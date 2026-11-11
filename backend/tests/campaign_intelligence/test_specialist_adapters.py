import uuid
import pytest
from datetime import datetime, timezone
from pydantic import ValidationError

from app.campaign_intelligence.collaboration.schemas import (
    ArtifactType,
    ComplianceArtifactPayload,
    ComplianceCheckItem,
    ComplianceVerdict,
    EvidenceCitation,
    FormatPerformanceMetric,
    MetricMeasurementBasis,
    PerformanceArtifactPayload,
    SceneCard,
    SocialPlatform,
    StoryboardArtifactPayload,
)
from app.campaign_intelligence.schemas.brand import BrandContext, ProhibitedTerm
from app.campaign_intelligence.schemas.campaign import CampaignBrief
from app.campaign_intelligence.schemas.studio_context import CampaignStudioContext
from app.campaign_intelligence.specialists import get_specialist_adapter
from app.campaign_intelligence.specialists.brand_adapter import BrandSpecialistAdapter
from app.campaign_intelligence.specialists.content_architect_adapter import ContentArchitectAdapter
from app.campaign_intelligence.specialists.market_research_adapter import MarketResearchSpecialistAdapter
from app.campaign_intelligence.specialists.performance_adapter import PerformanceSpecialistAdapter
from app.campaign_intelligence.specialists.quality_evaluator_adapter import QualityEvaluatorAdapter
from app.campaign_intelligence.specialists.strategist_adapter import CampaignStrategistAdapter


def _build_test_context() -> CampaignStudioContext:
    agency_id = uuid.uuid4()
    client_id = uuid.uuid4()
    campaign_id = uuid.uuid4()

    brief = CampaignBrief(
        client_id=client_id,
        agency_id=agency_id,
        period_month=11,
        period_year=2026,
        objective="Drive foot traffic and signature tandoor dish awareness",
        platforms=["instagram", "facebook"],
        duration_days=4,
    )

    brand_context = BrandContext(
        client_id=client_id,
        agency_id=agency_id,
        business_name="The Bombay Grill",
        industry="Hospitality & Fine Dining",
        website="https://bombaygrill.example.com",
        brand_voice=["Warm", "Authoritative", "Sensory"],
        content_pillars=["Authentic Charcoal Craft", "Culinary Heritage", "Weekend Specials"],
        prohibited_terms=[
            ProhibitedTerm(term="cheap eats", is_exact_match=True, reason="Devalues brand"),
            ProhibitedTerm(term="instant curry", is_exact_match=True, reason="Contradicts artisanal craft"),
        ],
        confirmed_facts=[
            "Client business name: 'The Bombay Grill'",
            "Client verified industry: 'Hospitality & Fine Dining'",
            "Operational charcoal tandoor oven on premises",
        ],
        assumptions=[
            "Target audience values slow-cooked, authentic Indian preparation",
        ],
        knowledge_gaps=[
            "Exact happy hour promotional pricing is unconfirmed in database.",
        ],
    )

    return CampaignStudioContext(
        agency_id=agency_id,
        client_id=client_id,
        campaign_id=campaign_id,
        client_name="The Bombay Grill",
        client_industry="Hospitality & Fine Dining",
        client_location="Bandra West, Mumbai",
        campaign_brief=brief,
        brand_context=brand_context,
    )


# =====================================================================
# 1. Studio Context Immutability & Provenance
# =====================================================================
def test_campaign_studio_context_immutability():
    ctx = _build_test_context()
    assert ctx.client_name == "The Bombay Grill"
    assert ctx.context_schema_version == "1.0"
    assert ctx.context_snapshot_id is not None

    # Enforces immutability: mutating attribute must raise ValidationError
    with pytest.raises(ValidationError):
        ctx.client_name = "Modified Name"  # type: ignore


# =====================================================================
# 2. Production-Grade Pydantic Schemas Validation
# =====================================================================
def test_evidence_citation_validation():
    # Valid HTTP/HTTPS URL
    citation = EvidenceCitation(
        source_title="Zomato Restaurant Trends 2026",
        source_url="https://zomato.example.com/trends/mumbai",
        publisher="Zomato",
        excerpt="Searches for authentic charcoal tandoor dining grew 34% year-over-year in Mumbai.",
    )
    assert citation.source_url == "https://zomato.example.com/trends/mumbai"
    assert citation.is_direct_quote is True

    # Invalid URL without http/https protocol must fail validation
    with pytest.raises(ValueError, match="source_url must start with http:// or https://"):
        EvidenceCitation(
            source_title="Invalid Source",
            source_url="ftp://invalid.com/file",
            publisher="Invalid",
            excerpt="Test",
        )


