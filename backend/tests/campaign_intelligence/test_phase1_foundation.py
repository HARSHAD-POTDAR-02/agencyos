from __future__ import annotations

import json
import operator
import uuid
import pytest
from pydantic import BaseModel, ValidationError

from app.core.config import settings
from app.core.llm import extract_json_from_llm, get_llm, invoke_structured_llm, _is_transient_error
from app.campaign_intelligence.orchestration.state import CampaignState
from app.campaign_intelligence.schemas import (
    AgentTelemetry,
    AudienceObservation,
    BrandContext,
    CampaignBrief,
    CampaignStrategy,
    CarouselSlide,
    ContractQuota,
    DataSufficiency,
    DeliverablePlan,
    FeedbackClassification,
    FeedbackItem,
    FindingCategory,
    FindingSeverity,
    FormatPerformanceSummary,
    MarketResearchReport,
    PerformancePlaybook,
    PipelineTrace,
    ProhibitedClaim,
    ProhibitedTerm,
    QualityEvaluation,
    QualityFinding,
    ReelScene,
    ResearchEvidence,
    RevisionInstruction,
    StrategicAngle,
    ToneGuideline,
    VerifiedOffer,
)


# ============================================================================
# 1. Schema Validation Tests
# ============================================================================

def test_campaign_brief_validation():
    """Verify CampaignBrief validates valid data and rejects invalid inputs."""
    client_id = uuid.uuid4()
    agency_id = uuid.uuid4()

    brief = CampaignBrief(
        client_id=client_id,
        agency_id=agency_id,
        period_month=11,
        period_year=2026,
        objective="Drive Q4 enterprise leads for robotic manufacturing solutions",
        target_audience=["Plant Managers", "Chief Operating Officers"],
        platforms=["linkedin", "youtube"],
        deliverable_preferences=["carousel", "reel"],
    )
    assert brief.period_month == 11
    assert brief.period_year == 2026
    assert "Plant Managers" in brief.target_audience

    # Invalid month (e.g. 13) should raise ValidationError
    with pytest.raises(ValidationError):
        CampaignBrief(
            client_id=client_id,
            agency_id=agency_id,
            period_month=13,
            period_year=2026,
            objective="Invalid",
        )


def test_brand_context_epistemic_separation():
    """Verify BrandContext strictly separates confirmed facts from assumptions, gaps, and offers."""
    client_id = uuid.uuid4()
    agency_id = uuid.uuid4()

    brand = BrandContext(
        client_id=client_id,
        agency_id=agency_id,
        business_name="RoboTech Precision",
        industry="Industrial Automation",
        website="https://robotechprecision.com",
        brand_positioning=None,  # Not in DB -> kept None, not fabricated!
        brand_voice=["authoritative", "technical", "engineering-first"],
        tone_guidelines=ToneGuideline(
            do=["Use SI units and precise metrics", "Focus on ROI and factory floor uptime"],
            dont=["Use consumer tech hype or buzzwords", "Make unsubstantiated speed claims"],
        ),
        prohibited_terms=[
            ProhibitedTerm(term="cheapest", is_exact_match=True, reason="Positions brand as low quality"),
            ProhibitedTerm(term="budget robotics", is_exact_match=True),
        ],
        prohibited_claims=[
            ProhibitedClaim(
                claim="100% zero downtime guarantee",
                semantic_context="Any claim that equipment never fails",
                reason="Unverifiable engineering claim violating warranty terms",
            )
        ],
        verified_offers=[
            VerifiedOffer(
                name="RoboTech Pro 500",
                description="Heavy payload robotic arm with sub-millimeter repeatability",
                source="confirmed_brand_profile",
                is_verified=True,
            )
        ],
        classified_feedback=[
            FeedbackItem(
                classification=FeedbackClassification.explicit_rule,
                content="Never show operators without proper protective gear in visual assets",
            ),
            FeedbackItem(
                classification=FeedbackClassification.repeated_preference,
                content="Client prefers dark mode technical schematics in carousels",
            ),
            FeedbackItem(
                classification=FeedbackClassification.internal_reviewer,
                content="Ensure tone does not sound like B2C electronics",
                is_internal=True,
            ),
        ],
        confirmed_facts=["Headquartered in Munich", "ISO 9001 certified"],
        assumptions=["Audience prefers LinkedIn for technical whitepaper summaries"],
        knowledge_gaps=["Brand positioning was not explicitly configured in BrandProfile"],
    )

    assert brand.brand_positioning is None
    assert len(brand.knowledge_gaps) == 1
    assert brand.prohibited_terms[0].is_exact_match is True
    assert brand.verified_offers[0].is_verified is True
    assert brand.classified_feedback[0].classification == FeedbackClassification.explicit_rule
    assert brand.classified_feedback[2].is_internal is True


