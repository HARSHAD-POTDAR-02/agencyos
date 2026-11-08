from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.campaign_intelligence.schemas.campaign import CampaignBrief
from app.campaign_intelligence.schemas.deliverables import (
    CarouselSlide,
    DeliverablePlan,
    ReelScene,
)
from app.campaign_intelligence.schemas.quality import QualityEvaluation
from app.campaign_intelligence.schemas.strategy import (
    CampaignStrategy,
    MessagingPillar,
    StrategicAngle,
)
from app.models.agency import Agency
from app.models.campaign import Campaign, CampaignStatus
from app.models.deliverable import Deliverable
from app.models.task import Task
from app.models.user import User


def _mock_multi_agent_pipeline_output(brief: CampaignBrief) -> dict:
    """Helper creating a complete mock state output from run_campaign_pipeline."""
    mock_strategy = CampaignStrategy(
        campaign_theme="Authentic Growth",
        primary_objective=brief.objective or "Increase brand engagement",
        target_audience_definition="Founders & Marketers",
        pacing_and_cadence="Weekly alternating distribution",
        strategic_angles=[
            StrategicAngle(
                angle_name="Operational Efficiency",
                rationale="Target pain points around manual agency workflows",
                target_audience_segment="Founders",
                aligned_content_pillar="Product Mastery",
            )
        ],
        messaging_pillars=[
            MessagingPillar(
                pillar_name="Product Mastery",
                core_message="Automate repetitive campaigns seamlessly",
                primary_call_to_action="Book a Demo",
            )
        ],
    )

    deliverable_plans = [
        DeliverablePlan(
            deliverable_id=uuid.uuid4(),
            title="Director Behind The Scenes Reel",
            deliverable_type="reel",
            platform="instagram",
            planned_week=1,
            strategic_angle="Behind The Scenes",
            hook_options=["Watch how our agency automates sprints", "The exact system we use"],
            primary_hook="Watch how our agency automates sprints in 60 seconds",
            caption="Scale without burning out. See the full workflow at the link in bio.",
            hashtags=["#agencygrowth", "#automation"],
            call_to_action="Comment SPRINT for the template",
            audio_track_guidance="Upbeat lo-fi beat",
            reel_scenes=[
                ReelScene(
                    scene_number=1,
                    timestamp_range="0:00 - 0:03",
                    visual_action="Macro cut of dashboard loading",
                    on_screen_text="Stop doing this manually",
                    spoken_audio_or_voiceover="If you are still doing this manually, you are losing 10 hours a week.",
                ),
                ReelScene(
                    scene_number=2,
                    timestamp_range="0:03 - 0:15",
                    visual_action="Screen recording of AI task pipeline",
                    on_screen_text="Automate in 1-click",
                    spoken_audio_or_voiceover="Here is how to automate your entire monthly sprint in under 5 minutes.",
                ),
            ],
        ),
        DeliverablePlan(
            deliverable_id=uuid.uuid4(),
            title="5 Playbooks For Modern Agencies Carousel",
            deliverable_type="carousel",
            platform="linkedin",
            planned_week=2,
            strategic_angle="Product Mastery",
            hook_options=["5 agency playbooks that changed our retention", "Retention frameworks"],
            primary_hook="5 agency playbooks that increased client retention by 30%",
            caption="Swipe through the frameworks every agency director should enforce.",
            hashtags=["#leadership", "#agencylife"],
            call_to_action="Save this post for your next quarterly review",
            carousel_slides=[
                CarouselSlide(
                    slide_number=1,
                    headline="5 Playbooks For Modern Agencies",
                    body_copy="Swipe to see the exact retained client frameworks.",
                    visual_layout="Bold typography with subtle dark gradient backdrop",
                    slide_type="cover",
                ),
                CarouselSlide(
                    slide_number=2,
                    headline="Playbook 1: Closed-Loop QA",
                    body_copy="Never ship creative without deterministic boundary verification.",
                    visual_layout="Split diagram showing reviewer vs AI loop",
                    slide_type="content",
                ),
                CarouselSlide(
                    slide_number=3,
                    headline="Scale Your Operations",
                    body_copy="Follow AgencyOS for weekly systems guides.",
                    visual_layout="Clean CTA slide with logo and profile link",
                    slide_type="cta",
                ),
            ],
        ),
    ]

    mock_quality = QualityEvaluation(
        is_approved_for_human_review=True,
        compliance_score=0.95,
        findings=[],
        revision_required=False,
        revision_instruction=None,
        evaluated_at="2026-11-07T21:00:00Z",
    )

    return {
        "strategy": mock_strategy,
        "deliverable_plans": deliverable_plans,
        "quality_evaluation": mock_quality,
        "workflow_status": "awaiting_approval",
        "revision_count": 0,
        "pipeline_agents_executed": [
            "brand_intelligence",
            "market_research",
            "historical_performance",
            "campaign_strategist",
            "content_architect",
            "quality_evaluator",
        ],
        "errors": [],
    }