def test_scene_card_timing_validation():
    # Valid scene: end_ms > start_ms
    scene = SceneCard(
        scene_number=1,
        start_ms=0,
        end_ms=3000,
        timestamp_range="0:00 - 0:03",
        shot_type="Macro Close-Up",
        visual_action="Chef places skewered lamb into glowing clay tandoor.",
        voiceover_script="The secret isn't in the spice. It's in the clay.",
    )
    assert scene.end_ms == 3000

    # Invalid scene: end_ms <= start_ms must fail validation
    with pytest.raises(ValueError, match="end_ms .* must be strictly greater than start_ms"):
        SceneCard(
            scene_number=2,
            start_ms=5000,
            end_ms=4000,
            visual_action="Invalid timing",
            voiceover_script="Test",
            shot_type="POV",
        )


def test_performance_schema_cold_start_handling():
    metric = FormatPerformanceMetric(
        deliverable_format="reel",
        platform=SocialPlatform.instagram,
        sample_size=0,
        avg_engagement_rate=None,  # Explicitly None for cold start!
        avg_views=None,
    )
    assert metric.sample_size == 0
    assert metric.avg_engagement_rate is None

    payload = PerformanceArtifactPayload(
        data_sufficiency="cold_start",
        sample_size_total=0,
        format_metrics=[metric],
        creative_fatigue_signals=[],
        recommended_format_ratio={"reel": 4, "carousel": 3, "static": 1},
    )
    assert payload.data_sufficiency == "cold_start"
    assert payload.recommended_format_ratio["reel"] == 4


def test_compliance_derived_blocking_status():
    # Case A: Check contains a blocking FAIL
    payload_dict = {
        "checks": [
            {
                "check_name": "Exact Prohibited Terms",
                "check_type": "deterministic",
                "verdict": "FAIL",
                "flagged_snippet": "cheap eats",
                "explanation": "Found prohibited term 'cheap eats'",
                "is_blocking": True,
            },
            {
                "check_name": "Character Limit",
                "check_type": "deterministic",
                "verdict": "PASS",
                "explanation": "Valid length",
                "is_blocking": False,
            },
        ],
        "original_text": "We offer the best cheap eats in town!",
    }
    payload = ComplianceArtifactPayload.model_validate(payload_dict)
    assert payload.has_blocking_violations is True

    # Case B: Check has only non-blocking warnings or passes
    payload_clean = ComplianceArtifactPayload.model_validate({
        "checks": [
            {
                "check_name": "Tone Alignment",
                "check_type": "semantic_ai",
                "verdict": "NEEDS_REVIEW",
                "explanation": "Tone feels slightly casual",
                "is_blocking": False,
            },
            {
                "check_name": "Character Limit",
                "check_type": "deterministic",
                "verdict": "PASS",
                "explanation": "Valid length",
                "is_blocking": False,
            },
        ],
        "original_text": "Authentic dining experience crafted with passion.",
    })
    assert payload_clean.has_blocking_violations is False


# =====================================================================
# 3. Specialist Registry & Adapter Dispatch
# =====================================================================
def test_specialist_registry_dispatch():
    brand_specialist = get_specialist_adapter("brand_intelligence")
    assert isinstance(brand_specialist, BrandSpecialistAdapter)
    assert brand_specialist.specialist_id == "brand_intelligence"

    content_specialist = get_specialist_adapter("content_architect")
    assert isinstance(content_specialist, ContentArchitectAdapter)

    perf_specialist = get_specialist_adapter("historical_performance")
    assert isinstance(perf_specialist, PerformanceSpecialistAdapter)

    market_specialist = get_specialist_adapter("market_research")
    assert isinstance(market_specialist, MarketResearchSpecialistAdapter)

    quality_specialist = get_specialist_adapter("quality_evaluator")
    assert isinstance(quality_specialist, QualityEvaluatorAdapter)

    strategist_specialist = get_specialist_adapter("campaign_strategist")
    assert isinstance(strategist_specialist, CampaignStrategistAdapter)

    # Unknown ID defaults cleanly to Campaign Director / Strategist
    default_specialist = get_specialist_adapter("unknown_or_none")
    assert isinstance(default_specialist, CampaignStrategistAdapter)


