from __future__ import annotations

import uuid
import pytest

from app.campaign_intelligence.agents.campaign_strategist import (
    CampaignStrategistAgent,
    campaign_strategist_node,
    validate_strategy_against_brand_rules,
)
from app.campaign_intelligence.orchestration.state import CampaignState
from app.campaign_intelligence.schemas import (
    AudienceObservation,
    BrandContext,
    CampaignBrief,
    CampaignStrategy,
    CompetitorInsight,
    ContractQuota,
    DataSufficiency,
    FormatPerformanceSummary,
    MarketResearchReport,
    PerformancePlaybook,
    PlatformFormatTrend,
    ProhibitedTerm,
    ResearchEvidence,
    StrategicAngle,
    ToneGuideline,
    VerifiedOffer,
)
from app.core.config import settings


# ============================================================================
# Helpers
# ============================================================================

def _build_test_intelligence_artifacts():
    client_id = uuid.uuid4()
    agency_id = uuid.uuid4()

    brief = CampaignBrief(
        client_id=client_id,
        agency_id=agency_id,
        period_month=11,
        period_year=2026,
        objective="Drive 25 qualified plant director demo requests for ARM-X1",
        custom_brief="Target tier-1 automotive manufacturing plants looking to modernize robotic welding cells.",
        target_audience=["Plant Directors", "Automation Engineers"],
        platforms=["linkedin", "instagram"],
        deliverable_preferences=["carousel", "reel"],
    )

    brand_context = BrandContext(
        client_id=client_id,
        agency_id=agency_id,
        business_name="AeroBotix Automation",
        industry="Industrial Robotics & Factory Automation",
        website="https://aerobotix.ai",
        brand_voice=["authoritative", "technical", "engineering-focused", "ROI-driven"],
        tone_guidelines=ToneGuideline(
            do=["Use precise engineering metrics", "Highlight 5-year TCO calculations"],
            dont=["Make unsubstantiated claims", "Use consumer hype buzzwords"],
        ),
        content_pillars=["Repeatability Benchmarks", "TCO Analysis", "Deployment Speed"],
        prohibited_terms=[
            ProhibitedTerm(term="cheapest", is_exact_match=True),
            ProhibitedTerm(term="bargain robotics", is_exact_match=True),
        ],
        verified_offers=[
            VerifiedOffer(
                name="AeroBotix ARM-X1",
                description="6-axis robotic arm with 50kg payload capacity",
                source="confirmed_brand_profile",
            )
        ],
        contract_quotas=[
            ContractQuota(deliverable_type="carousel", platform="linkedin", monthly_quantity=4),
            ContractQuota(deliverable_type="reel", platform="instagram", monthly_quantity=2),
        ],
        confirmed_facts=["Headquartered in Munich", "ISO 9001 certified"],
    )

    market_research = MarketResearchReport(
        industry="Industrial Robotics & Factory Automation",
        confidence_score=0.88,
        target_audience_insights=[
            AudienceObservation(
                segment_name="Automotive Tier-1 Plant Directors",
                pain_point="Long 3-month commissioning cycles causing production downtime",
                trigger_topic="48-hour modular cell deployment and pre-calibrated quick-lock rails",
            )
        ],
        competitor_landscape=[
            CompetitorInsight(
                competitor_name="Legacy Delta Arm Makers",
                observed_angle="Focusing exclusively on legacy speed rather than modular reconfiguration",
                format_used="Static catalog ads",
                differentiation_opportunity="Quantify modular re-tooling cost savings via multi-slide carousels",
            )
        ],
        format_and_platform_trends=[
            PlatformFormatTrend(
                platform="linkedin",
                format="carousel",
                trend_description="Technical comparison carousels achieve 3x dwell time among manufacturing decision makers",
                recommendation="Structure 6-slide TCO breakdowns comparing modular vs legacy arms",
            ),
            PlatformFormatTrend(
                platform="instagram",
                format="reel",
                trend_description="Silent vertical video with burned-in captions has 40% higher completion",
                recommendation="Produce 45s real-time stress tests with clear on-screen load metrics",
            ),
        ],
        strategic_opportunities=[
            "Position deployment speed as the primary hedge against manufacturing downtime",
            "Target plant directors with engineering-grade TCO comparison documents",
        ],
    )

    performance_playbook = PerformancePlaybook(
        data_sufficiency=DataSufficiency.sufficient,
        historical_posts_analyzed=6,
        format_summaries=[
            FormatPerformanceSummary(
                deliverable_type="carousel",
                platform="linkedin",
                total_published=4,
                avg_views=1800.0,
                avg_engagement_rate=6.7,
                top_performing_angles=["Hydraulic vs Electric Actuators TCO", "Modular Robotic Cell Setup in 48h"],
            ),
            FormatPerformanceSummary(
                deliverable_type="reel",
                platform="instagram",
                total_published=2,
                avg_views=5200.0,
                avg_engagement_rate=5.2,
                top_performing_angles=["Robot Arm 50kg Heavy Load Stress Test"],
            ),
        ],
        winning_hooks_and_angles=["Technical TCO breakdowns", "Speed of installation narratives"],
        underperforming_patterns=["Pure aesthetic shots without operational ROI framing"],
        recommended_format_mix={"carousel": 4, "reel": 2},
    )

    return brief, brand_context, market_research, performance_playbook


# ============================================================================
# Tests for Agent 4: Campaign Strategist
# ============================================================================

