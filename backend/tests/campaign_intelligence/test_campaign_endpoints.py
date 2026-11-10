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


def test_extract_date_range_from_text_utility() -> None:
    """Verifies that extract_date_range_from_text parses various date range formats reliably."""
    from app.campaign_intelligence.tools.date_utils import extract_date_range_from_text

    # User phrasing 1: "from 8th nov to 11th nov"
    r1 = extract_date_range_from_text("i want to create a campign from 8th nov to 11th nov", 2026)
    assert r1 is not None
    assert r1.start_date.isoformat() == "2026-11-08"
    assert r1.end_date.isoformat() == "2026-11-11"
    assert r1.duration_days == 4
    assert r1.period_month == 11
    assert r1.period_year == 2026

    # User phrasing 2: typo "8th nnov to 11th nov"
    r2 = extract_date_range_from_text("from 8th nnov to 11th nov", 2026)
    assert r2 is not None
    assert r2.start_date.isoformat() == "2026-11-08"
    assert r2.end_date.isoformat() == "2026-11-11"
    assert r2.duration_days == 4

    # User phrasing 3: "nov 8 to 11"
    r3 = extract_date_range_from_text("create sprint for nov 8 to 11", 2026)
    assert r3 is not None
    assert r3.start_date.isoformat() == "2026-11-08"
    assert r3.end_date.isoformat() == "2026-11-11"
    assert r3.duration_days == 4

    # User phrasing 4: "8th to 11th november"
    r4 = extract_date_range_from_text("8th to 11th november 2026", 2026)
    assert r4 is not None
    assert r4.start_date.isoformat() == "2026-11-08"
    assert r4.end_date.isoformat() == "2026-11-11"
    assert r4.duration_days == 4


@pytest.mark.asyncio
async def test_chat_brief_date_range_recognition(
    agency_a_client: AsyncClient,
    agency_a_data: tuple[User, Agency],
) -> None:
    """Verifies that the chat-brief copilot recognizes date ranges like 'from 8th nov to 11th nov'."""
    _, agency_a = agency_a_data

    create_res = await agency_a_client.post(
        f"/agencies/{agency_a.id}/clients",
        json={"business_name": "Date Sprint Client", "industry": "Retail"},
    )
    client_id = create_res.json()["id"]

    chat_res = await agency_a_client.post(
        f"/agencies/{agency_a.id}/clients/{client_id}/campaigns/chat-brief",
        json={
            "messages": [
                {"role": "user", "content": "I want to create a campaign from 8th nov to 11th nov for Diwali deals"}
            ],
            "period_month": 11,
            "period_year": 2026,
        },
    )
    assert chat_res.status_code == 200
    data = chat_res.json()
    assert data["suggested_start_date"] == "2026-11-08"
    assert data["suggested_end_date"] == "2026-11-11"
    assert data["suggested_duration_days"] == 4


