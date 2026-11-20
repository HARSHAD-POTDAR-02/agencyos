from __future__ import annotations

import logging
import time
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any

from pydantic import BaseModel, Field

from app.campaign_intelligence.agents.campaign_strategist import reconcile_and_pad_slots
from app.campaign_intelligence.orchestration.state import CampaignState
from app.campaign_intelligence.schemas.brand import BrandContext, ContractQuota
from app.campaign_intelligence.schemas.campaign import CampaignBrief
from app.campaign_intelligence.schemas.deliverables import (
    CarouselSlide,
    DeliverablePlan,
    ReelScene,
)
from app.campaign_intelligence.schemas.strategy import CampaignStrategy, DeliverableSlot
from app.campaign_intelligence.schemas.quality import QualityFinding
from app.campaign_intelligence.schemas.trace import AgentTelemetry
from app.campaign_intelligence.tools.date_utils import (
    extract_format_and_count_from_text,
    extract_reel_duration_from_text,
)
from app.core.config import settings
from app.core.llm import invoke_structured_llm

logger = logging.getLogger(__name__)


class MicroBatchOutput(BaseModel):
    """Container for a micro-batch of up to 2 deliverable plans."""
    deliverables: list[DeliverablePlan] = Field(
        min_length=1,
        description="Batch of up to 2 high-density, production-ready deliverable plans",
    )


class ContentArchitectOutput(BaseModel):
    """Structured container for the complete set of planned deliverables."""
    deliverables: list[DeliverablePlan] = Field(
        min_length=1,
        description="List of granular, production-ready deliverable plans matching contract quotas",
    )


