from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field

from app.campaign_intelligence.orchestration.state import CampaignState
from app.campaign_intelligence.schemas.brand import BrandContext
from app.campaign_intelligence.schemas.campaign import CampaignBrief
from app.campaign_intelligence.schemas.research import (
    AudienceObservation,
    CompetitorInsight,
    MarketResearchReport,
    PlatformFormatTrend,
    ResearchEvidence,
)
from app.campaign_intelligence.schemas.trace import AgentTelemetry
from app.campaign_intelligence.tools.research_tools import gather_market_evidence
from app.core.config import settings
from app.core.llm import invoke_structured_llm

logger = logging.getLogger(__name__)


# Structured intermediate schemas for LLM synthesis
class AudienceObservationItem(BaseModel):
    segment_name: str
    pain_point: str
    trigger_topic: str
    cited_evidence_indices: list[int] = Field(default_factory=list, description="0-based indices of evidence sources")


class CompetitorInsightItem(BaseModel):
    competitor_name: str
    observed_angle: str
    format_used: str
    differentiation_opportunity: str
    cited_evidence_indices: list[int] = Field(default_factory=list, description="0-based indices of evidence sources")


class PlatformTrendItem(BaseModel):
    platform: str
    format: str
    trend_description: str
    recommendation: str
    cited_evidence_indices: list[int] = Field(default_factory=list, description="0-based indices of evidence sources")


class MarketSynthesisOutput(BaseModel):
    target_audience_insights: list[AudienceObservationItem] = Field(default_factory=list)
    competitor_landscape: list[CompetitorInsightItem] = Field(default_factory=list)
    format_and_platform_trends: list[PlatformTrendItem] = Field(default_factory=list)
    strategic_opportunities: list[str] = Field(default_factory=list)
    buyer_language_snippets: list[str] = Field(
        default_factory=list,
        description="Verbatim colloquial customer quotes, pain phrases, and unfiltered voice-of-customer snippets"
    )
    confidence_score: float = Field(ge=0.0, le=1.0, default=0.85)


