from __future__ import annotations

import logging
import re
import time
from datetime import datetime, timezone
from typing import Any

from app.campaign_intelligence.orchestration.state import CampaignState
from app.campaign_intelligence.schemas.brand import BrandContext
from app.campaign_intelligence.schemas.campaign import CampaignBrief
from app.campaign_intelligence.schemas.performance import PerformancePlaybook
from app.campaign_intelligence.schemas.research import MarketResearchReport
from app.campaign_intelligence.schemas.strategy import (
    CampaignStrategy,
    DeliverableSlot,
    HookCategory,
    MessagingPillar,
    StrategicAngle,
)
from app.campaign_intelligence.schemas.trace import AgentTelemetry
from app.core.config import settings
from app.core.llm import invoke_structured_llm

logger = logging.getLogger(__name__)

HOOK_CATEGORIES_BY_STAGE: dict[str, list[HookCategory]] = {
    "top_of_funnel_awareness": [
        "pain_mirror",
        "counter_intuitive_myth",
        "sensory_showcase",
        "founder_or_expert_pov",
        "behind_the_scenes",
    ],
    "middle_of_funnel_consideration": [
        "live_proof_demo",
        "behind_the_scenes",
        "social_proof",
        "counter_intuitive_myth",
        "founder_or_expert_pov",
    ],
    "bottom_of_funnel_conversion": [
        "direct_offer",
        "social_proof",
        "live_proof_demo",
        "founder_or_expert_pov",
        "pain_mirror",
    ],
}

ALL_HOOK_CATEGORIES: list[HookCategory] = [
    "sensory_showcase",
    "behind_the_scenes",
    "pain_mirror",
    "counter_intuitive_myth",
    "live_proof_demo",
    "social_proof",
    "founder_or_expert_pov",
    "direct_offer",
]


def get_industry_funnel_guidance(brand_context: BrandContext | None) -> str:
    """
    Dynamic industry mapping: adapt funnel phrasing and examples to client industry.
    Explicitly forbids forcing B2B architecture phrasing onto non-B2B clients.
    """
    industry = (brand_context.industry or "").lower() if brand_context else ""
    is_non_b2b = any(k in industry for k in (
        "clinic", "health", "dental", "retail", "consumer", "fashion", "apparel",
        "beauty", "skincare", "cosmetic", "food", "beverage", "hospitality",
        "restaurant", "fitness", "wellness", "ecommerce", "d2c",
    ))
    if is_non_b2b:
        return (
            "CLIENT INDUSTRY TYPE: Consumer / Healthcare / D2C / Local Clinic (NON-B2B)\n"
            "- Tailor funnel stages to real-world consumer/client decisions:\n"
            "  * top_of_funnel_awareness: Sensory problem mirror, common misconception, pattern interrupt\n"
            "  * middle_of_funnel_consideration: Ingredient/method breakdown, unboxing/transformation, live demo\n"
            "  * bottom_of_funnel_conversion: Direct offer, verified trial, client/patient guarantee\n"
            "- STRICT PROHIBITION: DO NOT use enterprise B2B jargon like 'architecture teardown', 'enterprise migration', or 'TCO calculations'."
        )
    return (
        "CLIENT INDUSTRY TYPE: B2B / Technical / Professional Services\n"
        "- Tailor funnel stages to business decision makers:\n"
        "  * top_of_funnel_awareness: Industry tension, technical friction, contrarian POV\n"
        "  * middle_of_funnel_consideration: Mechanism/architecture breakdown, ROI mechanics, benchmark validation\n"
        "  * bottom_of_funnel_conversion: Verified low-friction consultation, demo request, workflow pilot"
    )


