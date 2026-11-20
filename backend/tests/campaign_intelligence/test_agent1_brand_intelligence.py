from __future__ import annotations

import uuid
from datetime import date
import pytest

from app.campaign_intelligence.agents.brand_intelligence import (
    BrandIntelligenceAgent,
    brand_intelligence_node,
)
from app.campaign_intelligence.orchestration.state import CampaignState
from app.campaign_intelligence.schemas import (
    BrandContext,
    CampaignBrief,
    FeedbackClassification,
)
from app.campaign_intelligence.tools.brand_tools import ClientNotFoundError
from app.core.config import settings
from app.models.agency import Agency
from app.models.brand_profile import BrandProfile
from app.models.campaign import Campaign, CampaignStatus
from app.models.client import Client, ClientStatus
from app.models.comment import DeliverableComment
from app.models.contract import Contract, ContractStatus, ScopeItem
from app.models.deliverable import Deliverable, DeliverableStatus
from app.models.user import Membership, RoleEnum, User
from tests.conftest import TestSessionLocal, _create_user_and_agency


# ============================================================================
# Helpers
# ============================================================================

async def _seed_b2b_robotics_client(db) -> tuple[Agency, Client, Contract, ScopeItem, DeliverableComment]:
    """Helper to seed a comprehensive B2B industrial robotics scenario."""
    user, agency, _ = await _create_user_and_agency(
        db=db,
        email=f"founder_{uuid.uuid4().hex[:6]}@aerobotix.ai",
        agency_name=f"Robotics Agency {uuid.uuid4().hex[:4]}",
        agency_slug=f"robotics-agency-{uuid.uuid4().hex[:6]}",
    )

    client = Client(
        id=uuid.uuid4(),
        agency_id=agency.id,
        business_name="AeroBotix Automation",
        industry="Industrial Robotics & Factory Automation",
        website="https://aerobotix.ai",
        status=ClientStatus.active,
    )
    db.add(client)
    await db.flush()

    brand_profile = BrandProfile(
        id=uuid.uuid4(),
        client_id=client.id,
        version=1,
        is_confirmed=True,
        confirmed_by_id=user.id,
        brand_voice="authoritative, technical, engineering-focused, ROI-driven",
        approved_phrases={"phrases": ["sub-millimeter precision", "ISO 9001 certified", "modular robotic cell"]},
        prohibited_claims=[
            {
                "claim": "Never claim 100% bug-free uptime or zero downtime guarantee",
                "reason": "Warranty violation and unrealistic engineering assertion",
            }
        ],
        target_audience={"primary": "Factory Floor Directors", "secondary": "Automation Plant Engineers"},
        content_pillars=["Repeatability Benchmarks", "TCO Analysis", "Deployment Speed"],
        goals={
            "offers": [
                {
                    "name": "AeroBotix ARM-X1",
                    "description": "6-axis precision robotic arm with 50kg payload capacity",
                }
            ]
        },
    )
    db.add(brand_profile)

    contract = Contract(
        id=uuid.uuid4(),
        client_id=client.id,
        name="Enterprise Retainer 2026",
        start_date=date(2026, 1, 1),
        status=ContractStatus.active,
        revision_allowance=2,
        notes="Active Q4 scope. Offer: 24/7 dedicated support SLA included.",
    )
    db.add(contract)
    await db.flush()

    scope_item = ScopeItem(
        id=uuid.uuid4(),
        contract_id=contract.id,
        deliverable_type="carousel",
        platform="linkedin",
        monthly_quantity=4,
    )
    db.add(scope_item)
    await db.flush()

    campaign = Campaign(
        id=uuid.uuid4(),
        client_id=client.id,
        name="Q4 Factory Modernization",
        status=CampaignStatus.planning,
    )
    db.add(campaign)
    await db.flush()

    deliverable = Deliverable(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        scope_item_id=scope_item.id,
        title="ARM-X1 vs Legacy Delta Comparison",
        deliverable_type="carousel",
        platform="linkedin",
        status=DeliverableStatus.in_production,
    )
    db.add(deliverable)
    await db.flush()

    comment = DeliverableComment(
        id=uuid.uuid4(),
        deliverable_id=deliverable.id,
        author_id=user.id,
        message="Never show unshielded robotic equipment without safety light curtains in visual renders.",
        is_internal=False,
    )
    db.add(comment)
    await db.commit()

    return agency, client, contract, scope_item, comment


# ============================================================================
# Tests for Agent 1: Brand Intelligence
# ============================================================================

