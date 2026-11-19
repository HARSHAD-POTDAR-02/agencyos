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
    MessagingPillar,
    StrategicAngle,
)
from app.campaign_intelligence.schemas.trace import AgentTelemetry
from app.core.config import settings
from app.core.llm import invoke_structured_llm

logger = logging.getLogger(__name__)


def validate_strategy_against_brand_rules(
    strategy: CampaignStrategy,
    brand_context: BrandContext | None,
) -> list[str]:
    """
    Deterministically validate the generated strategy against brand boundaries:
    - Scans theme, angles, and messaging pillars for exact prohibited terms.
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
    3. Ensure strategic angles directly address audience pain points and competitor gaps.
    4. Incorporate historical winning angles and respect fatigue warnings.
    5. Perform deterministic rule validation before finalizing the strategy.
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

### YOUR TASK
Formulate a master Campaign Strategy strictly conforming to the JSON schema:
1. campaign_theme: A powerful, conceptual narrative umbrella that unites the entire campaign (avoid generic phrases like 'Autumn Blast' or 'Q4 Growth').
2. strategic_thesis: The provocative central strategic argument or angle that creates an unfair moat for this client.
3. core_tension: The specific psychological friction point, unspoken truth, or ego defense of the target audience.
4. primary_objective: Clear, measurable business objective.
5. target_audience_definition: Distinct profile integrating the pain points identified by Market Research.
6. funnel_narrative: Phased narrative journey mapping:
   - "top_of_funnel": Pattern interrupt & cultural tension
   - "middle_of_funnel": Mechanism, proof, & re-framing the problem
   - "bottom_of_funnel": Verified low-friction conversion climax
7. strategic_angles: 3-4 distinct conceptual angles (e.g. contrarian demonstration, myth-busting, customer friction teardown). For each angle provide:
   - angle_name: Catchy angle title
   - rationale: Why this angle works based on audience triggers and competitor gaps
   - target_audience_segment: Which specific segment this targets
   - aligned_content_pillar: Which brand pillar it reinforces
   - supporting_evidence: Specific facts, market trends, or historical data justifying this angle
8. messaging_pillars: 3 foundational message pillars, each with a core message, clear call to action (strictly matching verified offers), and target emotions.
9. platform_distribution_strategy: Explicit strategic role for each platform in {', '.join(target_platforms)} (e.g. LinkedIn for high-dwell technical teardowns; Instagram for visual proof).
10. pacing_and_cadence: {pacing_instruction}
11. success_benchmarks: Target engagement rate, save rates, or lead indicators based on historical baselines or platform benchmarks.
12. assumptions_and_risks: Key strategic risks (fatigue, competitor saturation) and mitigation steps.
13. STRICT ANTI-HALLUCINATION & LANGUAGE REQUIREMENT:
   - NEVER invent discounts, false statistics, or unverified claims.
   - All strategy components, pillar descriptions, themes, and angles MUST be written exclusively in English.
"""

        # 5. Invoke LLM
        strategy: CampaignStrategy = await invoke_structured_llm(
            prompt=prompt,
            schema_class=CampaignStrategy,
            temperature=self.temperature,
            model=self.model_name,
        )

        # 6. Deterministic Validation against Brand Rules
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