@pytest.mark.asyncio
async def test_generate_plan_tenant_isolation(
    agency_a_client: AsyncClient,
    agency_b_client: AsyncClient,
    agency_a_data: tuple[User, Agency],
) -> None:
    """Verifies that Agency B cannot trigger plan generation for an Agency A client."""
    _, agency_a = agency_a_data

    # 1. Create client under Agency A
    create_res = await agency_a_client.post(
        f"/agencies/{agency_a.id}/clients",
        json={
            "business_name": "Tenancy Test Brand",
            "industry": "Cybersecurity",
        },
    )
    assert create_res.status_code == 201
    client_id = create_res.json()["id"]

    # 2. Attempt generation using Agency B's authenticated client
    tamper_res = await agency_b_client.post(
        f"/agencies/{agency_a.id}/clients/{client_id}/campaigns/generate-plan",
        json={"period_month": 12, "period_year": 2026, "objective": "Steal data"},
    )
    # Must be forbidden or not found
    assert tamper_res.status_code in (403, 404)


@pytest.mark.asyncio
async def test_generate_plan_endpoint_and_polymorphic_conversion(
    agency_a_client: AsyncClient,
    agency_a_data: tuple[User, Agency],
) -> None:
    """
    Tests end-to-end endpoint execution:
    1. Generates campaign plan via run_campaign_pipeline.
    2. Validates serialized plan draft compatibility (legacy UI keys + polymorphic rich data).
    3. Converts plan to production deliverables and tasks.
    4. Validates polymorphic task stage creation for Reels vs Carousels.
    """
    _, agency_a = agency_a_data

    # 1. Create client
    create_res = await agency_a_client.post(
        f"/agencies/{agency_a.id}/clients",
        json={
            "business_name": "SaaS Accelerator",
            "industry": "B2B SaaS",
        },
    )
    assert create_res.status_code == 201
    client_id = create_res.json()["id"]

    # 2. Mock run_campaign_pipeline to avoid external API calls and rate-limiting
    async def mock_run_pipeline(initial_state, db_session_factory=None, checkpointer=None):
        return _mock_multi_agent_pipeline_output(initial_state["brief"])

    with patch(
        "app.routers.campaigns.run_campaign_pipeline",
        side_effect=mock_run_pipeline,
    ):
        plan_res = await agency_a_client.post(
            f"/agencies/{agency_a.id}/clients/{client_id}/campaigns/generate-plan",
            json={
                "period_month": 12,
                "period_year": 2026,
                "objective": "Scale B2B demos via Reels and Carousels",
                "custom_brief": "Focus on developer tooling and operational speed",
            },
        )

    assert plan_res.status_code == 201
    campaign_data = plan_res.json()
    assert campaign_data["status"] == "planning"
    assert campaign_data["client_id"] == client_id

    # 3. Validate serialized ai_plan_draft structure
    plan = campaign_data["ai_plan_draft"]
    assert plan is not None
    assert "Authentic Growth" in plan["campaign_name"]
    assert plan["total_deliverables_planned"] == 2
    assert plan["generator"] == "AgencyOS Multi-Agent Campaign Intelligence Engine v3.0"
    assert len(plan["deliverables"]) == 2

    # Check Reel deliverable format
    reel = plan["deliverables"][0]
    assert reel["deliverable_type"] == "reel"
    assert reel["platform"] == "instagram"
    assert len(reel["reel_scenes"]) == 2
    assert "0:00 - 0:03" in reel["reel_scenes"][0]["timestamp_range"]

    # Check Carousel deliverable format
    carousel = plan["deliverables"][1]
    assert carousel["deliverable_type"] == "carousel"
    assert carousel["platform"] == "linkedin"
    assert len(carousel["carousel_slides"]) == 3
    assert carousel["carousel_slides"][0]["slide_type"] == "cover"

    # Check Multi-Agent Metadata
    assert plan["strategy"] is not None
    assert plan["quality_evaluation"] is not None
    assert plan["quality_evaluation"]["compliance_score"] == 0.95
    assert len(plan["pipeline_agents_executed"]) == 6

    # 4. Convert to production deliverables and tasks
    campaign_id = campaign_data["id"]
    convert_res = await agency_a_client.post(
        f"/agencies/{agency_a.id}/campaigns/{campaign_id}/convert-to-tasks"
    )
    assert convert_res.status_code == 200
    conv_data = convert_res.json()
    assert conv_data["campaign_id"] == campaign_id
    assert conv_data["deliverables_created"] == 2
    # 4 tasks for Reel (scripting, filming, editing, approval) + 4 tasks for Carousel (copywriting, design, qa, approval) = 8 tasks
    assert conv_data["tasks_created"] == 8
    assert conv_data["status"] == "converted_to_production"


