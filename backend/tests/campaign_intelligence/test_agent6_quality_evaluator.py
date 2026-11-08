import uuid
from datetime import datetime, timezone
import pytest

from app.campaign_intelligence.agents.quality_evaluator import (
    QualityEvaluatorAgent,
    quality_evaluator_node,
)
from app.campaign_intelligence.orchestration.state import CampaignState
from app.campaign_intelligence.schemas.brand import (
    BrandContext,
    ContractQuota,
    ProhibitedClaim,
    ProhibitedTerm,
    ToneGuideline,
)
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
)
from app.campaign_intelligence.schemas.strategy import (
    CampaignStrategy,
    MessagingPillar,
    StrategicAngle,
)


@pytest.fixture
def sample_brief():
    return CampaignBrief(
        client_id=uuid.uuid4(),
        agency_id=uuid.uuid4(),
        period_month=3,
        period_year=2026,
        objective="Drive qualified B2B demos for robotic automation",
        custom_brief="High precision automation campaign for manufacturing plants",
        target_audience=["Operations Directors at Tier-1 manufacturing plants"],
        platforms=["linkedin", "instagram"],
        deliverable_preferences=["carousel", "reel"],
        additional_constraints=["cheap", "magic bullet"],
    )


@pytest.fixture
def sample_brand_context():
    return BrandContext(
        client_id=uuid.uuid4(),
        agency_id=uuid.uuid4(),
        business_name="RoboTech Global",
        brand_positioning="Next-Gen Industrial Robotics",
        brand_voice=["Technical", "Authoritative", "Direct"],
        tone_guidelines=ToneGuideline(
            do=["Technical specifications", "Certified data"],
            dont=["Cheap jargon", "Hyperbolic promises"],
        ),
        prohibited_terms=[
            ProhibitedTerm(term="cheap", reason="Cheap implies inferior build quality"),
            ProhibitedTerm(term="magic bullet", reason="Over-promising unscientific claims"),
            ProhibitedTerm(term="unbreakable", reason="All machinery requires scheduled maintenance"),
        ],
        prohibited_claims=[
            ProhibitedClaim(claim="100% maintenance-free guarantee", reason="False engineering claim"),
        ],
        contract_quotas=[
            ContractQuota(platform="linkedin", deliverable_type="carousel", monthly_quantity=1),
            ContractQuota(platform="instagram", deliverable_type="reel", monthly_quantity=1),
        ],
    )


@pytest.fixture
def sample_strategy():
    return CampaignStrategy(
        campaign_theme="Precision Automation Launch",
        primary_objective="Drive qualified B2B demos",
        target_audience_definition="Tier-1 Manufacturing Leads",
        strategic_angles=[
            StrategicAngle(
                angle_name="Rapid Deployment",
                rationale="Showcase how ARM-X1 deploys in 7 days vs industry 4-week norm.",
                target_audience_segment="Tier-1 Manufacturing Leads",
                aligned_content_pillar="Speed of Integration",
                supporting_evidence=["ISO certified", "7-day turnkey setup"],
            )
        ],
        messaging_pillars=[
            MessagingPillar(
                pillar_name="Speed of Integration",
                core_message="Cut integration time by 75%",
                primary_call_to_action="Book a consult",
            )
        ],
        platform_distribution_strategy={"linkedin": "B2B authority", "instagram": "Visual demos"},
        pacing_and_cadence="2 posts per week",
    )


@pytest.fixture
def sample_compliant_deliverables():
    carousel = DeliverablePlan(
        title="7-Day Deployment Guide",
        deliverable_type="carousel",
        platform="linkedin",
        planned_week=1,
        strategic_angle="Rapid Deployment",
        hook_options=["How Tier-1 plants cut deployment downtime by 75%"],
        primary_hook="How Tier-1 plants cut deployment downtime by 75%",
        caption="Traditional robotics installations drag on for months. Discover how modular cells enable 7-day commissioning.",
        call_to_action="Book a 15-minute engineering consult today.",
        hashtags=["#Robotics", "#Manufacturing"],
        carousel_slides=[
            CarouselSlide(slide_number=1, slide_type="cover", headline="The 7-Day Robot Setup", body_copy="Why wait 4 months?", visual_layout="Clean blueprint"),
            CarouselSlide(slide_number=2, slide_type="content", headline="Modular Pre-Wiring", body_copy="Pre-tested cable harnesses.", visual_layout="Cable harness photo"),
            CarouselSlide(slide_number=3, slide_type="cta", headline="Accelerate Integration", body_copy="Book an engineering consult.", visual_layout="CTA button graphic"),
        ],
    )

    reel = DeliverablePlan(
        title="Live Precision Test",
        deliverable_type="reel",
        platform="instagram",
        planned_week=1,
        strategic_angle="Rapid Deployment",
        hook_options=["Sub-millimeter repeatability in extreme heat."],
        primary_hook="Sub-millimeter repeatability in extreme heat.",
        caption="High temperature testing of the ARM-X1. Watch how repeatability remains unaffected.",
        call_to_action="Visit our link in bio to see the full whitepaper.",
        hashtags=["#Automation", "#Tech"],
        reel_scenes=[
            ReelScene(scene_number=1, timestamp_range="0:00 - 0:03", visual_action="Arm moves quickly across test grid", on_screen_text="0.01mm repeatability", spoken_audio_or_voiceover="Watch sub-millimeter precision in real time."),
            ReelScene(scene_number=2, timestamp_range="0:03 - 0:15", visual_action="Thermal camera shows arm operating at 60C", on_screen_text="Thermal stress test", spoken_audio_or_voiceover="Operating consistently even in high ambient heat."),
        ],
    )

    return [carousel, reel]


