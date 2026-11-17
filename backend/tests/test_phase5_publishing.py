"""
Phase 5 Tests — Social Publishing, Multi-Client Separation & Performance Reporting.

Tests:
  1. Client Social Accounts CRUD (connect Instagram/Facebook per client).
  2. Multi-client account isolation (Client A credentials cannot be used or seen by Client B).
  3. Safe Publishing Guardrail: Unapproved deliverables cannot be published.
  4. Manual Publishing Workflow: Deliverable approved -> marked published -> tasks synced to done.
  5. Automated Publishing Validation: Fails cleanly if no account connected.
  6. Performance Metrics and Monthly Client Report Generation.
"""
from __future__ import annotations

import uuid
from datetime import datetime
import pytest
from httpx import AsyncClient

from app.models.campaign import Campaign, CampaignStatus
from app.models.client import Client
from app.models.client_social_account import ClientSocialAccount
from app.models.contract import Contract, ContractStatus, ScopeItem
from app.models.content_version import ContentVersion
from app.models.deliverable import Deliverable, DeliverableStatus
from app.models.task import Task, TaskPriority, TaskStatus
from tests.conftest import TestSessionLocal


@pytest.mark.asyncio
async def test_client_social_account_crud_and_isolation(
    agency_a_client: AsyncClient, agency_a_data
):
    """Verify connecting, retrieving, and isolating social accounts per client."""
    user_a, agency = agency_a_data

    # Setup two clients in the same agency
    async with TestSessionLocal() as db:
        client1 = Client(
            id=uuid.uuid4(),
            agency_id=agency.id,
            business_name="Acme Enterprise",
            status="active",
        )
        client2 = Client(
            id=uuid.uuid4(),
            agency_id=agency.id,
            business_name="Apex Global",
            status="active",
        )
        db.add_all([client1, client2])
        await db.commit()
        c1_id = str(client1.id)
        c2_id = str(client2.id)

    # 1. Connect Instagram account to Client 1
    post_res = await agency_a_client.post(
        f"/agencies/{agency.id}/clients/{c1_id}/social-accounts",
        json={
            "platform": "instagram",
            "account_name": "Acme Enterprise Official",
            "account_handle": "@shauryawada",
            "instagram_business_id": "17841400012345",
            "access_token": "EAAG...test_token_1",
        },
    )
    assert post_res.status_code == 201
    account1 = post_res.json()
    assert account1["platform"] == "instagram"
    assert account1["account_handle"] == "@shauryawada"

    # 2. List accounts for Client 1 -> 1 account
    list_c1 = await agency_a_client.get(
        f"/agencies/{agency.id}/clients/{c1_id}/social-accounts"
    )
    assert list_c1.status_code == 200
    assert len(list_c1.json()) == 1

    # 3. List accounts for Client 2 -> 0 accounts (Isolation verified!)
    list_c2 = await agency_a_client.get(
        f"/agencies/{agency.id}/clients/{c2_id}/social-accounts"
    )
    assert list_c2.status_code == 200
    assert len(list_c2.json()) == 0


@pytest.mark.asyncio
async def test_publishing_guardrail_unapproved_cannot_publish(
    agency_a_client: AsyncClient, agency_a_data
):
    """Unapproved deliverables cannot enter the publishing pipeline."""
    user_a, agency = agency_a_data

    async with TestSessionLocal() as db:
        client = Client(id=uuid.uuid4(), agency_id=agency.id, business_name="Brand A")
        campaign = Campaign(id=uuid.uuid4(), client_id=client.id, name="Nov Campaign")
        deliverable = Deliverable(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            title="Draft Reel",
            deliverable_type="reel",
            platform="instagram",
            status=DeliverableStatus.not_started,  # Not approved!
        )
        db.add_all([client, campaign, deliverable])
        await db.commit()
        deliv_id = str(deliverable.id)

    # Attempt to publish draft
    res = await agency_a_client.post(
        f"/agencies/{agency.id}/deliverables/{deliv_id}/publish",
        json={"mode": "manual", "live_post_url": "https://instagram.com/reel/xyz"},
    )
    assert res.status_code == 400
    assert "Only client-approved deliverables can be published" in res.json()["detail"]


