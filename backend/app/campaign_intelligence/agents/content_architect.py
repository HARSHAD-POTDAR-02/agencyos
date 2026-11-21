from __future__ import annotations

import asyncio
import logging
import re
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


# ---------------------------------------------------------------------------
# Creative Content Scrubber (Bug 7: P1 Polish with Constraint 2)
# ---------------------------------------------------------------------------

def scrub_creative_content(text: str) -> str:
    """
    Sanitizes creative scripts, hooks, and voiceovers.
    Preserves clean [CLIENT_INPUT_NEEDED: <specific missing fact>] tags for editors.
    Scrubs:
    - Internal spoken compliance disclaimers ('We will not present...', 'VERIFIED FIGURES: PENDING...')
    - Platform meta-guidance sentences ('Reels are best for...', 'Carousels are ideal for...')
    - Literal prompt angle brackets like '[CLIENT_INPUT_NEEDED: <exact missing proof or testimonial>]'
    """
    if not text:
        return ""

    cleaned = text

    # 1. Scrub literal prompt angle-bracket placeholders
    cleaned = re.sub(
        r"\[CLIENT_INPUT_NEEDED:\s*<[^>]+>\]",
        "[CLIENT_INPUT_NEEDED: Verified client metric or case study]",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(
        r"<\s*exact\s+missing\s+(?:proof|metric|fact|testimonial)[^>]*>",
        "Verified client metric",
        cleaned,
        flags=re.IGNORECASE,
    )

    # 2. Scrub spoken compliance disclaimers
    spoken_compliance_patterns = [
        r"(?:Note:\s*)?(?:We|I)\s+(?:will|can)?\s*not\s+present\s+[^.]+until\s+they\s+are\s+approved\.?",
        r"VERIFIED\s+FIGURES:\s*PENDING(?:\s+CLIENT\s+CONFIRMATION)?\.?",
        r"\bPENDING\s+CLIENT\s+CONFIRMATION\b\.?",
        r"(?:Note:\s*)?(?:We|I)\s+do\s+not\s+have\s+verified\s+figures\s+for\s+[^.]+\.?",
        r"\bAll\s+figures\s+are\s+subject\s+to\s+client\s+verification\.?",
        r"⚠️\s*\[CLIENT_INPUT_NEEDED\]",
    ]
    for pat in spoken_compliance_patterns:
        cleaned = re.sub(pat, "", cleaned, flags=re.IGNORECASE)

    # 3. Scrub platform meta-guidance sentences
    platform_meta_patterns = [
        r"Reels\s+are\s+best\s+for\s+content\s+where\s+the\s+video\s+is\s+the\s+whole\s+experience\.?",
        r"(?:Reels|Carousels|Videos|Posts)\s+are\s+(?:best|ideal|great)\s+for\s+[^.]+\.?",
        r"This\s+(?:deliverable|reel|carousel|video|post)\s+is\s+designed\s+to\s+[^.]+\.?",
        r"Target\s+audience:\s*[^.]+\.?",
    ]
    for pat in platform_meta_patterns:
        cleaned = re.sub(pat, "", cleaned, flags=re.IGNORECASE)

    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned).strip()
    return cleaned


def apply_deliverable_scrubber(d: DeliverablePlan) -> DeliverablePlan:
    """Applies clean scrubbing across all text fields of a deliverable plan."""
    d.primary_hook = scrub_creative_content(d.primary_hook)
    d.title = scrub_creative_content(d.title)
    d.caption = scrub_creative_content(d.caption)
    d.call_to_action = scrub_creative_content(d.call_to_action)

    if d.reel_scenes:
        for sc in d.reel_scenes:
            sc.spoken_audio_or_voiceover = scrub_creative_content(sc.spoken_audio_or_voiceover)
            sc.on_screen_text = scrub_creative_content(sc.on_screen_text)
            sc.visual_action = scrub_creative_content(sc.visual_action)

    if d.carousel_slides:
        for sl in d.carousel_slides:
            sl.headline = scrub_creative_content(sl.headline)
            sl.body_copy = scrub_creative_content(sl.body_copy)
            sl.visual_layout = scrub_creative_content(sl.visual_layout)

    return d