# =====================================================================
# 4. Content Architect Adapter Execution
# =====================================================================
@pytest.mark.asyncio
async def test_content_architect_adapter_storyboard_generation(mock_db_session=None):
    ctx = _build_test_context()
    adapter = ContentArchitectAdapter()

    res = await adapter.execute(
        query="Draft a 15-second viral Reel script for our signature seekh kebab",
        context=ctx,
        db=None,  # Content architect does not require DB session
    )

    assert res.specialist_id == "content_architect"
    assert res.artifact_type == ArtifactType.storyboard
    assert res.artifact_payload is not None
    assert "deliverable_title" in res.artifact_payload
    assert len(res.artifact_payload["scenes"]) >= 1
    assert len(res.activity_logs) >= 1
    assert len(res.suggested_followups) >= 1


# =====================================================================
# 5. Quality Evaluator Adapter Deterministic Check
# =====================================================================
@pytest.mark.asyncio
async def test_quality_evaluator_adapter_prohibited_term_detection():
    ctx = _build_test_context()
    adapter = QualityEvaluatorAdapter()

    # Text contains "cheap eats" which is in client.prohibited_terms
    res = await adapter.execute(
        query="Check this caption: 'Come down for the best cheap eats in Mumbai!'",
        context=ctx,
        db=None,
    )

    assert res.specialist_id == "quality_evaluator"
    assert res.artifact_type == ArtifactType.compliance_review
    assert res.artifact_payload is not None
    assert res.artifact_payload["has_blocking_violations"] is True
    # Verify exact finding
    checks = res.artifact_payload["checks"]
    prohibited_check = next(c for c in checks if c["check_name"] == "Exact Prohibited Terms")
    assert prohibited_check["verdict"] == ComplianceVerdict.FAIL.value or prohibited_check["verdict"] == "FAIL"
    assert "cheap eats" in prohibited_check["flagged_snippet"]


# =====================================================================
# 6. Brand Specialist Adapter 4-Tier Truth Execution
# =====================================================================
@pytest.mark.asyncio
async def test_brand_specialist_adapter_4_tier_truth():
    ctx = _build_test_context()
    adapter = BrandSpecialistAdapter()

    res = await adapter.execute(
        query="Audit our content pillars and brand voice",
        context=ctx,
        db=None,
    )

    assert res.specialist_id == "brand_intelligence"
    assert res.artifact_type == ArtifactType.brand_positioning
    payload = res.artifact_payload
    assert payload is not None
    assert payload["business_name"] == "The Bombay Grill"
    assert len(payload["confirmed_facts"]) >= 1
    # Check that confirmed facts identify their DB source
    assert any("clients / brand_profiles" in f["source_reference"] for f in payload["confirmed_facts"])
    # Check knowledge gaps produce clarifying questions
    assert len(payload["missing_information_questions"]) >= 1
    assert payload["missing_information_questions"][0]["clarifying_question"] is not None


# =====================================================================
# 7. Performance Specialist Adapter Execution
# =====================================================================
@pytest.mark.asyncio
async def test_performance_specialist_adapter_execution():
    ctx = _build_test_context()
    adapter = PerformanceSpecialistAdapter()

    # Pass mock DB that returns 0 deliverables (cold start)
    from unittest.mock import AsyncMock, MagicMock
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_scalars = MagicMock()
    mock_scalars.all.return_value = []
    mock_result.scalars.return_value = mock_scalars
    mock_db.execute = AsyncMock(return_value=mock_result)

    res = await adapter.execute(
        query="What format should we prioritize for our next campaign?",
        context=ctx,
        db=mock_db,
    )

    assert res.specialist_id == "historical_performance"
    assert res.artifact_type == ArtifactType.performance_playbook
    payload = res.artifact_payload
    assert payload is not None
    assert payload["data_sufficiency"] == "cold_start"
    assert payload["sample_size_total"] == 0
    assert payload["recommended_format_ratio"]["reel"] > 0


# =====================================================================
# 8. Campaign Strategist Adapter Blueprint Execution
# =====================================================================
@pytest.mark.asyncio
async def test_campaign_strategist_adapter_blueprint_generation():
    ctx = _build_test_context()
    adapter = CampaignStrategistAdapter()

    res = await adapter.execute(
        query="Plan a 4-day sprint arc moving customers from problem awareness to dinner booking",
        context=ctx,
        db=None,
    )

    assert res.specialist_id == "campaign_strategist"
    assert res.artifact_type == ArtifactType.campaign_blueprint
    payload = res.artifact_payload
    assert payload is not None
    assert "campaign_theme" in payload
    assert len(payload["stages"]) >= 2
    assert "target_format_mix" in payload

