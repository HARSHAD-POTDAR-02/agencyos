from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, patch
import pytest

from app.campaign_intelligence.agents.content_architect import (
    ContentArchitectAgent,
    MicroBatchOutput,
)
from app.campaign_intelligence.schemas.brand import (
    BrandContext,
    ContractQuota,
    ProhibitedTerm,
    VerifiedOffer,
)
from app.campaign_intelligence.schemas.campaign import CampaignBrief
from app.campaign_intelligence.schemas.deliverables import (
    CarouselSlide,
    DeliverablePlan,
    ReelScene,
)
from app.campaign_intelligence.schemas.strategy import (
    CampaignStrategy,
    DeliverableSlot,
    MessagingPillar,
    StrategicAngle,
)


def _build_test_harness():
    client_id = uuid.uuid4()
    agency_id = uuid.uuid4()

    brief = CampaignBrief(
        client_id=client_id,
        agency_id=agency_id,
        period_month=11,
        period_year=2026,
        duration_days=14,
        objective="Drive 30 enterprise cloud migrations",
        platforms=["linkedin", "instagram"],
    )

    brand_context = BrandContext(
        client_id=client_id,
        agency_id=agency_id,
        business_name="Vertex Cloud Technologies",
        industry="Enterprise Cloud Infrastructure",
        confirmed_facts=["99.999% SLA verified uptime over 3 years"],
        verified_offers=[
            VerifiedOffer(
                name="Cloud Migration Assessment",
                description="Zero-downtime architecture migration plan",
                source="confirmed_brand_profile",
                is_verified=True,
            )
        ],
        prohibited_terms=[ProhibitedTerm(term="cheapest cloud", is_exact_match=True)],
        contract_quotas=[
            ContractQuota(deliverable_type="reel", platform="instagram", monthly_quantity=2, contracted=2),
            ContractQuota(deliverable_type="carousel", platform="linkedin", monthly_quantity=3, contracted=3),
        ],
    )

    slots = [
        DeliverableSlot(
            slot_index=0,
            planned_day=1,
            deliverable_type="reel",
            target_platform="instagram",
            funnel_stage="top_of_funnel_awareness",
            hook_category="pain_mirror",
            strategic_angle_ref="Latency Bottleneck",
            core_message="Microsecond latency spikes cost millions in lost transactions.",
            allowed_proof_points=["99.999% SLA verified uptime over 3 years"],
        ),
        DeliverableSlot(
            slot_index=1,
            planned_day=3,
            deliverable_type="carousel",
            target_platform="linkedin",
            funnel_stage="middle_of_funnel_consideration",
            hook_category="live_proof_demo",
            strategic_angle_ref="Distributed Failover",
            core_message="Multi-region zero-downtime failover step-by-step.",
            allowed_proof_points=["NONE_USE_PLACEHOLDER"],  # Missing case study proof
        ),
        DeliverableSlot(
            slot_index=2,
            planned_day=6,
            deliverable_type="reel",
            target_platform="instagram",
            funnel_stage="middle_of_funnel_consideration",
            hook_category="behind_the_scenes",
            strategic_angle_ref="Kernel Bypass Networking",
            core_message="Inside our kernel-bypass routing engine.",
            allowed_proof_points=["99.999% SLA verified uptime over 3 years"],
        ),
        DeliverableSlot(
            slot_index=3,
            planned_day=9,
            deliverable_type="carousel",
            target_platform="linkedin",
            funnel_stage="bottom_of_funnel_conversion",
            hook_category="social_proof",
            strategic_angle_ref="Benchmark Outperformance",
            core_message="How leading fintechs migrated with zero downtime.",
            allowed_proof_points=["NONE_USE_PLACEHOLDER"],
        ),
        DeliverableSlot(
            slot_index=4,
            planned_day=12,
            deliverable_type="carousel",
            target_platform="linkedin",
            funnel_stage="bottom_of_funnel_conversion",
            hook_category="direct_offer",
            strategic_angle_ref="Migration Assessment",
            core_message="Book your custom cloud migration assessment.",
            allowed_proof_points=["Cloud Migration Assessment: Zero-downtime architecture migration plan"],
        ),
    ]

    strategy = CampaignStrategy(
        campaign_theme="The Architecture of Certainty",
        primary_objective="Drive 30 enterprise cloud migrations",
        target_audience_definition="Enterprise CTOs and VP Infrastructure",
        strategic_angles=[
            StrategicAngle(
                angle_name="Latency Bottleneck",
                rationale="Enterprise latency anxiety",
                target_audience_segment="CTOs",
                aligned_content_pillar="Performance",
            )
        ],
        messaging_pillars=[
            MessagingPillar(
                pillar_name="Uptime Architecture",
                core_message="99.999% reliability engineered into the kernel",
                primary_call_to_action="Schedule assessment",
            )
        ],
        deliverable_slots=slots,
    )

    return brief, brand_context, strategy, slots


