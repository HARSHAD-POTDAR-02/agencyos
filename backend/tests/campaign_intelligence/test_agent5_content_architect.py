from __future__ import annotations

import uuid
import pytest

from app.campaign_intelligence.agents.content_architect import (
    ContentArchitectAgent,
    content_architect_node,
)
from app.campaign_intelligence.orchestration.state import CampaignState
from app.campaign_intelligence.schemas import (
    BrandContext,
    CampaignBrief,
    CampaignStrategy,
    ContractQuota,
    DeliverablePlan,
    MessagingPillar,
    StrategicAngle,
    ToneGuideline,
    VerifiedOffer,
)
from app.core.config import settings


# ============================================================================
# Helpers
# ============================================================================

def _build_test_strategy_and_context():
    client_id = uuid.uuid4()
    agency_id = uuid.uuid4()
    scope_id_carousel = uuid.uuid4()
    scope_id_reel = uuid.uuid4()

    brief = CampaignBrief(
        client_id=client_id,
        agency_id=agency_id,
        period_month=11,
        period_year=2026,
        objective="Drive 25 qualified plant director demo requests for ARM-X1",
        target_audience=["Plant Directors", "Automation Engineers"],
        platforms=["linkedin", "instagram"],
        deliverable_preferences=["carousel", "reel"],
    )

    brand_context = BrandContext(
        client_id=client_id,
        agency_id=agency_id,
        business_name="AeroBotix Automation",
        industry="Industrial Robotics & Factory Automation",
        brand_voice=["authoritative", "technical", "ROI-driven"],
        tone_guidelines=ToneGuideline(
            do=["Highlight TCO and uptime metrics", "Focus on modular deployment"],
            dont=["Use consumer hype buzzwords", "Make unsubstantiated speed claims"],
        ),
        contract_quotas=[
            ContractQuota(
                scope_item_id=scope_id_carousel,
                deliverable_type="carousel",
                platform="linkedin",
                monthly_quantity=2,
            ),
            ContractQuota(
                scope_item_id=scope_id_reel,
                deliverable_type="reel",
                platform="instagram",
                monthly_quantity=1,
            ),
        ],
        verified_offers=[
            VerifiedOffer(
                name="AeroBotix ARM-X1",
                description="6-axis modular precision robot arm",
                source="confirmed_brand_profile",
            )
        ],
    )

    strategy = CampaignStrategy(
        campaign_theme="Modular Momentum: Slashing Commissioning Downtime",
        primary_objective="Generate 25 qualified demos for ARM-X1 modular cells",
        target_audience_definition="Automotive Tier-1 Plant Directors needing fast robotic deployment",
        strategic_angles=[
            StrategicAngle(
                angle_name="48-Hour Rapid Deployment",
                rationale="Directly solves the 3-month commissioning bottleneck",
                target_audience_segment="Automotive Plant Directors",
                aligned_content_pillar="Deployment Speed",
                supporting_evidence=["60% lead time reduction trigger from research"],
            ),
            StrategicAngle(
                angle_name="Modular TCO Architecture",
                rationale="Proves 2-year ROI vs legacy fixed delta arms",
                target_audience_segment="ROI Decision Makers",
                aligned_content_pillar="TCO Analysis",
                supporting_evidence=["Historical TCO posts drove 6.7% engagement"],
            ),
        ],
        messaging_pillars=[
            MessagingPillar(
                pillar_name="Deployment Velocity",
                core_message="Deploy a fully-qualified robotic welding cell in under 4 weeks.",
                primary_call_to_action="Schedule a live facility walkthrough",
                target_emotions=["confidence", "urgency"],
            ),
            MessagingPillar(
                pillar_name="Engineering Precision",
                core_message="Sub-millimeter repeatability across 10,000 continuous hours.",
                primary_call_to_action="Download technical CAD and spec sheet",
                target_emotions=["trust", "assurance"],
            ),
        ],
        platform_distribution_strategy={
            "linkedin": "Technical teardown carousels for engineering executives",
            "instagram": "Silent vertical video reels demonstrating high-speed load tests",
        },
        pacing_and_cadence="Week 1: Problem Awareness; Week 2: Technical TCO; Week 3: Benchmark; Week 4: Demos",
    )

    return brief, brand_context, strategy, scope_id_carousel, scope_id_reel


# ============================================================================
# Tests for Agent 5: Content Architect
# ============================================================================

