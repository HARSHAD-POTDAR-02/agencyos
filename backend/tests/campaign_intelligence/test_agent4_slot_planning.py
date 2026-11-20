from __future__ import annotations

import uuid
import pytest

from app.campaign_intelligence.agents.campaign_strategist import (
    ALL_HOOK_CATEGORIES,
    HOOK_CATEGORIES_BY_STAGE,
    CampaignStrategistAgent,
    derive_slot_allocation_targets,
    enforce_consecutive_hook_diversity,
    get_industry_funnel_guidance,
    ground_slot_proof_points,
    inject_negative_boundary_constraints,
    reconcile_and_pad_slots,
)
from app.campaign_intelligence.schemas.brand import (
    BrandContext,
    ContractQuota,
    ProhibitedClaim,
    ProhibitedTerm,
    VerifiedOffer,
)
from app.campaign_intelligence.schemas.campaign import CampaignBrief
from app.campaign_intelligence.schemas.performance import PerformancePlaybook
from app.campaign_intelligence.schemas.research import MarketResearchReport
from app.campaign_intelligence.schemas.strategy import (
    CampaignStrategy,
    DeliverableSlot,
    MessagingPillar,
    StrategicAngle,
)


def _build_test_brand_context() -> BrandContext:
    client_id = uuid.uuid4()
    agency_id = uuid.uuid4()
    return BrandContext(
        client_id=client_id,
        agency_id=agency_id,
        business_name="DermaGlow Aesthetics Clinic",
        industry="Dermatology, Medspa & Clinical Skincare",
        confirmed_facts=[
            "Board-certified medical dermatologists with 15+ years experience",
            "FDA-cleared laser resurfacing equipment with zero thermal downtime",
        ],
        verified_offers=[
            VerifiedOffer(
                name="ClearTone Laser Consultation",
                description="30-minute diagnostic dermal scan and treatment plan",
                source="confirmed_brand_profile",
                is_verified=True,
            )
        ],
        prohibited_terms=[
            ProhibitedTerm(term="miracle cure", is_exact_match=True),
            ProhibitedTerm(term="overnight eraser", is_exact_match=True),
        ],
        prohibited_claims=[
            ProhibitedClaim(claim="guarantees 100% acne removal in one session"),
        ],
        prohibited_concepts=[
            "comparing cosmetic results to surgical facelifts",
        ],
        contract_quotas=[
            ContractQuota(deliverable_type="reel", platform="instagram", monthly_quantity=3, contracted=3),
            ContractQuota(deliverable_type="carousel", platform="instagram", monthly_quantity=2, contracted=2),
        ],
    )


def test_deliverable_slot_schema_and_normalization():
    """Validates DeliverableSlot schema normalizers for types, platforms, and stages."""
    slot = DeliverableSlot(
        slot_index=0,
        planned_day=1,
        deliverable_type="video short",
        target_platform="insta",
        funnel_stage="top of funnel",
        target_persona="Adults with persistent hyperpigmentation",
        hook_category="social-proof",
        strategic_angle_ref="Clinical Precision Over Filter Hype",
        core_message="Board-certified diagnostics reveal the root cause.",
    )
    assert slot.deliverable_type == "reel"
    assert slot.target_platform == "instagram"
    assert slot.funnel_stage == "top_of_funnel_awareness"
    assert slot.hook_category == "social_proof"


def test_consecutive_hook_diversity_rotation():
    """Guarantees that consecutive identical hook categories are rotated deterministically."""
    slots = [
        DeliverableSlot(
            slot_index=0,
            planned_day=1,
            deliverable_type="reel",
            target_platform="instagram",
            funnel_stage="top_of_funnel_awareness",
            hook_category="pain_mirror",
        ),
        DeliverableSlot(
            slot_index=1,
            planned_day=3,
            deliverable_type="reel",
            target_platform="instagram",
            funnel_stage="top_of_funnel_awareness",
            hook_category="pain_mirror",  # Duplicate consecutive hook!
        ),
        DeliverableSlot(
            slot_index=2,
            planned_day=5,
            deliverable_type="carousel",
            target_platform="instagram",
            funnel_stage="middle_of_funnel_consideration",
            hook_category="live_proof_demo",
        ),
        DeliverableSlot(
            slot_index=3,
            planned_day=7,
            deliverable_type="carousel",
            target_platform="instagram",
            funnel_stage="middle_of_funnel_consideration",
            hook_category="live_proof_demo",  # Duplicate consecutive hook!
        ),
    ]

    rotated = enforce_consecutive_hook_diversity(slots)

    for i in range(1, len(rotated)):
        assert rotated[i].hook_category != rotated[i - 1].hook_category, (
            f"Consecutive duplicate hook at index {i}: {rotated[i].hook_category} == {rotated[i-1].hook_category}"
        )


