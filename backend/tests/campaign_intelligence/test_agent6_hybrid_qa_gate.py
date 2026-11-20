import uuid
import pytest

from app.campaign_intelligence.agents.quality_evaluator import (
    QualityEvaluatorAgent,
    calculate_jaccard_similarity,
    parse_scene_range,
    parse_timestamp_seconds,
)
from app.campaign_intelligence.schemas.brand import (
    BrandContext,
    ProhibitedClaim,
    ProhibitedTerm,
    VerifiedOffer,
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
from app.campaign_intelligence.schemas.strategy import CampaignStrategy, StrategicAngle


@pytest.fixture
def base_brand_context():
    return BrandContext(
        client_id=uuid.uuid4(),
        agency_id=uuid.uuid4(),
        business_name="Acrobatics AI",
        website="https://acrobatics.ai",
        brand_positioning="Autonomous motion intelligence for aerial robotics",
        brand_voice=["Technical", "Direct"],
        confirmed_facts=[
            "Processes flight telemetry in 5 milliseconds",
            "Deployed across 500 enterprise inspection drones",
        ],
        verified_offers=[
            VerifiedOffer(
                name="Enterprise Telemetry Pilot",
                description="30-day proof of concept deployment with dedicated engineer",
                source="confirmed_brand_profile",
            )
        ],
        prohibited_terms=[
            ProhibitedTerm(term="bulletproof", reason="Misleading safety claim"),
        ],
        prohibited_claims=[
            ProhibitedClaim(claim="100% crash-free guarantee", reason="Physically unverifiable"),
        ],
    )


@pytest.fixture
def base_brief():
    return CampaignBrief(
        client_id=uuid.uuid4(),
        agency_id=uuid.uuid4(),
        period_month=3,
        period_year=2026,
        objective="Drive enterprise pilot signups for autonomous drone software",
        custom_brief="Targeting heads of inspection at energy utility companies via acrobatics.ai/demo",
        target_audience=["Drone fleet managers at utility companies"],
        platforms=["linkedin", "instagram"],
        deliverable_preferences=["carousel", "reel"],
    )


@pytest.fixture
def base_strategy():
    return CampaignStrategy(
        campaign_theme="Autonomous Aerial Precision",
        primary_objective="Enterprise Pilot Inquiries",
        target_audience_definition="Utility Drone Fleet Managers",
        strategic_angles=[
            StrategicAngle(
                angle_name="Sub-Second Collision Avoidance",
                rationale="Highlight 5ms telemetry processing vs cloud latency.",
                target_audience_segment="Utility inspection engineers",
                aligned_content_pillar="Speed",
                supporting_evidence=["5 millisecond onboard compute response"],
            )
        ],
    )


def make_clean_reel(slot_index: int = 0) -> DeliverablePlan:
    return DeliverablePlan(
        slot_index=slot_index,
        title=f"Telemetry Speed Test #{slot_index}",
        deliverable_type="reel",
        platform="instagram",
        planned_week=1,
        planned_day=1,
        primary_hook="How utility drones process telemetry in 5 milliseconds.",
        caption="When inspecting high-voltage power lines, sub-second latency is critical. Discover onboard edge intelligence.",
        call_to_action="Visit the link in our bio for full benchmark whitepapers.",
        reel_scenes=[
            ReelScene(
                scene_number=1,
                timestamp_range="0:00 - 0:04",
                visual_action="Drone maneuvers rapidly around power pylon obstacle",
                on_screen_text="5ms edge latency",
                spoken_audio_or_voiceover="Autonomous flight requires instantaneous edge compute decisions.",  # 7 words in 4s = 1.75 wps
            ),
            ReelScene(
                scene_number=2,
                timestamp_range="0:04 - 0:18",
                visual_action="Cockpit HUD telemetry logs millisecond obstacle distance updates",
                on_screen_text="Zero cloud roundtrips",
                spoken_audio_or_voiceover="Our onboard model calculates trajectories with zero reliance on cloud latency.",  # 11 words in 14s = 0.78 wps
            ),
        ],
    )


def make_clean_carousel(slot_index: int = 1) -> DeliverablePlan:
    return DeliverablePlan(
        slot_index=slot_index,
        title=f"Autonomous Inspection Architecture #{slot_index}",
        deliverable_type="carousel",
        platform="linkedin",
        planned_week=1,
        planned_day=2,
        primary_hook="Three hardware bottlenecks holding back industrial utility inspections.",
        caption="Utility inspection flights fail when edge processing cannot keep up. Read the technical breakdown.",
        call_to_action="Apply for our 30-day proof of concept deployment at acrobatics.ai/demo.",
        carousel_slides=[
            CarouselSlide(
                slide_number=1,
                slide_type="cover",
                headline="The Latency Barrier in Aerial Inspection",
                body_copy="Why cloud-connected drones struggle in remote grid sectors.",
                visual_layout="Dark technical schematic of drone communication link",
            ),
            CarouselSlide(
                slide_number=2,
                slide_type="content",
                headline="Millisecond Edge Decisions",
                body_copy="5 millisecond response times keep inspection drones centered in gusty winds.",
                visual_layout="Onboard telemetry timeline chart",
            ),
            CarouselSlide(
                slide_number=3,
                slide_type="cta",
                headline="Pilot Deployment",
                body_copy="Book an engineering consultation at acrobatics.ai/demo.",
                visual_layout="Minimal CTA slide with verified client domain",
            ),
        ],
    )


# ---------------------------------------------------------------------------
# Test Helpers
# ---------------------------------------------------------------------------

def test_timing_helpers():
    assert parse_timestamp_seconds("0:03") == 3.0
    assert parse_timestamp_seconds("01:15") == 75.0
    assert parse_scene_range("0:00 - 0:04") == (0.0, 4.0)
    assert parse_scene_range("0:04-0:18") == (4.0, 18.0)
    assert parse_scene_range("0:18 to 0:30") == (18.0, 30.0)

    sim = calculate_jaccard_similarity(
        "How utility drones process telemetry in 5 milliseconds",
        "How utility drones process telemetry in 5 milliseconds",
    )
    assert sim == 1.0


# ---------------------------------------------------------------------------
# Check 1: Marketing Cliché & AI Slop Scanner
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_check1_marketing_cliche_detection(base_brand_context, base_brief):
    evaluator = QualityEvaluatorAgent()
    reel = make_clean_reel(0)
    reel.caption = "In today's fast-paced world, this AI tool is a total game changer to revolutionize your pipeline."

    eval = await evaluator.evaluate(
        deliverables=[reel],
        brand_context=base_brand_context,
        brief=base_brief,
    )

    assert eval.is_approved_for_human_review is False
    assert eval.revision_required is True
    cliche_findings = [f for f in eval.findings if f.category == FindingCategory.cliche_slop]
    assert len(cliche_findings) >= 1
    assert cliche_findings[0].severity in (FindingSeverity.critical, FindingSeverity.blocking, "blocking")
    assert 0 in eval.failing_deliverable_indices


# ---------------------------------------------------------------------------
# Check 2: Brand Boundary & Prohibited Terms
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_check2_prohibited_terms_and_boundaries(base_brand_context, base_brief):
    evaluator = QualityEvaluatorAgent()
    carousel = make_clean_carousel(0)
    carousel.carousel_slides[0].headline = "A Bulletproof Inspection Platform"

    eval = await evaluator.evaluate(
        deliverables=[carousel],
        brand_context=base_brand_context,
        brief=base_brief,
    )

    assert eval.is_approved_for_human_review is False
    term_findings = [f for f in eval.findings if f.category == FindingCategory.prohibited_term]
    assert len(term_findings) >= 1
    assert "bulletproof" in term_findings[0].issue_description.lower()
    assert 0 in eval.failing_deliverable_indices


# ---------------------------------------------------------------------------
# Check 3: Commercial & Unverified Claim Audit (User Adjustment 2)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_check3_unverified_claims_and_client_input_placeholder(base_brand_context, base_brief, base_strategy):
    evaluator = QualityEvaluatorAgent()

    # Case A: Unverified currency/discount invented by model ($499, 50% off)
    failing_deliv = make_clean_carousel(0)
    failing_deliv.caption = "Get our enterprise tier for only $499 with a flat 50% off discount code today!"

    eval_fail = await evaluator.evaluate(
        deliverables=[failing_deliv],
        brand_context=base_brand_context,
        brief=base_brief,
        strategy=base_strategy,
    )

    assert eval_fail.is_approved_for_human_review is False
    unverified = [f for f in eval_fail.findings if f.category == FindingCategory.commercial_unverified_claim]
    assert len(unverified) >= 1
    assert 0 in eval_fail.failing_deliverable_indices

    # Case B: Compliant use of [CLIENT_INPUT_NEEDED: ...] placeholder is NOT penalized
    placeholder_deliv = make_clean_carousel(0)
    placeholder_deliv.caption = "Pricing starts at [CLIENT_INPUT_NEEDED: monthly enterprise pilot license fee]."

    eval_pass = await evaluator.evaluate(
        deliverables=[placeholder_deliv],
        brand_context=base_brand_context,
        brief=base_brief,
        strategy=base_strategy,
    )

    unverified_pass = [f for f in eval_pass.findings if f.category == FindingCategory.commercial_unverified_claim]
    assert len(unverified_pass) == 0


# ---------------------------------------------------------------------------
# Check 4: Technical Compliance & Pacing Continuity (User Adjustment 1)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_check4_spoken_pacing_warning_vs_blocking(base_brand_context, base_brief):
    evaluator = QualityEvaluatorAgent()

    # Case A: High WPS > 3.8 words/second -> BLOCKING
    reel_rapid = make_clean_reel(0)
    # 20 words in a 4-second scene = 5.0 wps (> 3.8 wps ceiling)
    reel_rapid.reel_scenes[0].spoken_audio_or_voiceover = (
        "We are accelerating through high voltage lines with instantaneous telemetry processing and deep autonomous robotics vision intelligence right now."
    )

    eval_rapid = await evaluator.evaluate(
        deliverables=[reel_rapid],
        brand_context=base_brand_context,
        brief=base_brief,
    )

    pacing_blocking = [
        f for f in eval_rapid.findings
        if f.category == FindingCategory.technical_compliance and f.severity in (FindingSeverity.critical, FindingSeverity.blocking, "blocking") and "pacing" in f.issue_description.lower()
    ]
    assert len(pacing_blocking) >= 1
    assert 0 in eval_rapid.failing_deliverable_indices

    # Case B: Conversational WPS (3.3 - 3.7 wps) -> WARNING only (not blocking)
    reel_warn = make_clean_reel(0)
    # 14 words in 4 seconds = 3.5 wps (warn > 3.2 wps, but < 3.8 wps)
    reel_warn.reel_scenes[0].spoken_audio_or_voiceover = (
        "Utility drones navigate high voltage electrical power lines using onboard autonomous edge computing models."
    )

    eval_warn = await evaluator.evaluate(
        deliverables=[reel_warn],
        brand_context=base_brand_context,
        brief=base_brief,
    )

    pacing_warnings = [
        f for f in eval_warn.findings
        if f.category == FindingCategory.technical_compliance and f.severity == FindingSeverity.warning and "pacing" in f.issue_description.lower()
    ]
    assert len(pacing_warnings) >= 1

    # Case C: Slow scene < 2.2 wps is NEVER penalized (pauses are permitted)
    reel_slow = make_clean_reel(0)
    reel_slow.reel_scenes[0].spoken_audio_or_voiceover = "Look closely."  # 2 words in 4s = 0.5 wps
    eval_slow = await evaluator.evaluate(
        deliverables=[reel_slow],
        brand_context=base_brand_context,
        brief=base_brief,
    )
    pacing_findings = [f for f in eval_slow.findings if "pacing" in f.issue_description.lower()]
    assert len(pacing_findings) == 0


@pytest.mark.asyncio
async def test_check4_reel_duration_and_scene_continuity(base_brand_context, base_brief):
    evaluator = QualityEvaluatorAgent()

    # Case A: Total duration under 15 seconds -> BLOCKING
    short_reel = make_clean_reel(0)
    short_reel.reel_scenes = [
        ReelScene(scene_number=1, timestamp_range="0:00 - 0:08", visual_action="Drone hovers", spoken_audio_or_voiceover="Autonomous telemetry.")
    ]
    eval_short = await evaluator.evaluate(deliverables=[short_reel], brand_context=base_brand_context, brief=base_brief)
    dur_findings = [f for f in eval_short.findings if "below minimum duration" in f.issue_description.lower()]
    assert len(dur_findings) >= 1
    assert dur_findings[0].severity in (FindingSeverity.critical, FindingSeverity.blocking, "blocking")

    # Case B: Overlapping scene timestamps -> BLOCKING
    overlap_reel = make_clean_reel(0)
    overlap_reel.reel_scenes = [
        ReelScene(scene_number=1, timestamp_range="0:00 - 0:08", visual_action="Scene 1", spoken_audio_or_voiceover="First scene."),
        ReelScene(scene_number=2, timestamp_range="0:06 - 0:18", visual_action="Scene 2", spoken_audio_or_voiceover="Overlapping second scene."),
    ]
    eval_overlap = await evaluator.evaluate(deliverables=[overlap_reel], brand_context=base_brand_context, brief=base_brief)
    overlap_findings = [f for f in eval_overlap.findings if "overlaps" in f.issue_description.lower()]
    assert len(overlap_findings) >= 1


@pytest.mark.asyncio
async def test_check4_carousel_slide_bounds(base_brand_context, base_brief):
    evaluator = QualityEvaluatorAgent()

    # < 3 slides -> BLOCKING
    small_carousel = make_clean_carousel(0)
    small_carousel.carousel_slides = small_carousel.carousel_slides[:2]
    eval_small = await evaluator.evaluate(deliverables=[small_carousel], brand_context=base_brand_context, brief=base_brief)
    small_findings = [f for f in eval_small.findings if "minimum 3 required" in f.issue_description.lower()]
    assert len(small_findings) >= 1

    # > 10 slides -> BLOCKING
    large_carousel = make_clean_carousel(0)
    large_carousel.carousel_slides = [
        CarouselSlide(slide_number=i, headline=f"Slide {i}", body_copy="Body")
        for i in range(1, 13)
    ]
    eval_large = await evaluator.evaluate(deliverables=[large_carousel], brand_context=base_brand_context, brief=base_brief)
    large_findings = [f for f in eval_large.findings if "hard ceiling is 10 slides" in f.issue_description.lower()]
    assert len(large_findings) >= 1


@pytest.mark.asyncio
async def test_check4_hook_jaccard_similarity(base_brand_context, base_brief):
    evaluator = QualityEvaluatorAgent()

    # Two deliverables with nearly identical hooks
    deliv1 = make_clean_reel(0)
    deliv1.primary_hook = "How utility drones process telemetry in 5 milliseconds for power lines"

    deliv2 = make_clean_carousel(1)
    deliv2.primary_hook = "How utility drones process telemetry in 5 milliseconds for power inspection"

    eval = await evaluator.evaluate(
        deliverables=[deliv1, deliv2],
        brand_context=base_brand_context,
        brief=base_brief,
    )

    similarity_findings = [f for f in eval.findings if "jaccard token similarity" in f.issue_description.lower()]
    assert len(similarity_findings) >= 1
    assert 1 in eval.failing_deliverable_indices


# ---------------------------------------------------------------------------
# Check 6: Hook Length & CTA Structural Hygiene (User Adjustment 2)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_check6_hook_length_bounds(base_brand_context, base_brief):
    evaluator = QualityEvaluatorAgent()

    # > 18 words -> BLOCKING
    long_hook_deliv = make_clean_reel(0)
    long_hook_deliv.primary_hook = (
        "This is an extraordinarily long and verbose opening hook that stretches across way too many words and will definitely get cut off by the feed algorithm."
    )  # 24 words
    eval_long = await evaluator.evaluate(deliverables=[long_hook_deliv], brand_context=base_brand_context, brief=base_brief)
    hook_blocking = [f for f in eval_long.findings if f.category == FindingCategory.hook_length_cta and "exceeds hard limit" in f.issue_description.lower()]
    assert len(hook_blocking) >= 1
    assert 0 in eval_long.failing_deliverable_indices

    # 13-18 words -> WARNING
    med_hook_deliv = make_clean_reel(0)
    med_hook_deliv.primary_hook = "Discover why industrial utility inspection teams are rapidly transitioning to onboard edge processing architectures."  # 14 words
    eval_med = await evaluator.evaluate(deliverables=[med_hook_deliv], brand_context=base_brand_context, brief=base_brief)
    hook_warnings = [f for f in eval_med.findings if f.category == FindingCategory.hook_length_cta and f.severity == FindingSeverity.warning]
    assert len(hook_warnings) >= 1


@pytest.mark.asyncio
async def test_check6_url_hygiene(base_brand_context, base_brief):
    evaluator = QualityEvaluatorAgent()

    # Case A: LinkedIn post with VERIFIED client domain (acrobatics.ai/demo) -> ALLOWED
    linkedin_verified = make_clean_carousel(0)
    linkedin_verified.caption = "Apply for proof of concept at acrobatics.ai/demo."
    eval_ok = await evaluator.evaluate(deliverables=[linkedin_verified], brand_context=base_brand_context, brief=base_brief)
    li_findings_ok = [f for f in eval_ok.findings if "unverified or fabricated url" in f.issue_description.lower()]
    assert len(li_findings_ok) == 0

    # Case B: LinkedIn post with FABRICATED URL (e.g. sketchy-ai-tools.com) -> BLOCKING
    linkedin_fake = make_clean_carousel(0)
    linkedin_fake.caption = "Download our free guide at https://sketchy-ai-tools.com/free-drone-cheatsheet."
    eval_fake = await evaluator.evaluate(deliverables=[linkedin_fake], brand_context=base_brand_context, brief=base_brief)
    fake_findings = [f for f in eval_fake.findings if "unverified or fabricated url" in f.issue_description.lower()]
    assert len(fake_findings) >= 1
    assert 0 in eval_fake.failing_deliverable_indices

    # Case C: Instagram post with raw URL -> WARNING ("use link in bio")
    ig_raw = make_clean_reel(0)
    ig_raw.caption = "Check out acrobatics.ai/demo for details."
    eval_ig = await evaluator.evaluate(deliverables=[ig_raw], brand_context=base_brand_context, brief=base_brief)
    ig_warnings = [f for f in eval_ig.findings if "not clickable" in f.issue_description.lower()]
    assert len(ig_warnings) >= 1
