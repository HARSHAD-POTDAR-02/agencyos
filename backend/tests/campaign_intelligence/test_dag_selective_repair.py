import uuid
from unittest.mock import AsyncMock, patch
import pytest

from app.campaign_intelligence.agents.content_architect import content_architect_node
from app.campaign_intelligence.agents.quality_evaluator import quality_evaluator_node
from app.campaign_intelligence.orchestration.graph import route_quality_gate
from app.campaign_intelligence.orchestration.state import CampaignState
from app.campaign_intelligence.schemas.brand import BrandContext, ProhibitedTerm
from app.campaign_intelligence.schemas.campaign import CampaignBrief
from app.campaign_intelligence.schemas.deliverables import (
    CarouselSlide,
    DeliverablePlan,
    ReelScene,
)
from app.campaign_intelligence.schemas.quality import (
    FindingCategory,
    FindingSeverity,
    QualityEvaluation,
    QualityFinding,
    RevisionInstruction,
)
from app.campaign_intelligence.schemas.strategy import CampaignStrategy, DeliverableSlot


@pytest.fixture
def test_setup():
    client_id = uuid.uuid4()
    agency_id = uuid.uuid4()

    brief = CampaignBrief(
        client_id=client_id,
        agency_id=agency_id,
        period_month=11,
        period_year=2026,
        objective="Drive qualified plant director demo requests",
        target_audience=["Plant Directors"],
        platforms=["linkedin", "instagram"],
        deliverable_preferences=["carousel", "reel"],
    )

    brand_context = BrandContext(
        client_id=client_id,
        agency_id=agency_id,
        business_name="AeroBotix Automation",
        prohibited_terms=[ProhibitedTerm(term="magic bullet", reason="Hyperbolic claim")],
        confirmed_facts=["ARM-X1 deploys in 48 hours"],
    )

    slots = [
        DeliverableSlot(
            slot_index=0,
            planned_day=1,
            deliverable_type="reel",
            target_platform="instagram",
            funnel_stage="top_of_funnel_awareness",
            target_persona="Plant Directors",
            hook_category="pain_mirror",
            strategic_angle_ref="Fast Deployment",
            core_message="Cut deployment downtime",
        ),
        DeliverableSlot(
            slot_index=1,
            planned_day=2,
            deliverable_type="carousel",
            target_platform="linkedin",
            funnel_stage="middle_of_funnel_consideration",
            target_persona="Plant Directors",
            hook_category="counter_intuitive_myth",
            strategic_angle_ref="Modular TCO",
            core_message="Modular robotics beats legacy fixed automation",
        ),
    ]

    strategy = CampaignStrategy(
        campaign_theme="Slashing Commissioning Downtime",
        primary_objective="Drive qualified plant director demo requests",
        target_audience_definition="Plant Directors",
        deliverable_slots=slots,
    )

    return brief, brand_context, strategy


def test_route_quality_gate_revision_routing():
    # 1. Approved -> END
    state_approved: CampaignState = {
        "quality_evaluation": QualityEvaluation(
            is_approved_for_human_review=True,
            compliance_score=0.95,
            findings=[],
            failing_deliverable_indices=[],
            revision_required=False,
            evaluated_at="2026-11-20T12:00:00Z",
        ),
        "revision_count": 0,
        "max_revisions": 2,
    }
    assert route_quality_gate(state_approved) == "__end__"

    # 2. Content revision needed, count 0 -> content_architect
    state_repair: CampaignState = {
        "quality_evaluation": QualityEvaluation(
            is_approved_for_human_review=False,
            compliance_score=0.60,
            findings=[
                QualityFinding(
                    category=FindingCategory.cliche_slop,
                    severity=FindingSeverity.critical,
                    deliverable_index=1,
                    issue_description="Contains banned cliché",
                    remediation_instruction="Remove cliché",
                )
            ],
            failing_deliverable_indices=[1],
            revision_required=True,
            revision_instruction=RevisionInstruction(
                target_agent="content_architect",
                reason="Failed quality threshold",
                instructions=["Remove cliché"],
            ),
            evaluated_at="2026-11-20T12:00:00Z",
        ),
        "revision_count": 0,
        "max_revisions": 2,
    }
    assert route_quality_gate(state_repair) == "content_architect"

    # 3. Strategy revision needed -> campaign_strategist
    state_strat: CampaignState = {
        "quality_evaluation": QualityEvaluation(
            is_approved_for_human_review=False,
            compliance_score=0.50,
            findings=[],
            failing_deliverable_indices=[],
            revision_required=True,
            revision_instruction=RevisionInstruction(
                target_agent="campaign_strategist",
                reason="Strategic angle mismatch",
                instructions=["Align strategic angles"],
            ),
            evaluated_at="2026-11-20T12:00:00Z",
        ),
        "revision_count": 0,
        "max_revisions": 2,
    }
    assert route_quality_gate(state_strat) == "campaign_strategist"

    # 4. Max revisions reached -> END (escalate)
    state_max_rev = dict(state_repair)
    state_max_rev["revision_count"] = 2
    assert route_quality_gate(state_max_rev) == "__end__"


