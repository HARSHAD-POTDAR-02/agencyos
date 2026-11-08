from __future__ import annotations

import logging
import time
import uuid
from datetime import datetime, timezone
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
        # 1. Determine target deliverable quotas
        quotas: list[ContractQuota] = []
        if brand_context and brand_context.contract_quotas:
            quotas = brand_context.contract_quotas

        # If quotas exist in brand_context, calculate required counts per type/platform
        target_specs: list[str] = []
        total_quota_count = 0
        if quotas:
            for q in quotas:
                target_specs.append(f"- {q.monthly_quantity}x {q.deliverable_type.upper()} on {q.platform.upper()}")
                total_quota_count += q.monthly_quantity
        elif brief.deliverable_preferences:
            for pref in brief.deliverable_preferences:
                target_specs.append(f"- 2x {pref.upper()} across target platforms")
                total_quota_count += 2
        else:
            target_specs = ["- 4x CAROUSEL on LINKEDIN", "- 2x REEL on INSTAGRAM"]
            total_quota_count = 6

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
- Weekly Pacing: {strategy.pacing_and_cadence}

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

Generate all {total_quota_count} deliverable plans spread across Weeks 1 to 4.

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

        # 6. Assign stable UUIDs and link scope_item_ids if matching quotas exist
        deliverables = output.deliverables
        for d in deliverables:
            if not d.deliverable_id:
                d.deliverable_id = uuid.uuid4()
            # Match scope item id from brand quotas if available
            if quotas:
                for q in quotas:
                    if q.deliverable_type.lower() == d.deliverable_type.lower() and q.platform.lower() == d.platform.lower():
                        d.scope_item_id = q.scope_item_id
                        break

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