@pytest.mark.asyncio
async def test_brand_intelligence_real_db_industrial_client():
    """
    Test 1: Comprehensive B2B Industrial Robotics Client.
    Validates deterministic retrieval of brand profile, verified offers, quotas,
    classified feedback, and tone synthesis without consumer/restaurant tropes.
    """
    async with TestSessionLocal() as db:
        agency, client, contract, scope_item, comment = await _seed_b2b_robotics_client(db)

    brief = CampaignBrief(
        client_id=client.id,
        agency_id=agency.id,
        period_month=11,
        period_year=2026,
        objective="Drive qualified plant director demos for the ARM-X1 robotic arm",
        custom_brief="Focus on deployment speed and precision repeatability for automotive parts manufacturing.",
        target_audience=["Plant Directors", "Automation Engineers"],
        platforms=["linkedin"],
        deliverable_preferences=["carousel"],
    )

    agent = BrandIntelligenceAgent(model_name=settings.GROQ_MODEL)
    async with TestSessionLocal() as db:
        context = await agent.run(brief=brief, db=db)

    assert isinstance(context, BrandContext)
    # 1. Confirmed facts from DB
    assert context.business_name == "AeroBotix Automation"
    assert context.industry == "Industrial Robotics & Factory Automation"
    assert context.website == "https://aerobotix.ai"
    assert any("AeroBotix Automation" in fact for fact in context.confirmed_facts)

    # 2. Verified offers from DB
    assert len(context.verified_offers) >= 1
    assert any(o.name == "AeroBotix ARM-X1" and o.is_verified for o in context.verified_offers)

    # 3. Contract quotas from DB
    assert len(context.contract_quotas) >= 1
    assert context.contract_quotas[0].deliverable_type == "carousel"
    assert context.contract_quotas[0].platform == "linkedin"
    assert context.contract_quotas[0].monthly_quantity == 4

    # 4. Classified feedback
    assert len(context.classified_feedback) >= 1
    assert context.classified_feedback[0].classification == FeedbackClassification.explicit_rule
    assert "safety light curtains" in context.classified_feedback[0].content

    # 5. Tone guidelines populated
    assert len(context.tone_guidelines.do) > 0
    assert len(context.tone_guidelines.dont) > 0

    # 6. Epistemic separation & Synthesized positioning with audit tag
    assert (context.brand_positioning is None) or any("[INFERRED_NEEDS_REVIEW]" in a for a in context.assumptions)


@pytest.mark.asyncio
async def test_exact_prohibited_term_conflict():
    """
    Test 2: Deterministic exact prohibited-term conflict detection.
    When a brief uses an exact forbidden term, it must be flagged in conflicts.
    """
    async with TestSessionLocal() as db:
        user, agency, _ = await _create_user_and_agency(
            db=db,
            email=f"user_{uuid.uuid4().hex[:6]}@agency.com",
            agency_name="Test Agency",
            agency_slug=f"agency-{uuid.uuid4().hex[:6]}",
        )
        client = Client(
            id=uuid.uuid4(),
            agency_id=agency.id,
            business_name="Precision Aero Systems",
            industry="Aerospace Manufacturing",
            status=ClientStatus.active,
        )
        db.add(client)
        await db.flush()

        bp = BrandProfile(
            id=uuid.uuid4(),
            client_id=client.id,
            version=1,
            is_confirmed=True,
            brand_voice="authoritative, technical",
            prohibited_claims={"exact_terms": ["cheapest", "budget-grade"]},
        )
        db.add(bp)
        await db.commit()

    brief = CampaignBrief(
        client_id=client.id,
        agency_id=agency.id,
        period_month=11,
        period_year=2026,
        objective="Promote affordable aerospace tooling",
        custom_brief="We want to position this as the cheapest aerospace calibration tool on the market.",
        platforms=["linkedin"],
    )

    agent = BrandIntelligenceAgent(model_name=settings.GROQ_MODEL)
    async with TestSessionLocal() as db:
        context = await agent.run(brief=brief, db=db)

    assert any("cheapest" in conflict.lower() for conflict in context.conflicts)


@pytest.mark.asyncio
async def test_semantic_prohibited_claim_conflict():
    """
    Test 3: LLM semantic prohibited-claim conflict detection.
    When a brief violates the semantic policy against 100% bug-free uptime guarantees,
    the violation is flagged in conflicts.
    """
    async with TestSessionLocal() as db:
        user, agency, _ = await _create_user_and_agency(
            db=db,
            email=f"user_{uuid.uuid4().hex[:6]}@agency.com",
            agency_name="Industrial AI Agency",
            agency_slug=f"ind-agency-{uuid.uuid4().hex[:6]}",
        )
        client = Client(
            id=uuid.uuid4(),
            agency_id=agency.id,
            business_name="RoboWeld Solutions",
            industry="Automated Welding",
            status=ClientStatus.active,
        )
        db.add(client)
        await db.flush()

        bp = BrandProfile(
            id=uuid.uuid4(),
            client_id=client.id,
            version=1,
            is_confirmed=True,
            prohibited_claims=[
                {
                    "claim": "Never guarantee 100% bug-free operation or absolute zero downtime",
                    "reason": "Engineering warranty liability",
                }
            ],
        )
        db.add(bp)
        await db.commit()

    brief = CampaignBrief(
        client_id=client.id,
        agency_id=agency.id,
        period_month=11,
        period_year=2026,
        objective="Promote high-reliability welding cells",
        custom_brief="Our campaign will promise 100% bug-free zero downtime in every welding cell guaranteed.",
        platforms=["linkedin"],
    )

    agent = BrandIntelligenceAgent(model_name=settings.GROQ_MODEL)
    async with TestSessionLocal() as db:
        context = await agent.run(brief=brief, db=db)

    # Either detected via exact phrase or LLM semantic contradiction
    assert len(context.conflicts) > 0
    assert any("downtime" in c.lower() or "bug-free" in c.lower() or "guarantee" in c.lower() for c in context.conflicts)


