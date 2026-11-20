from __future__ import annotations

import logging
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

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

        prompt = f"""You are the Master Campaign Strategist & Co-Director for AgencyOS.
User Request: "{query}"

Client: {client_name} ({industry})
Objective: {brief.objective}
Custom Brief: {brief.custom_brief or 'None specified'}
Target Platforms: {', '.join(brief.platforms or ['instagram', 'linkedin'])}
Sprint Duration: {brief.duration_days or 7} days (Dates: {brief.start_date} to {brief.end_date})
Market Research Insights: {market_context_str}
Historical Performance Insights: {perf_context_str}

YOUR TASK:
Architect a multi-stage campaign sprint blueprint matching BlueprintOutput schema:
1. Define a powerful campaign theme and punchy campaign slogan.
2. Break down the sprint into 2 to 4 sequential stages (e.g. Stage 1: Problem Agitation, Stage 2: Product Breakdown, Stage 3: Offer Launch).
3. Specify target format mix across platforms.
"""

        try:
            bp_res: BlueprintOutput = await invoke_structured_llm(
                prompt=prompt,
                schema_class=BlueprintOutput,
                temperature=0.3,
                model=getattr(settings, "CAMPAIGN_STRATEGY_MODEL", settings.FALLBACK_MODEL),
            )
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
                campaign_theme=f"{client_name}: Authority & Growth Sprint",
                slogan="Crafted for Excellence, Built for Results",
                stages=[
                    BlueprintStage(
                        stage_name="Stage 1: Problem Awareness & Agitation",
                        day_range="Day 1 - 2",
                        objective=f"Highlight common pain points in {industry}.",
                        key_formats=["Reel", "Carousel"],
                    ),
                    BlueprintStage(
                        stage_name="Stage 2: Solution & Signature Craft",
                        day_range="Day 3 - 4",
                        objective=f"Demonstrate how {client_name} solves the core challenge.",
                        key_formats=["Reel", "Static Graphic"],
                    ),
                    BlueprintStage(
                        stage_name="Stage 3: Verified Offer & Call to Action",
                        day_range="Day 5 - 7",
                        objective="Drive direct inquiries and profile visits.",
                        key_formats=["Reel", "Carousel"],
                    ),
                ],
                target_format_mix={"reel": 3, "carousel": 2, "static": 1},
            )
            return SpecialistResult(
                specialist_id=self.specialist_id,
                specialist_name=self.specialist_name,
                reply=f"I've structured a 3-stage narrative blueprint for **{client_name}** spanning Problem Awareness, Solution Proof, and Offer Conversion.",
                artifact_type=ArtifactType.campaign_blueprint,
                artifact_payload=fallback_payload.model_dump(),
                activity_logs=activity_logs,
                suggested_followups=["Draft Reel storyboard for Stage 1", "Investigate competitor whitespace"],
            )
