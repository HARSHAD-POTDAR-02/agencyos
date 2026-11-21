from __future__ import annotations

import logging
import re
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field, field_validator

from app.campaign_intelligence.agents.campaign_strategist import CampaignStrategistAgent
from app.campaign_intelligence.collaboration.schemas import (
    ArtifactType,
    BlueprintStage,
    CampaignBlueprintPayload,
)
from app.campaign_intelligence.schemas.strategy import CampaignStrategy
from app.campaign_intelligence.schemas.studio_context import CampaignStudioContext
from app.campaign_intelligence.specialists.base import SpecialistAdapter, SpecialistResult
from app.core.config import settings
from app.core.llm import invoke_structured_llm

logger = logging.getLogger(__name__)


class BlueprintOutput(BaseModel):
    conversational_intro: str
    campaign_theme: str
    slogan: str
    stages: list[BlueprintStage] = Field(min_length=2)
    target_format_mix: dict[str, int] = Field(default_factory=dict)
    suggested_followups: list[str] = Field(default_factory=list)

    @field_validator("target_format_mix", mode="before")
    @classmethod
    def normalize_format_mix(cls, v: Any) -> dict[str, int]:
        if isinstance(v, dict):
            res = {}
            for k, val in v.items():
                try:
                    res[str(k).lower().strip()] = int(val)
                except (ValueError, TypeError):
                    res[str(k).lower().strip()] = 1
            return res or {"reel": 3, "carousel": 2, "static": 1}
        elif isinstance(v, str):
            res = {}
            for fmt in ["reel", "carousel", "static", "graphic", "video", "post"]:
                m = re.search(rf"\b{fmt}s?\b.*?(\d+)", v, re.IGNORECASE)
                if m:
                    res[fmt] = int(m.group(1))
            return res or {"reel": 3, "carousel": 2, "static": 1}
        return {"reel": 3, "carousel": 2, "static": 1}