@pytest.mark.asyncio
async def test_manual_publishing_workflow_and_task_sync(
    agency_a_client: AsyncClient, agency_a_data
):
    """Approved deliverable can be published manually and automatically syncs linked tasks to done."""
    user_a, agency = agency_a_data

    async with TestSessionLocal() as db:
        client = Client(id=uuid.uuid4(), agency_id=agency.id, business_name="Brand B")
        campaign = Campaign(id=uuid.uuid4(), client_id=client.id, name="Dec Sprint")
        deliverable = Deliverable(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            title="Product Launch Showcase",
            deliverable_type="reel",
            platform="instagram",
            status=DeliverableStatus.approved,  # Approved!
        )
        task = Task(
            id=uuid.uuid4(),
            deliverable_id=deliverable.id,
            title="Editing: Final Cut",
            status=TaskStatus.in_progress,
        )
        db.add_all([client, campaign, deliverable, task])
        await db.commit()
        deliv_id = str(deliverable.id)
        task_id = task.id

    # Publish with live URL
    pub_res = await agency_a_client.post(
        f"/agencies/{agency.id}/deliverables/{deliv_id}/publish",
        json={
            "mode": "manual",
            "live_post_url": "https://www.instagram.com/reel/DD123456/",
            "platform": "instagram",
        },
    )
    assert pub_res.status_code == 200
    data = pub_res.json()
    assert data["success"] is True
    assert data["status"] == "published"
    assert data["live_post_url"] == "https://www.instagram.com/reel/DD123456/"

    # Verify task was synced to done
    async with TestSessionLocal() as db:
        updated_task = await db.get(Task, task_id)
        assert updated_task.status == TaskStatus.done