def test_deliverable_plan_polymorphism():
    """Verify DeliverablePlan polymorphically models Reels, Carousels, and Static Graphics."""
    # 1. Reel
    reel = DeliverablePlan(
        title="Factory Floor Setup in 60 Seconds",
        deliverable_type="reel",
        platform="instagram",
        planned_week=1,
        strategic_angle="Speed of Deployment",
        hook_options=["Why most robot cells take 3 months to configure", "Stop wasting weeks on calibration"],
        primary_hook="Why most robot cells take 3 months to configure",
        caption="Full calibration walkthrough. Link in bio for specs.",
        call_to_action="Download technical spec sheet",
        reel_scenes=[
            ReelScene(
                scene_number=1,
                timestamp_range="0:00 - 0:03",
                visual_action="Close-up of robotic arm mounting on precision rails",
                on_screen_text="Factory Setup: Day 1 vs Day 30",
                spoken_audio_or_voiceover="Most plant managers think robotic integration takes a quarter.",
            ),
            ReelScene(
                scene_number=2,
                timestamp_range="0:03 - 0:10",
                visual_action="Split screen comparing legacy wiring vs modular bus",
                on_screen_text="Modular Quick-Lock System",
                spoken_audio_or_voiceover="Here is how modular bus architecture cuts installation to 48 hours.",
            ),
        ],
    )
    assert len(reel.reel_scenes) == 2
    assert reel.reel_scenes[0].scene_number == 1

    # 2. Carousel
    carousel = DeliverablePlan(
        title="5 Failure Points in Hydraulic vs Electric Actuators",
        deliverable_type="carousel",
        platform="linkedin",
        planned_week=2,
        strategic_angle="Technical Comparison",
        hook_options=["Are hydraulic actuators secretly bleeding your maintenance budget?"],
        primary_hook="Are hydraulic actuators secretly bleeding your maintenance budget?",
        caption="A direct breakdown for automation engineers.",
        call_to_action="Read the full engineering whitepaper",
        carousel_slides=[
            CarouselSlide(
                slide_number=1,
                headline="Hydraulic vs Electric: The Real 5-Year TCO",
                body_copy="Swipe to see breakdown",
                visual_layout="Split diagram of hydraulic fluid lines vs electric servo",
                slide_type="cover",
            ),
            CarouselSlide(
                slide_number=2,
                headline="1. Seal Degradation & Fluid Contamination",
                body_copy="Hydraulic seals require replacement every 1,500 operating hours.",
                visual_layout="Wear-and-tear diagram with callout pins",
                slide_type="content",
            ),
        ],
    )
    assert len(carousel.carousel_slides) == 2
    assert carousel.carousel_slides[0].slide_type == "cover"


def test_quality_evaluation_schema():
    """Verify QualityEvaluation schema models findings, severities, and revision instructions."""
    eval_report = QualityEvaluation(
        is_approved_for_human_review=False,
        compliance_score=0.75,
        findings=[
            QualityFinding(
                category=FindingCategory.prohibited_term,
                severity=FindingSeverity.critical,
                deliverable_index=0,
                deliverable_title="Post 1",
                issue_description="Used prohibited term 'cheapest'",
                remediation_instruction="Replace 'cheapest' with 'most cost-effective over a 5-year lifecycle'",
            )
        ],
        revision_required=True,
        revision_instruction=RevisionInstruction(
            target_agent="content_architect",
            reason="Brand term violations detected in Post 1",
            instructions=["Remove prohibited terms from Hook 1 and Caption"],
        ),
        evaluated_at="2026-11-07T12:00:00Z",
    )
    assert eval_report.is_approved_for_human_review is False
    assert eval_report.revision_required is True
    assert eval_report.findings[0].severity == FindingSeverity.critical
    assert eval_report.revision_instruction.target_agent == "content_architect"


# ============================================================================
# 2. LangGraph State & Reducer Tests
# ============================================================================