@pytest.mark.asyncio
async def test_content_architect_polymorphic_generation():
    """
    Test 1: Polymorphic deliverable generation matching contract quotas.
    Verifies that Carousels contain slide-by-slide breakdowns and Reels contain
    timestamped director beats.
    """
    brief, brand_context, strategy, scope_carousel, scope_reel = _build_test_strategy_and_context()

    agent = ContentArchitectAgent(model_name=settings.GROQ_MODEL)
    deliverables = await agent.run(
        strategy=strategy,
        brief=brief,
        brand_context=brand_context,
    )

    assert isinstance(deliverables, list)
    # Strict Quota Check: exactly 3 deliverables (2 Carousels + 1 Reel)
    assert len(deliverables) == 3

    carousels = [d for d in deliverables if d.deliverable_type.lower() == "carousel"]
    reels = [d for d in deliverables if d.deliverable_type.lower() == "reel"]

    assert len(carousels) == 2
    assert len(reels) == 1

    # Verify Carousel Polymorphic Architecture
    for c in carousels:
        assert c.platform.lower() == "linkedin"
        assert len(c.title) > 0
        assert len(c.primary_hook) > 0
        assert len(c.caption) > 10
        assert len(c.call_to_action) > 0
        assert 1 <= c.planned_week <= 4
        # Slide structure check
        assert len(c.carousel_slides) >= 4
        for slide in c.carousel_slides:
            assert slide.slide_number >= 1
            assert len(slide.headline) > 0
            assert len(slide.visual_layout) > 0

    # Verify Reel Polymorphic Architecture
    r = reels[0]
    assert r.platform.lower() == "instagram"
    assert len(r.title) > 0
    assert len(r.primary_hook) > 0
    assert len(r.hook_options) >= 1
    assert len(r.caption) > 10
    assert len(r.call_to_action) > 0
    assert 1 <= r.planned_week <= 4
    # Scene director beats check
    assert len(r.reel_scenes) >= 3
    for scene in r.reel_scenes:
        assert scene.scene_number >= 1
        assert len(scene.timestamp_range) > 0
        assert len(scene.visual_action) > 0
        assert len(scene.spoken_audio_or_voiceover) > 0


@pytest.mark.asyncio
async def test_content_architect_node_missing_strategy_safeguard():
    """
    Test 2: Graceful error handling when strategy is missing.
    """
    brief, brand_context, _, _, _ = _build_test_strategy_and_context()

    state: CampaignState = {
        "run_id": "test_run_fail_001",
        "agency_id": brief.agency_id,
        "client_id": brief.client_id,
        "campaign_id": uuid.uuid4(),
        "brief": brief,
        "brand_context": brand_context,
        "market_research": None,
        "performance_playbook": None,
        "campaign_strategy": None,  # Missing!
        "deliverable_plans": None,
        "quality_evaluation": None,
        "revision_count": 0,
        "max_revisions": 3,
        "workflow_status": "strategizing",
        "current_agent": None,
        "human_feedback": None,
        "pipeline_agents_executed": [],
        "agent_traces": [],
        "errors": [],
    }

    result = await content_architect_node(state=state)
    assert "errors" in result
    assert any("campaign_strategy is missing" in err for err in result["errors"])
    assert result["current_agent"] == "content_architect"


@pytest.mark.asyncio
async def test_content_architect_node_execution():
    """
    Test 3: LangGraph node execution and telemetry tracking.
    """
    brief, brand_context, strategy, _, _ = _build_test_strategy_and_context()

    state: CampaignState = {
        "run_id": "test_run_content_001",
        "agency_id": brief.agency_id,
        "client_id": brief.client_id,
        "campaign_id": uuid.uuid4(),
        "brief": brief,
        "brand_context": brand_context,
        "market_research": None,
        "performance_playbook": None,
        "campaign_strategy": strategy,
        "deliverable_plans": None,
        "quality_evaluation": None,
        "revision_count": 0,
        "max_revisions": 3,
        "workflow_status": "strategizing",
        "current_agent": None,
        "human_feedback": None,
        "pipeline_agents_executed": ["brand_intelligence", "market_research", "performance_analysis", "campaign_strategist"],
        "agent_traces": [],
        "errors": [],
    }

    result = await content_architect_node(state=state)

    assert "deliverable_plans" in result
    assert isinstance(result["deliverable_plans"], list)
    assert len(result["deliverable_plans"]) == 3
    assert result["pipeline_agents_executed"] == ["content_architect"]
    assert len(result["agent_traces"]) == 1
    telemetry = result["agent_traces"][0]
    assert telemetry.agent_name == "content_architect"
    assert telemetry.success is True
    assert telemetry.duration_ms > 0
    assert telemetry.model_name in (settings.GROQ_MODEL, settings.FALLBACK_MODEL)


@pytest.mark.asyncio
async def test_content_architect_3_day_sprint_synthesis(monkeypatch: pytest.MonkeyPatch):
    """
    Verifies that for a 3-day sprint, even if the LLM returns only 1 deliverable,
    ContentArchitectAgent guarantees all 3 days have distinct deliverables with planned_day=1, 2, 3.
    """
    from datetime import date
    from app.campaign_intelligence.agents.content_architect import ContentArchitectOutput

    brief, brand_context, strategy, _, _ = _build_test_strategy_and_context()
    brief.start_date = date(2026, 11, 10)
    brief.end_date = date(2026, 11, 12)
    brief.duration_days = 3

    # Simulate LLM returning only 1 deliverable
    fake_single_deliv = DeliverablePlan(
        title="Day 1 Launch Reel",
        deliverable_type="reel",
        platform="instagram",
        strategic_angle="Launch Angle",
        primary_hook="Hook for Day 1",
        caption="Day 1 caption",
        call_to_action="Swipe up",
        planned_day=1,
    )

    async def mock_invoke(*args, **kwargs):
        return ContentArchitectOutput(deliverables=[fake_single_deliv])

    monkeypatch.setattr("app.campaign_intelligence.agents.content_architect.invoke_structured_llm", mock_invoke)

    agent = ContentArchitectAgent()
    deliverables = await agent.run(strategy=strategy, brief=brief, brand_context=brand_context)

    assert len(deliverables) == 3
    days = [d.planned_day for d in deliverables]
    assert days == [1, 2, 3]
    dates = [d.scheduled_date for d in deliverables]
    assert dates == ["2026-11-10", "2026-11-11", "2026-11-12"]


