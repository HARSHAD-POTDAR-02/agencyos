from __future__ import annotations

import uuid
from unittest.mock import patch
import pytest
from httpx import AsyncClient

from app.campaign_intelligence.orchestration.state import CampaignState
from app.campaign_intelligence.schemas import (
    CampaignStrategy,
    DeliverablePlan,
    MessagingPillar,
    ReelScene,
    StrategicAngle,
)
from app.models.agency import Agency
from app.models.user import User


def _mock_pipeline_output(brief) -> CampaignState:
    mock_strategy = CampaignStrategy(
        campaign_theme="Cloud Native Performance",
        primary_objective=brief.objective or "Increase enterprise reach",
        target_audience_definition="Engineering Leaders & Developers",
        pacing_and_cadence="Weekly alternating distribution",
        strategic_angles=[
            StrategicAngle(
                angle_name="Operational Efficiency",
                rationale="Target pain points around manual cloud management",
                target_audience_segment="DevOps Teams",
                aligned_content_pillar="Infrastructure",
            )
        ],
        messaging_pillars=[
            MessagingPillar(
                pillar_name="Infrastructure",
                core_message="Accelerate cloud deployments with zero downtime",
                primary_call_to_action="Book a Demo",
            )
        ],
    )

    plans = [
        DeliverablePlan(
            deliverable_id=uuid.uuid4(),
            title="Next-Gen Architecture Breakdown",
            deliverable_type="reel",
            platform="instagram",
            planned_week=1,
            strategic_angle="Operational Efficiency",
            hook_options=["Why your pipeline is slowing down", "Deploy 10x faster"],
            primary_hook="Why your cloud deployments are stalling out",
            caption="Scale infrastructure without outages. Full blueprint in bio.",
            hashtags=["#cloudengineering", "#devops"],
            call_to_action="Comment BLUEPRINT for our architecture guide",
            audio_track_guidance="Upbeat tech ambience",
            reel_scenes=[
                ReelScene(
                    scene_number=1,
                    timestamp_range="0:00 - 0:03",
                    visual_action="Screen recording of console throughput",
                    on_screen_text="Stop deploying manually",
                    spoken_audio_or_voiceover="Manual deployments waste 15 engineer hours each sprint.",
                ),
            ],
        ),
    ]

    return {
        "strategy": mock_strategy,
        "deliverable_plans": plans,
        "quality_evaluation": None,
        "revision_count": 0,
        "workflow_status": "completed",
        "pipeline_agents_executed": ["brand_intelligence", "strategy", "content_architect"],
        "errors": [],
    }


@pytest.mark.asyncio
async def test_brand_profile_and_contracts(
    agency_a_client: AsyncClient,
    agency_a_data: tuple[User, Agency],
) -> None:
    _, agency = agency_a_data

    # 1. Create client
    create_res = await agency_a_client.post(
        f"/agencies/{agency.id}/clients",
        json={
            "business_name": "Apex Cloud Technologies",
            "industry": "Enterprise Cloud Software",
            "location": "San Francisco, CA",
        },
    )
    assert create_res.status_code == 201
    client_data = create_res.json()
    client_id = client_data["id"]

    # 2. Upsert Brand Profile
    bp_res = await agency_a_client.put(
        f"/agencies/{agency.id}/clients/{client_id}/brand-profile",
        json={
            "brand_voice": "Authoritative, technical, clear, and product-led",
            "tone_examples": ["Infrastructure should be invisible.", "Built for 99.999% uptime."],
            "target_audience": "VP of Engineering and cloud architects",
            "content_pillars": ["Architecture Deep Dives", "System Reliability", "Case Studies"],
            "prohibited_claims": ["100% bug free guarantee", "Cheapest hosting worldwide"],
            "is_confirmed": True,
        },
    )
    assert bp_res.status_code == 200
    bp_data = bp_res.json()
    assert bp_data["is_confirmed"] is True
    assert "Architecture Deep Dives" in bp_data["content_pillars"]

    # 3. Create Retainer Contract (30 Reels / month)
    contract_res = await agency_a_client.post(
        f"/agencies/{agency.id}/clients/{client_id}/contracts",
        json={
            "name": "Enterprise Growth Retainer",
            "monthly_fee_inr": 65000,
            "start_date": "2026-11-01",
            "scope_items": [
                {
                    "deliverable_type": "reel",
                    "platform": "instagram",
                    "monthly_quantity": 30,
                }
            ],
        },
    )
    assert contract_res.status_code == 201
    contract_data = contract_res.json()
    assert contract_data["monthly_fee_inr"] == 65000
    assert len(contract_data["scope_items"]) == 1
    assert contract_data["scope_items"][0]["monthly_quantity"] == 30

    # 4. Generate AI Campaign Plan (with mocked pipeline to isolate from network/LLM latency)
    async def mock_run(initial_state, db_session_factory=None, checkpointer=None):
        return _mock_pipeline_output(initial_state["brief"])

    with patch("app.routers.campaigns.run_campaign_pipeline", side_effect=mock_run):
        plan_res = await agency_a_client.post(
            f"/agencies/{agency.id}/clients/{client_id}/campaigns/generate-plan",
            json={
                "period_month": 11,
                "period_year": 2026,
                "objective": "Scale organic reach for enterprise developer tooling",
                "custom_brief": "Focus on system reliability and cloud performance",
            },
        )
    assert plan_res.status_code == 201
    campaign_data = plan_res.json()
    assert campaign_data["status"] == "planning"
    assert campaign_data["ai_plan_draft"] is not None
    plan = campaign_data["ai_plan_draft"]
    assert len(plan["deliverables"]) > 0

    # 5. Convert Plan to Pipeline Deliverables & Tasks
    campaign_id = campaign_data["id"]
    convert_res = await agency_a_client.post(
        f"/agencies/{agency.id}/campaigns/{campaign_id}/convert-to-tasks",
    )
    assert convert_res.status_code == 200
    conv_data = convert_res.json()
    assert conv_data["deliverables_created"] > 0
    assert conv_data["tasks_created"] > 0
    assert conv_data["status"] == "converted_to_production"


def test_format_executive_reply_user_case():
    from app.routers.campaigns import format_executive_reply

    raw_user_example = (
        "Your 1‑day LinkedIn sprint will spotlight cross‑region egress cost predictability with a single high‑impact carousel post. "
        "Concept: 5‑slide carousel – 1) Hook: “Stop guessing your egress bill across regions”. "
        "2) Pain: Real‑world cost variance example (anonymous). 3) Solution: Vertex Cloud’s predictive cost model (technical snapshot). "
        "4) Benefit: 20% more budgeting confidence (data‑driven). 5) Call‑to‑action: “Download the free cost‑predictability guide”. "
        "Visual style: minimalist diagrams, authoritative tone, brand colors. This stays within the brand voice and avoids prohibited claims."
    )

    formatted = format_executive_reply(raw_user_example)

    # Must NOT have asterisks or hashtags
    assert "*" not in formatted
    assert "#" not in formatted

    # Must be broken into clean multi-line paragraphs and numbered items
    assert "\n\n" in formatted
    assert "1. Hook:" in formatted
    assert "\n2. Pain:" in formatted
    assert "\n3. Solution:" in formatted
    assert "\n4. Benefit:" in formatted
    assert "\n5. Call‑to‑action:" in formatted
    assert "\n\nVisual style:" in formatted
    assert "\n\nThis stays within" in formatted