@pytest.mark.asyncio
async def test_micro_batch_execution_chunks_slots_by_two():
    """Validates that 5 slots are chunked into batches of at most 2 (2 + 2 + 1)."""
    brief, brand_context, strategy, slots = _build_test_harness()
    agent = ContentArchitectAgent()

    call_count = 0
    batch_sizes = []

    async def mock_generate_micro_batch(batch_slots, **kwargs):
        nonlocal call_count, batch_sizes
        call_count += 1
        batch_sizes.append(len(batch_slots))
        # Return mock deliverables matching batch_slots
        delivs = []
        for s in batch_slots:
            delivs.append(
                DeliverablePlan(
                    slot_index=s.slot_index,
                    planned_day=s.planned_day,
                    deliverable_type=s.deliverable_type,
                    platform=s.target_platform,
                    title=f"Deliverable for Slot {s.slot_index}",
                    primary_hook=f"Hook for {s.hook_category}",
                    caption="Caption copy",
                    call_to_action="Book assessment",
                )
            )
        return delivs

    with patch.object(agent, "_generate_micro_batch", side_effect=mock_generate_micro_batch):
        plans = await agent.run(strategy=strategy, brief=brief, brand_context=brand_context)

    # 5 slots chunked by 2 = 3 batches: [2, 2, 1]
    assert call_count == 3
    assert batch_sizes == [2, 2, 1]
    assert len(plans) == 5
    for idx, p in enumerate(plans):
        assert p.slot_index == idx


@pytest.mark.asyncio
async def test_cross_batch_memory_recording():
    """Verifies that previously_generated_summary accumulates across micro-batches."""
    brief, brand_context, strategy, slots = _build_test_harness()
    agent = ContentArchitectAgent()

    captured_memories = []

    async def mock_generate_micro_batch(batch_slots, previously_generated_summary, **kwargs):
        captured_memories.append(list(previously_generated_summary))
        delivs = []
        for s in batch_slots:
            delivs.append(
                DeliverablePlan(
                    slot_index=s.slot_index,
                    planned_day=s.planned_day,
                    deliverable_type=s.deliverable_type,
                    platform=s.target_platform,
                    title=f"Deliverable {s.slot_index}",
                    primary_hook=f"Hook #{s.slot_index}",
                    caption="Caption",
                    call_to_action="CTA",
                )
            )
        return delivs

    with patch.object(agent, "_generate_micro_batch", side_effect=mock_generate_micro_batch):
        await agent.run(strategy=strategy, brief=brief, brand_context=brand_context)

    # Batch 1 should have empty memory (0 items)
    assert len(captured_memories[0]) == 0
    # Batch 2 should see 2 items from Batch 1
    assert len(captured_memories[1]) == 2
    assert captured_memories[1][0]["slot_index"] == 0
    assert captured_memories[1][1]["slot_index"] == 1
    # Batch 3 should see 4 items from Batches 1 and 2
    assert len(captured_memories[2]) == 4


@pytest.mark.asyncio
async def test_targeted_repair_deliverables_merges_by_slot_index():
    """
    Tests repair_deliverables: regenerates only failing indices and merges
    back into the original list by slot_index without touching passing items.
    """
    brief, brand_context, strategy, slots = _build_test_harness()
    agent = ContentArchitectAgent()

    # Original list of 5 deliverables
    original_deliverables = [
        DeliverablePlan(
            slot_index=i,
            planned_day=i * 2 + 1,
            deliverable_type="reel" if i % 2 == 0 else "carousel",
            platform="instagram" if i % 2 == 0 else "linkedin",
            title=f"Original Title {i}",
            primary_hook=f"Original Hook {i}",
            caption=f"Original Caption {i}",
            call_to_action="Original CTA",
        )
        for i in range(5)
    ]

    failing_indices = [1, 3]
    findings = [
        type("QualityFinding", (), {"deliverable_index": 1, "description": "Cliché detected: 'game-changer'"})(),
        type("QualityFinding", (), {"deliverable_index": 3, "description": "Unverified statistic: 85% cost reduction"})(),
    ]

    async def mock_generate_micro_batch(batch_slots, revision_instructions, **kwargs):
        # Return repaired deliverables
        delivs = []
        for s in batch_slots:
            delivs.append(
                DeliverablePlan(
                    slot_index=s.slot_index,
                    planned_day=s.planned_day,
                    deliverable_type=s.deliverable_type,
                    platform=s.target_platform,
                    title=f"REPAIRED Title {s.slot_index}",
                    primary_hook=f"REPAIRED Hook {s.slot_index}",
                    caption=f"REPAIRED Caption {s.slot_index}",
                    call_to_action="REPAIRED CTA",
                )
            )
        return delivs

    with patch.object(agent, "_generate_micro_batch", side_effect=mock_generate_micro_batch):
        repaired = await agent.repair_deliverables(
            existing_deliverables=original_deliverables,
            failing_indices=failing_indices,
            findings=findings,
            strategy=strategy,
            brand_context=brand_context,
            brief=brief,
        )

    assert len(repaired) == 5

    # Check passing items were NOT touched
    assert repaired[0].title == "Original Title 0"
    assert repaired[2].title == "Original Title 2"
    assert repaired[4].title == "Original Title 4"

    # Check failing items WERE repaired
    assert repaired[1].title == "REPAIRED Title 1"
    assert repaired[3].title == "REPAIRED Title 3"


@pytest.mark.asyncio
async def test_eradication_of_fake_boilerplate_on_api_failure():
    """Verifies that persistent LLM failure raises RuntimeError rather than returning fake templates."""
    brief, brand_context, strategy, slots = _build_test_harness()
    agent = ContentArchitectAgent()

    with patch("app.campaign_intelligence.agents.content_architect.invoke_structured_llm", side_effect=ValueError("LLM API Timeout")):
        with pytest.raises(RuntimeError) as exc_info:
            await agent.run(strategy=strategy, brief=brief, brand_context=brand_context)

        assert "micro-batch generation failed" in str(exc_info.value)
