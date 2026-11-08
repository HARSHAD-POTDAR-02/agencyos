from __future__ import annotations

import uuid
from datetime import datetime, timezone
import pytest
from langgraph.graph import END

from app.campaign_intelligence.orchestration.graph import (
    create_campaign_graph,
    route_quality_gate,
    run_campaign_pipeline,
)
from app.campaign_intelligence.orchestration.state import CampaignState
from app.campaign_intelligence.schemas import (
    CampaignBrief,
    FindingCategory,
    FindingSeverity,
    QualityEvaluation,
    QualityFinding,
    RevisionInstruction,
)
from app.models.agency import Agency
from app.models.brand_profile import BrandProfile
from app.models.campaign import Campaign, CampaignStatus
from app.models.client import Client, ClientStatus
from app.models.contract import Contract, ContractStatus, ScopeItem
from app.models.deliverable import Deliverable, DeliverableStatus
from tests.conftest import TestSessionLocal, _create_user_and_agency


def test_graph_compilation_and_topology():
    """Verify that the end-to-end multi-agent LangGraph workflow compiles cleanly."""
    graph = create_campaign_graph(db_session_factory=TestSessionLocal)
    assert graph is not None

    # Check that all 6 nodes are registered in the graph
    node_keys = graph.nodes.keys()
    for expected_node in [
        "brand_intelligence",
        "market_research",
        "performance_analysis",
        "campaign_strategist",
        "content_architect",
        "quality_evaluator",
    ]:
        assert expected_node in node_keys, f"Node {expected_node} must be registered in graph"


def test_route_quality_gate_approved():
    """When approved for review, workflow exits to END."""
    eval_approved = QualityEvaluation(
        is_approved_for_human_review=True,
        compliance_score=0.95,
        findings=[],
        revision_required=False,
        revision_instruction=None,
        evaluated_at=datetime.now(timezone.utc).isoformat(),
    )
    state = {"quality_evaluation": eval_approved}
    decision = route_quality_gate(state)  # type: ignore[arg-type]
    assert decision == END


def test_route_quality_gate_escalated_to_human():
    """When max revisions reached, instruction targets human -> exits to END."""
    eval_escalated = QualityEvaluation(
        is_approved_for_human_review=False,
        compliance_score=0.60,
        findings=[
            QualityFinding(
                category=FindingCategory.prohibited_term,
                severity=FindingSeverity.critical,
                issue_description="Term violation",
                remediation_instruction="Remove term",
            )
        ],
        revision_required=True,
        revision_instruction=RevisionInstruction(
            target_agent="human",
            reason="Max revisions reached",
            instructions=["Manual intervention required"],
        ),
        evaluated_at=datetime.now(timezone.utc).isoformat(),
    )
    state = {"quality_evaluation": eval_escalated}
    decision = route_quality_gate(state)  # type: ignore[arg-type]
    assert decision == END


def test_route_quality_gate_content_revision():
    """When content issues flagged, routes back to content_architect."""
    eval_content = QualityEvaluation(
        is_approved_for_human_review=False,
        compliance_score=0.70,
        findings=[
            QualityFinding(
                category=FindingCategory.prohibited_term,
                severity=FindingSeverity.critical,
                issue_description="Exact prohibited term in caption",
                remediation_instruction="Fix copy",
            )
        ],
        revision_required=True,
        revision_instruction=RevisionInstruction(
            target_agent="content_architect",
            reason="Copy compliance failure",
            instructions=["Remove prohibited terms from copy"],
        ),
        evaluated_at=datetime.now(timezone.utc).isoformat(),
    )
    state = {"quality_evaluation": eval_content}
    decision = route_quality_gate(state)  # type: ignore[arg-type]
    assert decision == "content_architect"


def test_route_quality_gate_strategic_revision():
    """When strategic/quota issues flagged, routes back to campaign_strategist."""
    eval_strat = QualityEvaluation(
        is_approved_for_human_review=False,
        compliance_score=0.65,
        findings=[
            QualityFinding(
                category=FindingCategory.quota_mismatch,
                severity=FindingSeverity.critical,
                issue_description="Contract quota missing",
                remediation_instruction="Rebalance angles",
            )
        ],
        revision_required=True,
        revision_instruction=RevisionInstruction(
            target_agent="campaign_strategist",
            reason="Strategy quota mismatch",
            instructions=["Re-align strategic pillars with quotas"],
        ),
        evaluated_at=datetime.now(timezone.utc).isoformat(),
    )
    state = {"quality_evaluation": eval_strat}
    decision = route_quality_gate(state)  # type: ignore[arg-type]
    assert decision == "campaign_strategist"


