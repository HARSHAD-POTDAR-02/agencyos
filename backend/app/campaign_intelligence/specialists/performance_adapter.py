from __future__ import annotations

import logging
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from app.campaign_intelligence.agents.historical_performance import HistoricalPerformanceAgent
from app.campaign_intelligence.collaboration.schemas import (
    ArtifactType,
    FormatPerformanceMetric,
    MetricMeasurementBasis,
    PerformanceArtifactPayload,
    SocialPlatform,
)
from app.campaign_intelligence.schemas.performance import (
    DataSufficiency,
    PerformancePlaybook,
)
from app.campaign_intelligence.schemas.studio_context import CampaignStudioContext
from app.campaign_intelligence.specialists.base import SpecialistAdapter, SpecialistResult
from app.campaign_intelligence.tools.performance_tools import (
    calculate_format_performance_metrics,
    detect_audience_fatigue_signals,
    get_client_published_deliverables,
)
from app.core.config import settings
from app.core.llm import invoke_structured_llm

logger = logging.getLogger(__name__)


class PerformanceConversationalReply(BaseModel):
    conversational_summary: str
    format_recommendation: str
    fatigue_warning_or_opportunity: str
    suggested_followups: list[str] = Field(default_factory=list)


class PerformanceSpecialistAdapter(SpecialistAdapter):
    """
    Adapter bridging HistoricalPerformanceAgent into Campaign Studio.
    Enforces honest statistical integrity:
    - Never fabricates fake metrics for cold starts.
    - Explicitly marks missing/insufficient data as None with zero-sample basis.
    - Analyzes fatigue signals and empirical format conversion ratios.
    """

    def __init__(self):
        super().__init__(
            specialist_id="historical_performance",
            specialist_name="Performance Intelligence Specialist",
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
        activity_logs.append("Querying client published deliverables and engagement analytics...")

        # 1. Deterministic database retrieval (Check ingested social history first)
        from app.campaign_intelligence.tools.performance_tools import (
            calculate_historical_posts_metrics,
            get_client_historical_posts,
        )
        historical_posts = await get_client_historical_posts(
            client_id=context.client_id,
            db=db,
            limit=100,
        )

        total_posts = 0
        format_summaries = []
        fatigue_signals = []

        if historical_posts:
            total_posts = len(historical_posts)
            activity_logs.append(f"Retrieved {total_posts} ingested historical posts from connected Meta accounts.")
            format_summaries = calculate_historical_posts_metrics(historical_posts)
        else:
            deliverables = await get_client_published_deliverables(
                client_id=context.client_id,
                agency_id=context.agency_id,
                db=db,
                limit=50,
            )
            total_posts = len(deliverables)
            activity_logs.append(f"Retrieved {total_posts} published deliverables from AgencyOS database.")
            if total_posts > 0:
                format_summaries = calculate_format_performance_metrics(deliverables)
                fatigue_signals = detect_audience_fatigue_signals(deliverables)

        # 2. Determine Data Sufficiency
        if total_posts == 0:
            data_sufficiency_str = "cold_start"
        elif total_posts < 5:
            data_sufficiency_str = "sparse"
        else:
            data_sufficiency_str = "sufficient"

        # 4. Construct Typed FormatPerformanceMetric list with explicit None support
        format_metrics: list[FormatPerformanceMetric] = []
        for summary in format_summaries:
            platform_val = SocialPlatform.instagram
            if "linkedin" in summary.platform.lower():
                platform_val = SocialPlatform.linkedin
            elif "facebook" in summary.platform.lower():
                platform_val = SocialPlatform.facebook

            has_data = summary.total_published > 0
            format_metrics.append(
                FormatPerformanceMetric(
                    deliverable_format=summary.deliverable_type,
                    platform=platform_val,
                    sample_size=summary.total_published,
                    avg_engagement_rate=summary.avg_engagement_rate if has_data else None,
                    avg_views=summary.avg_views if has_data else None,
                    avg_shares=summary.avg_shares if has_data else None,
                    top_performing_angles=summary.top_performing_angles,
                    measurement_basis=MetricMeasurementBasis(
                        denominator="total_views",
                        measurement_window_days=90,
                        aggregation_method="mean",
                    ) if has_data else None,
                )
            )

        # 5. Handle Recommended Format Ratios
        fatigue_warnings = [
            f"{f.topic_or_format} ({f.fatigue_level} fatigue): {f.recommendation}"
            for f in fatigue_signals
        ]

        if data_sufficiency_str == "cold_start":
            if context.campaign_brief and context.campaign_brief.deliverable_preferences:
                recommended_mix = {p.lower(): 2 for p in context.campaign_brief.deliverable_preferences}
            elif context.brand_context and context.brand_context.contract_quotas:
                recommended_mix = {q.deliverable_type.lower(): q.monthly_quantity for q in context.brand_context.contract_quotas}
            else:
                recommended_mix = {"reel": 2, "carousel": 2}
        elif data_sufficiency_str == "sparse":
            # For sparse mode, recommend a balanced testable sprint allocation
            recommended_mix = {"reel": 2, "carousel": 2}
            if format_summaries:
                top_format = max(format_summaries, key=lambda s: s.avg_engagement_rate).deliverable_type
                recommended_mix[top_format] = recommended_mix.get(top_format, 2) + 1
        else:
            # Rebalance format ratio favoring highest engagement format
            recommended_mix = {"reel": 3, "carousel": 3, "static": 2}
            if format_summaries:
                top_format = max(format_summaries, key=lambda s: s.avg_engagement_rate).deliverable_type
                recommended_mix[top_format] = recommended_mix.get(top_format, 2) + 2

        artifact_payload = PerformanceArtifactPayload(
            data_sufficiency=data_sufficiency_str,
            sample_size_total=total_posts,
            format_metrics=format_metrics,
            creative_fatigue_signals=fatigue_warnings,
            recommended_format_ratio=recommended_mix,
        )

        detailed_metrics_lines = []
        for m in format_metrics:
            if m.avg_engagement_rate is not None:
                detailed_metrics_lines.append(
                    f"- {m.deliverable_format.upper()} ({m.platform.value}): post_count={m.sample_size}, "
                    f"engagement_rate_pct={m.avg_engagement_rate}% (observed interactions/views on this format; NOT portfolio share), "
                    f"avg_views={m.avg_views or 'N/A'}"
                )
        metrics_block = "\n".join(detailed_metrics_lines) if detailed_metrics_lines else "None recorded"

        # 6. Synthesize Conversational Answer
        prompt = f"""You are the Performance Intelligence Specialist for AgencyOS.
User Query: "{query}"

Client Track Record:
- Total Historical Posts Analyzed: {total_posts}
- Data Sufficiency: {data_sufficiency_str.upper()}
- Format Performance Metrics (Deterministic SQL/Python):
{metrics_block}
- Creative Fatigue Warnings: {fatigue_warnings}
- Recommended Format Mix (Deliverable Counts): {recommended_mix}

RULES:
1. If data_sufficiency is 'cold_start', be direct: state clearly that this client has no published deliverables yet in AgencyOS.
2. If data_sufficiency is 'sparse' (< 5 posts), state clearly that the historical sample is sparse ({total_posts} post(s)). Never confuse engagement_rate_pct (e.g. 66.7% on 1 post) with portfolio volume share or permanent audience preference.
3. NEVER fabricate generic percentage splits (e.g. NEVER output "50% Reels, 30% Carousels, 20% Statics"). Instead, output testable sprint hypotheses and concrete integer deliverable counts for initial empirical benchmarking.
4. If sufficient data is available, point out specific winning angles and fatigue warnings.
5. Keep the conversational summary concise and executive.
"""

        try:
            llm_reply: PerformanceConversationalReply = await invoke_structured_llm(
                prompt=prompt,
                schema_class=PerformanceConversationalReply,
                temperature=0.2,
                model=settings.FALLBACK_MODEL,
            )
            # Post-filter to strip any generic percentage splits from the reply
            cleaned_format_rec = llm_reply.format_recommendation
            for banned in ("50% reels", "30% carousels", "20% statics"):
                if banned in cleaned_format_rec.lower():
                    cleaned_format_rec = f"Allocate {', '.join([f'{k.upper()}: {v}' for k, v in recommended_mix.items()])} for empirical sprint testing."
                    break

            reply_text = (
                f"{llm_reply.conversational_summary}\n\n"
                f"**Format Recommendation**: {cleaned_format_rec}\n"
                f"**Signals**: {llm_reply.fatigue_warning_or_opportunity}"
            )
            followups = llm_reply.suggested_followups or [
                "Recommend format distribution for next sprint",
                "Audit top performing angles",
                "Check for topic fatigue",
            ]
        except Exception as ex:
            logger.warning(f"Error generating performance conversational reply: {ex}")
            if total_posts == 0:
                reply_text = (
                    f"**Cold Start Client**: **{context.client_name}** currently has no published deliverables "
                    f"recorded in AgencyOS. I recommend establishing an empirical baseline with testable sprint hypotheses "
                    f"across contracted formats: {', '.join([f'{k.upper()}: {v}' for k, v in recommended_mix.items()])}."
                )
            elif total_posts < 5:
                reply_text = (
                    f"**Sparse Historical Sample**: I analyzed {total_posts} published deliverable(s) for **{context.client_name}**. "
                    f"Because data is sparse (sample size < 5), avoid over-indexing on single-post performance. "
                    f"Recommended testing mix: {', '.join([f'{k.upper()}: {v}' for k, v in recommended_mix.items()])}."
                )
            else:
                reply_text = (
                    f"I analyzed {total_posts} published deliverables for **{context.client_name}**. "
                    f"Recommended format distribution: {', '.join([f'{k.upper()}: {v}' for k, v in recommended_mix.items()])}."
                )
            followups = ["Optimize format mix", "Examine past angles"]

        return SpecialistResult(
            specialist_id=self.specialist_id,
            specialist_name=self.specialist_name,
            reply=reply_text,
            artifact_type=ArtifactType.performance_playbook,
            artifact_payload=artifact_payload.model_dump(),
            activity_logs=activity_logs,
            suggested_followups=followups,
        )
