from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Any, Callable

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
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
    calculate_instagram_media_metrics,
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

    @field_validator("recommended_format_mix", mode="before")
    @classmethod
    def parse_format_mix(cls, v: Any) -> dict[str, int]:
        if isinstance(v, dict):
            res = {}
            for k, val in v.items():
                try:
                    res[str(k)] = int(val)
                except (ValueError, TypeError):
                    pass
            return res
        if isinstance(v, str):
            import ast, json
            try:
                parsed = json.loads(v)
                if isinstance(parsed, dict):
                    return {str(k): int(val) for k, val in parsed.items()}
            except Exception:
                pass
            try:
                parsed = ast.literal_eval(v)
                if isinstance(parsed, dict):
                    return {str(k): int(val) for k, val in parsed.items()}
            except Exception:
                pass
        return {}


def _get_industry_creative_hypotheses(
    brief: CampaignBrief,
    brand_context: BrandContext | None = None,
) -> list[str]:
    """Derive industry-adapted testable creative hypotheses (Zero fabricated CTR/hold-rate stats)."""
    industry_raw = ""
    if brand_context and brand_context.industry:
        industry_raw = brand_context.industry.lower()
    elif brief.custom_brief or brief.objective:
        combined = f"{brief.objective} {brief.custom_brief or ''}".lower()
        for ind in ["restaurant", "cafe", "food", "clinic", "dental", "medical", "healthcare", "d2c", "ecommerce", "retail", "fashion", "saas", "b2b", "software"]:
            if ind in combined:
                industry_raw = ind
                break

    if any(k in industry_raw for k in ["food", "restaurant", "cafe", "dining", "bar", "hospitality", "bakery", "chef"]):
        return [
            "Sensory & Plating Hook: Showcase signature dish finishing and texture details within the opening 2 seconds to maximize culinary interest.",
            "Social Proof Dining Walkthrough: Demonstrate authentic customer dining ambience, course arrival reactions, and hospitality highlights.",
            "Culinary Provenance & Kitchen Craft: Reveal behind-the-scenes prep methods, artisanal technique, and premium ingredient sourcing.",
            "Menu Milestone Angle: Feature seasonal menu additions or signature tasting flights with explicit tasting notes.",
        ]
    elif any(k in industry_raw for k in ["health", "clinic", "medical", "dental", "care", "wellness", "doctor", "therapy", "pharma"]):
        return [
            "Clinical Misconception Breakdown: Dispel widespread symptom anxieties or myths within the first 3 seconds using clear medical authority.",
            "Step-by-Step Procedure Transparency: Demystify what happens during a consultation or treatment to reduce patient fear and uncertainty.",
            "Patient Care Standard & Hygiene: Highlight sanitized clinic environment, professional accreditation, and practitioner qualifications.",
            "Consultation Readiness FAQ: Address top barrier-to-booking questions, realistic recovery timelines, and preparation steps.",
        ]
    elif any(k in industry_raw for k in ["d2c", "ecommerce", "e-commerce", "retail", "fashion", "beauty", "apparel", "product", "goods"]):
        return [
            "Immediate Problem-Solution Demonstration: Contrast common category frustration against direct product benefit in the first 3 seconds.",
            "Macro Tactile Inspection: Close-up focus on material craftsmanship, ingredient quality, finish, and unboxing presentation.",
            "Side-by-Side Mechanism Contrast: Clearly articulate key differentiators versus legacy mass-market alternatives without naming competitors.",
            "Day-in-the-Life Routine Integration: Show practical daily usage scenarios highlighting ergonomic utility and aesthetic appeal.",
        ]
    elif any(k in industry_raw for k in ["b2b", "saas", "tech", "software", "enterprise", "agency", "consulting", "fintech"]):
        return [
            "Workflow Bottleneck Agitation: Address a specific time-consuming operational or spreadsheet breakdown familiar to team leads.",
            "System Architecture & Teardown: Provide an objective step-by-step walkthrough of how automated workflows replace manual error loops.",
            "Implementation Blueprint: Outline clear phase-by-phase rollout expectations and timeline to eliminate onboarding hesitation.",
            "Peer Framework Breakdown: Share actionable industry rubrics or decision checklists that establish strategic credibility.",
        ]
    else:
        return [
            "Target Audience Pain Point Hook: Open with an incisive question isolating the primary challenge facing prospective clients.",
            "Operational Process Transparency: Walk through the proprietary methodology step-by-step to demonstrate structured expertise.",
            "Founder Conviction / Alternative Approach: Explain why traditional industry approaches fail and how this specific model solves the gap.",
            "Deliverable Clarity & Value Blueprint: Itemize exactly what the client receives with clear expectations and tangible milestones.",
        ]


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
        self.model_name = model_name or settings.GROQ_MODEL
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
        # 1. Check ingested client historical social posts (Meta/IG/FB)
        from app.campaign_intelligence.tools.performance_tools import (
            calculate_historical_posts_metrics,
            get_client_historical_posts,
        )
        historical_posts = await get_client_historical_posts(
            client_id=brief.client_id,
            db=db,
            limit=100,
        )

        total_posts = 0
        live_ig_used = False
        historical_db_used = False
        format_summaries: list[FormatPerformanceSummary] = []
        fatigue_signals: list[AudienceFatigueSignal] = []

        if historical_posts:
            total_posts = len(historical_posts)
            format_summaries = calculate_historical_posts_metrics(historical_posts)
            historical_db_used = True
        else:
            # Fallback to internal AgencyOS published deliverables
            deliverables = await get_client_published_deliverables(
                client_id=brief.client_id,
                agency_id=brief.agency_id,
                db=db,
                limit=50,
            )
            total_posts = len(deliverables)
            if total_posts > 0:
                format_summaries = calculate_format_performance_metrics(deliverables)
                fatigue_signals = detect_audience_fatigue_signals(deliverables)

        # 2. If 0 posts found in DB, check connected Instagram account on the fly
        if total_posts == 0:
            try:
                from app.models.client_social_account import ClientSocialAccount
                from app.services.instagram_service import InstagramService

                stmt = select(ClientSocialAccount).where(
                    ClientSocialAccount.client_id == brief.client_id,
                    ClientSocialAccount.platform == "instagram",
                    ClientSocialAccount.is_active == True,
                )
                res = await db.execute(stmt)
                social_account = res.scalars().first()

                if social_account and social_account.access_token and social_account.instagram_business_id:
                    ig_service = InstagramService(
                        access_token=social_account.access_token,
                        instagram_account_id=social_account.instagram_business_id,
                        facebook_page_id=social_account.facebook_page_id,
                    )
                    media_resp = await asyncio.wait_for(
                        asyncio.to_thread(ig_service.get_media_list, 25),
                        timeout=8.0,
                    )
                    ig_items = []
                    if isinstance(media_resp, dict) and media_resp.get("success"):
                        data_block = media_resp.get("data")
                        if isinstance(data_block, dict):
                            ig_items = data_block.get("data") or []
                        elif isinstance(data_block, list):
                            ig_items = data_block

                    if ig_items and len(ig_items) >= 1:
                        total_posts = len(ig_items)
                        format_summaries = calculate_instagram_media_metrics(ig_items)
                        live_ig_used = True
            except Exception as e:
                logger.warning(f"Connected Instagram fallback sync failed: {e}")
                # Cleanly falls through to cold_start

        # 3. Determine data sufficiency
        if total_posts == 0:
            data_sufficiency = DataSufficiency.cold_start
        elif total_posts < 5:
            data_sufficiency = DataSufficiency.sparse
        else:
            data_sufficiency = DataSufficiency.sufficient

        # 5. Handle Cold Start scenario (Zero Fabrication)
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

            cold_start_hypotheses = _get_industry_creative_hypotheses(brief, brand_context)

            cold_start_underperforming = [
                "No historical baseline yet — avoid committing all sprint slots to a single hook style; test at least 3 distinct angles in Sprint 1.",
                "Avoid unverified engagement assumptions; do not rely on high-production aesthetics without clear narrative hooks.",
                "Avoid generic category claims without concrete proof points or demonstrations.",
            ]

            return PerformancePlaybook(
                data_sufficiency=DataSufficiency.cold_start,
                historical_posts_analyzed=0,
                format_summaries=[],
                winning_hooks_and_angles=[
                    "Cold start client: Strategy should establish baseline performance benchmarks across requested formats without historical bias.",
                    *cold_start_hypotheses,
                ],
                underperforming_patterns=cold_start_underperforming,
                fatigue_signals=[],
                recommended_format_mix=default_mix,
            )

        # 6. Deterministic Metrics Disambiguation & LLM Interpretation
        total_interactions = sum(
            int(s.avg_likes + s.avg_comments + s.avg_shares) * s.total_published
            for s in format_summaries
        )

        summary_text_lines = []
        for s in format_summaries:
            format_interactions = int(s.avg_likes + s.avg_comments + s.avg_shares) * s.total_published
            format_share_pct = (
                round((format_interactions / total_interactions) * 100, 1)
                if total_interactions > 0
                else 0.0
            )
            summary_text_lines.append(
                f"- Format: {s.deliverable_type.upper()} on {s.platform.upper()}\n"
                f"  post_count: {s.total_published} post(s) observed\n"
                f"  engagement_rate_pct: {s.avg_engagement_rate}% (calculated strictly as interactions/views on these {s.total_published} post(s); NOT portfolio volume share)\n"
                f"  format_share_of_engagement_pct: {format_share_pct}% of total observed interactions across all posts\n"
                f"  Avg Views: {s.avg_views} | Avg Likes: {s.avg_likes} | Avg Shares: {s.avg_shares}\n"
                f"  Top Performing Angles: {', '.join(s.top_performing_angles) if s.top_performing_angles else 'None'}"
            )
        summaries_str = "\n".join(summary_text_lines)

        fatigue_text_lines = [f"- {f.topic_or_format} ({f.fatigue_level}): {f.recommendation}" for f in fatigue_signals]
        fatigue_str = "\n".join(fatigue_text_lines) if fatigue_text_lines else "None detected."

        sparse_instructions = ""
        if data_sufficiency == DataSufficiency.sparse:
            sparse_instructions = f"""
### CRITICAL SPARSE DATA GUARDRAILS (ONLY {total_posts} POST(S) OBSERVED):
- The sample size is extremely small ({total_posts} post(s)).
- Label deterministic metrics unambiguously: post_count, engagement_rate_pct, format_share_of_engagement_pct.
- DO NOT confuse engagement_rate_pct (performance on {total_posts} post) with overall portfolio share or audience preference.
- NEVER invent generic industry baseline percentage splits (e.g. NEVER output "50% Reels, 30% Carousels, 20% Statics").
- Formulate testable sprint hypotheses prefixed with "[SPARSE_DATA_HYPOTHESIS]" to validate creative angles with controlled low-risk tests.
- Format mix recommendations must be expressed as concrete integer deliverable counts for the sprint (e.g. {{'carousel': 2, 'reel': 2}}), respecting the client's requested preferences, NOT percentage splits.
"""

        prompt = f"""You are the Historical Performance Analysis Agent for AgencyOS.
Interpret the following calculated performance statistics for client '{brief.client_id}'.

### DETERMINISTIC STATISTICAL METRICS (Calculated by SQL/Python)
- Total Historical Posts Analyzed: {total_posts}
- Data Sufficiency Category: {data_sufficiency.value}
- Data Source: {'Ingested Social History (Meta Graph API)' if historical_db_used else ('Live Instagram Sync' if live_ig_used else 'Client Deliverables Database')}

Format Performance Breakdowns:
{summaries_str}

Audience Fatigue Signals:
{fatigue_str}

### CAMPAIGN OBJECTIVE & SCOPE
- Objective: {brief.objective}
- Format Preferences: {', '.join(brief.deliverable_preferences) if brief.deliverable_preferences else 'Any'}
- Platforms: {', '.join(brief.platforms) if brief.platforms else 'Any'}
{sparse_instructions}
### YOUR TASK
Interpret these statistical facts to produce an actionable playbook:
1. Winning Hooks & Angles: Extract qualitative patterns from observed posts, combined with testable sprint hypotheses.
2. Underperforming Patterns: Identify format traps, declining patterns, or sparse data limitations to avoid.
3. Recommended Format Mix: Propose a tactical deliverable count mix allocating integer post counts for the sprint.

RULES:
- Do NOT invent or alter the calculated numbers.
- Base your interpretations strictly on the observed statistics.
- Never invent CTR, hold rates, conversion rates, or industry benchmarks not provided in the input.
- Never output hallucinated percentage metrics or generic percentage splits (like "50% Reels, 30% Carousels, 20% Statics").
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

        # Deterministic Python post-filter for sparse mode (enforces testable hypotheses & strips generic splits)
        if data_sufficiency == DataSufficiency.sparse:
            creative_hypotheses = _get_industry_creative_hypotheses(brief, brand_context)
            sparse_hypotheses = [
                f"[SPARSE_DATA_HYPOTHESIS] {h}"
                for h in creative_hypotheses[:3]
                if not any(h[:25].lower() in a.lower() for a in winning_angles)
            ]
            cleaned_winning = [
                a for a in winning_angles
                if not any(b in a.lower() for b in ("50% reels", "30% carousels", "20% statics"))
            ]
            winning_angles = [
                f"[SPARSE_DATA_OBSERVATION] Limited historical sample ({total_posts} post(s) analyzed). "
                f"Format {format_summaries[0].deliverable_type} showed {format_summaries[0].avg_engagement_rate}% engagement rate.",
                *cleaned_winning,
                *sparse_hypotheses,
            ]
            sparse_guard = (
                f"Sparse sample size ({total_posts} post(s)): avoid over-indexing on single-post performance or "
                f"assuming permanent audience format preferences without at least 5-10 published benchmark tests."
            )
            cleaned_underperforming = [
                u for u in underperforming
                if not any(b in u.lower() for b in ("50% reels", "30% carousels", "20% statics"))
            ]
            underperforming = [sparse_guard, *cleaned_underperforming]

            # In sparse mode, ensure format mix is concrete integer counts, not percentages
            if not format_mix:
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
    model_name = settings.GROQ_MODEL

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

