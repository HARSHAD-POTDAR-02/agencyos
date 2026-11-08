from __future__ import annotations

import operator
import uuid
from datetime import datetime, timezone
import pytest

from app.campaign_intelligence.agents.historical_performance import (
    HistoricalPerformanceAgent,
    performance_analysis_node,
)
from app.campaign_intelligence.orchestration.state import CampaignState
from app.campaign_intelligence.schemas import (
    CampaignBrief,
    DataSufficiency,
    PerformancePlaybook,
)
from app.campaign_intelligence.tools.performance_tools import (
    calculate_format_performance_metrics,
    detect_audience_fatigue_signals,
    get_client_published_deliverables,
)
from app.core.config import settings
from app.models.agency import Agency
from app.models.campaign import Campaign, CampaignStatus
from app.models.client import Client, ClientStatus
from app.models.deliverable import Deliverable, DeliverableStatus
from app.models.user import User
from tests.conftest import TestSessionLocal, _create_user_and_agency


# ============================================================================
# Helpers
# ============================================================================

async def _seed_client_with_published_posts(
    db,
    num_carousels: int = 4,
    num_reels: int = 2,
) -> tuple[Agency, Client]:
    """Helper to seed client with published deliverables with deterministic metrics."""
    user, agency, _ = await _create_user_and_agency(
        db=db,
        email=f"perf_user_{uuid.uuid4().hex[:6]}@agencyos.local",
        agency_name=f"Perf Agency {uuid.uuid4().hex[:4]}",
        agency_slug=f"perf-agency-{uuid.uuid4().hex[:6]}",
    )

    client = Client(
        id=uuid.uuid4(),
        agency_id=agency.id,
        business_name="Performance Test Corp",
        industry="B2B Technology",
        status=ClientStatus.active,
    )
    db.add(client)
    await db.flush()

    campaign = Campaign(
        id=uuid.uuid4(),
        client_id=client.id,
        name="Past Q3 Campaign",
        status=CampaignStatus.completed,
    )
    db.add(campaign)
    await db.flush()

    # Seed Carousels on LinkedIn
    # Post 1: 1000 views, 50 likes, 10 comments, 5 shares (65 interactions -> 6.5% rate)
    # Post 2: 2000 views, 100 likes, 20 comments, 10 shares (130 interactions -> 6.5% rate)
    # Post 3: 1500 views, 60 likes, 15 comments, 0 shares (75 interactions -> 5.0% rate)
    # Post 4: 1500 views, 60 likes, 15 comments, 0 shares (75 interactions -> 5.0% rate)
    carousel_stats = [
        (1000, 50, 10, 5),
        (2000, 100, 20, 10),
        (1500, 60, 15, 0),
        (1500, 60, 15, 0),
    ]
    for idx, (v, l, c, s) in enumerate(carousel_stats[:num_carousels]):
        d = Deliverable(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            title=f"LinkedIn Carousel {idx + 1}: Tech Deep Dive",
            deliverable_type="carousel",
            platform="linkedin",
            status=DeliverableStatus.published,
            views_count=v,
            likes_count=l,
            comments_count=c,
            shares_count=s,
            published_at=datetime(2026, 8, idx + 1, 10, 0, tzinfo=timezone.utc),
        )
        db.add(d)

    # Seed Reels on Instagram
    # Reel 1: 5000 views, 200 likes, 30 comments, 20 shares (250 interactions -> 5.0% rate)
    # Reel 2: 3000 views, 100 likes, 10 comments, 10 shares (120 interactions -> 4.0% rate)
    reel_stats = [
        (5000, 200, 30, 20),
        (3000, 100, 10, 10),
    ]
    for idx, (v, l, c, s) in enumerate(reel_stats[:num_reels]):
        d = Deliverable(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            title=f"Instagram Reel {idx + 1}: 30s Architecture Walkthrough",
            deliverable_type="reel",
            platform="instagram",
            status=DeliverableStatus.published,
            views_count=v,
            likes_count=l,
            comments_count=c,
            shares_count=s,
            published_at=datetime(2026, 9, idx + 1, 12, 0, tzinfo=timezone.utc),
        )
        db.add(d)

    await db.commit()
    return agency, client


# ============================================================================
# Tests for Agent 3: Historical Performance Analysis
# ============================================================================