def test_positive_proof_grounding_with_verified_facts():
    """Tests that proof points are grounded in confirmed facts or forced to NONE_USE_PLACEHOLDER."""
    bc = _build_test_brand_context()

    slots = [
        DeliverableSlot(
            slot_index=0,
            planned_day=1,
            deliverable_type="reel",
            target_platform="instagram",
            funnel_stage="top_of_funnel_awareness",
            hook_category="pain_mirror",
            core_message="Treatment powered by FDA-cleared laser resurfacing equipment with zero thermal downtime",
            allowed_proof_points=["FDA-cleared laser resurfacing equipment with zero thermal downtime"],
        ),
        DeliverableSlot(
            slot_index=1,
            planned_day=3,
            deliverable_type="reel",
            target_platform="instagram",
            funnel_stage="middle_of_funnel_consideration",
            hook_category="social_proof",  # No testimonials exist in confirmed facts
            core_message="10,000 happy patients love our results",
            allowed_proof_points=["10,000 happy patients love our results"],
        ),
        DeliverableSlot(
            slot_index=2,
            planned_day=5,
            deliverable_type="carousel",
            target_platform="instagram",
            funnel_stage="bottom_of_funnel_conversion",
            hook_category="direct_offer",
            core_message="Unsubstantiated discount of 80% off",
            allowed_proof_points=["80% off everything today only"],
        ),
    ]

    grounded = ground_slot_proof_points(slots, bc)

    # Slot 0 has verified fact
    assert "FDA-cleared laser resurfacing" in grounded[0].allowed_proof_points[0]

    # Slot 1 is social_proof with no testimonials in confirmed_facts -> must be placeholder
    assert grounded[1].allowed_proof_points == ["NONE_USE_PLACEHOLDER"]

    # Slot 2 had fabricated discount not in verified offers -> must be placeholder
    assert grounded[2].allowed_proof_points == ["NONE_USE_PLACEHOLDER"]


def test_negative_boundary_inheritance():
    """Tests that prohibited terms, claims, and concepts are injected into all deliverable slots."""
    bc = _build_test_brand_context()

    slots = [
        DeliverableSlot(
            slot_index=0,
            planned_day=1,
            deliverable_type="reel",
            target_platform="instagram",
            funnel_stage="top_of_funnel_awareness",
        ),
        DeliverableSlot(
            slot_index=1,
            planned_day=3,
            deliverable_type="carousel",
            target_platform="instagram",
            funnel_stage="middle_of_funnel_consideration",
        ),
    ]

    injected = inject_negative_boundary_constraints(slots, bc)

    for s in injected:
        constraints_str = " ".join(s.factual_boundary_constraints).lower()
        assert "miracle cure" in constraints_str
        assert "overnight eraser" in constraints_str
        assert "guarantees 100% acne removal" in constraints_str
        assert "surgical facelifts" in constraints_str


def test_quota_and_performance_slot_derivation():
    """Tests slot allocation derivation honoring contract quotas and sprint durations."""
    bc = _build_test_brand_context()
    brief = CampaignBrief(
        client_id=bc.client_id,
        agency_id=bc.agency_id,
        period_month=11,
        period_year=2026,
        duration_days=14,
        objective="Drive 20 laser consultations",
        platforms=["instagram"],
    )

    targets = derive_slot_allocation_targets(brief, bc)

    # bc has 3 reels and 2 carousels = 5 total
    assert len(targets) == 5
    reel_count = sum(1 for t in targets if t["deliverable_type"] == "reel")
    carousel_count = sum(1 for t in targets if t["deliverable_type"] == "carousel")
    assert reel_count == 3
    assert carousel_count == 2

    # Verify sequential days within duration_days (14 days)
    for idx, t in enumerate(targets):
        assert t["slot_index"] == idx
        assert 1 <= t["planned_day"] <= 14


def test_dynamic_industry_funnel_guidance_non_b2b_vs_b2b():
    """Verifies that non-B2B industries receive consumer/clinic guidance with B2B prohibition."""
    clinic_bc = _build_test_brand_context()
    clinic_guidance = get_industry_funnel_guidance(clinic_bc)
    assert "NON-B2B" in clinic_guidance
    assert "architecture teardown" in clinic_guidance.lower()
    assert "STRICT PROHIBITION" in clinic_guidance

    b2b_bc = BrandContext(
        client_id=uuid.uuid4(),
        agency_id=uuid.uuid4(),
        business_name="CloudMesh Kubernetes Observability",
        industry="Enterprise Cloud Infrastructure & DevOps Software",
    )
    b2b_guidance = get_industry_funnel_guidance(b2b_bc)
    assert "B2B / Technical" in b2b_guidance
    assert "Mechanism/architecture breakdown" in b2b_guidance


def test_buyer_language_snippets_grounding():
    """Verifies that Market Research buyer language snippets ground deliverable slots."""
    bc = _build_test_brand_context()
    brief = CampaignBrief(
        client_id=bc.client_id,
        agency_id=bc.agency_id,
        period_month=11,
        period_year=2026,
        objective="Drive 20 consultations",
    )
    mr = MarketResearchReport(
        industry="Dermatology & Skincare",
        confidence_score=0.9,
        buyer_language_snippets=[
            "I'm terrified of chemical peels burning my sensitive skin",
            "Every serum claims to fix redness but none of them actually do anything",
        ],
    )

    strategy = CampaignStrategy(
        campaign_theme="Clinical Redness Solutions",
        primary_objective="Drive 20 consultations",
        target_audience_definition="Adults with sensitive skin redness",
        strategic_angles=[
            StrategicAngle(
                angle_name="Dermal Barrier Science",
                rationale="Education on skin barrier",
                target_audience_segment="Redness sufferers",
                aligned_content_pillar="Clinical Proof",
            )
        ],
        messaging_pillars=[
            MessagingPillar(
                pillar_name="Diagnostic Precision",
                core_message="Scan before you treat",
                primary_call_to_action="Book Scan",
            )
        ],
        deliverable_slots=[],  # Empty initial slots to test reconciliation
    )

    reconciled = reconcile_and_pad_slots(
        strategy=strategy,
        brief=brief,
        brand_context=bc,
        market_research=mr,
        performance_playbook=None,
    )

    assert len(reconciled.deliverable_slots) == 5
    for slot in reconciled.deliverable_slots:
        assert len(slot.buyer_language_refs) > 0
        assert any(
            s in slot.buyer_language_refs[0]
            for s in mr.buyer_language_snippets
        )