class MarketResearchAgent:
    """
    Agent 2: Market & Trend Research
    
    Responsibilities:
    1. Investigate the client's external environment (audience, competitors, format trends).
    2. Dynamically discover market realities using live research tools (zero predefined vertical templates).
    3. Ensure every finding is supported by verifiable ResearchEvidence citations.
    4. Focus on format and algorithm trends specific to the requested platforms.
    5. Produce a validated MarketResearchReport.
    """

    def __init__(self, model_name: str | None = None, temperature: float = 0.2):
        self.model_name = model_name or settings.GROQ_MODEL
        self.temperature = temperature

    async def run(
        self,
        brief: CampaignBrief,
        brand_context: BrandContext | None = None,
    ) -> MarketResearchReport:
        """
        Execute market research discovery and synthesis.
        """
        # 1. Determine scope parameters
        industry = (
            (brand_context.industry if brand_context and brand_context.industry else None)
            or "Commercial Enterprise"
        )
        audience = brief.target_audience or (brand_context.target_audience if brand_context else [])
        platforms = brief.platforms or ["linkedin", "instagram"]
        location = brand_context.location if brand_context else None

        # 2. Gather real external research evidence (with adaptive broadened retry if sparse)
        evidence_list: list[ResearchEvidence] = await gather_market_evidence(
            industry=industry,
            target_audience=audience,
            platforms=platforms,
            custom_brief=brief.custom_brief,
            location=location,
        )
        if len(evidence_list) < 2:
            broadened_evidence = await gather_market_evidence(
                industry=industry,
                target_audience=audience or ["Decision Makers"],
                platforms=platforms,
                custom_brief=brief.objective,
                location=None,
            )
            seen_urls = {ev.source_url for ev in evidence_list}
            for ev in broadened_evidence:
                if ev.source_url not in seen_urls:
                    evidence_list.append(ev)
                    seen_urls.add(ev.source_url)

        # 3. Format evidence for LLM prompt (Select top 5-6 deduplicated items with deep excerpts)
        sorted_evidence = sorted(evidence_list, key=lambda e: e.relevance_score, reverse=True)[:6]
        evidence_prompt_lines: list[str] = []
        for idx, ev in enumerate(sorted_evidence):
            evidence_prompt_lines.append(
                f"[{idx}] {ev.source_title} ({ev.publisher})\n"
                f"     URL: {ev.source_url}\n"
                f"     Excerpt: {ev.excerpt[:1250]}\n"
                f"     Key Takeaway: {ev.key_takeaway[:200]}"
            )
        evidence_text = "\n\n".join(evidence_prompt_lines) if evidence_prompt_lines else "No external evidence retrieved."

        # 4. Prompt Groq LLM for synthesis
        prompt = f"""You are the Market & Trend Research Agent for AgencyOS.
Analyze the external market landscape for a social media campaign based strictly on the retrieved evidence citations.

### CAMPAIGN PARAMETERS
- Industry: {industry}
- Location: {location or 'General'}
- Target Audience: {', '.join(audience) if audience else 'Professional decision makers'}
- Target Platforms: {', '.join(platforms)}
- Objective: {brief.objective}
- Custom Brief Notes: {brief.custom_brief or 'None provided'}

### RETRIEVED RESEARCH EVIDENCE SOURCES
{evidence_text}

### YOUR TASK
Synthesize a comprehensive market research report strictly adhering to the schema:
1. Target Audience Insights: Identify specific segments, real operational pain points, and triggering topics. Cite the relevant evidence indices ([0], [1], etc.).
2. Competitor Landscape: Analyze prevailing competitor angles and identify differentiation opportunities in this industry. Cite relevant evidence indices.
3. Platform & Format Trends: Provide tactical platform trends specifically for {', '.join(platforms)}. Focus on retention, carousel multi-slide dynamics, and hook pacing. Cite evidence indices.
4. Strategic Opportunities: List 3-5 high-leverage differentiation opportunities for this campaign.
5. Buyer Language Snippets: Extract 3-5 verbatim colloquial phrases, complaints, or friction statements customers in this space actually say (from Reddit, reviews, or forum evidence).
6. Confidence Score: A score from 0.0 to 1.0 reflecting the depth and reliability of the evidence.

RULES:
- Do NOT hallucinate fake case-study statistics (e.g. 'Brand X boosted leads by 421%').
- Ground your analysis in real market dynamics and platform specifications.
- Ensure every insight connects to the target platforms ({', '.join(platforms)}).
- All insights, competitor observations, trends, and opportunities MUST be written exclusively in English.
"""

        llm_result: MarketSynthesisOutput = await invoke_structured_llm(
            prompt=prompt,
            schema_class=MarketSynthesisOutput,
            temperature=self.temperature,
            model=self.model_name,
        )

        # 5. Map cited evidence into final Pydantic models (strictly indexing sorted_evidence)
        audience_observations: list[AudienceObservation] = []
        for item in llm_result.target_audience_insights:
            cited_ev = [
                sorted_evidence[i] for i in item.cited_evidence_indices if 0 <= i < len(sorted_evidence)
            ]
            audience_observations.append(
                AudienceObservation(
                    segment_name=item.segment_name,
                    pain_point=item.pain_point,
                    trigger_topic=item.trigger_topic,
                    evidence=cited_ev,
                )
            )

        competitor_insights: list[CompetitorInsight] = []
        for item in llm_result.competitor_landscape:
            cited_ev = [
                sorted_evidence[i] for i in item.cited_evidence_indices if 0 <= i < len(sorted_evidence)
            ]
            competitor_insights.append(
                CompetitorInsight(
                    competitor_name=item.competitor_name,
                    observed_angle=item.observed_angle,
                    format_used=item.format_used,
                    differentiation_opportunity=item.differentiation_opportunity,
                    evidence=cited_ev,
                )
            )

        platform_trends: list[PlatformFormatTrend] = []
        for item in llm_result.format_and_platform_trends:
            cited_ev = [
                sorted_evidence[i] for i in item.cited_evidence_indices if 0 <= i < len(sorted_evidence)
            ]
            platform_trends.append(
                PlatformFormatTrend(
                    platform=item.platform,
                    format=item.format,
                    trend_description=item.trend_description,
                    recommendation=item.recommendation,
                    evidence=cited_ev,
                )
            )

        buyer_snippets = [str(s).strip() for s in llm_result.buyer_language_snippets if str(s).strip()]

        # 6. Assemble complete MarketResearchReport
        return MarketResearchReport(
            industry=industry,
            target_audience_insights=audience_observations,
            competitor_landscape=competitor_insights,
            format_and_platform_trends=platform_trends,
            strategic_opportunities=llm_result.strategic_opportunities,
            buyer_language_snippets=buyer_snippets,
            evidence_sources=sorted_evidence,
            confidence_score=llm_result.confidence_score,
        )


async def market_research_node(
    state: CampaignState,
) -> dict[str, Any]:
    """
    LangGraph node entry point for Market & Trend Research Agent.
    
    1. Operates independently and safely in parallel with Brand Intelligence and Performance Analysis.
    2. Writes exclusively to state["market_research"].
    3. Records execution telemetry (AgentTelemetry).
    """
    start_time = datetime.now(timezone.utc).isoformat()
    start_perf = time.perf_counter()
    agent_name = "market_research"
    model_name = getattr(settings, "MARKET_RESEARCH_MODEL", None) or settings.GROQ_MODEL

    try:
        agent = MarketResearchAgent(model_name=model_name)
        report = await agent.run(
            brief=state["brief"],
            brand_context=state.get("brand_context"),
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
            "market_research": report,
            "pipeline_agents_executed": [agent_name],
            "agent_traces": [telemetry],
            "current_agent": agent_name,
        }

    except Exception as e:
        duration_ms = (time.perf_counter() - start_perf) * 1000.0
        end_time = datetime.now(timezone.utc).isoformat()
        err_msg = f"Market Research failed: {str(e)}"
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