class ContentArchitectAgent:
    """
    Agent 5: Content Architect
    
    Responsibilities:
    1. Translate the CampaignStrategy into concrete, polymorphic deliverable plans.
    2. Execute chunked micro-batching (at most 2 slots per LLM call, max_tokens=4096).
    3. Maintain cross-batch anti-repetition memory (opening visual, hook, CTA).
    4. Calibrate spoken voiceover to 2.2–2.8 words/second (generation target).
    5. Enforce 15–60s sequential non-overlapping Reel timestamps and 5–8 slide Carousels.
    6. Ground proof in verified facts or emit [CLIENT_INPUT_NEEDED: <fact>].
    7. Eradicate all boilerplate fallback copy (no fake templates on failure).
    8. Support targeted partial repair (repair_deliverables).
    """

    def __init__(self, model_name: str | None = None, temperature: float = 0.70):
        self.model_name = model_name or settings.CAMPAIGN_CONTENT_MODEL
        self.temperature = temperature

    async def _generate_micro_batch(
        self,
        batch_slots: list[DeliverableSlot],
        strategy: CampaignStrategy,
        brief: CampaignBrief,
        brand_context: BrandContext | None,
        previously_generated_summary: list[dict[str, Any]],
        revision_instructions: list[str] | None = None,
    ) -> list[DeliverablePlan]:
        """
        Generate a micro-batch of at most 2 deliverables for the given DeliverableSlots.
        """
        # Format brand guardrails and tone
        tone_do = "; ".join(brand_context.tone_guidelines.do) if brand_context and brand_context.tone_guidelines.do else "Professional, clear"
        tone_dont = "; ".join(brand_context.tone_guidelines.dont) if brand_context and brand_context.tone_guidelines.dont else "Hype, unsubstantiated claims"
        prohibited_terms = ", ".join([pt.term for pt in brand_context.prohibited_terms]) if brand_context and brand_context.prohibited_terms else "None"
        offers_text = ", ".join([o.name for o in brand_context.verified_offers]) if brand_context and brand_context.verified_offers else "Standard Services"
        factual_boundaries = brand_context.get_factual_boundary_prompt() if brand_context else ""

        # Format hero entities
        pinned = brief.pinned_entities or []
        hero_section = ""
        if pinned:
            hero_section = (
                f"\n### MANDATORY HERO OFFERINGS / PINNED CORE ENTITIES:\n"
                f"Feature signature offerings: {', '.join(pinned)}.\n"
                f"Prominently designate `hero_entity` and include in `hero_focus` on relevant scenes/slides.\n"
            )

        # Cross-Batch Anti-Repetition Memory
        memory_section = ""
        if previously_generated_summary:
            mem_items = []
            for item in previously_generated_summary:
                mem_items.append(
                    f"  * Slot {item['slot_index']} (Day {item['planned_day']}, {item.get('hook_category', 'general')}): "
                    f"Hook='{item['primary_hook']}' | Visual='{item['opening_visual']}' | CTA='{item['call_to_action']}'"
                )
            memory_section = (
                f"\n### CROSS-BATCH ANTI-REPETITION MEMORY (DO NOT REPEAT):\n"
                f"The following deliverables were already created in earlier batches for this campaign:\n"
                + "\n".join(mem_items) + "\n"
                f"STRICT DIRECTIVE: You MUST NOT reuse the same opening hook phrasing, visual camera framing, "
                f"or call-to-action structure as the previously generated deliverables above! "
                f"Each deliverable MUST feel distinctly authored with fresh creative angles.\n"
            )

        # Revision Instructions if repairing
        revision_section = ""
        if revision_instructions:
            rev_items = "\n".join([f"  ! {item}" for item in revision_instructions])
            revision_section = (
                f"\n### TARGETED QUALITY REPAIR INSTRUCTIONS:\n{rev_items}\n"
                f"You MUST strictly fix every flagged issue for the deliverables in this batch!\n"
            )

        # Build detailed slot instructions
        slot_blocks = []
        for s in batch_slots:
            proof_guidance = (
                f"MANDATORY: No verified case studies/metrics exist for this slot! You MUST emit '[CLIENT_INPUT_NEEDED: <exact missing proof or testimonial>]' instead of fabricating numbers, percentages, or quotes!"
                if s.allowed_proof_points == ["NONE_USE_PLACEHOLDER"]
                else f"Allowed verified proof points: {', '.join(s.allowed_proof_points)}"
            )
            buyer_lang = f"Verbatim buyer voice: {', '.join(f'\"{b}\"' for b in s.buyer_language_refs)}" if s.buyer_language_refs else "Tone: Authentic voice of customer"
            constraints = f"Negative boundaries: {'; '.join(s.factual_boundary_constraints)}" if s.factual_boundary_constraints else "None"

            slot_blocks.append(
                f"- TARGET SLOT {s.slot_index} (Sprint Day {s.planned_day}):\n"
                f"  * Format: {s.deliverable_type.upper()} on {s.target_platform.upper()}\n"
                f"  * Funnel Stage: {s.funnel_stage}\n"
                f"  * Target Persona: {s.target_persona}\n"
                f"  * Hook Category: {s.hook_category}\n"
                f"  * Strategic Angle: {s.strategic_angle_ref}\n"
                f"  * Core Message: {s.core_message}\n"
                f"  * Proof Grounding: {proof_guidance}\n"
                f"  * Voice of Customer: {buyer_lang}\n"
                f"  * Constraints: {constraints}\n"
                f"  * Deliverable title, slot_index={s.slot_index}, planned_day={s.planned_day} MUST be explicitly populated."
            )

        slots_prompt = "\n\n".join(slot_blocks)

        prompt = f"""You are the Lead Creative Director and Content Architect for AgencyOS.
Your task is to generate high-density, production-ready deliverable plans for EXACTLY {len(batch_slots)} slots:

{revision_section}
### CAMPAIGN STRATEGY
- Campaign Theme: {strategy.campaign_theme}
- Strategic Thesis: {strategy.strategic_thesis or 'Brand differentiation through authentic proof'}
- Audience Core Tension: {strategy.core_tension or 'Addressing unsaid psychological friction'}
- Primary Objective: {strategy.primary_objective}
- Client Brief Notes: {brief.custom_brief or 'None specified'}

{factual_boundaries}

### BRAND GUARDRAILS & TONE
- Verified Offers: {offers_text}
- Prescribed Tone (DO): {tone_do}
- Proscribed Tone (DONT): {tone_dont}
- FORBIDDEN TERMS (NEVER USE): {prohibited_terms}
{hero_section}
{memory_section}
### TARGET SLOTS FOR THIS BATCH (Generate EXACTLY {len(batch_slots)} DeliverablePlans):
{slots_prompt}

### PRODUCTION REQUIREMENTS PER FORMAT:

1. REELS (15–60 Seconds Total Duration):
   - Primary Hook (0-3s): High tension, physical pattern interrupt (prop, movement, angle) + spoken opening line.
   - Pacing & Spoken Cadence: Voiceover MUST be calibrated to 2.2–2.8 spoken words per second.
     * 3-second hook: 6–8 words
     * 8-second breakdown: 18–22 words
     * 12-second demonstration: 26–33 words
   - Storyboards (`reel_scenes`): 4 to 6 timestamped scenes with STRICTLY sequential, non-overlapping timestamps:
     (e.g., 0:00-0:03 Hook, 0:03-0:10 Mechanism, 0:10-0:22 Demo, 0:22-0:35 Proof, 0:35-0:45 CTA).
     * visual_action: Camera angle, talent movement, physical lighting/environment cues (physically filmable!).
     * spoken_audio_or_voiceover: Authentic spoken dialogue matching word-per-second constraints.
     * on_screen_text: Exact graphic overlay text.
     * b_roll_notes: Specific cutaway footage.
   - audio_track_guidance: Specific genre, pacing, and sound effects (SFX) cues.
   - call_to_action: Linked directly to a verified client offer or consultation.

2. CAROUSELS (5 to 8 Slides Target):
   - Slide 1: High-retention cover with bold visual layout and thumb-stop headline.
   - Slides 2 to N-1: Sequential value/framework/breakdown slides with scannable body copy and clear visual_layout specs.
   - Final Slide: Concrete call-to-action slide.
   - Complete social caption with verified CTA.

3. PROOF GROUNDING & PLACEHOLDERS:
   - When a slot has no verified proof points or mentions NONE_USE_PLACEHOLDER, emit [CLIENT_INPUT_NEEDED: <exact missing fact>] instead of fabricating metrics!

4. ANTI-CLICHÉ PROHIBITIONS (STRICT):
   - NEVER use marketing slop: "delve", "game-changer", "unleash", "revolutionize", "elevate", "in today's fast-paced world", "skyrocket", "supercharge", "dive into", "unlock your potential", "look no further", "secret sauce".

5. STRICT ENGLISH REQUIREMENT:
   - All text, voiceover scripts, captions, and slide copy MUST be written exclusively in English.
"""

        # Execute structured LLM call with retry failover
        attempts = 0
        last_err: Exception | None = None
        while attempts < 2:
            attempts += 1
            try:
                batch_output: MicroBatchOutput = await invoke_structured_llm(
                    prompt=prompt,
                    schema_class=MicroBatchOutput,
                    temperature=self.temperature,
                    model=self.model_name,
                    max_tokens=4096,
                )
                deliverables = list(batch_output.deliverables)
                if deliverables:
                    return deliverables
            except Exception as e:
                last_err = e
                logger.warning(
                    f"Micro-batch generation attempt {attempts} failed for slots {[s.slot_index for s in batch_slots]}: {e}. "
                    f"{'Retrying once...' if attempts < 2 else 'Raising error.'}"
                )
                time.sleep(1.0)

        raise RuntimeError(
            f"Content Architect micro-batch generation failed for slots {[s.slot_index for s in batch_slots]} "
            f"after {attempts} attempts: {last_err}"
        )

    async def run(
        self,
        strategy: CampaignStrategy,
        brief: CampaignBrief,
        brand_context: BrandContext | None = None,
        revision_instructions: list[str] | None = None,
    ) -> list[DeliverablePlan]:
        """
        Generate production-ready deliverable plans using 2-deliverable micro-batching.
        """
        # Ensure strategy has deliverable_slots populated
        slots = list(strategy.deliverable_slots or [])
        if not slots:
            strategy = reconcile_and_pad_slots(
                strategy=strategy,
                brief=brief,
                brand_context=brand_context,
                market_research=None,
                performance_playbook=None,
            )
            slots = list(strategy.deliverable_slots or [])

        quotas: list[ContractQuota] = brand_context.contract_quotas if brand_context and brand_context.contract_quotas else []
        pinned = brief.pinned_entities or []

        # Chunk slots into micro-batches of at most 2 slots
        batch_size = 2
        slot_chunks = [slots[i:i + batch_size] for i in range(0, len(slots), batch_size)]

        all_deliverables: list[DeliverablePlan] = []
        previously_generated_summary: list[dict[str, Any]] = []

        for chunk_idx, batch_slots in enumerate(slot_chunks):
            logger.info(
                f"Executing Content Architect micro-batch {chunk_idx + 1}/{len(slot_chunks)} "
                f"(slots {[s.slot_index for s in batch_slots]})"
            )

            batch_delivs = await self._generate_micro_batch(
                batch_slots=batch_slots,
                strategy=strategy,
                brief=brief,
                brand_context=brand_context,
                previously_generated_summary=previously_generated_summary,
                revision_instructions=revision_instructions,
            )

            # Reconcile each deliverable with its source DeliverableSlot
            for i, slot in enumerate(batch_slots):
                raw_d = batch_delivs[i] if i < len(batch_delivs) else batch_delivs[-1]
                d = raw_d.model_copy(deep=True)
                if not d.deliverable_id:
                    d.deliverable_id = uuid.uuid4()

                d.slot_index = slot.slot_index
                d.planned_day = slot.planned_day
                d.deliverable_type = slot.deliverable_type
                d.platform = slot.target_platform
                d.strategic_angle = slot.strategic_angle_ref
                d.hook_category = slot.hook_category
                d.allowed_proof_points = slot.allowed_proof_points
                d.factual_boundary_constraints = slot.factual_boundary_constraints
                d.planned_week = min(5, max(1, (slot.planned_day - 1) // 7 + 1))

                # Scheduled date calculation if brief has start_date
                if brief.start_date:
                    calc_date = brief.start_date + timedelta(days=max(0, slot.planned_day - 1))
                    d.scheduled_date = calc_date.isoformat()
                    d.date_label = calc_date.strftime("%a, %b %d, %Y")

                # Match contract scope item id
                if quotas:
                    for q in quotas:
                        if q.deliverable_type.lower() == d.deliverable_type.lower() and q.platform.lower() == d.platform.lower():
                            d.scope_item_id = q.scope_item_id
                            break

                # Hero entity mapping
                if pinned:
                    if not d.hero_entity:
                        combined_text = f"{d.title} {d.caption} {d.primary_hook}".lower()
                        matched = [p for p in pinned if p.lower() in combined_text]
                        d.hero_entity = matched[0] if matched else pinned[slot.slot_index % len(pinned)]
                    if not d.hero_focus:
                        d.hero_focus = [d.hero_entity]
                    if d.hero_entity and d.hero_entity.lower() not in d.title.lower():
                        d.title = f"{d.hero_entity}: {d.title}"

                # Record in cross-batch memory
                opening_visual = ""
                if d.deliverable_type == "reel" and d.reel_scenes:
                    opening_visual = d.reel_scenes[0].visual_action
                elif d.deliverable_type == "carousel" and d.carousel_slides:
                    opening_visual = d.carousel_slides[0].visual_layout
                elif d.visual_asset_prompt or d.graphic_copy:
                    opening_visual = d.visual_asset_prompt or d.graphic_copy or ""

                previously_generated_summary.append({
                    "slot_index": d.slot_index,
                    "planned_day": d.planned_day,
                    "primary_hook": d.primary_hook,
                    "hook_category": slot.hook_category,
                    "opening_visual": opening_visual[:160],
                    "call_to_action": d.call_to_action,
                })

                all_deliverables.append(d)

        all_deliverables.sort(key=lambda x: x.slot_index)
        return all_deliverables

    async def repair_deliverables(
        self,
        existing_deliverables: list[DeliverablePlan],
        failing_indices: list[int],
        findings: list[Any],
        strategy: CampaignStrategy,
        brand_context: BrandContext | None = None,
        brief: CampaignBrief | None = None,
    ) -> list[DeliverablePlan]:
        """
        Targeted repair of failing deliverables:
        - Only regenerates deliverables at failing_indices.
        - Preserves passing deliverables untouched.
        - Merges repaired deliverables back into the full plan keyed by slot_index.
        """
        if not failing_indices:
            return existing_deliverables

        slots = list(strategy.deliverable_slots or [])
        slots_by_index = {s.slot_index: s for s in slots}

        # Filter slots to only those failing
        failing_slots = [slots_by_index[idx] for idx in failing_indices if idx in slots_by_index]
        if not failing_slots:
            return existing_deliverables

        # Group findings into revision instructions
        rev_instructions: list[str] = []
        for finding in findings:
            desc = getattr(finding, "description", str(finding))
            d_idx = getattr(finding, "deliverable_index", None)
            prefix = f"[Deliverable #{d_idx}] " if d_idx is not None else ""
            rev_instructions.append(f"{prefix}{desc}")

        # Chunk failing slots into batches of at most 2
        batch_size = 2
        failing_chunks = [failing_slots[i:i + batch_size] for i in range(0, len(failing_slots), batch_size)]

        # Prepare summary of passing deliverables for anti-repetition memory
        passing_summary: list[dict[str, Any]] = []
        for d in existing_deliverables:
            if d.slot_index not in failing_indices:
                opening_visual = ""
                if d.deliverable_type == "reel" and d.reel_scenes:
                    opening_visual = d.reel_scenes[0].visual_action
                elif d.deliverable_type == "carousel" and d.carousel_slides:
                    opening_visual = d.carousel_slides[0].visual_layout
                passing_summary.append({
                    "slot_index": d.slot_index,
                    "planned_day": d.planned_day,
                    "primary_hook": d.primary_hook,
                    "hook_category": d.hook_category,
                    "opening_visual": opening_visual[:160],
                    "call_to_action": d.call_to_action,
                })

        repaired_deliverables: list[DeliverablePlan] = []

        for chunk in failing_chunks:
            batch_delivs = await self._generate_micro_batch(
                batch_slots=chunk,
                strategy=strategy,
                brief=brief or CampaignBrief(
                    client_id=uuid.uuid4(),
                    agency_id=uuid.uuid4(),
                    period_month=11,
                    period_year=2026,
                    objective=strategy.primary_objective,
                ),
                brand_context=brand_context,
                previously_generated_summary=passing_summary,
                revision_instructions=rev_instructions,
            )

            for i, slot in enumerate(chunk):
                raw_d = batch_delivs[i] if i < len(batch_delivs) else batch_delivs[-1]
                d = raw_d.model_copy(deep=True)
                d.slot_index = slot.slot_index
                d.planned_day = slot.planned_day
                d.deliverable_type = slot.deliverable_type
                d.platform = slot.target_platform
                d.strategic_angle = slot.strategic_angle_ref
                d.hook_category = slot.hook_category
                d.allowed_proof_points = slot.allowed_proof_points
                d.factual_boundary_constraints = slot.factual_boundary_constraints
                repaired_deliverables.append(d)

        # Merge repaired deliverables back into existing_deliverables keyed by slot_index
        merged_map: dict[int, DeliverablePlan] = {d.slot_index: d for d in existing_deliverables}
        for rd in repaired_deliverables:
            merged_map[rd.slot_index] = rd

        merged_list = [merged_map[k] for k in sorted(merged_map.keys())]
        return merged_list


async def content_architect_node(
    state: CampaignState,
) -> dict[str, Any]:
    """
    LangGraph node entry point for Content Architect Agent.
    
    1. Consumes campaign_strategy, brief, and brand_context.
    2. Executes ContentArchitectAgent with micro-batching.
    3. Records execution telemetry (AgentTelemetry).
    4. Writes exclusively to state["deliverable_plans"].
    """
    start_time = datetime.now(timezone.utc).isoformat()
    start_perf = time.perf_counter()
    agent_name = "content_architect"
    model_name = settings.CAMPAIGN_CONTENT_MODEL

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
        failing_indices = getattr(quality_eval, "failing_deliverable_indices", None) if quality_eval else None

        existing_plans = state.get("deliverable_plans")

        if existing_plans and failing_indices:
            # Selective repair path
            findings = getattr(quality_eval, "findings", []) if quality_eval else []
            logger.info(f"Triggering selective repair for failing deliverable indices: {failing_indices}")
            plans = await agent.repair_deliverables(
                existing_deliverables=existing_plans,
                failing_indices=failing_indices,
                findings=findings,
                strategy=strategy,
                brand_context=state.get("brand_context"),
                brief=state.get("brief"),
            )
        else:
            # Full micro-batch generation path
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
    model_name = settings.CAMPAIGN_CONTENT_MODEL

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

        existing_plans = state.get("deliverable_plans") or []
        failing_indices = getattr(quality_eval, "failing_deliverable_indices", []) if quality_eval else []

        if existing_plans and failing_indices and quality_eval and quality_eval.revision_required:
            plans = await agent.repair_deliverables(
                existing_deliverables=existing_plans,
                failing_indices=failing_indices,
                findings=quality_eval.findings if quality_eval else [],
                strategy=strategy,
                brand_context=state.get("brand_context"),
            )
        else:
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