@pytest.mark.asyncio
async def test_campaign_strategist_full_synthesis():
    """
    Test 1: Full synthesis combining Brand Context, Market Research, and Performance Playbook.
    Verifies cohesive theme, strategic angles, messaging pillars, platform distribution,
    and absence of prohibited terms.
    """
    brief, brand_context, market_research, performance_playbook = _build_test_intelligence_artifacts()

    agent = CampaignStrategistAgent(model_name=settings.GROQ_MODEL)
    strategy = await agent.run(
        brief=brief,
        brand_context=brand_context,
        market_research=market_research,
        performance_playbook=performance_playbook,
    )

    assert isinstance(strategy, CampaignStrategy)

    # 1. Theme and objective
    assert len(strategy.campaign_theme) > 5
    assert len(strategy.primary_objective) > 10
    assert len(strategy.target_audience_definition) > 10

    # 2. Strategic Angles (3+ angles connected to pillars)
    assert len(strategy.strategic_angles) >= 3
    for angle in strategy.strategic_angles:
        assert len(angle.angle_name) > 0
        assert len(angle.rationale) > 10
        assert len(angle.target_audience_segment) > 0
        assert len(angle.aligned_content_pillar) > 0

    # 3. Messaging Pillars
    assert len(strategy.messaging_pillars) >= 2
    for p in strategy.messaging_pillars:
        assert len(p.pillar_name) > 0
        assert len(p.core_message) > 10
        assert len(p.primary_call_to_action) > 0

    # 4. Platform Distribution Strategy
    assert len(strategy.platform_distribution_strategy) >= 2
    platforms_mapped = [p.lower() for p in strategy.platform_distribution_strategy.keys()]
    assert "linkedin" in platforms_mapped
    assert "instagram" in platforms_mapped

    # 5. Pacing and Cadence
    assert len(strategy.pacing_and_cadence) > 10

    # 6. Prohibited term verification (neither 'cheapest' nor 'bargain' allowed)
    violations = validate_strategy_against_brand_rules(strategy, brand_context)
    assert len(violations) == 0


@pytest.mark.asyncio
async def test_campaign_strategist_cold_start():
    """
    Test 2: Strategic synthesis under Cold Start conditions.
    Verifies strategy succeeds when historical performance has 0 posts.
    """
    brief, brand_context, market_research, _ = _build_test_intelligence_artifacts()

    cold_playbook = PerformancePlaybook(
        data_sufficiency=DataSufficiency.cold_start,
        historical_posts_analyzed=0,
        format_summaries=[],
        winning_hooks_and_angles=["Cold start client: Baseline establishing required"],
        underperforming_patterns=[],
        recommended_format_mix={"carousel": 4, "reel": 2},
    )

    agent = CampaignStrategistAgent(model_name=settings.GROQ_MODEL)
    strategy = await agent.run(
        brief=brief,
        brand_context=brand_context,
        market_research=market_research,
        performance_playbook=cold_playbook,
    )

    assert isinstance(strategy, CampaignStrategy)
    assert len(strategy.campaign_theme) > 0
    assert len(strategy.strategic_angles) >= 3


def test_deterministic_strategy_rule_validation():
    """
    Test 3: Deterministic prohibited term validation helper.
    """
    brand_context = BrandContext(
        client_id=uuid.uuid4(),
        agency_id=uuid.uuid4(),
        business_name="Test Robotics",
        prohibited_terms=[ProhibitedTerm(term="cheapest", is_exact_match=True)],
    )

    bad_strategy = CampaignStrategy(
        campaign_theme="The Cheapest Robotic Automation in Manufacturing",
        primary_objective="Sell robots",
        target_audience_definition="Factory owners",
        pacing_and_cadence="Weekly",
    )
    violations = validate_strategy_against_brand_rules(bad_strategy, brand_context)
    assert len(violations) == 1
    assert "cheapest" in violations[0]

    good_strategy = CampaignStrategy(
        campaign_theme="Precision Robotic Repeatability at Scale",
        primary_objective="Sell robots",
        target_audience_definition="Factory owners",
        pacing_and_cadence="Weekly",
    )
    no_violations = validate_strategy_against_brand_rules(good_strategy, brand_context)
    assert len(no_violations) == 0


@pytest.mark.asyncio
async def test_campaign_strategist_node_execution():
    """
    Test 4: LangGraph node execution and telemetry tracking.
    """
    brief, brand_context, market_research, performance_playbook = _build_test_intelligence_artifacts()

    state: CampaignState = {
        "run_id": "test_run_strategy_001",
        "agency_id": brief.agency_id,
        "client_id": brief.client_id,
        "campaign_id": uuid.uuid4(),
        "brief": brief,
        "brand_context": brand_context,
        "market_research": market_research,
        "performance_playbook": performance_playbook,
        "campaign_strategy": None,
        "deliverable_plans": None,
        "quality_evaluation": None,
        "revision_count": 0,
        "max_revisions": 3,
        "workflow_status": "gathering_intelligence",
        "current_agent": None,
        "human_feedback": None,
        "pipeline_agents_executed": ["brand_intelligence", "market_research", "performance_analysis"],
        "agent_traces": [],
        "errors": [],
    }

    result = await campaign_strategist_node(state=state)

    assert "campaign_strategy" in result
    assert isinstance(result["campaign_strategy"], CampaignStrategy)
    assert result["pipeline_agents_executed"] == ["campaign_strategist"]
    assert len(result["agent_traces"]) == 1
    telemetry = result["agent_traces"][0]
    assert telemetry.agent_name == "campaign_strategist"
    assert telemetry.success is True
    assert telemetry.duration_ms > 0
    assert telemetry.model_name == settings.GROQ_MODEL