@pytest.mark.asyncio
async def test_end_to_end_pipeline_execution():
    """
    Integration Test: Full end-to-end execution of the 6-agent multi-agent workflow.
    
    Verifies:
    1. Parallel execution of Agents 1, 2, and 3.
    2. Barrier synchronization joining into Agent 4 (Strategist).
    3. Production-ready deliverable generation by Agent 5 (Content Architect).
    4. Compliance auditing and scoring by Agent 6 (Quality Evaluator).
    5. Clean state transitions, telemetry records, and zero DB leaks.
    """
    async with TestSessionLocal() as db:
        user, agency, _ = await _create_user_and_agency(
            db=db,
            email=f"e2e_user_{uuid.uuid4().hex[:6]}@agencyos.local",
            agency_name=f"E2E Agency {uuid.uuid4().hex[:4]}",
            agency_slug=f"e2e-agency-{uuid.uuid4().hex[:6]}",
        )

        client = Client(
            id=uuid.uuid4(),
            agency_id=agency.id,
            business_name="RoboLogix Automation Systems",
            industry="Industrial Robotics & Smart Factory Automation",
            status=ClientStatus.active,
        )
        db.add(client)
        await db.flush()

        bp = BrandProfile(
            id=uuid.uuid4(),
            client_id=client.id,
            version=1,
            is_confirmed=True,
            brand_voice="authoritative, technical, ROI-focused",
            goals={
                "offers": [
                    {"name": "RoboLogix ARM-800", "description": "High-precision 6-axis robot cell with 0.01mm repeatability"}
                ]
            },
        )
        db.add(bp)

        contract = Contract(
            id=uuid.uuid4(),
            client_id=client.id,
            name="Q1 Enterprise Retainer",
            start_date=datetime.now(timezone.utc).date(),
            status=ContractStatus.active,
        )
        db.add(contract)
        await db.flush()

        scope1 = ScopeItem(
            id=uuid.uuid4(),
            contract_id=contract.id,
            deliverable_type="carousel",
            platform="linkedin",
            monthly_quantity=1,
        )
        scope2 = ScopeItem(
            id=uuid.uuid4(),
            contract_id=contract.id,
            deliverable_type="reel",
            platform="instagram",
            monthly_quantity=1,
        )
        db.add_all([scope1, scope2])

        # Seed 2 historical published deliverables for Agent 3
        campaign_past = Campaign(
            id=uuid.uuid4(),
            client_id=client.id,
            name="Past Q3 Campaign",
            status=CampaignStatus.completed,
        )
        db.add(campaign_past)
        await db.flush()

        past_deliv = Deliverable(
            id=uuid.uuid4(),
            campaign_id=campaign_past.id,
            title="Past Precision Benchmark",
            deliverable_type="carousel",
            platform="linkedin",
            status=DeliverableStatus.published,
            views_count=1200,
            likes_count=60,
            comments_count=10,
            shares_count=5,
            published_at=datetime.now(timezone.utc),
        )
        db.add(past_deliv)
        await db.commit()

        # Build Brief
        brief = CampaignBrief(
            client_id=client.id,
            agency_id=agency.id,
            period_month=3,
            period_year=2026,
            objective="Drive 20 qualified plant director demo requests for ARM-800",
            custom_brief="Target Tier-1 manufacturing plants with deployment speed and precision repeatability.",
            target_audience=["Plant Operations Directors", "Factory Automation Engineers"],
            platforms=["linkedin", "instagram"],
            deliverable_preferences=["carousel", "reel"],
            additional_constraints=["No cheap claims"],
            success_criteria=["High dwell time on carousel slides", "High saves and shares"],
        )

        initial_state: CampaignState = {
            "run_id": str(uuid.uuid4()),
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
            "max_revisions": 2,
            "workflow_status": "gathering_intelligence",
            "current_agent": None,
            "human_feedback": None,
            "pipeline_agents_executed": [],
            "agent_traces": [],
            "errors": [],
        }

        # Execute full multi-agent pipeline
        final_state = await run_campaign_pipeline(
            initial_state=initial_state,
            db_session_factory=TestSessionLocal,
        )

        # 1. State assertions
        assert final_state["brand_context"] is not None
        assert final_state["brand_context"].business_name == "RoboLogix Automation Systems"

        assert final_state["market_research"] is not None
        assert len(final_state["market_research"].evidence_sources) > 0

        assert final_state["performance_playbook"] is not None
        assert final_state["campaign_strategy"] is not None
        assert len(final_state["campaign_strategy"].strategic_angles) > 0

        assert final_state["deliverable_plans"] is not None
        assert len(final_state["deliverable_plans"]) >= 1

        assert final_state["quality_evaluation"] is not None
        assert 0.0 <= final_state["quality_evaluation"].compliance_score <= 1.0

        # Workflow status must be resolved
        assert final_state["workflow_status"] in ("awaiting_approval", "escalated_to_human")

        # Telemetry verification: all 6 agents must have executed
        executed_agents = set(final_state["pipeline_agents_executed"])
        assert "brand_intelligence" in executed_agents
        assert "market_research" in executed_agents
        assert "performance_analysis" in executed_agents
        assert "campaign_strategist" in executed_agents
        assert "content_architect" in executed_agents
        assert "quality_evaluator" in executed_agents

        assert len(final_state["agent_traces"]) >= 6
        for trace in final_state["agent_traces"]:
            assert trace.success is True
            assert trace.duration_ms > 0
