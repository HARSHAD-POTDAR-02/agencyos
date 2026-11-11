import uuid
import pytest
from unittest.mock import AsyncMock, patch
from sqlalchemy.ext.asyncio import AsyncSession

from app.campaign_intelligence.collaboration.delegation_runner import (
    BoundedDelegationRunner,
    DelegationRequest,
    MAX_DELEGATION_DEPTH,
    MAX_CALLS_PER_TURN,
)
from app.campaign_intelligence.schemas.campaign import CampaignBrief
from app.campaign_intelligence.schemas.studio_context import CampaignStudioContext
from app.campaign_intelligence.specialists.base import SpecialistResult


def _build_test_context() -> CampaignStudioContext:
    agency_id = uuid.uuid4()
    client_id = uuid.uuid4()
    campaign_id = uuid.uuid4()

    brief = CampaignBrief(
        client_id=client_id,
        agency_id=agency_id,
        period_month=11,
        period_year=2026,
        objective="Growth Sprint",
    )

    return CampaignStudioContext(
        agency_id=agency_id,
        client_id=client_id,
        campaign_id=campaign_id,
        client_name="Peak Roasters",
        client_industry="Specialty Coffee",
        campaign_brief=brief,
    )


# =====================================================================
# 1. Bounded Delegation: Depth Boundary Enforcement (max_depth = 1)
# =====================================================================
@pytest.mark.asyncio
async def test_delegation_runner_blocks_recursive_calls():
    runner = BoundedDelegationRunner(max_depth=1, max_calls_per_turn=2)
    context = _build_test_context()
    db = AsyncMock(spec=AsyncSession)

    # Attempt delegation with current_depth = 1 (violates max_depth=1)
    req = DelegationRequest(
        caller_agent_id="content_architect",
        target_agent_id="market_research",
        sub_query="Recursive call attempt",
        current_depth=1,
    )

    result = await runner.delegate(req, context, db)
    assert result is None, "Delegation with current_depth >= max_depth must be blocked immediately"
    assert runner.call_count == 0


# =====================================================================
# 2. Bounded Delegation: Calls Per Turn Budget (max_calls_per_turn = 2)
# =====================================================================
@pytest.mark.asyncio
async def test_delegation_runner_enforces_calls_per_turn_budget():
    runner = BoundedDelegationRunner(max_depth=1, max_calls_per_turn=2)
    context = _build_test_context()
    db = AsyncMock(spec=AsyncSession)

    mock_specialist_result = SpecialistResult(
        specialist_id="market_research",
        specialist_name="Market & Trend Researcher",
        reply="Identified 2 competitor video angles.",
        activity_logs=["Searched live web"],
    )

    with patch("app.campaign_intelligence.collaboration.delegation_runner.get_specialist_adapter") as mock_get_adapter:
        mock_adapter = AsyncMock()
        mock_adapter.specialist_name = "Market Researcher"
        mock_adapter.execute.return_value = mock_specialist_result
        mock_get_adapter.return_value = mock_adapter

        # Call 1: Allowed
        req1 = DelegationRequest(
            caller_agent_id="content_architect",
            target_agent_id="market_research",
            sub_query="Find hooks",
            current_depth=0,
        )
        res1 = await runner.delegate(req1, context, db)
        assert res1 is not None
        assert runner.call_count == 1

        # Call 2: Allowed
        req2 = DelegationRequest(
            caller_agent_id="content_architect",
            target_agent_id="market_research",
            sub_query="Find formats",
            current_depth=0,
        )
        res2 = await runner.delegate(req2, context, db)
        assert res2 is not None
        assert runner.call_count == 2

        # Call 3: Blocked (Budget exhausted)
        req3 = DelegationRequest(
            caller_agent_id="content_architect",
            target_agent_id="market_research",
            sub_query="Excess call",
            current_depth=0,
        )
        res3 = await runner.delegate(req3, context, db)
        assert res3 is None, "Delegation exceeding max_calls_per_turn must be blocked"
        assert runner.call_count == 2


# =====================================================================
# 3. Transparent Operational Logging (Zero Internal Chain-of-Thought Dump)
# =====================================================================
@pytest.mark.asyncio
async def test_delegation_produces_clean_activity_log():
    runner = BoundedDelegationRunner()
    context = _build_test_context()
    db = AsyncMock(spec=AsyncSession)

    mock_res = SpecialistResult(
        specialist_id="brand_intelligence",
        specialist_name="Brand Identity Specialist",
        reply="Verified 3 brand pillars without prohibited claims.",
    )

    with patch("app.campaign_intelligence.collaboration.delegation_runner.get_specialist_adapter") as mock_get_adapter:
        mock_adapter = AsyncMock()
        mock_adapter.specialist_name = "Brand Identity Specialist"
        mock_adapter.execute.return_value = mock_res
        mock_get_adapter.return_value = mock_adapter

        req = DelegationRequest(
            caller_agent_id="campaign_strategist",
            target_agent_id="brand_intelligence",
            sub_query="Audit brand pillars",
            current_depth=0,
        )
        res = await runner.delegate(req, context, db)

        assert res is not None
        assert "[Campaign Strategist] Consulted Brand Identity Specialist:" in res.activity_log
        assert "Verified 3 brand pillars" in res.activity_log