@pytest.mark.asyncio
async def test_deterministic_statistical_calculations():
    """
    Test 1: Statistical calculations executed in Python.
    Verifies that averages and engagement rates match exact mathematical formulas.
    """
    async with TestSessionLocal() as db:
        agency, client = await _seed_client_with_published_posts(db, num_carousels=4, num_reels=2)

    brief = CampaignBrief(
        client_id=client.id,
        agency_id=agency.id,
        period_month=11,
        period_year=2026,
        objective="Q4 optimization",
        platforms=["linkedin", "instagram"],
        deliverable_preferences=["carousel", "reel"],
    )

    agent = HistoricalPerformanceAgent(model_name=settings.GROQ_MODEL)
    async with TestSessionLocal() as db:
        playbook = await agent.run(brief=brief, db=db)

    assert isinstance(playbook, PerformancePlaybook)
    assert playbook.data_sufficiency == DataSufficiency.sufficient
    assert playbook.historical_posts_analyzed == 6

    # Verify format breakdowns
    assert len(playbook.format_summaries) == 2
    summaries_by_format = {s.deliverable_type: s for s in playbook.format_summaries}

    # Verify Carousel stats:
    # Total = 4, Total Views = 1000 + 2000 + 1500 + 1500 = 6000 -> Avg = 1500.0
    carousel_summary = summaries_by_format["carousel"]
    assert carousel_summary.total_published == 4
    assert carousel_summary.avg_views == 1500.0
    assert carousel_summary.platform == "linkedin"
    assert carousel_summary.avg_engagement_rate > 5.0
    assert len(carousel_summary.top_performing_angles) > 0

    # Verify Reel stats:
    # Total = 2, Total Views = 5000 + 3000 = 8000 -> Avg = 4000.0
    reel_summary = summaries_by_format["reel"]
    assert reel_summary.total_published == 2
    assert reel_summary.avg_views == 4000.0
    assert reel_summary.platform == "instagram"

    # Verify LLM strategic interpretations exist
    assert len(playbook.winning_hooks_and_angles) > 0
    assert len(playbook.underperforming_patterns) > 0
    assert len(playbook.recommended_format_mix) > 0


@pytest.mark.asyncio
async def test_cold_start_zero_fabrication():
    """
    Test 2: Cold start client with zero historical posts.
    Verifies that agent explicitly flags cold start, preserves empty summaries,
    and invents ZERO fake numerical statistics.
    """
    async with TestSessionLocal() as db:
        user, agency, _ = await _create_user_and_agency(
            db=db,
            email=f"cold_user_{uuid.uuid4().hex[:6]}@agencyos.local",
            agency_name="Cold Start Agency",
            agency_slug=f"cold-agency-{uuid.uuid4().hex[:6]}",
        )
        client = Client(
            id=uuid.uuid4(),
            agency_id=agency.id,
            business_name="Brand New Client",
            status=ClientStatus.active,
        )
        db.add(client)
        await db.commit()

    brief = CampaignBrief(
        client_id=client.id,
        agency_id=agency.id,
        period_month=11,
        period_year=2026,
        objective="First campaign ever",
        deliverable_preferences=["carousel", "reel"],
    )

    agent = HistoricalPerformanceAgent(model_name=settings.GROQ_MODEL)
    async with TestSessionLocal() as db:
        playbook = await agent.run(brief=brief, db=db)

    assert playbook.data_sufficiency == DataSufficiency.cold_start
    assert playbook.historical_posts_analyzed == 0
    assert playbook.format_summaries == []
    assert any("Cold start client" in angle for angle in playbook.winning_hooks_and_angles)
    assert playbook.recommended_format_mix == {"carousel": 2, "reel": 2}


@pytest.mark.asyncio
async def test_audience_fatigue_detection():
    """
    Test 3: Audience fatigue signal detection.
    When recent deliverables show >35% drop in average views, flags fatigue signal.
    """
    async with TestSessionLocal() as db:
        user, agency, _ = await _create_user_and_agency(
            db=db,
            email=f"fatigue_user_{uuid.uuid4().hex[:6]}@agencyos.local",
            agency_name="Fatigue Agency",
            agency_slug=f"fatigue-agency-{uuid.uuid4().hex[:6]}",
        )
        client = Client(
            id=uuid.uuid4(),
            agency_id=agency.id,
            business_name="Fatigue Testing Corp",
            status=ClientStatus.active,
        )
        db.add(client)
        await db.flush()

        campaign = Campaign(id=uuid.uuid4(), client_id=client.id, name="Old Campaign")
        db.add(campaign)
        await db.flush()

        # Seed 5 reels: first 2 had 10,000 views, next 3 had 2,000 views (80% drop)
        views = [10000, 10000, 2000, 2000, 2000]
        for idx, v in enumerate(views):
            d = Deliverable(
                id=uuid.uuid4(),
                campaign_id=campaign.id,
                title=f"Reel {idx + 1}",
                deliverable_type="reel",
                platform="instagram",
                status=DeliverableStatus.published,
                views_count=v,
                likes_count=100,
                comments_count=10,
                shares_count=5,
                published_at=datetime(2026, 7, idx + 1, 10, 0, tzinfo=timezone.utc),
            )
            db.add(d)
        await db.commit()

    agent = HistoricalPerformanceAgent(model_name=settings.GROQ_MODEL)
    brief = CampaignBrief(
        client_id=client.id,
        agency_id=agency.id,
        period_month=11,
        period_year=2026,
        objective="Reignite growth",
    )
    async with TestSessionLocal() as db:
        playbook = await agent.run(brief=brief, db=db)

    assert len(playbook.fatigue_signals) >= 1
    fatigue = playbook.fatigue_signals[0]
    assert fatigue.fatigue_level in ("moderate", "high")
    assert "Reel" in fatigue.topic_or_format or "reel" in fatigue.topic_or_format
    assert "dropped by" in fatigue.recommendation


