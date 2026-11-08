from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Any, Callable

from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.campaign_intelligence.orchestration.state import CampaignState
from app.campaign_intelligence.schemas.brand import BrandContext
from app.campaign_intelligence.schemas.campaign import CampaignBrief
from app.campaign_intelligence.schemas.performance import (
    AudienceFatigueSignal,
    DataSufficiency,
    FormatPerformanceSummary,
    PerformancePlaybook,
)
from app.campaign_intelligence.schemas.trace import AgentTelemetry
from app.campaign_intelligence.tools.performance_tools import (
    calculate_format_performance_metrics,
    detect_audience_fatigue_signals,
    get_client_published_deliverables,
)
from app.core.config import settings
from app.core.llm import invoke_structured_llm

logger = logging.getLogger(__name__)


class PerformanceInterpretationOutput(BaseModel):
    """Structured LLM output for interpreting deterministic performance statistics."""
    winning_hooks_and_angles: list[str] = Field(
        default_factory=list,
        description="Qualitative patterns and angles extracted from highest-performing posts"
    )
    underperforming_patterns: list[str] = Field(
        default_factory=list,
        description="Identified fatigue or low-engagement patterns from lowest-performing posts"
    )
    recommended_format_mix: dict[str, int] = Field(
        default_factory=dict,
        description="Recommended format distribution (e.g. {'carousel': 4, 'reel': 2})"
    )


