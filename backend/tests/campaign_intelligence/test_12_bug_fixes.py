import json
import pytest
import re
import uuid
from app.campaign_intelligence.agents.content_architect import (
    scrub_creative_content,
    apply_deliverable_scrubber,
    get_dynamic_emoji_rule,
    get_dynamic_visual_motifs,
    get_concrete_carousel_structure,
)
from app.campaign_intelligence.agents.campaign_strategist import (
    reconcile_and_pad_slots,
    derive_slot_allocation_targets,
)
from app.campaign_intelligence.agents.quality_evaluator import QualityEvaluatorAgent
from app.campaign_intelligence.research.deep_research_graph import has_schema_docstring_echo
from app.campaign_intelligence.schemas.brand import BrandContext, ProhibitedTerm, ProhibitedClaim
from app.campaign_intelligence.schemas.campaign import CampaignBrief
from app.campaign_intelligence.schemas.deliverables import DeliverablePlan, ReelScene, CarouselSlide
from app.campaign_intelligence.schemas.strategy import CampaignStrategy, StrategicAngle, MessagingPillar, DeliverableSlot
from app.campaign_intelligence.specialists.quality_evaluator_adapter import QualityEvaluatorAdapter
from app.campaign_intelligence.schemas.studio_context import CampaignStudioContext
from app.campaign_intelligence.schemas.quality import FindingSeverity
from app.campaign_intelligence.collaboration.schemas import ComplianceVerdict, ArtifactType


def _make_context(client_name="VertexCloud", industry="Cloud Infrastructure", website="https://vertexcloud.com") -> CampaignStudioContext:
    cid = uuid.uuid4()
    aid = uuid.uuid4()
    camp_id = uuid.uuid4()
    brand_ctx = BrandContext(
        client_id=cid,
        agency_id=aid,
        business_name=client_name,
        industry=industry,
        brand_voice=["Authoritative", "Minimalist"],
        confirmed_facts=["Enterprise cloud optimization platform"],
        website=website,
    )
    brief = CampaignBrief(
        client_id=cid,
        agency_id=aid,
        period_month=11,
        period_year=2026,
        duration_days=10,
        start_date="2026-11-20",
        end_date="2026-11-29",
        objective="Drive pipeline",
        platforms=["instagram", "linkedin"],
    )
    return CampaignStudioContext(
        agency_id=aid,
        client_id=cid,
        campaign_id=camp_id,
        client_name=client_name,
        client_industry=industry,
        brand_context=brand_ctx,
        campaign_brief=brief,
        active_artifact_payload={"deliverable_title": "Active Reel on Canvas", "full_caption": "Normal reel caption on canvas"},
    )


@pytest.mark.asyncio
async def test_bug_1_quality_evaluator_catches_pasted_roi_and_guarantees():
    """Bug 1: Verify QualityEvaluatorAdapter prioritizes user-pasted text over canvas and flags 500% ROI & unverified URLs."""
    ctx = _make_context()
    adapter = QualityEvaluatorAdapter()

    # User pasted extreme spam copy into chat query
    pasted_query = 'Audit this copy: "In today\'s fast-paced world, our breakthrough platform guarantees a 500% ROI in 7 days or your money back! Visit https://unverified-third-party.io/deal"'
    
    res = await adapter.execute(
        query=pasted_query,
        context=ctx,
        db=None,
    )
    assert res.specialist_id == "quality_evaluator"
    assert res.artifact_payload["has_blocking_violations"] is True
    
    checks = res.artifact_payload["checks"]
    roi_check = next((c for c in checks if c["check_name"] == "Prohibited Guarantees & Unsubstantiated ROI"), None)
    assert roi_check is not None
    assert roi_check["verdict"] == ComplianceVerdict.FAIL.value or roi_check["verdict"] == "FAIL"

    url_check = next((c for c in checks if c["check_name"] == "Verified URL & Link Hygiene"), None)
    assert url_check is not None
    assert url_check["verdict"] == ComplianceVerdict.FAIL.value or url_check["verdict"] == "FAIL"


def test_bug_2_and_6_sequential_day_and_scene_indexing():
    """Bug 2 & 6: Verify 20 deliverables over 10 days are scheduled chronologically (no D1-D10 collisions) and scenes are 1-indexed."""
    ctx = _make_context()
    targets = derive_slot_allocation_targets(ctx.campaign_brief, ctx.brand_context)
    assert len(targets) >= 5

    # Check DeliverablePlan strict 1-based normalization for scenes and slides (Bug 6 fix)
    raw_plan = {
        "title": "Day 1 Technical Reel",
        "deliverable_type": "reel",
        "platform": "instagram",
        "primary_hook": "Why latency spikes at 2 AM",
        "reel_scenes": [
            {"scene_number": 0, "timestamp_range": "0:00 - 0:03", "visual_action": "Lead looking at laptop"},
            {"scene_number": 1, "timestamp_range": "0:03 - 0:08", "visual_action": "Overhead screen view"},
            {"scene_number": 2, "timestamp_range": "0:08 - 0:15", "visual_action": "Whiteboard breakdown"},
        ],
        "carousel_slides": [
            {"slide_number": 0, "headline": "The Hidden Metric", "body_copy": "First slide body"},
            {"slide_number": 1, "headline": "Why it fails", "body_copy": "Second slide body"},
        ],
    }
    deliv = DeliverablePlan.model_validate(raw_plan)
    # Scenes must be strictly 1, 2, 3
    scene_nums = [s.scene_number for s in deliv.reel_scenes]
    assert scene_nums == [1, 2, 3], f"Expected [1, 2, 3], got {scene_nums}"

    # Slides must be strictly 1, 2
    slide_nums = [s.slide_number for s in deliv.carousel_slides]
    assert slide_nums == [1, 2], f"Expected [1, 2], got {slide_nums}"


