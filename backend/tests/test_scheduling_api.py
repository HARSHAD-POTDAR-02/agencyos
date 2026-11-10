"""
Integration Tests for Scheduling Endpoints:
  - POST /agencies/{agency_id}/deliverables/{deliverable_id}/schedule
  - POST /agencies/{agency_id}/deliverables/{deliverable_id}/reschedule
  - POST /agencies/{agency_id}/deliverables/{deliverable_id}/cancel-schedule
  - GET  /agencies/{agency_id}/scheduled-deliverables
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta
import pytest
from httpx import AsyncClient

from app.models.campaign import Campaign, CampaignStatus
from app.models.client import Client
from app.models.client_social_account import ClientSocialAccount
from app.models.content_version import ContentVersion
from app.models.deliverable import Deliverable, DeliverableStatus
from app.models.publication_job import PublicationJob, JobStatus
from tests.conftest import TestSessionLocal


@pytest.fixture
async def setup_scheduled_hierarchy(agency_a_data):
    user_a, agency = agency_a_data

    async with TestSessionLocal() as db:
        client = Client(
            id=uuid.uuid4(),
            agency_id=agency.id,
            business_name="Acme Scheduling Corp",
            status="active",
        )
        db.add(client)
        await db.flush()

        ig_account = ClientSocialAccount(
            id=uuid.uuid4(),
            client_id=client.id,
            platform="instagram",
            account_name="acme_insta",
            instagram_business_id="ig_12345",
            access_token="encrypted_token",
            is_active=True,
        )
        fb_account = ClientSocialAccount(
            id=uuid.uuid4(),
            client_id=client.id,
            platform="facebook",
            account_name="acme_fb",
            facebook_page_id="fb_67890",
            access_token="encrypted_token",
            is_active=True,
        )
        db.add_all([ig_account, fb_account])

        campaign = Campaign(
            id=uuid.uuid4(),
            client_id=client.id,
            name="Q4 Launch",
            status=CampaignStatus.in_production,
        )
        db.add(campaign)
        await db.flush()

        approved_deliv = Deliverable(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            title="Winter Promo Reel",
            deliverable_type="reel",
            platform="both",
            status=DeliverableStatus.approved,
        )
        draft_deliv = Deliverable(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            title="Draft Reel",
            deliverable_type="reel",
            platform="instagram",
            status=DeliverableStatus.in_production,
        )
        db.add_all([approved_deliv, draft_deliv])
        await db.flush()

        version = ContentVersion(
            id=uuid.uuid4(),
            deliverable_id=approved_deliv.id,
            version_number=1,
            file_name="winter.mp4",
            file_type="video/mp4",
            checksum_sha256="abc123sha256hash",
            uploaded_by_id=user_a.id,
            caption="Check out our winter collection! ❄️",
            storage_key="https://storage.agencyos.test/videos/winter.mp4",
        )
        db.add(version)
        await db.commit()

        return {
            "agency": agency,
            "client": client,
            "approved_deliv": approved_deliv,
            "draft_deliv": draft_deliv,
            "version": version,
        }


@pytest.mark.asyncio
async def test_schedule_deliverable_success(agency_a_client: AsyncClient, setup_scheduled_hierarchy):
    data = setup_scheduled_hierarchy
    agency = data["agency"]
    deliv = data["approved_deliv"]

    target_time = (datetime.now(timezone.utc) + timedelta(hours=10)).isoformat()

    res = await agency_a_client.post(
        f"/agencies/{agency.id}/deliverables/{deliv.id}/schedule",
        json={
            "scheduled_at": target_time,
            "scheduled_timezone": "America/New_York",
            "platform": "both",
            "caption_override": "Exclusive sneak peek! ❄️",
            "share_to_feed": True,
        },
    )

    assert res.status_code == 200, res.text
    body = res.json()
    assert body["success"] is True
    assert body["status"] == "scheduled"
    assert len(body["jobs"]) == 2

    # Verify in DB
    async with TestSessionLocal() as db:
        saved_deliv = await db.get(Deliverable, deliv.id)
        assert saved_deliv.status == DeliverableStatus.scheduled
        assert saved_deliv.scheduled_timezone == "America/New_York"


@pytest.mark.asyncio
async def test_schedule_unapproved_deliverable_fails(agency_a_client: AsyncClient, setup_scheduled_hierarchy):
    data = setup_scheduled_hierarchy
    agency = data["agency"]
    draft_deliv = data["draft_deliv"]

    target_time = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()

    res = await agency_a_client.post(
        f"/agencies/{agency.id}/deliverables/{draft_deliv.id}/schedule",
        json={
            "scheduled_at": target_time,
            "platform": "instagram",
        },
    )

    assert res.status_code == 400
    assert "Only client-approved deliverables can be scheduled" in res.json()["detail"]


@pytest.mark.asyncio
async def test_list_and_reschedule_deliverable(agency_a_client: AsyncClient, setup_scheduled_hierarchy):
    data = setup_scheduled_hierarchy
    agency = data["agency"]
    deliv = data["approved_deliv"]

    # 1. Schedule it
    t1 = (datetime.now(timezone.utc) + timedelta(hours=5)).isoformat()
    sched_res = await agency_a_client.post(
        f"/agencies/{agency.id}/deliverables/{deliv.id}/schedule",
        json={"scheduled_at": t1, "platform": "instagram"},
    )
    assert sched_res.status_code == 200

    # 2. List scheduled deliverables
    list_res = await agency_a_client.get(f"/agencies/{agency.id}/scheduled-deliverables")
    assert list_res.status_code == 200
    items = list_res.json()
    assert any(item["deliverable_id"] == str(deliv.id) for item in items)

    # 3. Reschedule
    t2 = (datetime.now(timezone.utc) + timedelta(hours=12)).isoformat()
    resched_res = await agency_a_client.post(
        f"/agencies/{agency.id}/deliverables/{deliv.id}/reschedule",
        json={"new_scheduled_at": t2, "scheduled_timezone": "UTC"},
    )
    assert resched_res.status_code == 200
    resched_body = resched_res.json()
    assert resched_body["success"] is True


@pytest.mark.asyncio
async def test_cancel_schedule_deliverable(agency_a_client: AsyncClient, setup_scheduled_hierarchy):
    data = setup_scheduled_hierarchy
    agency = data["agency"]
    deliv = data["approved_deliv"]

    # 1. Schedule it
    t1 = (datetime.now(timezone.utc) + timedelta(hours=8)).isoformat()
    await agency_a_client.post(
        f"/agencies/{agency.id}/deliverables/{deliv.id}/schedule",
        json={"scheduled_at": t1, "platform": "instagram"},
    )

    # 2. Cancel
    cancel_res = await agency_a_client.post(
        f"/agencies/{agency.id}/deliverables/{deliv.id}/cancel-schedule"
    )
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "approved"

    # Verify deliverable returned to approved state
    async with TestSessionLocal() as db:
        saved = await db.get(Deliverable, deliv.id)
        assert saved.status == DeliverableStatus.approved
        assert saved.scheduled_at is None