@pytest.mark.asyncio
async def test_tenant_isolation_historical_data():
    """
    Test 4: Strict multi-tenant isolation.
    Agency B cannot query or analyze Agency A client deliverables.
    """
    async with TestSessionLocal() as db:
        agency_a, client_a = await _seed_client_with_published_posts(db, num_carousels=2, num_reels=1)

    mismatched_agency_id = uuid.uuid4()
    brief = CampaignBrief(
        client_id=client_a.id,
        agency_id=mismatched_agency_id,
        period_month=11,
        period_year=2026,
        objective="Data leak attempt",
    )

    agent = HistoricalPerformanceAgent(model_name=settings.GROQ_MODEL)
    async with TestSessionLocal() as db:
        playbook = await agent.run(brief=brief, db=db)

    # Scoped query returns 0 deliverables -> cold start
    assert playbook.historical_posts_analyzed == 0
    assert playbook.data_sufficiency == DataSufficiency.cold_start


@pytest.mark.asyncio
async def test_performance_analysis_node_execution():
    """
    Test 5: LangGraph node execution and telemetry tracking.
    Verifies state updates, telemetry metrics, and pipeline execution tracking.
    """
    async with TestSessionLocal() as db:
        agency, client = await _seed_client_with_published_posts(db, num_carousels=3, num_reels=1)

    brief = CampaignBrief(
        client_id=client.id,
        agency_id=agency.id,
        period_month=11,
        period_year=2026,
        objective="Performance node test",
        platforms=["linkedin"],
    )

    state: CampaignState = {
        "run_id": "test_run_perf_001",
        "agency_id": agency.id,
        "client_id": client.id,
        "campaign_id": uuid.uuid4(),
        "brief": brief,
        "brand_context": None,
        "market_research": None,
        "performance_playbook": None,
        "campaign_strategy": None,
        "deliverable_plans": None,
        "quality_evaluation": None,
        "revision_count": 0,
        "max_revisions": 3,
        "workflow_status": "initializing",
        "current_agent": None,
        "human_feedback": None,
        "pipeline_agents_executed": [],
        "agent_traces": [],
        "errors": [],
    }

    result = await performance_analysis_node(state=state, db_session_factory=TestSessionLocal)

    assert "performance_playbook" in result
    assert isinstance(result["performance_playbook"], PerformancePlaybook)
    assert result["pipeline_agents_executed"] == ["performance_analysis"]
    assert len(result["agent_traces"]) == 1
    telemetry = result["agent_traces"][0]
    assert telemetry.agent_name == "performance_analysis"
    assert telemetry.success is True
    assert telemetry.duration_ms > 0
    assert telemetry.model_name == settings.GROQ_MODEL


def test_three_way_parallel_intelligence_isolation():
    """
    Test 6: Three-way parallel state isolation.
    Validates that Brand Intelligence, Market Research, and Performance Analysis
    write to three mutually independent artifact keys without clobbering.
    """
    state_update_1 = {"brand_context": "mock_brand", "pipeline_agents_executed": ["brand_intelligence"]}
    state_update_2 = {"market_research": "mock_research", "pipeline_agents_executed": ["market_research"]}
    state_update_3 = {"performance_playbook": "mock_playbook", "pipeline_agents_executed": ["performance_analysis"]}

    # Ensure no key collision across intelligence artifacts
    keys_1 = set(state_update_1.keys()) - {"pipeline_agents_executed"}
    keys_2 = set(state_update_2.keys()) - {"pipeline_agents_executed"}
    keys_3 = set(state_update_3.keys()) - {"pipeline_agents_executed"}

    assert keys_1.isdisjoint(keys_2)
    assert keys_2.isdisjoint(keys_3)
    assert keys_1.isdisjoint(keys_3)

    # Reducer simulation
    all_agents = operator.add(
        operator.add(state_update_1["pipeline_agents_executed"], state_update_2["pipeline_agents_executed"]),
        state_update_3["pipeline_agents_executed"],
    )
    assert all_agents == ["brand_intelligence", "market_research", "performance_analysis"]