@pytest.mark.asyncio
async def test_missing_data_zero_fabrication():
    """
    Test 4: Missing data handling and zero fabrication.
    When a client has no BrandProfile, fields remain None/empty and are recorded in knowledge_gaps.
    """
    async with TestSessionLocal() as db:
        user, agency, _ = await _create_user_and_agency(
            db=db,
            email=f"user_{uuid.uuid4().hex[:6]}@agency.com",
            agency_name="Minimal Agency",
            agency_slug=f"min-agency-{uuid.uuid4().hex[:6]}",
        )
        client = Client(
            id=uuid.uuid4(),
            agency_id=agency.id,
            business_name="Cold Start Robotics",
            industry="Warehouse Automation",
            status=ClientStatus.onboarding,
        )
        db.add(client)
        await db.commit()

    brief = CampaignBrief(
        client_id=client.id,
        agency_id=agency.id,
        period_month=11,
        period_year=2026,
        objective="Initial introductory campaign",
        platforms=["linkedin"],
    )

    agent = BrandIntelligenceAgent(model_name=settings.GROQ_MODEL)
    async with TestSessionLocal() as db:
        context = await agent.run(brief=brief, db=db)

    # 1. Brand positioning: if synthesized, must be labeled with epistemic inference tag
    if context.brand_positioning:
        assert any("[INFERRED_NEEDS_REVIEW]" in a for a in context.assumptions)

    # 2. Missing data flagged in knowledge_gaps
    assert any("No BrandProfile record exists" in gap for gap in context.knowledge_gaps)
    assert any("Brand voice" in gap or "pillars" in gap for gap in context.knowledge_gaps)


@pytest.mark.asyncio
async def test_tenant_isolation_enforcement():
    """
    Test 5: Strict multi-tenant isolation.
    Querying client data with a mismatched agency_id raises ClientNotFoundError.
    """
    async with TestSessionLocal() as db:
        user, agency_a, _ = await _create_user_and_agency(
            db=db,
            email=f"user_a_{uuid.uuid4().hex[:6]}@agency.com",
            agency_name="Agency A",
            agency_slug=f"agency-a-{uuid.uuid4().hex[:6]}",
        )
        client_a = Client(
            id=uuid.uuid4(),
            agency_id=agency_a.id,
            business_name="Client A Business",
            status=ClientStatus.active,
        )
        db.add(client_a)
        await db.commit()

    # Mismatched agency_id
    mismatched_agency_id = uuid.uuid4()
    brief = CampaignBrief(
        client_id=client_a.id,
        agency_id=mismatched_agency_id,
        period_month=11,
        period_year=2026,
        objective="Unauthorized access attempt",
    )

    agent = BrandIntelligenceAgent(model_name=settings.GROQ_MODEL)
    async with TestSessionLocal() as db:
        with pytest.raises(ClientNotFoundError):
            await agent.run(brief=brief, db=db)


@pytest.mark.asyncio
async def test_langgraph_node_execution():
    """
    Test 6: LangGraph node execution and telemetry tracking.
    Verifies state updates, pipeline execution list, and telemetry metrics.
    """
    async with TestSessionLocal() as db:
        agency, client, _, _, _ = await _seed_b2b_robotics_client(db)

    brief = CampaignBrief(
        client_id=client.id,
        agency_id=agency.id,
        period_month=11,
        period_year=2026,
        objective="Automotive supplier campaign",
        platforms=["linkedin"],
    )

    state: CampaignState = {
        "run_id": "test_run_node_001",
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

    result = await brand_intelligence_node(state=state, db_session_factory=TestSessionLocal)

    assert "brand_context" in result
    assert isinstance(result["brand_context"], BrandContext)
    assert result["pipeline_agents_executed"] == ["brand_intelligence"]
    assert len(result["agent_traces"]) == 1
    telemetry = result["agent_traces"][0]
    assert telemetry.agent_name == "brand_intelligence"
    assert telemetry.success is True
    assert telemetry.duration_ms > 0
    assert telemetry.model_name in [settings.GROQ_MODEL, settings.FALLBACK_MODEL]

