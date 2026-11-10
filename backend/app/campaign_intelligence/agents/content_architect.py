from __future__ import annotations

import logging
import time
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any

from pydantic import BaseModel, Field

from app.campaign_intelligence.orchestration.state import CampaignState
from app.campaign_intelligence.schemas.brand import BrandContext, ContractQuota
from app.campaign_intelligence.schemas.campaign import CampaignBrief
from app.campaign_intelligence.schemas.deliverables import (
    CarouselSlide,
    DeliverablePlan,
    ReelScene,
)
from app.campaign_intelligence.schemas.strategy import CampaignStrategy
from app.campaign_intelligence.schemas.trace import AgentTelemetry
from app.campaign_intelligence.tools.date_utils import extract_format_and_count_from_text
from app.core.config import settings
from app.core.llm import invoke_structured_llm

logger = logging.getLogger(__name__)


class ContentArchitectOutput(BaseModel):
    """Structured container for the complete set of planned deliverables."""
    deliverables: list[DeliverablePlan] = Field(
        min_length=1,
        description="List of granular, production-ready deliverable plans matching contract quotas"
    )


class ContentArchitectAgent:
    """
    Agent 5: Content Architect
    
    Responsibilities:
    1. Translate the CampaignStrategy into concrete, polymorphic deliverable plans.
    2. Strictly conform to ContractQuota limits (deliverable counts per type and platform).
    3. Produce format-specific production architectures:
       - Reels: Timestamped director action, on-screen text, spoken dialogue, B-roll notes.
       - Carousels: Slide-by-slide headlines, body copy, and visual layout prompts.
       - Static: Visual prompts, graphic copy, and concise CTAs.
    4. Adhere rigidly to brand tone boundaries and zero prohibited terms.
    5. Return pure data plans (NEVER perform premature database insertions).
    """

    def __init__(self, model_name: str | None = None, temperature: float = 0.3):
        self.model_name = model_name or settings.FALLBACK_MODEL
        self.temperature = temperature

    async def run(
        self,
        strategy: CampaignStrategy,
        brief: CampaignBrief,
        brand_context: BrandContext | None = None,
        revision_instructions: list[str] | None = None,
    ) -> list[DeliverablePlan]:
        """
        Generate the production-ready deliverable plans.
        """
        # 1. Determine target deliverable quotas & format preferences
        quotas: list[ContractQuota] = []
        if brand_context and brand_context.contract_quotas:
            quotas = brand_context.contract_quotas

        inferred_fmts, inferred_cnt = extract_format_and_count_from_text(
            f"{brief.custom_brief or ''} {brief.objective or ''}"
        )
        active_formats = [f.lower() for f in (inferred_fmts or brief.deliverable_preferences or [])]

        is_date_bounded = bool(brief.start_date and brief.end_date and brief.duration_days)
        explicit_count_requested = bool(inferred_cnt or (brief.duration_days and is_date_bounded))
        sprint_days = brief.duration_days or inferred_cnt or 1

        # Formats cycle: strictly prioritize user format preferences if specified
        if active_formats:
            formats_cycle = active_formats
        elif brand_context and brand_context.contract_quotas:
            formats_cycle = [q.deliverable_type.lower() for q in brand_context.contract_quotas]
        else:
            formats_cycle = ["reel", "carousel", "static"]

        # Platforms cycle
        if brief.platforms:
            platforms_cycle = [p.lower() for p in brief.platforms]
        else:
            platforms_cycle = ["instagram", "facebook"]

        target_specs: list[str] = []
        total_quota_count = 0

        # Branch A: Specific date-bounded sprint OR explicit count requested (e.g. "give me 3 reel ideas")
        if is_date_bounded or explicit_count_requested:
            total_quota_count = sprint_days
            day_schedule_lines: list[str] = []
            curr_date = datetime.now(timezone.utc).date()
            start_base = brief.start_date or curr_date
            for d_idx in range(sprint_days):
                d_date = start_base + timedelta(days=d_idx)
                d_num = d_idx + 1
                d_format = formats_cycle[d_idx % len(formats_cycle)]
                d_platform = platforms_cycle[d_idx % len(platforms_cycle)]
                target_specs.append(f"- Day {d_num} ({d_date.strftime('%a, %b %d')}): 1x {d_format.upper()} on {d_platform.upper()}")
                day_schedule_lines.append(
                    f"  * Day {d_num} ({d_date.strftime('%a, %b %d, %Y')}): 1x {d_format.upper()} with planned_day={d_num}, scheduled_date='{d_date.isoformat()}'"
                )

            end_base = brief.end_date or (start_base + timedelta(days=sprint_days - 1))
            timeline_instruction = (
                f"\n### MANDATORY DAILY SPRINT SCHEDULE ({sprint_days} DAYS: {start_base.isoformat()} TO {end_base.isoformat()}):\n"
                f"You MUST architect distinct deliverables distributed across EVERY DAY of this sprint.\n"
                f"Schedule:\n" + "\n".join(day_schedule_lines) + "\n"
                f"CRITICAL: You MUST output EXACTLY {sprint_days} deliverable plans in the `deliverables` list (one deliverable per day for Day 1 through Day {sprint_days}).\n"
            )
            pacing_instruction = f"Generate EXACTLY {total_quota_count} deliverable plans mapped sequentially across Day 1 to Day {sprint_days} ({start_base} to {end_base}). Every calendar day in the sprint must have its own deliverable!"
        elif quotas:
            for q in quotas:
                target_specs.append(f"- {q.monthly_quantity}x {q.deliverable_type.upper()} on {q.platform.upper()}")
                total_quota_count += q.monthly_quantity
            timeline_instruction = ""
            pacing_instruction = f"Generate all {total_quota_count} deliverable plans spread across Weeks 1 to 4 with sequential planned_day numbers."
        elif active_formats:
            for pref in active_formats:
                target_specs.append(f"- 2x {pref.upper()} across target platforms")
                total_quota_count += 2
            timeline_instruction = ""
            pacing_instruction = f"Generate all {total_quota_count} deliverable plans spread across Weeks 1 to 4 with sequential planned_day numbers."
        else:
            target_specs = ["- 4x CAROUSEL on LINKEDIN", "- 2x REEL on INSTAGRAM"]
            total_quota_count = 6
            timeline_instruction = ""
            pacing_instruction = f"Generate all {total_quota_count} deliverable plans spread across Weeks 1 to 4 with sequential planned_day numbers."

        # 2. Extract Strategic Angles & Messaging Pillars
        angles_text = "\n".join([f"  * Angle: '{a.angle_name}' (Pillar: {a.aligned_content_pillar}) -> {a.rationale}" for a in strategy.strategic_angles])
        pillars_text = "\n".join([f"  * {p.pillar_name}: '{p.core_message}' (CTA: {p.primary_call_to_action})" for p in strategy.messaging_pillars])

        # 3. Tone Guardrails & Verified Offers
        tone_do = "; ".join(brand_context.tone_guidelines.do) if brand_context and brand_context.tone_guidelines.do else "Professional, clear"
        tone_dont = "; ".join(brand_context.tone_guidelines.dont) if brand_context and brand_context.tone_guidelines.dont else "Hype, unsubstantiated claims"
        prohibited = ", ".join([pt.term for pt in brand_context.prohibited_terms]) if brand_context and brand_context.prohibited_terms else "None"
        offers_text = ", ".join([o.name for o in brand_context.verified_offers]) if brand_context and brand_context.verified_offers else "Standard Services"

        revision_section = ""
        if revision_instructions:
            rev_items = "\n".join([f"  ! {item}" for item in revision_instructions])
            revision_section = f"\n### MANDATORY QUALITY REVISION INSTRUCTIONS (PREVIOUS DRAFT REJECTED):\n{rev_items}\nYou MUST strictly correct all of the above issues in this regenerated plan!\n"

        # 4. Construct Prompt for Content Architect
        prompt = f"""You are the Content Architect Agent for AgencyOS.
Your job is to convert the approved Campaign Strategy into production-ready social media deliverables.
{revision_section}
### CAMPAIGN STRATEGY & THEME
- Campaign Theme: {strategy.campaign_theme}
- Primary Objective: {strategy.primary_objective}
- Pacing: {strategy.pacing_and_cadence}
{timeline_instruction}
Strategic Angles:
{angles_text}

Messaging Pillars:
{pillars_text}

### BRAND GUARDRAILS & OFFERS
- Verified Offers: {offers_text}
- Prescribed Tone (DO): {tone_do}
- Proscribed Tone (DONT): {tone_dont}
- FORBIDDEN TERMS (NEVER USE): {prohibited}

### REQUIRED DELIVERABLE TARGETS (Strict Quotas)
{chr(10).join(target_specs)}
Total Deliverables to generate: EXACTLY {total_quota_count}

### PRODUCTION REQUIREMENTS PER FORMAT:
1. REELS:
   - Must include 2-3 hook_options and 1 primary_hook (focused on 0-3s retention).
   - Must include 3-5 timestamped 'reel_scenes' (e.g. 0:00-0:03, 0:03-0:10, etc.) detailing director action, on_screen_text, spoken voiceover, and B-roll.
   - Include audio_track_guidance and production_notes.
2. CAROUSELS:
   - Must include 4-7 structured 'carousel_slides' (Slide 1: cover, Slides 2-5: content, Slide 6: takeaway/CTA).
   - Each slide must have a headline, body_copy, and visual_layout prompt.
   - Include primary_hook and full social caption.

{pacing_instruction}

3. STRICT LANGUAGE REQUIREMENT:
   - All deliverable hooks, titles, captions, scene descriptions, voiceovers, slide headlines, and body copy MUST be written exclusively in the English language. Never generate deliverable content in any other language.
"""

        # 5. Invoke Groq LLM
        output: ContentArchitectOutput = await invoke_structured_llm(
            prompt=prompt,
            schema_class=ContentArchitectOutput,
            temperature=self.temperature,
            model=self.model_name,
            max_tokens=4500,
        )

        # 6. Assign stable UUIDs, day distribution, scheduled dates, and link scope_item_ids
        deliverables = list(output.deliverables)
        for idx, d in enumerate(deliverables):
            if not d.deliverable_id:
                d.deliverable_id = uuid.uuid4()

            # Deterministic day & calendar date mapping
            if is_date_bounded and brief.start_date:
                # Distribute deliverables across the sprint days (Day 1, Day 2, Day 3, Day 4...)
                day_offset = (d.planned_day - 1) if (d.planned_day and 1 <= d.planned_day <= sprint_days) else (idx % sprint_days)
                assigned_day = day_offset + 1
                assigned_date = brief.start_date + timedelta(days=day_offset)
                d.planned_day = assigned_day
                d.scheduled_date = assigned_date.isoformat()
                d.date_label = assigned_date.strftime("%a, %b %d, %Y")
            elif not d.planned_day:
                d.planned_day = idx + 1

            # Match scope item id from brand quotas if available
            if quotas:
                for q in quotas:
                    if q.deliverable_type.lower() == d.deliverable_type.lower() and q.platform.lower() == d.platform.lower():
                        d.scope_item_id = q.scope_item_id
                        break

        # 7. Deterministic Sprint Completeness Guarantee:
        # If the LLM returned fewer deliverables than sprint_days (e.g. LLM generated 1 item for a 3-day sprint),
        # automatically synthesize high-fidelity deliverable plans for all missing days so every day has its own card!
        if (is_date_bounded or sprint_days > 1 or active_formats) and len(deliverables) < sprint_days:
            covered_days = {d.planned_day for d in deliverables if d.planned_day}
            curr_date = datetime.now(timezone.utc).date()
            start_base = brief.start_date or curr_date
            for day_idx in range(1, sprint_days + 1):
                if day_idx not in covered_days:
                    calc_dt = start_base + timedelta(days=day_idx - 1)
                    angle_idx = (day_idx - 1) % len(strategy.strategic_angles) if strategy.strategic_angles else 0
                    pillar_idx = (day_idx - 1) % len(strategy.messaging_pillars) if strategy.messaging_pillars else 0
                    angle = strategy.strategic_angles[angle_idx] if strategy.strategic_angles else None
                    pillar = strategy.messaging_pillars[pillar_idx] if strategy.messaging_pillars else None

                    d_type = formats_cycle[(day_idx - 1) % len(formats_cycle)]
                    p_name = platforms_cycle[(day_idx - 1) % len(platforms_cycle)]
                    angle_name = angle.angle_name if angle else f"Day {day_idx} Showcase"
                    pillar_name = pillar.pillar_name if pillar else (angle.aligned_content_pillar if angle else "Brand Experience")
                    core_msg = pillar.core_message if pillar else strategy.campaign_theme
                    cta = pillar.primary_call_to_action if pillar else "Visit us today to experience the difference!"

                    synth_deliv = DeliverablePlan(
                        deliverable_id=uuid.uuid4(),
                        title=f"Day {day_idx}: {angle_name}",
                        deliverable_type=d_type,
                        platform=p_name,
                        planned_day=day_idx,
                        scheduled_date=calc_dt.isoformat(),
                        date_label=calc_dt.strftime("%a, %b %d, %Y"),
                        strategic_angle=angle_name,
                        hook_options=[
                            f"Day {day_idx}: Experience {strategy.campaign_theme}",
                            f"Why our {angle_name} is turning heads this week",
                        ],
                        primary_hook=f"Day {day_idx}: {core_msg}",
                        caption=(
                            f"Day {day_idx} of our {strategy.campaign_theme}! ✨\n\n"
                            f"{core_msg}\n\n"
                            f"Authentic flavours and memorable moments with zero hassle.\n\n"
                            f"👉 {cta}"
                        ),
                        hashtags=["#campaign", "#trending", "#viral", "#growth"],
                        call_to_action=cta,
                        carousel_slides=[
                            CarouselSlide(slide_number=1, headline=f"Day {day_idx}: {angle_name}", body_copy=core_msg, visual_layout="High-impact hero visual", slide_type="cover"),
                            CarouselSlide(slide_number=2, headline="The Experience", body_copy="Authentic preparation and unforgettable taste.", visual_layout="Split highlight diagram", slide_type="content"),
                            CarouselSlide(slide_number=3, headline="Join Us Today", body_copy=cta, visual_layout="Bold CTA banner", slide_type="cta"),
                        ] if d_type == "carousel" else [],
                        reel_scenes=[
                            ReelScene(scene_number=1, timestamp_range="0:00 - 0:03", visual_action="Quick cut hero hook shot", on_screen_text=f"Day {day_idx}: {core_msg}", spoken_audio_or_voiceover=core_msg, b_roll_notes="Warm lighting"),
                            ReelScene(scene_number=2, timestamp_range="0:03 - 0:08", visual_action="Fast-paced kitchen / product showcase", on_screen_text=angle_name, spoken_audio_or_voiceover=f"Here is how we bring {strategy.campaign_theme} to life.", b_roll_notes="Action montage"),
                            ReelScene(scene_number=3, timestamp_range="0:08 - 0:15", visual_action="Final table spread and logo outro", on_screen_text=cta, spoken_audio_or_voiceover=cta, b_roll_notes="Outro CTA screen"),
                        ] if d_type == "reel" else [],
                    )
                    deliverables.append(synth_deliv)

            # Sort deliverables sequentially by planned_day
            deliverables.sort(key=lambda d: d.planned_day or 0)

        return deliverables