@pytest.mark.asyncio
async def test_metrics_recording_and_monthly_report(
    agency_a_client: AsyncClient, agency_a_data
):
    """Test updating metrics and generating the Phase 5 Monthly Delivery & Performance Report."""
    user_a, agency = agency_a_data

    async with TestSessionLocal() as db:
        client = Client(id=uuid.uuid4(), agency_id=agency.id, business_name="Fine Dining")
        contract = Contract(
            id=uuid.uuid4(),
            client_id=client.id,
            name="Monthly Retainer",
            start_date=datetime.now().date(),
            status=ContractStatus.active,
        )
        scope = ScopeItem(
            id=uuid.uuid4(),
            contract_id=contract.id,
            deliverable_type="reel",
            platform="instagram",
            monthly_quantity=20,
        )
        campaign = Campaign(id=uuid.uuid4(), client_id=client.id, name="Campaign 1")
        deliverable = Deliverable(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            title="Viral Chef Recipe",
            deliverable_type="reel",
            platform="instagram",
            status=DeliverableStatus.published,
            live_post_url="https://instagram.com/reel/recipe",
            views_count=50000,
            likes_count=2500,
            comments_count=180,
        )
        db.add_all([client, contract, scope, campaign, deliverable])
        await db.commit()
        c_id = str(client.id)
        deliv_id = str(deliverable.id)

    # 1. Update metrics
    patch_res = await agency_a_client.patch(
        f"/agencies/{agency.id}/deliverables/{deliv_id}/metrics",
        json={"views_count": 65000, "likes_count": 3200},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["views_count"] == 65000

    # 2. Get Monthly Delivery Report
    report_res = await agency_a_client.get(
        f"/agencies/{agency.id}/clients/{c_id}/reports/monthly"
    )
    assert report_res.status_code == 200
    report = report_res.json()
    assert report["client_name"] == "Fine Dining"
    assert report["total_scope_quota"] == 20
    assert report["deliverables_delivered"] >= 1
    assert report["total_views"] == 65000
    assert len(report["top_deliverables"]) >= 1
    assert "executive_summary" in report


@pytest.mark.asyncio
async def test_facebook_automated_publishing_and_metrics_sync(
    agency_a_client: AsyncClient, agency_a_data, monkeypatch
):
    """Test automated Facebook publishing and Facebook live metrics syncing."""
    user_a, agency = agency_a_data

    # Mock publish_facebook_page_post
    async def mock_publish_fb(*args, **kwargs):
        return {
            "post_id": "796871400170353_123456789",
            "permalink": "https://www.facebook.com/796871400170353_123456789",
            "platform": "facebook",
        }

    # Mock sync_facebook_metrics
    async def mock_sync_fb(*args, **kwargs):
        return {
            "likes_count": 42,
            "comments_count": 8,
            "views_count": 550,
            "shares_count": 14,
        }

    monkeypatch.setattr("app.routers.publishing.publish_facebook_page_post", mock_publish_fb)
    monkeypatch.setattr("app.routers.publishing.sync_facebook_metrics", mock_sync_fb)

    async with TestSessionLocal() as db:
        client = Client(id=uuid.uuid4(), agency_id=agency.id, business_name="Shauryawada FB Client")
        social = ClientSocialAccount(
            id=uuid.uuid4(),
            client_id=client.id,
            platform="facebook",
            account_name="Shauryawada Facebook Page",
            account_handle="@shauryawadafb",
            facebook_page_id="796871400170353",
            access_token="test_fb_page_token",
            is_active=True,
        )
        campaign = Campaign(id=uuid.uuid4(), client_id=client.id, name="Facebook Campaign")
        deliverable = Deliverable(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            title="Facebook Viral Promo",
            deliverable_type="video",
            platform="facebook",
            status=DeliverableStatus.approved,
        )
        version = ContentVersion(
            id=uuid.uuid4(),
            deliverable_id=deliverable.id,
            version_number=1,
            storage_key="test_video.mp4",
            file_name="test_video.mp4",
            file_type="video/mp4",
            checksum_sha256="abc123sha",
            uploaded_by_id=user_a.id,
            caption="Check out our grand opening on Facebook!",
        )
        db.add_all([client, social, campaign, deliverable, version])
        await db.commit()
        deliv_id = str(deliverable.id)

    # 1. Publish to Facebook
    pub_res = await agency_a_client.post(
        f"/agencies/{agency.id}/deliverables/{deliv_id}/publish",
        json={
            "mode": "automated",
            "platform": "facebook",
            "caption_override": "Custom Facebook Page Post #Shauryawada",
        },
    )
    assert pub_res.status_code == 200
    pub_data = pub_res.json()
    assert pub_data["success"] is True
    assert pub_data["platform"] == "facebook"
    assert pub_data["status"] == "published"
    assert pub_data["external_post_id"] == "796871400170353_123456789"
    assert "https://www.facebook.com" in pub_data["live_post_url"]

    # 2. Sync metrics from Facebook
    sync_res = await agency_a_client.post(
        f"/agencies/{agency.id}/deliverables/{deliv_id}/sync-metrics"
    )
    assert sync_res.status_code == 200
    sync_data = sync_res.json()
    assert sync_data["likes_count"] == 42
    assert sync_data["comments_count"] == 8
    assert sync_data["views_count"] == 550
    assert sync_data["shares_count"] == 14

    # 3. Unpublish deliverable (moves back to approved status)
    unpub_res = await agency_a_client.post(
        f"/agencies/{agency.id}/deliverables/{deliv_id}/unpublish"
    )
    assert unpub_res.status_code == 200
    unpub_data = unpub_res.json()
    assert unpub_data["status"] == "approved"
    assert unpub_data["unpublish"] is True

    # Verify deliverable state in DB
    async with TestSessionLocal() as db:
        updated = await db.get(Deliverable, deliverable.id)
        assert updated.status == DeliverableStatus.approved
        assert updated.live_post_url is None
        assert updated.external_post_id is None
        assert updated.published_at is None
        assert updated.views_count == 0
        assert updated.likes_count == 0