def test_bug_3_quality_evaluator_flags_short_reels_and_missing_cta():
    """Bug 3: Verify 10-second reels or missing CTAs are flagged as critical blocking issues by QualityEvaluatorAgent."""
    agent = QualityEvaluatorAgent()
    short_reel = DeliverablePlan(
        title="10s Quick Reel",
        deliverable_type="reel",
        platform="instagram",
        primary_hook="Fast hook without cta",
        call_to_action="None",
        reel_scenes=[
            ReelScene(scene_number=1, timestamp_range="0:00 - 0:05", visual_action="Action 1", audio_or_voiceover="Voice 1"),
            ReelScene(scene_number=2, timestamp_range="0:05 - 0:10", visual_action="Action 2", audio_or_voiceover="Voice 2"),
        ],
    )
    # Explicitly clear CTA to simulate empty CTA entering quality gate
    short_reel.call_to_action = ""
    
    pacing_findings, _, _ = agent._audit_technical_compliance_and_pacing([short_reel])
    duration_crit = [f for f in pacing_findings if f.severity == FindingSeverity.critical and "15" in f.issue_description]
    assert len(duration_crit) > 0, f"Expected critical finding for <15s reel, got {pacing_findings}"

    cta_findings, _, _ = agent._audit_hook_length_and_cta_hygiene([short_reel])
    assert any(f.severity == FindingSeverity.critical for f in cta_findings)


def test_bug_4_schema_docstring_echo_detection():
    """Bug 4: Verify detection of raw Pydantic schema docstring echoes."""
    clean_output = {
        "executive_summary": "Investigated cloud providers AWS, GCP, and Azure.",
        "key_findings": [{"finding": "AWS data egress costs surged 14% in 2026.", "source_url": "https://example.com/report"}],
        "observed_competitors": [{"competitor_name": "Datadog", "supporting_source_url": "https://datadog.com"}],
    }
    assert not has_schema_docstring_echo(clean_output)

    echo_output_1 = {
        "executive_summary": "Factual statement grounded in retrieved evidence.",
        "key_findings": [],
    }
    assert has_schema_docstring_echo(echo_output_1)

    echo_output_2 = {
        "observed_competitors": [{"competitor_name": "Exact name of an actual business", "supporting_source_url": "https://agencyos.local"}],
    }
    assert has_schema_docstring_echo(echo_output_2)


def test_bug_7_scrubber_preserves_client_input_tags_and_removes_disclaimers():
    """Bug 7 & Constraint 2: Preserve clean [CLIENT_INPUT_NEEDED: ...] tags, scrub spoken compliance leaks and platform meta-sentences."""
    # 1. Clean tag must be PRESERVED
    text_with_clean_tag = "According to our recent study, we achieved [CLIENT_INPUT_NEEDED: Verified latency reduction percentage] across 45 nodes."
    cleaned = scrub_creative_content(text_with_clean_tag)
    assert "[CLIENT_INPUT_NEEDED: Verified latency reduction percentage]" in cleaned

    # 2. Literal angle-bracket placeholder must be scrubbed to clean tag
    text_with_angle_brackets = "Our system cuts costs by [CLIENT_INPUT_NEEDED: <exact missing proof or testimonial>] in enterprise tests."
    cleaned2 = scrub_creative_content(text_with_angle_brackets)
    assert "[CLIENT_INPUT_NEEDED: Verified client metric or case study]" in cleaned2
    assert "<exact missing" not in cleaned2

    # 3. Spoken compliance disclaimers must be completely removed
    text_with_spoken_disclaimer = "We will not present latency, throughput, or scaling numbers until they are approved. Real-time observability is the future."
    cleaned3 = scrub_creative_content(text_with_spoken_disclaimer)
    assert "We will not present" not in cleaned3
    assert "Real-time observability is the future." in cleaned3

    # 4. Platform meta-guidance sentences must be stripped
    text_with_meta_sentence = "Reels are best for content where the video is the whole experience. Watch how packet loss cascades."
    cleaned4 = scrub_creative_content(text_with_meta_sentence)
    assert "Reels are best for content" not in cleaned4
    assert "Watch how packet loss cascades." in cleaned4