async def content_architect_node(
    state: CampaignState,
) -> dict[str, Any]:
    """
    LangGraph node entry point for Content Architect Agent.
    
    1. Consumes campaign_strategy, brief, and brand_context.
    2. Executes ContentArchitectAgent.
    3. Records execution telemetry (AgentTelemetry).
    4. Writes exclusively to state["deliverable_plans"].
    """
    start_time = datetime.now(timezone.utc).isoformat()
    start_perf = time.perf_counter()
    agent_name = "content_architect"
    model_name = settings.FALLBACK_MODEL

    strategy = state.get("campaign_strategy")
    if not strategy:
        err_msg = "Content Architect failed: campaign_strategy is missing from state."
        logger.error(err_msg)
        return {
            "pipeline_agents_executed": [agent_name],
            "errors": [err_msg],
            "current_agent": agent_name,
        }

    try:
        agent = ContentArchitectAgent(model_name=model_name)
        quality_eval = state.get("quality_evaluation")
        rev_instructions = None
        if quality_eval and quality_eval.revision_instruction and quality_eval.revision_instruction.target_agent == "content_architect":
            rev_instructions = quality_eval.revision_instruction.instructions

        plans = await agent.run(
            strategy=strategy,
            brief=state["brief"],
            brand_context=state.get("brand_context"),
            revision_instructions=rev_instructions,
        )

        duration_ms = (time.perf_counter() - start_perf) * 1000.0
        end_time = datetime.now(timezone.utc).isoformat()

        telemetry = AgentTelemetry(
            agent_name=agent_name,
            start_time=start_time,
            end_time=end_time,
            duration_ms=duration_ms,
            model_name=model_name,
            success=True,
        )

        return {
            "deliverable_plans": plans,
            "pipeline_agents_executed": [agent_name],
            "agent_traces": [telemetry],
            "current_agent": agent_name,
        }

    except Exception as e:
        duration_ms = (time.perf_counter() - start_perf) * 1000.0
        end_time = datetime.now(timezone.utc).isoformat()
        err_msg = f"Content Architect failed: {str(e)}"
        logger.error(err_msg, exc_info=True)

        telemetry = AgentTelemetry(
            agent_name=agent_name,
            start_time=start_time,
            end_time=end_time,
            duration_ms=duration_ms,
            model_name=model_name,
            success=False,
            error_message=str(e),
        )

        return {
            "pipeline_agents_executed": [agent_name],
            "agent_traces": [telemetry],
            "errors": [err_msg],
            "current_agent": agent_name,
        }

