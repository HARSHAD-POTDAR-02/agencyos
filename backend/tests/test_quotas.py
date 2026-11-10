"""
Quota enforcement tests.
"""
from __future__ import annotations

import uuid
from datetime import date

import pytest
from httpx import AsyncClient

from app.models.agency import Agency
from app.models.campaign import Campaign, CampaignStatus
from app.models.client import Client, ClientStatus
from app.models.contract import Contract, ContractStatus, ScopeItem
from app.models.deliverable import Deliverable, DeliverableStatus
from app.models.user import User
from tests.conftest import TestSessionLocal


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _seed_quota_scenario(
    agency_id: uuid.UUID,
    deliverable_type: str,
    platform: str,
    monthly_quantity: int,
    num_deliverables: int,
    period_month: int = 11,
    period_year: int = 2026,
) -> tuple[uuid.UUID, uuid.UUID, uuid.UUID]:
    """
    Seeds:
     - Client under the given agency
     - Contract + ScopeItem (monthly_quantity)
     - Campaign for the period
     - num_deliverables Deliverables linked to the scope item

    Returns (client_id, scope_item_id, campaign_id).
    """
    async with TestSessionLocal() as db:
        client = Client(
            id=uuid.uuid4(),
            agency_id=agency_id,
            business_name=f"Quota Client {uuid.uuid4().hex[:6]}",
            status=ClientStatus.active,
        )
        db.add(client)
        await db.flush()

        contract = Contract(
            id=uuid.uuid4(),
            client_id=client.id,
            name="Test Contract",
            start_date=date(period_year, 1, 1),
            status=ContractStatus.active,
        )
        db.add(contract)
        await db.flush()

        scope_item = ScopeItem(
            id=uuid.uuid4(),
            contract_id=contract.id,
            deliverable_type=deliverable_type,
            platform=platform,
            monthly_quantity=monthly_quantity,
        )
        db.add(scope_item)
        await db.flush()

        campaign = Campaign(
            id=uuid.uuid4(),
            client_id=client.id,
            name="Test Campaign",
            period_month=period_month,
            period_year=period_year,
            status=CampaignStatus.in_production,
        )
        db.add(campaign)
        await db.flush()

        for _ in range(num_deliverables):
            d = Deliverable(
                id=uuid.uuid4(),
                campaign_id=campaign.id,
                scope_item_id=scope_item.id,
                title="Test Deliverable",
                deliverable_type=deliverable_type,
                platform=platform,
                status=DeliverableStatus.not_started,
            )
            db.add(d)

        await db.commit()
        return client.id, scope_item.id, campaign.id


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_quota_summary_correct(
    agency_a_client: AsyncClient,
    agency_a_data: tuple[User, Agency],
):
    """
    Seed a scope of 10 reels; add 7 deliverables.
    Quota endpoint must report remaining = 3.
    """
    _, agency = agency_a_data
    client_id, scope_item_id, _ = await _seed_quota_scenario(
        agency_id=agency.id,
        deliverable_type="reel",
        platform="instagram",
        monthly_quantity=10,
        num_deliverables=7,
        period_month=11,
        period_year=2026,
    )

    response = await agency_a_client.get(
        f"/agencies/{agency.id}/clients/{client_id}/quota",
        params={"period_month": 11, "period_year": 2026},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert len(data) >= 1

    # Find our scope item
    entry = next(
        (d for d in data if str(d["scope_item_id"]) == str(scope_item_id)), None
    )
    assert entry is not None, f"Scope item {scope_item_id} not in response: {data}"
    assert entry["monthly_quantity"] == 10
    assert entry["not_started"] == 7
    assert entry["remaining"] == 3


@pytest.mark.asyncio
async def test_overage_detected(
    agency_a_client: AsyncClient,
    agency_a_data: tuple[User, Agency],
):
    """
    Seed a scope of 10 reels; add 11 deliverables.
    check_quota_overage must return True.
    """
    _, agency = agency_a_data
    client_id, scope_item_id, _ = await _seed_quota_scenario(
        agency_id=agency.id,
        deliverable_type="reel",
        platform="facebook",
        monthly_quantity=10,
        num_deliverables=11,
        period_month=11,
        period_year=2026,
    )

    from app.services.quota_service import check_quota_overage

    async with TestSessionLocal() as db:
        overage = await check_quota_overage(
            client_id=client_id,
            period_month=11,
            period_year=2026,
            deliverable_type="reel",
            platform="facebook",
            db=db,
        )
    assert overage is True, "Expected overage=True when 11 deliverables exceed quota of 10"


@pytest.mark.asyncio
async def test_client_dynamic_scope_progress(
    agency_a_client: AsyncClient,
    agency_a_data: tuple[User, Agency],
):
    """
    Test that GET /agencies/{agency_id}/clients returns dynamic scope_progress
    reflecting contracts and deliverables.
    """
    _, agency = agency_a_data
    client_id, _, _ = await _seed_quota_scenario(
        agency_id=agency.id,
        deliverable_type="reel",
        platform="instagram",
        monthly_quantity=60,
        num_deliverables=5,
        period_month=11,
        period_year=2026,
    )

    # Fetch clients list
    res = await agency_a_client.get(f"/agencies/{agency.id}/clients")
    assert res.status_code == 200
    clients = res.json()
    client = next(c for c in clients if c["id"] == str(client_id))
    assert client["scope_progress"] is not None
    sp = client["scope_progress"]
    assert sp["contracts_count"] == 1
    assert sp["total_contracted"] == 60
    assert "60 Reels / month" in sp["monthly_scope_text"]
    assert sp["total_planned"] == 5

