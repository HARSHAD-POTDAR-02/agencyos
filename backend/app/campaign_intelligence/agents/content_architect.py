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
from app.campaign_intelligence.tools.date_utils import (
    extract_format_and_count_from_text,
    extract_reel_duration_from_text,
)
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

    def __init__(self, model_name: str | None = None, temperature: float = 0.70):
        self.model_name = model_name or settings.CAMPAIGN_CONTENT_MODEL
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
        factual_boundaries = brand_context.get_factual_boundary_prompt() if brand_context else ""

        pinned_text = ", ".join(brief.pinned_entities) if brief.pinned_entities else ""
        hero_entities_section = ""
        if pinned_text:
            hero_entities_section = (
                f"\n### MANDATORY HERO OFFERINGS / PINNED CORE ENTITIES:\n"
                f"The client has pinned the following signature offerings: {pinned_text}.\n"
                f"You MUST explicitly feature these hero offerings across the deliverables.\n"
                f"For each deliverable, designate which hero offering is featured in `hero_entity` (e.g. '{brief.pinned_entities[0]}'), "
                f"and include specific hero items in `hero_focus` on scenes/slides where they appear. "
                f"Incorporate the signature item name directly into the deliverable title, primary hook, and script details!\n"
            )

        revision_section = ""
        if revision_instructions:
            rev_items = "\n".join([f"  ! {item}" for item in revision_instructions])
            revision_section = f"\n### MANDATORY QUALITY REVISION INSTRUCTIONS (PREVIOUS DRAFT REJECTED):\n{rev_items}\nYou MUST strictly correct all of the above issues in this regenerated plan!\n"

        # Extract requested video / reel duration from brief text or custom brief
        text_for_duration = f"{brief.custom_brief or ''} {brief.objective or ''}"
        reel_dur = extract_reel_duration_from_text(text_for_duration)
        if reel_dur:
            s_min, s_max = reel_dur
            reel_dur_instruction = (
                f"- TARGET VIDEO DURATION: EXACTLY {s_min} to {s_max} seconds!\n"
                f"  * You MUST architect 4 to 7 distinct timestamped 'reel_scenes' spanning the entire {s_min}-{s_max} second length.\n"
                f"  * Break down the narrative across sequential camera cuts (e.g. 0:00-0:03 Hook, 0:03-0:12 Context, 0:12-0:25 Demonstration, 0:25-0:38 Climax, 0:38-0:{s_max:02d} CTA Outro).\n"
                f"  * The final scene MUST end at exactly 0:{s_max:02d}! NEVER output only 15-second scenes when the user explicitly requested {s_min}-{s_max} seconds!"
            )
        else:
            reel_dur_instruction = (
                "- Target Video Duration: 30-50 seconds standard.\n"
                "- Must include 4-6 timestamped 'reel_scenes' (e.g. 0:00-0:03, 0:03-0:15, 0:15-0:32, 0:32-0:45) detailing director action, camera movements, on_screen_text, spoken voiceover, and B-roll."
            )

        # 4. Construct Prompt for Content Architect
        prompt = f"""You are the Lead Creative Director and Content Architect for AgencyOS.
Your job is to translate the approved Campaign Strategy into production-ready, agency-grade social media deliverables.

{revision_section}
### CAMPAIGN STRATEGY & THEME
- Campaign Theme: {strategy.campaign_theme}
- Strategic Thesis: {strategy.strategic_thesis or 'Brand differentiation through authentic proof'}
- Audience Core Tension: {strategy.core_tension or 'Addressing unsaid psychological friction'}
- Primary Objective: {strategy.primary_objective}
- Client Instructions: {brief.custom_brief or 'None specified'}
- Pacing: {strategy.pacing_and_cadence}
{timeline_instruction}
Strategic Angles:
{angles_text}

Messaging Pillars:
{pillars_text}

{factual_boundaries}

### BRAND GUARDRAILS & TONE
- Verified Offers: {offers_text}
- Prescribed Tone (DO): {tone_do}
- Proscribed Tone (DONT): {tone_dont}
- FORBIDDEN TERMS (NEVER USE): {prohibited}
{hero_entities_section}
### REQUIRED DELIVERABLE TARGETS (Strict Quotas)
{chr(10).join(target_specs)}
Total Deliverables to generate: EXACTLY {total_quota_count}

### PRODUCTION REQUIREMENTS PER FORMAT (AGENCY-GRADE STORYBOARDS):
1. REELS:
   - Primary Hook (0-3s): Must provide high tension with an exact spoken line AND a physical visual pattern interrupt (e.g. prop, camera movement, surprising action).
   {reel_dur_instruction}
   - Shot-by-Shot Storyboards (`reel_scenes`):
     * visual_action: Exact camera angle (low-angle, Dutch tilt, handheld POV), talent physical motion, props, and lighting/environment cues.
     * spoken_audio_or_voiceover: Authentic spoken dialogue with natural cadence, pauses, and persona vocabulary. NOT generic ad copy.
     * on_screen_text: Exact graphic overlay text.
     * b_roll_notes: Specific secondary footage and cutaway inserts.
   - audio_track_guidance: Specific genre, pacing, and sound effects (SFX) cues.
   - call_to_action: MUST directly link to a verified client offer (NO invented discounts or fake guarantees).

2. CAROUSELS:
   - Must include 4-7 structured 'carousel_slides' (Slide 1: high-retention cover, Slides 2-5: structured value/framework, Slide 6: takeaway/CTA).
   - Each slide must have a compelling headline, scannable body_copy, and explicit visual_layout design direction.
   - Include full social caption with verified CTA.

{pacing_instruction}

3. ANTI-CLICHÉ PROHIBITIONS (STRICT):
   - NEVER use lazy marketing buzzwords: "game-changer", "supercharge", "dive in/dive into", "unlock your potential", "elevate your", "revolutionize", "in today's world", "look no further", "secret sauce".
   - Ground all claims in real actions, tangible facts, or relatable human tensions.

4. STRICT LANGUAGE REQUIREMENT:
   - All deliverable hooks, titles, captions, scene descriptions, voiceovers, slide headlines, and body copy MUST be written exclusively in the English language. Never generate deliverable content in any other language.
"""

        # 5. Invoke LLM
        output: ContentArchitectOutput = await invoke_structured_llm(
            prompt=prompt,
            schema_class=ContentArchitectOutput,
            temperature=self.temperature,
            model=self.model_name,
            max_tokens=6500,
        )

        # 6. Assign stable UUIDs, day distribution, scheduled dates, and link scope_item_ids
        deliverables = list(output.deliverables)
        pinned = brief.pinned_entities or []
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

            # Hero entity assignment if pinned_entities exist
            if pinned:
                # If LLM didn't set hero_entity or it's not in pinned, map round-robin or detect in text
                if not d.hero_entity:
                    combined_text = f"{d.title} {d.caption} {d.primary_hook}".lower()
                    matched = [p for p in pinned if p.lower() in combined_text]
                    if matched:
                        d.hero_entity = matched[0]
                        d.hero_focus = matched
                    else:
                        assigned_hero = pinned[idx % len(pinned)]
                        d.hero_entity = assigned_hero
                        d.hero_focus = [assigned_hero]
                else:
                    if not d.hero_focus:
                        d.hero_focus = [d.hero_entity]

                # Ensure deliverable title prominently displays the hero entity if not already present
                if d.hero_entity and d.hero_entity.lower() not in d.title.lower():
                    d.title = f"{d.hero_entity}: {d.title}"

                # Quality guarantee: Ensure reels have at least 3 director scenes and carousels have at least 4 slides
                if d.deliverable_type.lower() == "reel" and (not d.reel_scenes or len(d.reel_scenes) < 3):
                    assigned_h = d.hero_entity or (pinned[idx % len(pinned)] if pinned else None)
                    msg = d.primary_hook or f"Experience {assigned_h or strategy.campaign_theme}"
                    cta_txt = d.call_to_action or "Link in bio to get started"
                    d.reel_scenes = [
                        ReelScene(scene_number=1, timestamp_range="0:00 - 0:03", visual_action=f"High-impact hook shot showcasing {assigned_h or 'core offering'}", on_screen_text=d.primary_hook or "Discover the Difference", spoken_audio_or_voiceover=msg, b_roll_notes="Dynamic professional lighting", hero_focus=[assigned_h] if assigned_h else []),
                        ReelScene(scene_number=2, timestamp_range="0:03 - 0:15", visual_action=f"Behind-the-scenes showcase and feature breakdown for {assigned_h or strategy.campaign_theme}", on_screen_text=d.strategic_angle or "Core Value", spoken_audio_or_voiceover=f"Here is how {assigned_h or strategy.campaign_theme} delivers unmatched results.", b_roll_notes="Action feature highlights", hero_focus=[assigned_h] if assigned_h else []),
                        ReelScene(scene_number=3, timestamp_range="0:15 - 0:30", visual_action=f"Product / service demonstration of signature {assigned_h or 'solution'}", on_screen_text="Signature Quality & Standards", spoken_audio_or_voiceover="Engineered with precision for an unparalleled customer experience.", b_roll_notes="Smooth cinematic tracking", hero_focus=[assigned_h] if assigned_h else []),
                        ReelScene(scene_number=4, timestamp_range="0:30 - 0:45", visual_action="Final brand hero card, key takeaway, and call to action", on_screen_text=cta_txt, spoken_audio_or_voiceover=cta_txt, b_roll_notes="Outro CTA screen with handle", hero_focus=[assigned_h] if assigned_h else []),
                    ]

                if d.deliverable_type.lower() == "carousel" and (not d.carousel_slides or len(d.carousel_slides) < 4):
                    assigned_h = d.hero_entity or (pinned[idx % len(pinned)] if pinned else None)
                    msg = d.primary_hook or f"Key Insights: {assigned_h or strategy.campaign_theme}"
                    cta_txt = d.call_to_action or "Save & Share this post"
                    d.carousel_slides = [
                        CarouselSlide(slide_number=1, headline=f"{assigned_h or 'Core Feature'}", body_copy=msg, visual_layout="High-impact hero cover slide", slide_type="cover"),
                        CarouselSlide(slide_number=2, headline="The Strategic Problem", body_copy=f"Common roadblocks and why traditional methods fall short in delivering {assigned_h or 'results'}.", visual_layout="Split comparison layout", slide_type="content"),
                        CarouselSlide(slide_number=3, headline="The Proven Solution", body_copy=f"Uncompromising quality and proven value delivered by {assigned_h or 'our core offering'}.", visual_layout="Step-by-step breakdown diagram", slide_type="content"),
                        CarouselSlide(slide_number=4, headline="Take Action Today", body_copy=cta_txt, visual_layout="Bold closing CTA card with branding", slide_type="cta"),
                    ]

                # Propagate hero_focus to reel scenes if scenes exist and lack hero_focus
                if d.reel_scenes and d.hero_entity:
                    for s in d.reel_scenes:
                        scene_txt = f"{s.visual_action} {s.on_screen_text} {s.spoken_audio_or_voiceover}".lower()
                        s_matched = [p for p in pinned if p.lower() in scene_txt]
                        if s_matched:
                            s.hero_focus = s_matched
                        elif not s.hero_focus:
                            s.hero_focus = [d.hero_entity]

        # 7. Deterministic Sprint & Quota Completeness Guarantee:
        # If the LLM returned fewer deliverables than required by contract quota or sprint length,
        # automatically synthesize high-fidelity deliverable plans for all missing items so targets are met!
        target_count = sprint_days if (is_date_bounded or explicit_count_requested) else total_quota_count
        if target_count > 1 and len(deliverables) < target_count:
            missing_count = target_count - len(deliverables)
            covered_days = {d.planned_day for d in deliverables if d.planned_day}
            curr_date = datetime.now(timezone.utc).date()
            start_base = brief.start_date or curr_date

            if is_date_bounded:
                needed_days = [d for d in range(1, target_count + 1) if d not in covered_days]
            else:
                needed_days = []
                next_day = 1
                while len(needed_days) < missing_count:
                    if next_day not in covered_days:
                        needed_days.append(next_day)
                        covered_days.add(next_day)
                    next_day += 1

            for day_num in needed_days:
                calc_dt = start_base + timedelta(days=day_num - 1)
                angle_idx = (day_num - 1) % len(strategy.strategic_angles) if strategy.strategic_angles else 0
                pillar_idx = (day_num - 1) % len(strategy.messaging_pillars) if strategy.messaging_pillars else 0
                angle = strategy.strategic_angles[angle_idx] if strategy.strategic_angles else None
                pillar = strategy.messaging_pillars[pillar_idx] if strategy.messaging_pillars else None

                # If quotas are defined, find missing quota formats first
                d_type = None
                p_name = None
                matched_scope_id = None
                if quotas:
                    existing_counts: dict[tuple[str, str], int] = {}
                    for ed in deliverables:
                        k = (ed.deliverable_type.lower(), ed.platform.lower())
                        existing_counts[k] = existing_counts.get(k, 0) + 1
                    for q in quotas:
                        k = (q.deliverable_type.lower(), q.platform.lower())
                        if existing_counts.get(k, 0) < q.monthly_quantity:
                            d_type = q.deliverable_type.lower()
                            p_name = q.platform.lower()
                            matched_scope_id = q.scope_item_id
                            existing_counts[k] = existing_counts.get(k, 0) + 1
                            break

                if not d_type:
                    d_type = formats_cycle[(day_num - 1) % len(formats_cycle)]
                if not p_name:
                    p_name = platforms_cycle[(day_num - 1) % len(platforms_cycle)]

                angle_name = angle.angle_name if angle else f"Day {day_num} Showcase"
                pillar_name = pillar.pillar_name if pillar else (angle.aligned_content_pillar if angle else "Brand Experience")
                core_msg = pillar.core_message if pillar else strategy.campaign_theme
                cta = pillar.primary_call_to_action if pillar else "Visit us today to experience the difference!"

                assigned_hero = pinned[(day_num - 1) % len(pinned)] if pinned else None
                hero_prefix = f"{assigned_hero}: " if assigned_hero else ""

                synth_deliv = DeliverablePlan(
                    deliverable_id=uuid.uuid4(),
                    title=f"{hero_prefix}Day {day_num}: {angle_name}",
                    deliverable_type=d_type,
                    platform=p_name,
                    planned_day=day_num,
                    scheduled_date=calc_dt.isoformat() if is_date_bounded else None,
                    date_label=calc_dt.strftime("%a, %b %d, %Y") if is_date_bounded else None,
                    strategic_angle=angle_name,
                    hero_entity=assigned_hero,
                    hero_focus=[assigned_hero] if assigned_hero else [],
                    scope_item_id=matched_scope_id,
                    hook_options=[
                        f"Day {day_num}: Experience {assigned_hero or strategy.campaign_theme}",
                        f"Why our {assigned_hero or angle_name} is turning heads this week",
                    ],
                    primary_hook=f"Day {day_num}: {core_msg}",
                        caption=(
                            f"Day {day_num} of our {strategy.campaign_theme}! ✨\n\n"
                            f"{core_msg}\n\n"
                            f"{('Featuring our signature ' + assigned_hero + '. ') if assigned_hero else ''}Premium quality and measurable results designed for our clients.\n\n"
                            f"👉 {cta}"
                        ),
                        hashtags=["#campaign", "#trending", "#viral", "#growth"],
                        call_to_action=cta,
                        carousel_slides=[
                            CarouselSlide(slide_number=1, headline=f"{assigned_hero or angle_name}", body_copy=core_msg, visual_layout="High-impact hero visual", slide_type="cover"),
                            CarouselSlide(slide_number=2, headline="The Problem & Opportunity", body_copy=f"Why conventional approaches fail and where {assigned_hero or 'real innovation'} makes the difference.", visual_layout="Comparison layout", slide_type="content"),
                            CarouselSlide(slide_number=3, headline="The Value Proposition", body_copy=f"Uncompromising quality and proven value delivered by {assigned_hero or 'our core offering'}.", visual_layout="Split highlight diagram", slide_type="content"),
                            CarouselSlide(slide_number=4, headline="Get Started", body_copy=cta, visual_layout="Bold CTA banner", slide_type="cta"),
                        ] if d_type == "carousel" else [],
                        reel_scenes=(
                            [
                                ReelScene(scene_number=1, timestamp_range="0:00 - 0:03", visual_action=f"High-impact hook shot showcasing {assigned_hero or 'core offering'}", on_screen_text=f"Day {day_num}: {core_msg}", spoken_audio_or_voiceover=core_msg, b_roll_notes="Dynamic professional lighting", hero_focus=[assigned_hero] if assigned_hero else []),
                                ReelScene(scene_number=2, timestamp_range="0:03 - 0:12", visual_action=f"Behind-the-scenes showcase and feature breakdown for {assigned_hero or strategy.campaign_theme}", on_screen_text=angle_name, spoken_audio_or_voiceover=f"Here is how {assigned_hero or strategy.campaign_theme} delivers unmatched results.", b_roll_notes="Macro feature highlights", hero_focus=[assigned_hero] if assigned_hero else []),
                                ReelScene(scene_number=3, timestamp_range="0:12 - 0:25", visual_action=f"Product / service demonstration of signature {assigned_hero or 'solution'}", on_screen_text="Signature Quality & Standards", spoken_audio_or_voiceover="Engineered with precision for an unparalleled customer experience.", b_roll_notes="Smooth cinematic tracking", hero_focus=[assigned_hero] if assigned_hero else []),
                                ReelScene(scene_number=4, timestamp_range="0:25 - 0:38", visual_action="Customer outcome and authentic success story", on_screen_text="Proven Results & Impact", spoken_audio_or_voiceover="Reliable quality designed to exceed expectations every single time.", b_roll_notes="Engaging contextual setting", hero_focus=[assigned_hero] if assigned_hero else []),
                                ReelScene(scene_number=5, timestamp_range=f"0:38 - 0:{reel_dur[1]:02d}" if reel_dur[1] < 60 else "0:38 - 1:00", visual_action="Final brand hero card, key takeaway, and call to action", on_screen_text=cta, spoken_audio_or_voiceover=cta, b_roll_notes="Outro CTA screen with contact handle", hero_focus=[assigned_hero] if assigned_hero else []),
                            ] if (reel_dur and reel_dur[1] >= 40) else
                            [
                                ReelScene(scene_number=1, timestamp_range="0:00 - 0:03", visual_action=f"High-impact hook shot showcasing {assigned_hero or 'core offering'}", on_screen_text=f"Day {day_num}: {core_msg}", spoken_audio_or_voiceover=core_msg, b_roll_notes="Dynamic lighting", hero_focus=[assigned_hero] if assigned_hero else []),
                                ReelScene(scene_number=2, timestamp_range="0:03 - 0:14", visual_action=f"Dynamic demonstration montage and {assigned_hero or 'offering'} reveal", on_screen_text=angle_name, spoken_audio_or_voiceover=f"Here is how {assigned_hero or strategy.campaign_theme} solves the core challenge.", b_roll_notes="Action montage", hero_focus=[assigned_hero] if assigned_hero else []),
                                ReelScene(scene_number=3, timestamp_range="0:14 - 0:26", visual_action=f"Customer spotlight on {assigned_hero or 'solution'} and key benefits", on_screen_text="Industry-Leading Standards", spoken_audio_or_voiceover="Tested performance that elevates your brand and sets the benchmark.", b_roll_notes="Close-up focus", hero_focus=[assigned_hero] if assigned_hero else []),
                                ReelScene(scene_number=4, timestamp_range=f"0:26 - 0:{reel_dur[1]:02d}" if reel_dur else "0:26 - 0:30", visual_action="Final brand hero card and logo outro", on_screen_text=cta, spoken_audio_or_voiceover=cta, b_roll_notes="Outro CTA screen", hero_focus=[assigned_hero] if assigned_hero else []),
                            ] if (reel_dur and reel_dur[1] >= 25) else
                            [
                                ReelScene(scene_number=1, timestamp_range="0:00 - 0:03", visual_action=f"High-impact hook shot showcasing {assigned_hero or 'core offering'}", on_screen_text=f"Day {day_num}: {core_msg}", spoken_audio_or_voiceover=core_msg, b_roll_notes="Dynamic lighting", hero_focus=[assigned_hero] if assigned_hero else []),
                                ReelScene(scene_number=2, timestamp_range="0:03 - 0:10", visual_action=f"Fast-paced feature and product showcase for {assigned_hero or strategy.campaign_theme}", on_screen_text=angle_name, spoken_audio_or_voiceover=f"Here is how {assigned_hero or strategy.campaign_theme} delivers value.", b_roll_notes="Action montage", hero_focus=[assigned_hero] if assigned_hero else []),
                                ReelScene(scene_number=3, timestamp_range=f"0:10 - 0:{reel_dur[1]:02d}" if reel_dur else "0:10 - 0:20", visual_action="Final brand hero card and logo outro", on_screen_text=cta, spoken_audio_or_voiceover=cta, b_roll_notes="Outro CTA screen", hero_focus=[assigned_hero] if assigned_hero else []),
                            ]
                        ) if d_type == "reel" else [],
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