# ---------------------------------------------------------------------------
# Dynamic Style & Industry Motif Derivation (Constraints 3 & 4)
# ---------------------------------------------------------------------------

def derive_dynamic_emoji_policy(brand_voice: list[str] | None) -> str:
    """Derive dynamic tone and emoji policy from brand_context.brand_voice (Constraint 3)."""
    voice_str = " ".join(brand_voice or []).lower() if brand_voice else ""
    is_restrained_voice = any(
        w in voice_str
        for w in ("restrained", "minimalist", "enterprise", "serious", "academic", "sober", "technical", "clinical", "formal", "authoritative")
    )
    if is_restrained_voice:
        return "ZERO emojis (strict restraint). Do NOT use playful, hyped, or consumer emojis like rocket, wrench, or hype icons."
    return "Use 1-3 contextual, expressive emojis matching brand tone."

get_dynamic_emoji_rule = derive_dynamic_emoji_policy


def derive_industry_visual_motifs(industry: str | None) -> str:
    """Derive dynamic multi-industry visual motifs (Constraint 3: Realistic low-budget shoots)."""
    industry_lower = (industry or "").lower()
    if any(k in industry_lower for k in ("tech", "cloud", "software", "saas", "ai", "cyber", "data")):
        return (
            "Technical lead talking-head POV at desk with dual-monitor screen recording, "
            "whiteboard architecture/flow walkthrough, or tablet displaying telemetry dashboard. Everyday tech office props."
        )
    elif any(k in industry_lower for k in ("health", "clinic", "wellness", "medical", "dental", "pharma")):
        return (
            "Practitioner in authentic consultation room, patient journey walkthrough, "
            "desk with medical reference or anatomical model, calm direct-to-camera explanation. Everyday clinic props."
        )
    elif any(k in industry_lower for k in ("retail", "e-comm", "fashion", "product", "beauty")):
        return (
            "Clean unboxing on neutral table, authentic hands-on product demonstration, "
            "founder talking head holding product in daylight studio or showroom."
        )
    elif any(k in industry_lower for k in ("finance", "legal", "consult", "law", "account")):
        return (
            "Partner at conference table or clean office desk, document review, "
            "whiteboard framework breakdown, authoritative direct-to-camera POV."
        )
    elif any(k in industry_lower for k in ("food", "restaurant", "hospitality", "hotel", "cafe")):
        return (
            "Kitchen prep counter, dining room ambience walkthrough, chef plating dish, "
            "welcoming greeting at venue entrance. Everyday dining props."
        )
    else:
        return (
            "Authentic founder/specialist talking-head POV, real workspace walkthrough, "
            "whiteboard breakdown, or everyday desktop/tablet prop."
        )

get_dynamic_visual_motifs = derive_industry_visual_motifs


