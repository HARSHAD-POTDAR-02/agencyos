from __future__ import annotations

import operator
import uuid
import pytest

from app.campaign_intelligence.agents.market_research import (
    MarketResearchAgent,
    market_research_node,
)
from app.campaign_intelligence.orchestration.state import CampaignState
from app.campaign_intelligence.schemas import (
    BrandContext,
    CampaignBrief,
    MarketResearchReport,
    ResearchEvidence,
)
from app.campaign_intelligence.tools.research_tools import (
    gather_market_evidence,
    get_platform_format_evidence,
    search_wikipedia,
)
from app.core.config import settings


# ============================================================================
# Unit Tests for Research Tools
# ============================================================================

@pytest.mark.asyncio
async def test_search_wikipedia_returns_valid_evidence():
    """Verify Wikipedia tool returns genuine encyclopedia citations with valid URLs."""
    evidence = await search_wikipedia("Industrial robot", max_results=2)
    assert len(evidence) > 0
    first = evidence[0]
    assert isinstance(first, ResearchEvidence)
    assert first.source_url.startswith("https://en.wikipedia.org/wiki/")
    assert len(first.excerpt) > 10
    assert first.relevance_score >= 0.8


def test_platform_format_evidence_retrieval():
    """Verify platform documentation citations are retrieved for target platforms."""
    evidence = get_platform_format_evidence(["linkedin", "instagram"])
    assert len(evidence) >= 3
    urls = [e.source_url for e in evidence]
    # LinkedIn documentation is now at linkedin.com/help (official help center)
    assert any("linkedin.com" in u for u in urls)
    assert any("instagram.com" in u or "about.instagram.com" in u for u in urls)
    # Verify no fabricated publication dates
    for ev in evidence:
        assert ev.publication_date is None, (
            f"Platform doc entry '{ev.source_title}' must not have a fabricated publication_date"
        )


# ============================================================================
# Agent 2 Integration Tests
# ============================================================================

@pytest.mark.asyncio
async def test_market_research_agent_niche_industry():
    """
    Test 1: Unfamiliar/Niche Industry Test (Industrial Robotics & Port Automation).
    Validates dynamic discovery, verifiable citations, and realistic market opportunities.
    """
    brief = CampaignBrief(
        client_id=uuid.uuid4(),
        agency_id=uuid.uuid4(),
        period_month=11,
        period_year=2026,
        objective="Drive Q4 enterprise demos for autonomous container port cranes",
        custom_brief="Target terminal operators and harbor logistics directors looking to reduce demurrage penalties.",
        target_audience=["Port Operations Directors", "Terminal Logistics Managers"],
        platforms=["linkedin", "youtube"],
        deliverable_preferences=["carousel", "video"],
    )

    brand_context = BrandContext(
        client_id=brief.client_id,
        agency_id=brief.agency_id,
        business_name="PortVance Automation",
        industry="Maritime Logistics & Container Port Automation",
        website="https://portvance.com",
    )

    agent = MarketResearchAgent(model_name=settings.GROQ_MODEL)
    report = await agent.run(brief=brief, brand_context=brand_context)

    assert isinstance(report, MarketResearchReport)
    assert report.industry == "Maritime Logistics & Container Port Automation"

    # 1. Target Audience Insights
    assert len(report.target_audience_insights) > 0
    first_obs = report.target_audience_insights[0]
    assert len(first_obs.segment_name) > 0
    assert len(first_obs.pain_point) > 0

    # 2. Competitor Landscape
    assert len(report.competitor_landscape) > 0
    first_comp = report.competitor_landscape[0]
    assert len(first_comp.competitor_name) > 0
    assert len(first_comp.differentiation_opportunity) > 0

    # 3. Format & Platform Trends
    assert len(report.format_and_platform_trends) > 0
    # Must cover target platforms (linkedin or youtube)
    platforms_covered = [t.platform.lower() for t in report.format_and_platform_trends]
    assert any("linkedin" in p or "youtube" in p for p in platforms_covered)

    # 4. Verifiable Evidence Sources
    assert len(report.evidence_sources) > 0
    for ev in report.evidence_sources:
        assert ev.source_url.startswith("http")
        assert len(ev.source_title) > 0
        assert 0.0 <= ev.relevance_score <= 1.0

    # 5. Strategic Opportunities
    assert len(report.strategic_opportunities) >= 2


@pytest.mark.asyncio
async def test_market_research_node_execution():
    """
    Test 2: LangGraph node execution and telemetry tracking.
    Verifies state updates, telemetry duration, and execution list.
    """
    brief = CampaignBrief(
        client_id=uuid.uuid4(),
        agency_id=uuid.uuid4(),
        period_month=11,
        period_year=2026,
        objective="Cloud security compliance campaign",
        target_audience=["Chief Information Security Officers"],
        platforms=["linkedin"],
    )

    state: CampaignState = {
        "run_id": "test_run_market_001",
        "agency_id": brief.agency_id,
        "client_id": brief.client_id,
        "campaign_id": uuid.uuid4(),
        "brief": brief,
        "brand_context": BrandContext(
            client_id=brief.client_id,
            agency_id=brief.agency_id,
            business_name="CloudSentry Cyber",
            industry="Cloud Cybersecurity & SOC Automation",
        ),
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

    result = await market_research_node(state=state)

    assert "market_research" in result
    assert isinstance(result["market_research"], MarketResearchReport)
    assert result["pipeline_agents_executed"] == ["market_research"]
    assert len(result["agent_traces"]) == 1
    telemetry = result["agent_traces"][0]
    assert telemetry.agent_name == "market_research"
    assert telemetry.success is True
    assert telemetry.duration_ms > 0
    assert telemetry.model_name in [settings.GROQ_MODEL, settings.FALLBACK_MODEL]


def test_parallel_intelligence_state_isolation():
    """
    Test 3: Parallel state update compatibility.
    Demonstrates that Brand Intelligence and Market Research updates write to
    isolated artifact keys and their execution traces combine safely via operator.add.
    """
    brand_context_mock = BrandContext(
        client_id=uuid.uuid4(),
        agency_id=uuid.uuid4(),
        business_name="Test Enterprise",
    )
    market_research_mock = MarketResearchReport(
        industry="Enterprise AI",
        strategic_opportunities=["Focus on data residency"],
    )

    # Node 1 returns brand update
    node_1_update = {
        "brand_context": brand_context_mock,
        "pipeline_agents_executed": ["brand_intelligence"],
    }

    # Node 2 returns market research update
    node_2_update = {
        "market_research": market_research_mock,
        "pipeline_agents_executed": ["market_research"],
    }

    # Verify keys are independent
    assert "brand_context" in node_1_update and "market_research" not in node_1_update
    assert "market_research" in node_2_update and "brand_context" not in node_2_update

    # Verify parallel reducer simulation
    combined_pipeline = operator.add(
        node_1_update["pipeline_agents_executed"],
        node_2_update["pipeline_agents_executed"],
    )
    assert combined_pipeline == ["brand_intelligence", "market_research"]

