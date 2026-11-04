from __future__ import annotations

import uuid
import pytest
from httpx import AsyncClient

from app.models.agency import Agency
from app.models.user import User


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
            "business_name": "Artisan Chai Co",
            "industry": "Food & Beverage",
            "location": "Mumbai, India",
        },
    )
    assert create_res.status_code == 201
    client_data = create_res.json()
    client_id = client_data["id"]

    # 2. Upsert Brand Profile
    bp_res = await agency_a_client.put(
        f"/agencies/{agency.id}/clients/{client_id}/brand-profile",
        json={
            "brand_voice": "Warm, authentic, rooted in Indian tradition yet appealing to Gen Z",
            "tone_examples": ["Chai is not just a drink, it is an emotion.", "No artificial syrups, only real spices."],
            "target_audience": "Urban young professionals and tea connoisseurs aged 21-38",
            "content_pillars": ["Origins & Sourcing", "Monsoon Chai Aesthetics", "Customer Stories"],
            "prohibited_claims": ["100% cure for headaches", "Cheapest tea online"],
            "is_confirmed": True,
        },
    )
    assert bp_res.status_code == 200
    bp_data = bp_res.json()
    assert bp_data["is_confirmed"] is True
    assert "Monsoon Chai Aesthetics" in bp_data["content_pillars"]

    # 3. Create Retainer Contract (30 Reels / month)
    contract_res = await agency_a_client.post(
        f"/agencies/{agency.id}/clients/{client_id}/contracts",
        json={
            "name": "Social Growth Retainer",
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

    # 4. Generate AI Campaign Plan
    plan_res = await agency_a_client.post(
        f"/agencies/{agency.id}/clients/{client_id}/campaigns/generate-plan",
        json={
            "period_month": 11,
            "period_year": 2026,
            "objective": "Scale organic views and drive Diwali gift box sales",
            "custom_brief": "Focus on high visual quality and warm cozy vibes",
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