class CampaignStrategistAdapter(SpecialistAdapter):
    """
    Adapter bridging CampaignStrategistAgent into Campaign Studio.
    Architects macro campaign narrative arcs:
    - Synthesizes Brand Intelligence, Market Research, and Performance data
    - Defines multi-stage pacing (Awareness -> Authority -> Launch)
    - Outputs CampaignBlueprintPayload
    """

    def __init__(self):
        super().__init__(
            specialist_id="campaign_strategist",
            specialist_name="Campaign Strategist & Co-Director",
        )

    async def execute(
        self,
        query: str,
        context: CampaignStudioContext,
        db: AsyncSession,
        on_event: Any | None = None,
        **kwargs: Any,
    ) -> SpecialistResult:
        activity_logs: list[str] = []
        activity_logs.append("Synthesizing strategic campaign architecture across brand, market, and performance data...")

        client_name = context.client_name
        industry = context.client_industry or "General Business"
        brief = context.campaign_brief
        brand_ctx = context.brand_context

        # Brand Context Ingestion
        brand_voice_list = brand_ctx.brand_voice if brand_ctx and brand_ctx.brand_voice else ["Technical", "Authoritative", "Restrained", "Data-driven"]
        brand_voice_str = ", ".join(brand_voice_list)
        pillars = brand_ctx.content_pillars if brand_ctx and brand_ctx.content_pillars else ["Operational Latency", "Cloud Cost Control", "High-Availability Architecture"]
        pillars_str = ", ".join(pillars)
        primary_pillar = pillars[0] if pillars else "Operational Performance"
        secondary_pillar = pillars[1] if len(pillars) > 1 else "Architecture & Efficiency"

        facts = brand_ctx.confirmed_facts if brand_ctx and brand_ctx.confirmed_facts else [f"{client_name} specializes in {industry}"]
        facts_str = "\n".join(f"- {f}" for f in facts[:4])

        offers_str = ""
        verified_offer_name = "Technical Architecture Review & Audit"
        if brand_ctx and getattr(brand_ctx, "verified_offers", None):
            offers_list = []
            for o in brand_ctx.verified_offers[:3]:
                name = getattr(o, "name", str(o))
                desc = getattr(o, "description", "")
                offers_list.append(f"- {name}: {desc}" if desc else f"- {name}")
            offers_str = "\n".join(offers_list)
            if brand_ctx.verified_offers:
                verified_offer_name = getattr(brand_ctx.verified_offers[0], "name", verified_offer_name)
        else:
            offers_str = f"- {verified_offer_name}: Consultation & infrastructure evaluation"

        boundaries = getattr(brand_ctx, "factual_boundaries", None) or []
        boundaries_str = "\n".join(f"- {b}" for b in boundaries[:3]) if boundaries else "- No unverified claims or arbitrary percentage guarantees (e.g. 500% ROI)."

        market_res = context.market_research
        perf_playbook = context.performance_playbook

        market_context_str = "None available."
        if market_res:
            points = []
            if getattr(market_res, "pain_points", None):
                points.append(f"Pain Points: {', '.join(market_res.pain_points[:3])}")
            if getattr(market_res, "buyer_language_snippets", None):
                points.append(f"Buyer Language: {', '.join(market_res.buyer_language_snippets[:3])}")
            if points:
                market_context_str = " | ".join(points)

        perf_context_str = "None available."
        if perf_playbook:
            perf_pts = []
            if getattr(perf_playbook, "winning_hooks_and_angles", None):
                perf_pts.append(f"Winning Angles: {', '.join(perf_playbook.winning_hooks_and_angles[:2])}")
            if getattr(perf_playbook, "recommended_format_mix", None):
                perf_pts.append(f"Recommended Mix: {perf_playbook.recommended_format_mix}")
            if perf_pts:
                perf_context_str = " | ".join(perf_pts)

        prompt = f"""You are the Master Campaign Strategist & Technical Co-Director for AgencyOS.
User Request: "{query}"

CLIENT & BRAND INTELLIGENCE:
- Client Business: {client_name} ({industry})
- Brand Voice Tone: {brand_voice_str}
- Content Pillars: {pillars_str}
- Confirmed Brand Facts:
{facts_str}
- Verified Offers / Services:
{offers_str}
- Factual Boundaries (Strict Guardrails):
{boundaries_str}

CAMPAIGN BRIEF:
- Objective: {brief.objective}
- Custom Brief / Focus: {brief.custom_brief or 'None specified'}
- Target Platforms: {', '.join(brief.platforms or ['instagram', 'linkedin'])}
- Sprint Duration: {brief.duration_days or 7} days (Dates: {brief.start_date} to {brief.end_date})
- Market Research Insights: {market_context_str}
- Historical Performance Insights: {perf_context_str}

YOUR TASK:
Architect a multi-stage campaign sprint blueprint matching BlueprintOutput schema:
1. Define a powerful campaign theme and punchy campaign slogan:
   - Slogan MUST be domain-specific, sharp, and grounded in the client's actual technical value proposition (e.g. "Predictable Latency, Not Hope", "Zero Jitter at 2 AM").
   - FORBIDDEN: NEVER use generic, hollow marketing slogans like "Crafted for Excellence, Built for Results", "Unleash Your Potential", "Growth Driven", or "Empowering Tomorrow".
2. Break down the sprint into 2 to 4 sequential stages (e.g. Stage 1: Problem Agitation & Diagnostic, Stage 2: Architecture Proof & Breakdown, Stage 3: Conversion & Consultation):
   - EVERY stage MUST have a concrete, domain-specific `stage_name` and `objective` / `core_message` explicitly referencing the client's content pillars ({pillars_str}) and technical mechanisms.
   - FORBIDDEN: Do NOT output placeholder generic text like "Highlight common pain points in Industry" or "Demonstrate how the company solves the core challenge".
   - Specify 2 key deliverable formats for each stage (e.g. ["Reel", "Carousel"]).
3. Specify target_format_mix:
   - Return a JSON integer dictionary mapping deliverable types to target counts for this sprint (e.g. {{"reel": 3, "carousel": 2, "static": 1}}).
"""

        try:
            bp_res: BlueprintOutput = await invoke_structured_llm(
                prompt=prompt,
                schema_class=BlueprintOutput,
                temperature=0.3,
                model=getattr(settings, "CAMPAIGN_STRATEGY_MODEL", settings.FALLBACK_MODEL),
            )

            # Slogan Cliché Scrubber
            cliche_slogans = [
                r"built for results",
                r"crafted for excellence",
                r"excellence in",
                r"empowering",
                r"unleash your",
                r"growth driven",
                r"tomorrow today",
                r"passion meets",
            ]
            if any(re.search(pat, bp_res.slogan, re.IGNORECASE) for pat in cliche_slogans):
                bp_res.slogan = f"Predictable {primary_pillar}, Grounded in Verified Architecture"

            # Scrub generic placeholder objectives in stages
            for st in bp_res.stages:
                if re.search(r"highlight common pain points|demonstrate how .* solves the core challenge|drive direct inquiries", st.objective, re.IGNORECASE):
                    if "stage 1" in st.stage_name.lower() or "problem" in st.stage_name.lower():
                        st.objective = f"Diagnose root operational friction and hidden failure modes in {primary_pillar.lower()}."
                    elif "stage 2" in st.stage_name.lower() or "solution" in st.stage_name.lower():
                        st.objective = f"Demonstrate how {client_name}'s verified architecture resolves {secondary_pillar.lower()}."
                    else:
                        st.objective = f"Invite qualified decision-makers to request a {verified_offer_name}."

            payload = CampaignBlueprintPayload(
                campaign_theme=bp_res.campaign_theme,
                slogan=bp_res.slogan,
                stages=bp_res.stages,
                target_format_mix=bp_res.target_format_mix or {"reel": 3, "carousel": 2, "static": 1},
            )
            activity_logs.append(f"Formulated master theme '{bp_res.campaign_theme}' with {len(bp_res.stages)} narrative stages.")

            return SpecialistResult(
                specialist_id=self.specialist_id,
                specialist_name=self.specialist_name,
                reply=f"{bp_res.conversational_intro}\n\n**Master Campaign Theme**: \"{bp_res.campaign_theme}\"\n**Slogan**: *{bp_res.slogan}*",
                artifact_type=ArtifactType.campaign_blueprint,
                artifact_payload=payload.model_dump(),
                activity_logs=activity_logs,
                suggested_followups=bp_res.suggested_followups or [
                    "Draft Day 1 Reel storyboard using this theme",
                    "Ask Market Research for competitor angles on this topic",
                    "Audit strategy against brand boundaries",
                ],
            )
        except Exception as ex:
            logger.error(f"Error in strategist adapter: {ex}", exc_info=True)
            fallback_payload = CampaignBlueprintPayload(
                campaign_theme=f"{client_name}: {primary_pillar} & Architecture Sprint",
                slogan=f"Predictable {primary_pillar}, Grounded in Verified Architecture",
                stages=[
                    BlueprintStage(
                        stage_name=f"Stage 1: Problem Agitation & {primary_pillar} Diagnostics",
                        day_range="Day 1 - 2",
                        objective=f"Diagnose root operational friction and hidden latency/cost bottlenecks in {primary_pillar.lower()}.",
                        key_formats=["Reel", "Carousel"],
                    ),
                    BlueprintStage(
                        stage_name=f"Stage 2: Solution Architecture & {secondary_pillar} Proof",
                        day_range="Day 3 - 4",
                        objective=f"Demonstrate how {client_name}'s verified architecture resolves {secondary_pillar.lower()}.",
                        key_formats=["Reel", "Carousel"],
                    ),
                    BlueprintStage(
                        stage_name=f"Stage 3: Verified Offer & {verified_offer_name}",
                        day_range="Day 5 - 7",
                        objective=f"Connect qualified engineering leaders with a direct {verified_offer_name}.",
                        key_formats=["Reel", "Static Graphic"],
                    ),
                ],
                target_format_mix={"reel": 3, "carousel": 2, "static": 1},
            )
            return SpecialistResult(
                specialist_id=self.specialist_id,
                specialist_name=self.specialist_name,
                reply=f"I've structured a 3-stage narrative blueprint for **{client_name}** spanning {primary_pillar} Diagnostics, Solution Architecture, and Verified Consultation.",
                artifact_type=ArtifactType.campaign_blueprint,
                artifact_payload=fallback_payload.model_dump(),
                activity_logs=activity_logs,
                suggested_followups=["Draft Reel storyboard for Stage 1", "Investigate competitor whitespace"],
            )