class HistoricalPerformanceAgent:
    """
    Agent 3: Historical Performance Analysis
    
    Responsibilities:
    1. Retrieve published deliverables for this client with multi-tenant isolation.
    2. Deterministically calculate statistical aggregates strictly in Python/SQL (views, likes, comments, shares, engagement rate).
    3. Categorize data sufficiency (cold_start, sparse, sufficient).
    4. Detect audience fatigue signals from diminishing performance trends.
    5. Use centralized LLM ONLY to interpret statistical results (never to invent fake numbers).
    6. Produce a validated PerformancePlaybook.
    """

    def __init__(self, model_name: str | None = None, temperature: float = 0.1):
        self.model_name = model_name or settings.FALLBACK_MODEL
        self.temperature = temperature

    async def run(
        self,
        brief: CampaignBrief,
        db: AsyncSession,
        brand_context: BrandContext | None = None,
    ) -> PerformancePlaybook:
        """
        Execute deterministic historical performance analysis and strategic interpretation.
        """
        # 1. Deterministic database retrieval
        deliverables = await get_client_published_deliverables(
            client_id=brief.client_id,
            agency_id=brief.agency_id,
            db=db,
            limit=50,
        )

        total_posts = len(deliverables)

        # 2. Determine data sufficiency
        if total_posts == 0:
            data_sufficiency = DataSufficiency.cold_start
        elif total_posts < 5:
            data_sufficiency = DataSufficiency.sparse
        else:
            data_sufficiency = DataSufficiency.sufficient

        # 3. Deterministic statistical aggregation
        format_summaries = calculate_format_performance_metrics(deliverables)
        fatigue_signals = detect_audience_fatigue_signals(deliverables)

        # 4. Handle Cold Start scenario (Zero Fabrication)
        if data_sufficiency == DataSufficiency.cold_start:
            default_mix: dict[str, int] = {}
            if brief.deliverable_preferences:
                for pref in brief.deliverable_preferences:
                    default_mix[pref.lower()] = 2
            elif brand_context and brand_context.contract_quotas:
                for q in brand_context.contract_quotas:
                    default_mix[q.deliverable_type.lower()] = q.monthly_quantity
            else:
                default_mix = {"carousel": 4, "reel": 2}

            return PerformancePlaybook(
                data_sufficiency=DataSufficiency.cold_start,
                historical_posts_analyzed=0,
                format_summaries=[],
                winning_hooks_and_angles=[
                    "Cold start client: No historical published deliverables exist in database.",
                    "Strategy should establish baseline performance benchmarks across requested formats.",
                ],
                underperforming_patterns=[
                    "Cold start client: No historical underperformance data available.",
                ],
                fatigue_signals=[],
                recommended_format_mix=default_mix,
            )

        # 5. LLM Interpretation of Calculated Metrics
        summary_text_lines = []
        for s in format_summaries:
            summary_text_lines.append(
                f"- Format: {s.deliverable_type.upper()} on {s.platform.upper()}\n"
                f"  Total Published: {s.total_published} | Avg Views: {s.avg_views} | Avg Likes: {s.avg_likes}\n"
                f"  Avg Engagement Rate: {s.avg_engagement_rate}%\n"
                f"  Top Performing Titles: {', '.join(s.top_performing_angles) if s.top_performing_angles else 'None'}"
            )
        summaries_str = "\n".join(summary_text_lines)

        fatigue_text_lines = [f"- {f.topic_or_format} ({f.fatigue_level}): {f.recommendation}" for f in fatigue_signals]
        fatigue_str = "\n".join(fatigue_text_lines) if fatigue_text_lines else "None detected."

        prompt = f"""You are the Historical Performance Analysis Agent for AgencyOS.
Interpret the following calculated performance statistics for client '{brief.client_id}'.

### DETERMINISTIC STATISTICAL METRICS (Calculated by SQL/Python)
- Total Historical Posts Analyzed: {total_posts}
- Data Sufficiency Category: {data_sufficiency.value}

Format Performance Breakdowns:
{summaries_str}

Audience Fatigue Signals:
{fatigue_str}

### CAMPAIGN OBJECTIVE & SCOPE
- Objective: {brief.objective}
- Format Preferences: {', '.join(brief.deliverable_preferences) if brief.deliverable_preferences else 'Any'}
- Platforms: {', '.join(brief.platforms) if brief.platforms else 'Any'}

### YOUR TASK
Interpret these statistical facts to produce an actionable playbook:
1. Winning Hooks & Angles: Extract 2-4 qualitative patterns from the top-performing formats and titles.
2. Underperforming Patterns: Identify format traps or declining patterns to avoid.
3. Recommended Format Mix: Propose a tactical monthly deliverable count mix allocating the formats.

RULES:
- Do NOT invent or alter the calculated numbers.
- Base your interpretations strictly on the observed statistics.
"""

        try:
            llm_result: PerformanceInterpretationOutput = await invoke_structured_llm(
                prompt=prompt,
                schema_class=PerformanceInterpretationOutput,
                temperature=self.temperature,
                model=self.model_name,
            )

            winning_angles = llm_result.winning_hooks_and_angles
            underperforming = llm_result.underperforming_patterns
            format_mix = llm_result.recommended_format_mix or {s.deliverable_type: s.total_published for s in format_summaries}

        except Exception as e:
            logger.error(f"Error during LLM performance interpretation: {e}")
            winning_angles = [f"Focus on top format: {format_summaries[0].deliverable_type}" if format_summaries else "Maintain baseline formats"]
            underperforming = ["Avoid uncaptioned or low-interaction formats"]
            format_mix = {s.deliverable_type: 2 for s in format_summaries}

        return PerformancePlaybook(
            data_sufficiency=data_sufficiency,
            historical_posts_analyzed=total_posts,
            format_summaries=format_summaries,
            winning_hooks_and_angles=winning_angles,
            underperforming_patterns=underperforming,
            fatigue_signals=fatigue_signals,
            recommended_format_mix=format_mix,
        )


async def performance_analysis_node(
    state: CampaignState,
    db_session_factory: Callable[[], AsyncSession],
) -> dict[str, Any]:
    """
    LangGraph node entry point for Historical Performance Analysis Agent.
    
    1. Obtains a fresh AsyncSession from db_session_factory (never stored in state).
    2. Runs HistoricalPerformanceAgent.
    3. Records execution telemetry (AgentTelemetry).
    4. Returns updates for performance_playbook, pipeline_agents_executed, and agent_traces.
    """
    start_time = datetime.now(timezone.utc).isoformat()
    start_perf = time.perf_counter()
    agent_name = "performance_analysis"
    model_name = settings.FALLBACK_MODEL

    try:
        async with db_session_factory() as db:
            agent = HistoricalPerformanceAgent(model_name=model_name)
            playbook = await agent.run(
                brief=state["brief"],
                db=db,
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
            "performance_playbook": playbook,
            "pipeline_agents_executed": [agent_name],
            "agent_traces": [telemetry],
            "current_agent": agent_name,
        }

    except Exception as e:
        duration_ms = (time.perf_counter() - start_perf) * 1000.0
        end_time = datetime.now(timezone.utc).isoformat()
        err_msg = f"Performance Analysis failed: {str(e)}"
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