@pytest.mark.asyncio
async def test_chat_brief_llm_2024_year_sanitization(
    agency_a_client: AsyncClient,
    agency_a_data: tuple[User, Agency],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Verifies that if the LLM defaults to 2024 (knowledge cutoff), the endpoint sanitizes to 2026."""
    from app.routers.campaigns import ChatBriefLLMOutput

    fake_llm_output = ChatBriefLLMOutput(
        reply="Great! We will run a 4-day sprint from November 8, 2024 to November 11, 2024.",
        suggested_objective="Drive holiday sales",
        suggested_custom_brief="Target young professionals",
        suggested_period_month=11,
        suggested_period_year=2024,
        suggested_start_date="2024-11-08",
        suggested_end_date="2024-11-11",
        suggested_duration_days=4,
        is_ready_to_generate=False,
    )

    async def mock_invoke(*args, **kwargs):
        return fake_llm_output

    monkeypatch.setattr("app.routers.campaigns.invoke_structured_llm", mock_invoke)

    _, agency_a = agency_a_data
    create_res = await agency_a_client.post(
        f"/agencies/{agency_a.id}/clients",
        json={"business_name": "Sanitization Client", "industry": "SaaS"},
    )
    client_id = create_res.json()["id"]

    chat_res = await agency_a_client.post(
        f"/agencies/{agency_a.id}/clients/{client_id}/campaigns/chat-brief",
        json={
            "messages": [
                {"role": "user", "content": "I want to create a campaign from 8th nov to 11th nov"}
            ],
            "period_month": 11,
            "period_year": 2026,
        },
    )
    assert chat_res.status_code == 200
    data = chat_res.json()
    assert data["suggested_start_date"] == "2026-11-08"
    assert data["suggested_end_date"] == "2026-11-11"
    assert data["suggested_period_year"] == 2026
    assert "2024" not in data["reply"]
    assert "2026" in data["reply"]


@pytest.mark.asyncio
async def test_generate_plan_multi_day_sprint_distribution(
    agency_a_client: AsyncClient,
    agency_a_data: tuple[User, Agency],
) -> None:
    """
    Verifies that when generating a campaign sprint from 8th Nov to 11th Nov (4 days),
    deliverables are created across Day 1, Day 2, Day 3, and Day 4 with scheduled dates,
    and converting to tasks assigns planned_date and due_date accurately.
    """
    _, agency_a = agency_a_data

    create_res = await agency_a_client.post(
        f"/agencies/{agency_a.id}/clients",
        json={"business_name": "Multi-Day Restaurant Client", "industry": "Food & Beverage"},
    )
    client_id = create_res.json()["id"]

    # Mock the pipeline so we don't hit external LLM rate limits in CI
    mock_plans = [
        DeliverablePlan(
            deliverable_id=uuid.uuid4(),
            title="Day 1 Launch Reel",
            deliverable_type="reel",
            platform="instagram",
            planned_day=1,
            scheduled_date="2026-11-08",
            primary_hook="Secret spice recipe revealed",
            caption="Day 1 special deal",
        ),
        DeliverablePlan(
            deliverable_id=uuid.uuid4(),
            title="Day 2 Behind The Scenes Reel",
            deliverable_type="reel",
            platform="instagram",
            planned_day=2,
            scheduled_date="2026-11-09",
            primary_hook="How we make 500 thalis every day",
            caption="Day 2 behind the scenes",
        ),
        DeliverablePlan(
            deliverable_id=uuid.uuid4(),
            title="Day 3 Carousel",
            deliverable_type="carousel",
            platform="instagram",
            planned_day=3,
            scheduled_date="2026-11-10",
            primary_hook="Top 5 dishes you must try",
            caption="Day 3 carousel guide",
        ),
        DeliverablePlan(
            deliverable_id=uuid.uuid4(),
            title="Day 4 Offer Close Reel",
            deliverable_type="reel",
            platform="instagram",
            planned_day=4,
            scheduled_date="2026-11-11",
            primary_hook="Last chance to claim the weekend offer",
            caption="Day 4 offer closing tonight",
        ),
    ]

    with patch(
        "app.routers.campaigns.run_campaign_pipeline",
        new=AsyncMock(return_value={
            "strategy": CampaignStrategy(
                campaign_theme="Diwali Special Weekend",
                primary_objective="Drive weekend footfall",
                target_audience_definition="Foodies in Pune",
                pacing_and_cadence="Daily sequential campaign across 4 days from Nov 8 to Nov 11",
            ),
            "deliverable_plans": mock_plans,
            "quality_evaluation": None,
            "brand_context": None,
            "errors": [],
        }),
    ):
        gen_res = await agency_a_client.post(
            f"/agencies/{agency_a.id}/clients/{client_id}/campaigns/generate-plan",
            json={
                "start_date": "2026-11-08",
                "end_date": "2026-11-11",
                "duration_days": 4,
                "objective": "Diwali Weekend Feast Footfall",
                "custom_brief": "Create a 4-day sprint from 8th nov to 11th nov",
            },
        )
        assert gen_res.status_code == 201
        camp_data = gen_res.json()
        campaign_id = camp_data["id"]
        draft = camp_data["ai_plan_draft"]

        assert draft["start_date"] == "2026-11-08"
        assert draft["end_date"] == "2026-11-11"
        assert draft["duration_days"] == 4

        delivs = draft["deliverables"]
        assert len(delivs) == 4
        # Verify Day 1 through Day 4 are explicitly distinct
        assert [d["day_number"] for d in delivs] == [1, 2, 3, 4]
        assert delivs[0]["scheduled_date"] == "2026-11-08"
        assert delivs[1]["scheduled_date"] == "2026-11-09"
        assert delivs[2]["scheduled_date"] == "2026-11-10"
        assert delivs[3]["scheduled_date"] == "2026-11-11"

        # Convert to tasks and verify planned_date and task due_date
        conv_res = await agency_a_client.post(
            f"/agencies/{agency_a.id}/campaigns/{campaign_id}/convert-to-tasks"
        )
        assert conv_res.status_code == 200
        assert conv_res.json()["deliverables_created"] == 4

    # Query tasks list for the agency to verify due_date was populated on created tasks
    tasks_res = await agency_a_client.get(f"/agencies/{agency_a.id}/tasks")
    assert tasks_res.status_code == 200
    tasks = tasks_res.json()
    assert len(tasks) > 0
    due_dates = [t["due_date"] for t in tasks if t.get("due_date")]
    assert "2026-11-08" in due_dates
    assert "2026-11-09" in due_dates
    assert "2026-11-10" in due_dates
    assert "2026-11-11" in due_dates