@pytest.mark.asyncio
async def test_content_architect_node_selective_repair(test_setup):
    brief, brand_context, strategy = test_setup

    # Slot 0 is clean; Slot 1 has a banned cliché
    deliv0 = DeliverablePlan(
        slot_index=0,
        planned_day=1,
        title="48-Hour Turnkey Deployment",
        deliverable_type="reel",
        platform="instagram",
        primary_hook="How plants commission robots in 48 hours.",
        caption="Traditional robotics installations drag on for months. Discover how modular cells deploy rapidly.",
        call_to_action="Visit the link in bio for full specs.",
        reel_scenes=[
            ReelScene(scene_number=1, timestamp_range="0:00 - 0:04", visual_action="Camera pans over arm", spoken_audio_or_voiceover="Robotics commissioning in 48 hours."),
            ReelScene(scene_number=2, timestamp_range="0:04 - 0:16", visual_action="Technicians connect modular bus", spoken_audio_or_voiceover="Pre-configured bus eliminates weeks of rewiring."),
        ],
    )

    deliv1_failing = DeliverablePlan(
        slot_index=1,
        planned_day=2,
        title="TCO Architecture Breakdown",
        deliverable_type="carousel",
        platform="linkedin",
        primary_hook="Why legacy robotics is not a game changer.",
        caption="In today's fast-paced world, this cutting-edge solution will supercharge your plant.",
        call_to_action="Book a consult today.",
        carousel_slides=[
            CarouselSlide(slide_number=1, headline="The Legacy Bottleneck", body_copy="Why wait 4 months?", visual_layout="Schematic"),
            CarouselSlide(slide_number=2, headline="Modular ROI", body_copy="Cut downtime by 75%.", visual_layout="Chart"),
            CarouselSlide(slide_number=3, headline="Take Action", body_copy="Book a demo.", visual_layout="CTA"),
        ],
    )

    # Clean replacement that repair_deliverables will produce
    deliv1_repaired = DeliverablePlan(
        slot_index=1,
        planned_day=2,
        title="TCO Architecture Breakdown",
        deliverable_type="carousel",
        platform="linkedin",
        primary_hook="Why legacy fixed automation drains factory capital.",
        caption="Discover how modular cell architectures reduce total cost of ownership by 40% across two years.",
        call_to_action="Request an engineering analysis at acrobatics.ai/demo.",
        carousel_slides=[
            CarouselSlide(slide_number=1, headline="The Capital Drain of Fixed Delta Arms", body_copy="Why custom fixturing drains capital.", visual_layout="Schematic"),
            CarouselSlide(slide_number=2, headline="Modular Flexibility", body_copy="Rapid retooling for new product variants.", visual_layout="Chart"),
            CarouselSlide(slide_number=3, headline="Calculate Your TCO", body_copy="Book an engineering review.", visual_layout="CTA"),
        ],
    )

    # 1. Run Quality Evaluator on initial plan (should flag slot 1 only)
    evaluator_state: CampaignState = {
        "run_id": "test-repair-run",
        "agency_id": brief.agency_id,
        "client_id": brief.client_id,
        "campaign_id": uuid.uuid4(),
        "brief": brief,
        "brand_context": brand_context,
        "market_research": None,
        "performance_playbook": None,
        "campaign_strategy": strategy,
        "deliverable_plans": [deliv0, deliv1_failing],
        "quality_evaluation": None,
        "revision_count": 0,
        "max_revisions": 2,
        "workflow_status": "evaluating",
        "current_agent": "content_architect",
        "human_feedback": None,
        "pipeline_agents_executed": [],
        "agent_traces": [],
        "errors": [],
    }

    eval_result = await quality_evaluator_node(evaluator_state)
    quality_eval: QualityEvaluation = eval_result["quality_evaluation"]

    assert quality_eval.is_approved_for_human_review is False
    assert quality_eval.revision_required is True
    assert 1 in quality_eval.failing_deliverable_indices
    assert 0 not in quality_eval.failing_deliverable_indices

    # 2. Update state and invoke content_architect_node with mocked repair response
    repair_state = dict(evaluator_state)
    repair_state["quality_evaluation"] = quality_eval
    repair_state["deliverable_plans"] = [deliv0, deliv1_failing]

    with patch(
        "app.campaign_intelligence.agents.content_architect.invoke_structured_llm",
        new_callable=AsyncMock,
    ) as mock_llm:
        from app.campaign_intelligence.agents.content_architect import MicroBatchOutput
        mock_llm.return_value = MicroBatchOutput(deliverables=[deliv1_repaired])

        repair_output = await content_architect_node(repair_state)

    # 3. Verify slot 0 was preserved and slot 1 was successfully replaced in merged plans
    repaired_plans = repair_output["deliverable_plans"]
    assert len(repaired_plans) == 2
    assert repaired_plans[0].slot_index == 0
    assert repaired_plans[0].primary_hook == deliv0.primary_hook
    assert repaired_plans[1].slot_index == 1
    assert repaired_plans[1].primary_hook == deliv1_repaired.primary_hook
    assert "game changer" not in repaired_plans[1].primary_hook.lower()