def derive_concrete_carousel_structure(industry: str | None) -> str:
    """Enforce concrete, saveable slide architecture adapted to industry (Constraint 4)."""
    ind_name = industry or "the client industry"
    ind_lower = (industry or "").lower()
    if any(k in ind_lower for k in ("tech", "cloud", "software", "saas", "ai", "cyber", "data")):
        hook_label = "Slide 1 (The Provocative Hook): Bold, high-contrast headline identifying the core tension or counterintuitive reality."
        root_cause = "Slide 2 (The Hidden Architecture Flaw): Unpacks the hidden underlying metric or network bottleneck."
        checklist = "Slide 3 (The Triage / Audit Checklist): Concrete 3-4 step diagnostic or command/setting readers can audit."
    elif any(k in ind_lower for k in ("food", "restaurant", "hospitality", "hotel", "cafe")):
        hook_label = "Slide 1 (The Hook): Bold, high-contrast headline identifying the culinary or service tension."
        root_cause = "Slide 2 (The Hidden Mistake): Reveals the common operational error compromising flavor or service."
        checklist = "Slide 3 (The Actionable Framework): Concrete 3-step prep or ingredient standard readers can replicate."
    else:
        hook_label = "Slide 1 (The Hook): Bold, high-contrast headline identifying the core tension or counterintuitive reality."
        root_cause = "Slide 2 (The Root Cause): Unpacks the hidden underlying mechanism or why conventional approaches fail."
        checklist = "Slide 3 (The Actionable Checklist): Concrete 3-4 step practical diagnostic that readers can bookmark and execute."

    return (
        f"Enforce concrete, saveable slide architecture adapted to {ind_name}:\n"
        f"* {hook_label}\n"
        f"* {root_cause}\n"
        f"* {checklist}\n"
        f"* Slide 4 (The Before vs. After Standard): Tangible contrast between the standard pitfall vs the optimized state.\n"
        f"* Slide 5 (The Action Step): Clear takeaway summary and actionable call-to-action tied to client's verified offer."
    )

get_concrete_carousel_structure = derive_concrete_carousel_structure


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

    def __init__(
        self,
        model_name: str | None = None,
        temperature: float = 0.70,
        batch_size: int = 2,
        max_concurrency: int = 1,
    ):
        self.model_name = model_name or settings.CAMPAIGN_CONTENT_MODEL
        self.temperature = temperature
        self.batch_size = batch_size
        self.max_concurrency = max_concurrency

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

        # Derive dynamic tone, emoji policy, visual motifs, and carousel structure (Constraints 3 & 4)
        emoji_policy = derive_dynamic_emoji_policy(brand_context.brand_voice if brand_context else [])
        industry_visual_motifs = derive_industry_visual_motifs(brand_context.industry if brand_context else "")
        carousel_structure = derive_concrete_carousel_structure(brand_context.industry if brand_context else "")

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
                f"MANDATORY: No verified case studies/metrics exist for this slot! You MUST emit '[CLIENT_INPUT_NEEDED: <specific missing fact>]' instead of fabricating numbers, percentages, or quotes!"
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
- EMOJI & TONE POLICY: {emoji_policy}
{hero_section}
{memory_section}
### TARGET SLOTS FOR THIS BATCH (Generate EXACTLY {len(batch_slots)} DeliverablePlans):
{slots_prompt}

### PRODUCTION REQUIREMENTS PER FORMAT:

1. REELS (15–60 Seconds Total Duration):
   - Primary Hook (0-3s): High tension, physical pattern interrupt + spoken opening line.
   - Pacing & Spoken Cadence: Voiceover MUST be calibrated to 2.2–2.8 spoken words per second.
     * 3-second hook: 6–8 words
     * 8-second breakdown: 18–22 words
     * 12-second demonstration: 26–33 words
   - Storyboards (`reel_scenes`): 4 to 6 timestamped scenes with STRICTLY sequential, non-overlapping timestamps:
     (e.g., 0:00-0:03 Hook, 0:03-0:10 Mechanism, 0:10-0:22 Demo, 0:22-0:35 Proof, 0:35-0:45 CTA). Total reel duration MUST be between 20 and 45 seconds (never under 15 seconds)!
   - Visual Motifs & Feasibility (Constraint 3):
     * Recommended Motifs: {industry_visual_motifs}
     * Zero-budget feasibility: Every direction MUST be physically filmable with an everyday smartphone and available workspace/props.
     * STRICT PROHIBITIONS: NO custom industrial props, NO CGI effects, and NO CLI terminals for non-tech clients!
   - audio_track_guidance: Specific genre, pacing, and sound effects (SFX) cues.
   - call_to_action: Linked directly to a verified client offer or consultation.

2. CAROUSELS (5 to 7 Slides Target - Constraint 4):
   - {carousel_structure}
   - Every slide MUST specify a clear, physically producible `visual_layout` and crisp `headline`.
   - Complete social caption with verified CTA (following emoji policy: {emoji_policy}).