@pytest.mark.asyncio
async def test_quality_evaluator_empty_deliverables():
    evaluator = QualityEvaluatorAgent()
    evaluation = await evaluator.evaluate(
        deliverables=[],
        strategy=None,
        brief=None,
        brand_context=None,
    )

    assert evaluation.is_approved_for_human_review is False
    assert evaluation.revision_required is True
    assert evaluation.compliance_score == 0.0
    assert len(evaluation.findings) == 1
    assert evaluation.findings[0].category == FindingCategory.production_feasibility
    assert evaluation.revision_instruction is not None
    assert evaluation.revision_instruction.target_agent == "content_architect"


@pytest.mark.asyncio
async def test_quality_evaluator_compliant_pass(sample_compliant_deliverables, sample_brand_context, sample_strategy, sample_brief):
    evaluator = QualityEvaluatorAgent()
    evaluation = await evaluator.evaluate(
        deliverables=sample_compliant_deliverables,
        strategy=sample_strategy,
        brief=sample_brief,
        brand_context=sample_brand_context,
    )

    prohibited_term_findings = [f for f in evaluation.findings if f.category == FindingCategory.prohibited_term]
    assert len(prohibited_term_findings) == 0

    quota_findings = [f for f in evaluation.findings if f.category == FindingCategory.quota_mismatch]
    assert len(quota_findings) == 0

    assert evaluation.compliance_score >= 0.75
    assert evaluation.is_approved_for_human_review is True
    assert evaluation.revision_required is False


@pytest.mark.asyncio
async def test_quality_evaluator_prohibited_terms_detection(sample_compliant_deliverables, sample_brand_context):
    sample_compliant_deliverables[0].carousel_slides[1].body_copy = "This is a cheap robotic arm alternative."

    evaluator = QualityEvaluatorAgent()
    evaluation = await evaluator.evaluate(
        deliverables=sample_compliant_deliverables,
        brand_context=sample_brand_context,
    )

    assert evaluation.is_approved_for_human_review is False
    assert evaluation.revision_required is True

    term_findings = [f for f in evaluation.findings if f.category == FindingCategory.prohibited_term]
    assert len(term_findings) >= 1
    assert any("cheap" in f.issue_description.lower() for f in term_findings)
    assert term_findings[0].severity == FindingSeverity.critical

    assert evaluation.revision_instruction is not None
    assert evaluation.revision_instruction.target_agent == "content_architect"


@pytest.mark.asyncio
async def test_quality_evaluator_production_feasibility_failures(sample_compliant_deliverables):
    sample_compliant_deliverables[1].reel_scenes = []
    sample_compliant_deliverables[0].primary_hook = ""

    evaluator = QualityEvaluatorAgent()
    evaluation = await evaluator.evaluate(
        deliverables=sample_compliant_deliverables,
    )

    assert evaluation.is_approved_for_human_review is False
    assert evaluation.revision_required is True

    feasibility_findings = [f for f in evaluation.findings if f.category == FindingCategory.production_feasibility]
    assert len(feasibility_findings) >= 2
    critical_findings = [f for f in feasibility_findings if f.severity == FindingSeverity.critical]
    assert len(critical_findings) >= 2


@pytest.mark.asyncio
async def test_quality_evaluator_quota_deficit_warning(sample_compliant_deliverables, sample_brand_context):
    sample_brand_context.contract_quotas.append(
        ContractQuota(platform="instagram", deliverable_type="reel", monthly_quantity=5)
    )

    evaluator = QualityEvaluatorAgent()
    evaluation = await evaluator.evaluate(
        deliverables=sample_compliant_deliverables,
        brand_context=sample_brand_context,
    )

    quota_findings = [f for f in evaluation.findings if f.category == FindingCategory.quota_mismatch]
    assert len(quota_findings) >= 1
    assert quota_findings[0].severity == FindingSeverity.warning


@pytest.mark.asyncio
async def test_quality_evaluator_max_revisions_escalation_to_human(sample_compliant_deliverables, sample_brand_context):
    sample_compliant_deliverables[0].caption = "This is a magic bullet solution."

    evaluator = QualityEvaluatorAgent()
    evaluation = await evaluator.evaluate(
        deliverables=sample_compliant_deliverables,
        brand_context=sample_brand_context,
        revision_count=2,
        max_revisions=2,
    )

    assert evaluation.is_approved_for_human_review is False
    assert evaluation.revision_required is True
    assert evaluation.revision_instruction is not None
    assert evaluation.revision_instruction.target_agent == "human"
    assert "maximum" in evaluation.revision_instruction.reason.lower()


@pytest.mark.asyncio
async def test_quality_evaluator_node_state_integration(sample_compliant_deliverables, sample_brand_context, sample_strategy, sample_brief):
    state: CampaignState = {
        "run_id": "test-run-123",
        "agency_id": uuid.uuid4(),
        "client_id": uuid.uuid4(),
        "campaign_id": uuid.uuid4(),
        "brief": sample_brief,
        "brand_context": sample_brand_context,
        "market_research": None,
        "performance_playbook": None,
        "campaign_strategy": sample_strategy,
        "deliverable_plans": sample_compliant_deliverables,
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

    result = await quality_evaluator_node(state)

    assert "quality_evaluation" in result
    evaluation = result["quality_evaluation"]
    assert isinstance(evaluation, QualityEvaluation)
    assert evaluation.is_approved_for_human_review is True
    assert result["workflow_status"] == "awaiting_approval"
    assert result["current_agent"] == "quality_evaluator"
    assert "quality_evaluator" in result["pipeline_agents_executed"]
    assert len(result["agent_traces"]) == 1
    assert result["agent_traces"][0].success is True