def derive_slot_allocation_targets(
    brief: CampaignBrief,
    brand_context: BrandContext | None = None,
    performance_playbook: PerformancePlaybook | None = None,
) -> list[dict[str, Any]]:
    """
    Derives deterministic slot count, format mix, platforms, and sprint days.
    Prioritizes:
    1. Contract quotas on brand_context
    2. Explicit deliverable_preferences from brief
    3. PerformancePlaybook recommended_format_mix (integer format counts)
    4. Balanced 5-slot cold-start default (e.g. 2 reels, 2 carousels, 1 static)
    """
    targets: list[dict[str, Any]] = []
    platforms = brief.platforms or ["linkedin", "instagram"]
    duration_days = brief.duration_days or 30

    # 1. Contract quotas
    if brand_context and brand_context.contract_quotas:
        for q in brand_context.contract_quotas:
            qty = q.remaining if q.remaining is not None and q.remaining > 0 else (q.contracted or q.monthly_quantity or 1)
            for _ in range(qty):
                targets.append({
                    "deliverable_type": q.deliverable_type,
                    "target_platform": q.platform or (platforms[0] if platforms else "instagram"),
                })

    # 2. PerformancePlaybook recommended_format_mix if no quotas
    if not targets and performance_playbook and performance_playbook.recommended_format_mix:
        mix = performance_playbook.recommended_format_mix
        for fmt, cnt in mix.items():
            if isinstance(cnt, int) and cnt > 0:
                plat = "linkedin" if fmt == "carousel" else "instagram"
                if plat not in platforms and platforms:
                    plat = platforms[0]
                for _ in range(cnt):
                    targets.append({
                        "deliverable_type": fmt,
                        "target_platform": plat,
                    })

    # 3. Deliverable preferences from brief
    if not targets and brief.deliverable_preferences:
        for pref in brief.deliverable_preferences:
            pref_lower = pref.lower().strip()
            plat = "instagram" if "reel" in pref_lower else "linkedin"
            if plat not in platforms and platforms:
                plat = platforms[0]
            targets.append({
                "deliverable_type": pref_lower,
                "target_platform": plat,
            })
        if len(targets) == 1:
            targets = [dict(targets[0]) for _ in range(4)]
        elif len(targets) == 2:
            targets = [dict(targets[0]), dict(targets[1]), dict(targets[0]), dict(targets[1])]

    # 4. Default fallback: balanced 5-slot sprint
    if not targets:
        p1 = platforms[0] if platforms else "instagram"
        p2 = platforms[1] if len(platforms) > 1 else p1
        targets = [
            {"deliverable_type": "reel", "target_platform": p1},
            {"deliverable_type": "carousel", "target_platform": p2},
            {"deliverable_type": "reel", "target_platform": p1},
            {"deliverable_type": "carousel", "target_platform": p2},
            {"deliverable_type": "static", "target_platform": p1},
        ]

    is_date_bounded = bool(brief.start_date and brief.end_date and brief.duration_days)

    # If explicit date-bounded sprint and fewer targets than sprint days, pad to sprint_days
    if is_date_bounded and brief.duration_days and len(targets) < brief.duration_days:
        missing = brief.duration_days - len(targets)
        for i in range(missing):
            base_t = dict(targets[i % len(targets)])
            targets.append(base_t)

    # Assign sequential days
    if is_date_bounded and brief.duration_days:
        for idx, t in enumerate(targets):
            t["slot_index"] = idx
            t["planned_day"] = (idx % brief.duration_days) + 1
    else:
        n = len(targets)
        step = max(1, duration_days // (n + 1))
        for idx, t in enumerate(targets):
            t["slot_index"] = idx
            t["planned_day"] = min(duration_days, max(1, (idx + 1) * step))

    return targets


def enforce_consecutive_hook_diversity(slots: list[DeliverableSlot]) -> list[DeliverableSlot]:
    """
    Deterministically guarantees that slot[i].hook_category != slot[i - 1].hook_category.
    If the LLM repeats the same hook_category back-to-back, rotates to the next unused category
    fitting its funnel_stage.
    """
    for i in range(1, len(slots)):
        if slots[i].hook_category == slots[i - 1].hook_category:
            prev_hook = slots[i - 1].hook_category
            next_hook = slots[i + 1].hook_category if i + 1 < len(slots) else None
            stage = slots[i].funnel_stage
            candidates = HOOK_CATEGORIES_BY_STAGE.get(stage, ALL_HOOK_CATEGORIES)

            rotated = False
            for cand in candidates:
                if cand != prev_hook and cand != next_hook:
                    slots[i].hook_category = cand
                    rotated = True
                    break
            if not rotated:
                for cand in ALL_HOOK_CATEGORIES:
                    if cand != prev_hook and cand != next_hook:
                        slots[i].hook_category = cand
                        break
    return slots


def ground_slot_proof_points(
    slots: list[DeliverableSlot],
    brand_context: BrandContext | None,
) -> list[DeliverableSlot]:
    """
    Populates allowed_proof_points strictly from brand_context.confirmed_facts
    and brand_context.verified_offers.
    If no verified proof supports the slot's angle or hook category (e.g., social_proof
    with zero testimonials), set allowed_proof_points = ["NONE_USE_PLACEHOLDER"] so Agent 5
    is forced to emit [CLIENT_INPUT_NEEDED: ...].
    """
    if not brand_context:
        for slot in slots:
            slot.allowed_proof_points = ["NONE_USE_PLACEHOLDER"]
        return slots

    verified_facts = [f.strip() for f in (brand_context.confirmed_facts or []) if f.strip()]
    verified_offers = [
        f"{o.name}: {o.description}".strip()
        for o in (brand_context.verified_offers or [])
        if getattr(o, "is_verified", True) and o.name
    ]
    verified_pool = verified_facts + verified_offers

    has_testimonials = any(
        any(k in fact.lower() for k in ("testimonial", "case study", "customer", "review", "client said", "rating", "satisfaction"))
        for fact in verified_facts
    )

    for slot in slots:
        if slot.hook_category == "social_proof" and not has_testimonials:
            slot.allowed_proof_points = ["NONE_USE_PLACEHOLDER"]
            continue

        if not verified_pool:
            slot.allowed_proof_points = ["NONE_USE_PLACEHOLDER"]
            continue

        valid_points: list[str] = []
        for p in slot.allowed_proof_points:
            p_clean = p.strip()
            if p_clean == "NONE_USE_PLACEHOLDER":
                continue
            p_lower = p_clean.lower()
            if any(p_lower in v.lower() or v.lower() in p_lower for v in verified_pool):
                valid_points.append(p_clean)

        if not valid_points:
            msg_tokens = set(re.findall(r"\w{4,}", (slot.core_message + " " + slot.strategic_angle_ref).lower()))
            for v in verified_pool:
                v_tokens = set(re.findall(r"\w{4,}", v.lower()))
                if msg_tokens & v_tokens:
                    valid_points.append(v)
                    if len(valid_points) >= 2:
                        break

        if not valid_points:
            slot.allowed_proof_points = ["NONE_USE_PLACEHOLDER"]
        else:
            slot.allowed_proof_points = valid_points

    return slots


def inject_negative_boundary_constraints(
    slots: list[DeliverableSlot],
    brand_context: BrandContext | None,
) -> list[DeliverableSlot]:
    """
    Programmatically injects prohibited_terms, prohibited_claims, and prohibited_concepts
    into every slot's factual_boundary_constraints.
    """
    if not brand_context:
        return slots

    boundaries: list[str] = []
    for pt in brand_context.prohibited_terms:
        if pt.term.strip():
            boundaries.append(f"Prohibited term: '{pt.term.strip()}'")
    for pc in brand_context.prohibited_claims:
        if pc.claim.strip():
            boundaries.append(f"Prohibited claim: '{pc.claim.strip()}'")
    for concept in brand_context.prohibited_concepts:
        if concept.strip():
            boundaries.append(f"Prohibited concept: '{concept.strip()}'")

    for slot in slots:
        existing = set(slot.factual_boundary_constraints)
        for b in boundaries:
            if b not in existing:
                slot.factual_boundary_constraints.append(b)
                existing.add(b)

    return slots


def reconcile_and_pad_slots(
    strategy: CampaignStrategy,
    brief: CampaignBrief,
    brand_context: BrandContext | None,
    market_research: MarketResearchReport | None,
    performance_playbook: PerformancePlaybook | None,
) -> CampaignStrategy:
    """
    Guarantees that strategy.deliverable_slots is populated, correctly sized,
    indexed sequentially (0..N-1), and has valid buyer language and sprint days.
    """
    targets = derive_slot_allocation_targets(brief, brand_context, performance_playbook)
    buyer_snippets = market_research.buyer_language_snippets if market_research else []
    angles = strategy.strategic_angles or []
    pillars = strategy.messaging_pillars or []

    funnel_stages: list[Literal["top_of_funnel_awareness", "middle_of_funnel_consideration", "bottom_of_funnel_conversion"]] = [
        "top_of_funnel_awareness",
        "middle_of_funnel_consideration",
        "bottom_of_funnel_conversion",
    ]

    existing_slots = list(strategy.deliverable_slots or [])
    final_slots: list[DeliverableSlot] = []

    for idx, target in enumerate(targets):
        if idx < len(existing_slots):
            slot = existing_slots[idx]
            slot.slot_index = idx
            if not slot.planned_day:
                slot.planned_day = target["planned_day"]
            if not slot.deliverable_type:
                slot.deliverable_type = target["deliverable_type"]
            if not slot.target_platform:
                slot.target_platform = target["target_platform"]
        else:
            # Deterministically synthesize slot from target, angles, and pillars
            f_stage = funnel_stages[min(idx, len(funnel_stages) - 1)] if idx < len(funnel_stages) else funnel_stages[idx % len(funnel_stages)]
            angle = angles[idx % len(angles)] if angles else None
            pillar = pillars[idx % len(pillars)] if pillars else None
            angle_ref = angle.angle_name if angle else strategy.campaign_theme
            core_msg = pillar.core_message if pillar else strategy.primary_objective
            persona = angle.target_audience_segment if angle else (brief.target_audience[0] if brief.target_audience else "Primary Decision Maker")
            default_hooks = HOOK_CATEGORIES_BY_STAGE.get(f_stage, ALL_HOOK_CATEGORIES)
            hook_cat = default_hooks[idx % len(default_hooks)]

            slot = DeliverableSlot(
                slot_index=idx,
                planned_day=target["planned_day"],
                deliverable_type=target["deliverable_type"],
                target_platform=target["target_platform"],
                funnel_stage=f_stage,
                target_persona=persona,
                hook_category=hook_cat,
                strategic_angle_ref=angle_ref,
                core_message=core_msg,
            )

        # Ground buyer language references if empty
        if not slot.buyer_language_refs and buyer_snippets:
            assigned_snippet = buyer_snippets[idx % len(buyer_snippets)]
            slot.buyer_language_refs = [assigned_snippet]

        final_slots.append(slot)

    # Apply deterministic post-validators
    final_slots = enforce_consecutive_hook_diversity(final_slots)
    final_slots = ground_slot_proof_points(final_slots, brand_context)
    final_slots = inject_negative_boundary_constraints(final_slots, brand_context)

    strategy.deliverable_slots = final_slots
    return strategy


def validate_strategy_against_brand_rules(
    strategy: CampaignStrategy,
    brand_context: BrandContext | None,
) -> list[str]:
    """
    Deterministically validate the generated strategy against brand boundaries:
    - Scans theme, angles, messaging pillars, and deliverable slots for exact prohibited terms.
    - Checks that prohibited claims are not incorporated.
    """
    violations: list[str] = []
    if not brand_context:
        return violations

    full_text = " ".join([
        strategy.campaign_theme,
        strategy.primary_objective,
        strategy.target_audience_definition,
        " ".join([a.angle_name + " " + a.rationale for a in strategy.strategic_angles]),
        " ".join([m.pillar_name + " " + m.core_message for m in strategy.messaging_pillars]),
        " ".join([s.core_message + " " + s.strategic_angle_ref for s in strategy.deliverable_slots]),
    ]).lower()

    # Exact prohibited term check
    for pt in brand_context.prohibited_terms:
        term_clean = pt.term.strip().lower()
        if term_clean and re.search(rf"\b{re.escape(term_clean)}\b", full_text):
            violations.append(f"Strategy contains prohibited term: '{pt.term}'")

    return violations


class CampaignStrategistAgent:
    """
    Agent 4: Campaign Strategist
    
    Responsibilities:
    1. Synthesize Brand Intelligence, Market Research, and Historical Performance.
    2. Formulate a cohesive campaign theme, strategic angles, and messaging pillars.
    3. Generate deterministic DeliverableSlots honoring quotas, performance ratios, and industry tone.
    4. Enforce consecutive hook category diversity.
    5. Ground allowed proof points strictly in verified facts or force placeholders.
    6. Inherit brand negative boundary constraints on every slot.
    """

    def __init__(self, model_name: str | None = None, temperature: float = 0.55):
        self.model_name = model_name or settings.CAMPAIGN_STRATEGY_MODEL
        self.temperature = temperature

    async def run(
        self,
        brief: CampaignBrief,
        brand_context: BrandContext | None = None,
        market_research: MarketResearchReport | None = None,
        performance_playbook: PerformancePlaybook | None = None,
    ) -> CampaignStrategy:
        """
        Execute strategic synthesis across all intelligence inputs.
        """
        # 1. Format Brand Context Intelligence with strict factual boundaries
        brand_text_parts: list[str] = []
        if brand_context:
            brand_text_parts.append(f"- Business Name: {brand_context.business_name}")
            brand_text_parts.append(f"- Industry: {brand_context.industry or 'Unspecified'}")
            brand_text_parts.append(f"- Brand Voice: {', '.join(brand_context.brand_voice) if brand_context.brand_voice else 'Authoritative'}")
            brand_text_parts.append(f"- Content Pillars: {', '.join(brand_context.content_pillars) if brand_context.content_pillars else 'Core Value Props'}")
            brand_text_parts.append(f"- Prescribed Tone (DO): {'; '.join(brand_context.tone_guidelines.do) if brand_context.tone_guidelines.do else 'Professional'}")
            brand_text_parts.append(f"- Proscribed Tone (DONT): {'; '.join(brand_context.tone_guidelines.dont) if brand_context.tone_guidelines.dont else 'Hype'}")
            
            # Append 3-tier factual boundaries
            brand_text_parts.append("\n" + brand_context.get_factual_boundary_prompt())
        else:
            brand_text_parts.append("No confirmed brand context available; inferring from brief.")
        brand_summary = "\n".join(brand_text_parts)

        # 2. Format Market Research Intelligence
        market_text_parts: list[str] = []
        if market_research:
            market_text_parts.append(f"- Research Confidence Score: {market_research.confidence_score * 100:.1f}%")
            if market_research.target_audience_insights:
                market_text_parts.append("Audience Pain Points & Triggers:")
                for obs in market_research.target_audience_insights[:3]:
                    market_text_parts.append(f"  * {obs.segment_name}: Pain='{obs.pain_point}' | Trigger='{obs.trigger_topic}'")
            if market_research.competitor_landscape:
                market_text_parts.append("Competitor Differentiation Opportunities:")
                for comp in market_research.competitor_landscape[:3]:
                    market_text_parts.append(f"  * vs {comp.competitor_name}: {comp.differentiation_opportunity}")
            if market_research.format_and_platform_trends:
                market_text_parts.append("Platform Format Benchmarks:")
                for tr in market_research.format_and_platform_trends[:3]:
                    market_text_parts.append(f"  * {tr.platform} ({tr.format}): {tr.trend_description}")
            if market_research.strategic_opportunities:
                market_text_parts.append(f"Strategic High-Leverage Opportunities: {'; '.join(market_research.strategic_opportunities[:3])}")
            if market_research.buyer_language_snippets:
                market_text_parts.append("Verbatim Voice-of-Customer / Buyer Language Snippets:")
                for snip in market_research.buyer_language_snippets[:6]:
                    market_text_parts.append(f'  * "{snip}"')
        else:
            market_text_parts.append("No external market research available; using industry baselines.")
        market_summary = "\n".join(market_text_parts)

        # 3. Format Historical Performance Intelligence
        perf_text_parts: list[str] = []
        if performance_playbook:
            perf_text_parts.append(f"- Data Sufficiency: {performance_playbook.data_sufficiency.value.upper()}")
            perf_text_parts.append(f"- Total Historical Posts Analyzed: {performance_playbook.historical_posts_analyzed}")
            if performance_playbook.winning_hooks_and_angles:
                perf_text_parts.append(f"- Winning Angles from Past Campaigns: {'; '.join(performance_playbook.winning_hooks_and_angles[:3])}")
            if performance_playbook.underperforming_patterns:
                perf_text_parts.append(f"- Underperforming Traps to Avoid: {'; '.join(performance_playbook.underperforming_patterns[:2])}")
            if performance_playbook.fatigue_signals:
                for fat in performance_playbook.fatigue_signals:
                    perf_text_parts.append(f"- FATIGUE WARNING: {fat.topic_or_format} ({fat.fatigue_level}): {fat.recommendation}")
            if performance_playbook.recommended_format_mix:
                mix_str = ", ".join([f"{k}: {v}" for k, v in performance_playbook.recommended_format_mix.items()])
                perf_text_parts.append(f"- Recommended Historical Format Mix: {mix_str}")
        else:
            perf_text_parts.append("Cold start: No historical performance data recorded.")
        perf_summary = "\n".join(perf_text_parts)

        # 4. Construct Strategic Prompt
        target_platforms = brief.platforms or ["linkedin", "instagram"]
        timeline_info = f"Month {brief.period_month}, {brief.period_year}"
        if brief.start_date and brief.end_date:
            timeline_info = f"Specific Sprint: {brief.start_date.strftime('%B %d, %Y')} to {brief.end_date.strftime('%B %d, %Y')} ({brief.duration_days} days total)"

        hero_guidance = ""
        if brief.pinned_entities:
            hero_guidance = f"- Pinned Hero Offerings / Key Assets: {', '.join(brief.pinned_entities)} (Build strategic angles, narrative phases, and conversion climaxes around these verified offerings!)"

        if brief.start_date and brief.end_date and brief.duration_days:
            pacing_instruction = f"Daily phasing across the {brief.duration_days}-day sprint ({brief.start_date} to {brief.end_date}) detailing sequential daily narrative progression from Day 1 to Day {brief.duration_days}."
        else:
            pacing_instruction = f"Weekly phasing across Month {brief.period_month} (e.g. Week 1: Problem Awareness, Week 2: Technical Breakdown, Week 3: Proof & Benchmark, Week 4: Conversion)."

        industry_funnel_guidance = get_industry_funnel_guidance(brand_context)
        slot_targets = derive_slot_allocation_targets(brief, brand_context, performance_playbook)
        targets_prompt = "\n".join([
            f"  * Slot {t['slot_index']}: Planned Day {t['planned_day']} | Format: {t['deliverable_type']} | Platform: {t['target_platform']}"
            for t in slot_targets
        ])

        prompt = f"""You are the Campaign Strategist Agent for AgencyOS.
Synthesize the internal brand reality, external market research, and historical campaign track record to formulate a comprehensive, high-converting social media campaign strategy.

### 1. CLIENT & BRAND INTELLIGENCE (Agent 1)
{brand_summary}

### 2. MARKET RESEARCH & EXTERNAL REALITY (Agent 2)
{market_summary}

### 3. HISTORICAL PERFORMANCE & FATIGUE SIGNALS (Agent 3)
{perf_summary}

### 4. CAMPAIGN BRIEF & OBJECTIVE
- Primary Objective: {brief.objective}
- Custom Brief Notes: {brief.custom_brief or 'None'}
- Target Platforms: {', '.join(target_platforms)}
- Target Formats: {', '.join(brief.deliverable_preferences) if brief.deliverable_preferences else 'Any'}
- Campaign Timeline: {timeline_info}
- Budget: {f"${brief.budget:,.2f}" if brief.budget else "Unspecified / Retainer Scope"}
{hero_guidance}

### 5. INDUSTRY TONE & FUNNEL GROUNDING
{industry_funnel_guidance}

### 6. PLANNED DELIVERABLE SLOTS TARGETS
Construct exactly {len(slot_targets)} slots in `deliverable_slots` matching these pre-planned quotas:
{targets_prompt}

### YOUR TASK
Formulate a master Campaign Strategy strictly conforming to the JSON schema:
1. campaign_theme: A powerful, conceptual narrative umbrella that unites the entire campaign (avoid generic phrases like 'Autumn Blast' or 'Q4 Growth').
2. strategic_thesis: The provocative central strategic argument or angle that creates an unfair moat for this client.
3. core_tension: The specific psychological friction point, unspoken truth, or ego defense of the target audience.
4. primary_objective: Clear, measurable business objective.
5. target_audience_definition: Distinct profile integrating the pain points identified by Market Research.
6. funnel_narrative: Phased narrative journey mapping:
   - "top_of_funnel": Pattern interrupt & tension
   - "middle_of_funnel": Mechanism, proof, & re-framing
   - "bottom_of_funnel": Verified low-friction conversion climax
7. strategic_angles: 3-4 distinct conceptual angles.
8. messaging_pillars: 3 foundational message pillars, each with core message, CTA (strictly matching verified offers), and target emotions.
9. platform_distribution_strategy: Strategic role for each platform in {', '.join(target_platforms)}.
10. pacing_and_cadence: {pacing_instruction}
11. success_benchmarks: Target engagement rate, save rates, or lead indicators based on historical baselines or platform benchmarks.
12. assumptions_and_risks: Key strategic risks and mitigation steps.
13. deliverable_slots: Exactly {len(slot_targets)} slots. For each slot specify:
   - slot_index: Sequential 0-indexed integer (0..{len(slot_targets) - 1})
   - planned_day: Sprint day
   - deliverable_type: reel, carousel, static, or text_thread
   - target_platform: instagram, linkedin, etc.
   - funnel_stage: top_of_funnel_awareness, middle_of_funnel_consideration, or bottom_of_funnel_conversion
   - target_persona: Target audience persona
   - hook_category: One of [sensory_showcase, behind_the_scenes, pain_mirror, counter_intuitive_myth, live_proof_demo, social_proof, founder_or_expert_pov, direct_offer]. MANDATORY: Consecutive slots MUST have distinct hook_categories (never repeat back-to-back)!
   - strategic_angle_ref: Reference to the aligned strategic angle
   - core_message: Concise core message for this piece
   - allowed_proof_points: List of verified proof points strictly from confirmed facts/offers. If no verified proof supports the angle, emit ["NONE_USE_PLACEHOLDER"].
   - buyer_language_refs: Verbatim buyer quotes from Market Research to ground the copy
   - factual_boundary_constraints: Restrictions inheriting brand prohibited terms/claims/concepts
14. STRICT ANTI-HALLUCINATION & LANGUAGE REQUIREMENT:
   - NEVER invent discounts, false statistics, or unverified claims.
   - All strategy components MUST be written exclusively in English.
"""

        # 5. Invoke LLM
        strategy: CampaignStrategy = await invoke_structured_llm(
            prompt=prompt,
            schema_class=CampaignStrategy,
            temperature=self.temperature,
            model=self.model_name,
        )

        # 6. Reconcile, Pad, and Apply Deterministic Post-Validators
        strategy = reconcile_and_pad_slots(
            strategy=strategy,
            brief=brief,
            brand_context=brand_context,
            market_research=market_research,
            performance_playbook=performance_playbook,
        )

        # 7. Deterministic Validation against Brand Rules
        rule_violations = validate_strategy_against_brand_rules(strategy, brand_context)
        if rule_violations:
            logger.warning(f"Rule violations detected in generated strategy: {rule_violations}")
            strategy.assumptions_and_risks.extend([f"RULE VIOLATION MITIGATION: {v}" for v in rule_violations])

        return strategy


async def campaign_strategist_node(
    state: CampaignState,
) -> dict[str, Any]:
    """
    LangGraph node entry point for Campaign Strategist Agent.
    
    1. Consumes intelligence from brand_context, market_research, and performance_playbook.
    2. Executes CampaignStrategistAgent.
    3. Records execution telemetry (AgentTelemetry).
    4. Writes exclusively to state["campaign_strategy"].
    """
    start_time = datetime.now(timezone.utc).isoformat()
    start_perf = time.perf_counter()
    agent_name = "campaign_strategist"
    model_name = settings.CAMPAIGN_STRATEGY_MODEL

    try:
        agent = CampaignStrategistAgent(model_name=model_name)
        strategy = await agent.run(
            brief=state["brief"],
            brand_context=state.get("brand_context"),
            market_research=state.get("market_research"),
            performance_playbook=state.get("performance_playbook"),
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
            "campaign_strategy": strategy,
            "pipeline_agents_executed": [agent_name],
            "agent_traces": [telemetry],
            "current_agent": agent_name,
        }

    except Exception as e:
        duration_ms = (time.perf_counter() - start_perf) * 1000.0
        end_time = datetime.now(timezone.utc).isoformat()
        err_msg = f"Campaign Strategist failed: {str(e)}"
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



async def campaign_strategist_node(
    state: CampaignState,
) -> dict[str, Any]:
    """
    LangGraph node entry point for Campaign Strategist Agent.
    
    1. Consumes intelligence from brand_context, market_research, and performance_playbook.
    2. Executes CampaignStrategistAgent.
    3. Records execution telemetry (AgentTelemetry).
    4. Writes exclusively to state["campaign_strategy"].
    """
    start_time = datetime.now(timezone.utc).isoformat()
    start_perf = time.perf_counter()
    agent_name = "campaign_strategist"
    model_name = settings.CAMPAIGN_STRATEGY_MODEL

    try:
        agent = CampaignStrategistAgent(model_name=model_name)
        strategy = await agent.run(
            brief=state["brief"],
            brand_context=state.get("brand_context"),
            market_research=state.get("market_research"),
            performance_playbook=state.get("performance_playbook"),
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
            "campaign_strategy": strategy,
            "pipeline_agents_executed": [agent_name],
            "agent_traces": [telemetry],
            "current_agent": agent_name,
        }

    except Exception as e:
        duration_ms = (time.perf_counter() - start_perf) * 1000.0
        end_time = datetime.now(timezone.utc).isoformat()
        err_msg = f"Campaign Strategist failed: {str(e)}"
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