def test_campaign_state_reducers():
    """Verify that parallel state reducers accumulate without clobbering."""
    # Test operator.add reducer simulation
    agents_1 = ["brand_intelligence"]
    agents_2 = ["market_research"]
    agents_3 = ["performance_analysis"]

    combined_agents = operator.add(agents_1, agents_2)
    combined_agents = operator.add(combined_agents, agents_3)
    assert combined_agents == ["brand_intelligence", "market_research", "performance_analysis"]

    # Test telemetry reducer simulation
    trace_1 = [AgentTelemetry(
        agent_name="brand_intelligence",
        start_time="2026-11-07T12:00:00Z",
        end_time="2026-11-07T12:00:02Z",
        duration_ms=2000.0,
        model_name="openai/gpt-oss-120b",
    )]
    trace_2 = [AgentTelemetry(
        agent_name="market_research",
        start_time="2026-11-07T12:00:00Z",
        end_time="2026-11-07T12:00:03Z",
        duration_ms=3000.0,
        model_name="openai/gpt-oss-120b",
    )]
    combined_traces = operator.add(trace_1, trace_2)
    assert len(combined_traces) == 2
    assert combined_traces[0].agent_name == "brand_intelligence"
    assert combined_traces[1].agent_name == "market_research"


def test_campaign_state_structure():
    """Verify CampaignState can be initialized with complete tenant & artifact keys."""
    client_id = uuid.uuid4()
    agency_id = uuid.uuid4()
    campaign_id = uuid.uuid4()

    state: CampaignState = {
        "run_id": "test_run_123",
        "agency_id": agency_id,
        "client_id": client_id,
        "campaign_id": campaign_id,
        "brief": CampaignBrief(
            client_id=client_id,
            agency_id=agency_id,
            period_month=11,
            period_year=2026,
            objective="Scale brand awareness",
        ),
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

    assert state["run_id"] == "test_run_123"
    assert state["workflow_status"] == "initializing"
    assert "AsyncSession" not in str(state.keys())


# ============================================================================
# 3. LLM Resilient JSON Parser & Transient Error Tests
# ============================================================================

def test_extract_json_from_llm():
    """Verify extract_json_from_llm handles markdown fences, preambles, and malformed spacing."""
    # 1. Clean JSON
    clean = '{"status": "ok", "count": 42}'
    assert extract_json_from_llm(clean) == {"status": "ok", "count": 42}

    # 2. Markdown fenced JSON with conversational intro
    fenced = (
        "Certainly! Here is your requested JSON object:\n\n"
        "```json\n"
        "{\n"
        '  "campaign_name": "Autumn Blast",\n'
        '  "target_platforms": ["instagram", "tiktok"]\n'
        "}\n"
        "```\n\n"
        "Let me know if you need anything else!"
    )
    res = extract_json_from_llm(fenced)
    assert res["campaign_name"] == "Autumn Blast"
    assert "tiktok" in res["target_platforms"]

    # 3. Code fence without language tag
    fenced_no_tag = "```\n[1, 2, 3]\n```"
    assert extract_json_from_llm(fenced_no_tag) == [1, 2, 3]

    # 4. Outermost brace search with trailing commentary
    outer_brace = 'Here is the result: {"key": "value"} - validated successfully.'
    assert extract_json_from_llm(outer_brace) == {"key": "value"}


def test_is_transient_error():
    """Verify transient error classifier correctly categorizes rate limits and timeouts."""
    class MockError(Exception):
        def __init__(self, message, status_code=None):
            super().__init__(message)
            self.status_code = status_code

    assert _is_transient_error(MockError("Rate limit reached: 429 Too Many Requests")) is True
    assert _is_transient_error(MockError("Server error", status_code=503)) is True
    assert _is_transient_error(MockError("Connection timed out after 60s")) is True
    assert _is_transient_error(MockError("Invalid schema syntax: bad input", status_code=400)) is False


# ============================================================================
# 4. Live Groq LLM Structured Output Test
# ============================================================================

@pytest.mark.asyncio
async def test_live_groq_structured_output():
    """Verify live Groq structured output returns a validated Pydantic model."""
    if not settings.GROQ_API_KEY:
        pytest.skip("GROQ_API_KEY is not configured; skipping live LLM test.")

    class TestVerificationModel(BaseModel):
        verification_status: str
        confidence_score: float
        reasoning: str

    prompt = (
        "Verify that AgencyOS Foundation is successfully configured. "
        "Set verification_status to 'verified' and confidence_score to 1.0."
    )

    result = await invoke_structured_llm(
        prompt=prompt,
        schema_class=TestVerificationModel,
        temperature=0.1,
    )

    assert isinstance(result, TestVerificationModel)
    assert result.verification_status == "verified"
    assert result.confidence_score == 1.0
    assert len(result.reasoning) > 0