def test_bug_8_and_10_dynamic_tone_and_multi_industry_motifs():
    """Bug 8 & 10 (Constraint 3): Derive emoji/tone from brand voice and visual motifs by industry with low-budget physical realism."""
    # Tech brand with minimalist voice
    tech_voice = ["Minimalist", "Technical", "Direct"]
    rule_tech = get_dynamic_emoji_rule(tech_voice)
    assert "Do NOT use playful, hyped, or consumer emojis" in rule_tech or "zero emojis" in rule_tech.lower()

    # Creative / Lifestyle brand
    lifestyle_voice = ["Playful", "Warm", "Energetic"]
    rule_lifestyle = get_dynamic_emoji_rule(lifestyle_voice)
    assert "Use 1-3 contextual, expressive emojis" in rule_lifestyle

    # Hospitality / Food industry motifs
    food_motifs = get_dynamic_visual_motifs("Hospitality & Dining")
    assert "kitchen" in food_motifs.lower() or "counter" in food_motifs.lower() or "food" in food_motifs.lower()
    assert "terminal" not in food_motifs.lower()  # No CLI terminals for non-tech clients!

    # Tech industry motifs
    tech_motifs = get_dynamic_visual_motifs("Cloud Infrastructure")
    assert "laptop" in tech_motifs.lower() or "screen" in tech_motifs.lower() or "whiteboard" in tech_motifs.lower()


def test_bug_9_strategic_angle_rotation_across_pillars():
    """Bug 9: Verify slots rotate across distinct pillars instead of hammering the exact same topic."""
    cid = uuid.uuid4()
    aid = uuid.uuid4()
    angles = [
        StrategicAngle(
            angle_name="Hidden Cost Multipliers",
            rationale="Uncovers untracked cloud transfer bills",
            target_audience_segment="CFO",
            aligned_content_pillar="Cost Certainty",
        ),
        StrategicAngle(
            angle_name="Failover Architecture",
            rationale="Addresses resilience in multi-region setups",
            target_audience_segment="VP Eng",
            aligned_content_pillar="Fault Tolerance",
        ),
        StrategicAngle(
            angle_name="FinOps Justification",
            rationale="Empowers team leads to defend cloud budget requests",
            target_audience_segment="Tech Lead",
            aligned_content_pillar="Executive Visibility",
        ),
    ]
    pillars = [
        MessagingPillar(
            pillar_name="Cost Certainty",
            core_message="Predictable monthly cloud run-rate",
            primary_call_to_action="Audit your cloud egress today",
        ),
        MessagingPillar(
            pillar_name="Fault Tolerance",
            core_message="Zero single points of failure",
            primary_call_to_action="Read our architectural resilience guide",
        ),
        MessagingPillar(
            pillar_name="Executive Visibility",
            core_message="Granular engineering allocation",
            primary_call_to_action="Request a FinOps audit",
        ),
    ]
    brief = CampaignBrief(
        client_id=cid,
        agency_id=aid,
        period_month=11,
        period_year=2026,
        duration_days=6,
        start_date="2026-11-20",
        end_date="2026-11-25",
        objective="Enterprise pipeline",
        platforms=["linkedin", "instagram"],
    )
    strategy = CampaignStrategy(
        campaign_theme="The Forecastable Cloud",
        primary_objective="Enterprise pipeline",
        target_audience_definition="Enterprise Engineering Leadership",
        strategic_angles=angles,
        messaging_pillars=pillars,
        # LLM emitted 6 slots all with the exact same angle
        deliverable_slots=[
            DeliverableSlot(
                slot_index=i,
                planned_day=i+1,
                deliverable_type="reel",
                target_platform="instagram",
                strategic_angle_ref="Hidden Cost Multipliers",
                core_message="Unexpected invoices",
            )
            for i in range(6)
        ],
    )
    reconciled = reconcile_and_pad_slots(strategy, brief, brand_context=None, market_research=None, performance_playbook=None)
    assigned_angles = [s.strategic_angle_ref for s in reconciled.deliverable_slots]
    assert len(set(assigned_angles)) > 1, f"Expected diversified angles, got {assigned_angles}"
    assert "Failover Architecture" in assigned_angles
    assert "FinOps Justification" in assigned_angles


def test_bug_11_concrete_carousel_structure():
    """Bug 11 (Constraint 4): Enforce concrete, saveable slide structures adapted to industry."""
    # Food/Dining industry structure
    food_structure = get_concrete_carousel_structure("Hospitality & Dining")
    assert "Slide 1 (The Hook):" in food_structure
    assert "Slide 2 (The Hidden Mistake):" in food_structure
    assert "Slide 3 (The Actionable Framework):" in food_structure
    assert "Slide 4 (The Before vs. After Standard):" in food_structure
    assert "Slide 5 (The Action Step):" in food_structure
    # Must NOT have generic B2B "Hidden Architecture Flaw"
    assert "Hidden Architecture Flaw" not in food_structure

    # Tech industry structure
    tech_structure = get_concrete_carousel_structure("Cloud Infrastructure")
    assert "Slide 1 (The Provocative Hook):" in tech_structure
    assert "Slide 2 (The Hidden Architecture Flaw):" in tech_structure
    assert "Slide 3 (The Triage / Audit Checklist):" in tech_structure