3. PROOF GROUNDING & PLACEHOLDERS (Constraint 2):
   - When a slot has no verified proof points or mentions NONE_USE_PLACEHOLDER, emit '[CLIENT_INPUT_NEEDED: <specific missing fact>]' instead of fabricating metrics!
   - NEVER recite compliance rules aloud in spoken scripts (e.g. NEVER speak 'We will not present numbers until approved').

4. ANTI-CLICHÉ PROHIBITIONS (STRICT):
   - NEVER use marketing slop: "delve", "game-changer", "unleash", "revolutionize", "elevate", "in today's fast-paced world", "skyrocket", "supercharge", "dive into", "unlock your potential", "look no further", "secret sauce".

5. TOPIC ROTATION (Bug 9):
   - Do NOT repeat the exact same sub-topic across deliverables! Rotate across distinct buyer considerations, operational realities, and value angles.

6. STRICT ENGLISH REQUIREMENT:
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
                    return [apply_deliverable_scrubber(d) for d in deliverables]
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

    def _enrich_deliverable_batch(
        self,
        batch_delivs: list[DeliverablePlan],
        batch_slots: list[DeliverableSlot],
        brief: CampaignBrief,
        quotas: list[ContractQuota],
        pinned: list[str],
    ) -> list[DeliverablePlan]:
        enriched: list[DeliverablePlan] = []
        for i, slot in enumerate(batch_slots):
            if i < len(batch_delivs):
                raw_d = batch_delivs[i]
            elif batch_delivs:
                raw_d = batch_delivs[-1].model_copy(deep=True)
                raw_d.primary_hook = f"{slot.strategic_angle_ref}: {raw_d.primary_hook}"
                raw_d.title = f"{slot.strategic_angle_ref} Sprint Day {slot.planned_day}"
            else:
                continue

            d = apply_deliverable_scrubber(raw_d.model_copy(deep=True))
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

            if brief.start_date:
                calc_date = brief.start_date + timedelta(days=max(0, slot.planned_day - 1))
                d.scheduled_date = calc_date.isoformat()
                d.date_label = calc_date.strftime("%a, %b %d, %Y")

            if quotas:
                for q in quotas:
                    if q.deliverable_type.lower() == d.deliverable_type.lower() and q.platform.lower() == d.platform.lower():
                        d.scope_item_id = q.scope_item_id
                        break

            if pinned:
                if not d.hero_entity:
                    combined_text = f"{d.title} {d.caption} {d.primary_hook}".lower()
                    matched = [p for p in pinned if p.lower() in combined_text]
                    d.hero_entity = matched[0] if matched else pinned[slot.slot_index % len(pinned)]
                if not d.hero_focus:
                    d.hero_focus = [d.hero_entity]
                if d.hero_entity and d.hero_entity.lower() not in d.title.lower():
                    d.title = f"{d.hero_entity}: {d.title}"

            enriched.append(d)
        return enriched

    async def run(
        self,
        strategy: CampaignStrategy,
        brief: CampaignBrief,
        brand_context: BrandContext | None = None,
        revision_instructions: list[str] | None = None,
    ) -> list[DeliverablePlan]:
        """
        Generate production-ready deliverable plans using adaptive micro-batching.
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

        batch_size = max(1, self.batch_size)
        slot_chunks = [slots[i:i + batch_size] for i in range(0, len(slots), batch_size)]

        all_deliverables: list[DeliverablePlan] = []
        previously_generated_summary: list[dict[str, Any]] = []

        concurrency = max(1, self.max_concurrency)

        async def _execute_single_chunk(chunk_idx: int, batch_slots: list[DeliverableSlot], memory_snapshot: list[dict[str, Any]]) -> list[DeliverablePlan]:
            logger.info(
                f"Executing Content Architect micro-batch {chunk_idx + 1}/{len(slot_chunks)} "
                f"(slots {[s.slot_index for s in batch_slots]})"
            )
            batch_delivs = await self._generate_micro_batch(
                batch_slots=batch_slots,
                strategy=strategy,
                brief=brief,
                brand_context=brand_context,
                previously_generated_summary=memory_snapshot,
                revision_instructions=revision_instructions,
            )
            if len(batch_delivs) < len(batch_slots):
                for missing_slot_idx in range(len(batch_delivs), len(batch_slots)):
                    missing_slot = batch_slots[missing_slot_idx]
                    logger.info(f"Generating single deliverable for missing slot {missing_slot.slot_index}")
                    try:
                        single_delivs = await self._generate_micro_batch(
                            batch_slots=[missing_slot],
                            strategy=strategy,
                            brief=brief,
                            brand_context=brand_context,
                            previously_generated_summary=memory_snapshot,
                            revision_instructions=revision_instructions,
                        )
                        if single_delivs:
                            batch_delivs.append(single_delivs[0])
                    except Exception as e:
                        logger.warning(f"Fallback generation for slot {missing_slot.slot_index} failed: {e}")
            return self._enrich_deliverable_batch(batch_delivs, batch_slots, brief, quotas, pinned)

        if concurrency <= 1 or len(slot_chunks) <= 1:
            for chunk_idx, batch_slots in enumerate(slot_chunks):
                enriched = await _execute_single_chunk(chunk_idx, batch_slots, previously_generated_summary)
                for d in enriched:
                    all_deliverables.append(d)
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
                        "hook_category": d.hook_category,
                        "opening_visual": opening_visual[:160],
                        "call_to_action": d.call_to_action,
                    })
        else:
            for wave_start in range(0, len(slot_chunks), concurrency):
                wave_slots = slot_chunks[wave_start:wave_start + concurrency]
                snapshot = list(previously_generated_summary)
                wave_results = await asyncio.gather(*[
                    _execute_single_chunk(wave_start + i, c, snapshot)
                    for i, c in enumerate(wave_slots)
                ])
                for enriched in wave_results:
                    for d in enriched:
                        all_deliverables.append(d)
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
                            "hook_category": d.hook_category,
                            "opening_visual": opening_visual[:160],
                            "call_to_action": d.call_to_action,
                        })

        # Post-generation anti-cloning and hook deduplication pass
        seen_hooks: dict[str, int] = {}
        for d in all_deliverables:
            h_key = d.primary_hook.strip().lower()
            if h_key in seen_hooks:
                # Try picking an alternate hook from hook_options that hasn't been used yet
                alt_chosen = None
                for opt in (d.hook_options or []):
                    if opt.strip().lower() not in seen_hooks and len(opt.strip()) >= 5:
                        alt_chosen = opt.strip()
                        break
                if alt_chosen:
                    d.primary_hook = alt_chosen
                else:
                    d.primary_hook = f"{d.strategic_angle}: {d.primary_hook}"
                seen_hooks[d.primary_hook.strip().lower()] = d.slot_index
            else:
                seen_hooks[h_key] = d.slot_index

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

            if len(batch_delivs) < len(chunk):
                for missing_idx in range(len(batch_delivs), len(chunk)):
                    missing_slot = chunk[missing_idx]
                    try:
                        single_res = await self._generate_micro_batch(
                            batch_slots=[missing_slot],
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
                        if single_res:
                            batch_delivs.append(single_res[0])
                    except Exception as e:
                        logger.warning(f"Repair fallback for slot {missing_slot.slot_index} failed: {e}")

            for i, slot in enumerate(chunk):
                if i < len(batch_delivs):
                    raw_d = batch_delivs[i]
                elif batch_delivs:
                    raw_d = batch_delivs[-1].model_copy(deep=True)
                    raw_d.primary_hook = f"{slot.strategic_angle_ref}: {raw_d.primary_hook}"
                    raw_d.title = f"{slot.strategic_angle_ref} Sprint Day {slot.planned_day}"
                else:
                    continue

                d = apply_deliverable_scrubber(raw_d.model_copy(deep=True))
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