@pytest.mark.asyncio
async def test_convert_campaign_tenant_isolation(
    agency_a_client: AsyncClient,
    agency_b_client: AsyncClient,
    agency_a_data: tuple[User, Agency],
) -> None:
    """Verifies that Agency B cannot convert an Agency A campaign."""
    _, agency_a = agency_a_data

    # Create dummy campaign under Agency A
    create_res = await agency_a_client.post(
        f"/agencies/{agency_a.id}/clients",
        json={"business_name": "Tenancy Convert Brand"},
    )
    client_id = create_res.json()["id"]

    camp_res = await agency_a_client.post(
        f"/agencies/{agency_a.id}/clients/{client_id}/campaigns",
        json={"name": "Isolated Campaign", "status": "planning"},
    )
    campaign_id = camp_res.json()["id"]

    # Agency B tries to convert Agency A's campaign
    tamper_res = await agency_b_client.post(
        f"/agencies/{agency_a.id}/campaigns/{campaign_id}/convert-to-tasks"
    )
    assert tamper_res.status_code in (403, 404)


@pytest.mark.asyncio
async def test_convert_campaign_missing_draft_error(
    agency_a_client: AsyncClient,
    agency_a_data: tuple[User, Agency],
) -> None:
    """Verifies that converting a campaign without an AI plan draft raises a 400 error."""
    _, agency_a = agency_a_data

    create_res = await agency_a_client.post(
        f"/agencies/{agency_a.id}/clients",
        json={"business_name": "Empty Draft Brand"},
    )
    client_id = create_res.json()["id"]

    camp_res = await agency_a_client.post(
        f"/agencies/{agency_a.id}/clients/{client_id}/campaigns",
        json={"name": "Empty Draft Campaign", "status": "planning"},
    )
    campaign_id = camp_res.json()["id"]

    convert_res = await agency_a_client.post(
        f"/agencies/{agency_a.id}/campaigns/{campaign_id}/convert-to-tasks"
    )
    assert convert_res.status_code == 400
    assert "Campaign does not have an AI plan draft to convert" in convert_res.json()["detail"]


@pytest.mark.asyncio
async def test_chat_brief_endpoint(
    agency_a_client: AsyncClient,
    agency_a_data: tuple[User, Agency],
) -> None:
    """Verifies that the conversational chat briefing copilot responds and extracts goals."""
    _, agency_a = agency_a_data

    create_res = await agency_a_client.post(
        f"/agencies/{agency_a.id}/clients",
        json={"business_name": "Copilot Test Client", "industry": "DevTools"},
    )
    client_id = create_res.json()["id"]

    chat_res = await agency_a_client.post(
        f"/agencies/{agency_a.id}/clients/{client_id}/campaigns/chat-brief",
        json={
            "messages": [
                {"role": "user", "content": "We want to plan a sprint focusing on developer velocity."}
            ],
            "period_month": 12,
            "period_year": 2026,
        },
    )
    assert chat_res.status_code == 200
    data = chat_res.json()
    assert "reply" in data
    assert len(data["reply"]) > 0

