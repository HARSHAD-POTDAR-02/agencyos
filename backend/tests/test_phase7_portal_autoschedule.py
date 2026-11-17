"""
Phase 7 Integration Tests — Closed-Loop Client Portal Approval ➔ Auto-Scheduling Trigger:
1. Portal single-item approval automatically schedules deliverable when connected social accounts and media assets exist.
2. Portal single-item approval gracefully transitions to approved when no social accounts are connected.
3. Requesting changes cancels any existing scheduled publication jobs and resets scheduled_at.
4. Portal batch sprint decision executes 1-click approvals across multiple deliverables, creating publication jobs.
5. Strict tenant isolation: client reviewer cannot approve or batch-decide deliverables belonging to other clients.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.approval import Approval, ApprovalDecision
from app.models.campaign import Campaign, CampaignStatus
from app.models.client import Client
from app.models.client_reviewer import ClientReviewer
from app.models.client_social_account import ClientSocialAccount
from app.models.content_version import ContentVersion
from app.models.deliverable import Deliverable, DeliverableStatus
from app.models.publication_job import JobStatus, PublicationJob
from app.models.task import Task, TaskPriority, TaskStatus
from app.models.user import User
from tests.conftest import TestSessionLocal, _make_token


@pytest.fixture
async def setup_portal_autoschedule_hierarchy(agency_a_data):
    """Sets up an agency, client, active social accounts, campaigns, deliverables, and a client reviewer."""
    user_a, agency = agency_a_data

    async with TestSessionLocal() as db:
        # 1. Client
        client = Client(
            id=uuid.uuid4(),
            agency_id=agency.id,
            business_name="Nexus Technologies",
            industry="enterprise_software",
            status="active",
        )
        db.add(client)
        await db.flush()

        # 2. Client Social Accounts (Instagram + Facebook)
        ig_account = ClientSocialAccount(
            id=uuid.uuid4(),
            client_id=client.id,
            platform="instagram",
            account_name="nexustech_official",
            instagram_business_id="ig_biz_99901",
            access_token="encrypted_ig_token",
            is_active=True,
        )
        fb_account = ClientSocialAccount(
            id=uuid.uuid4(),
            client_id=client.id,
            platform="facebook",
            account_name="Nexus Tech Enterprise",
            facebook_page_id="fb_page_88801",
            access_token="encrypted_fb_token",
            is_active=True,
        )
        db.add_all([ig_account, fb_account])

        # 3. Client Reviewer User
        reviewer_user = User(
            id=uuid.uuid4(),
            email=f"reviewer_{uuid.uuid4().hex[:6]}@nexustech.io",
            full_name="Jordan Brand Director",
            hashed_password="fakehashedpassword",
            is_active=True,
        )
        db.add(reviewer_user)
        await db.flush()

        reviewer_link = ClientReviewer(
            id=uuid.uuid4(),
            client_id=client.id,
            user_id=reviewer_user.id,
        )
        db.add(reviewer_link)

        # 4. Campaign
        campaign = Campaign(
            id=uuid.uuid4(),
            client_id=client.id,
            name="Q4 Enterprise Launch",
            status=CampaignStatus.in_production,
        )
        db.add(campaign)
        await db.flush()

        # 5. Deliverables with media versions
        target_planned = date.today() + timedelta(days=5)

        deliv1 = Deliverable(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            title="Product Vision Reel",
            deliverable_type="video",
            platform="instagram",
            planned_date=target_planned,
            status=DeliverableStatus.client_review,
        )
        db.add(deliv1)
        await db.flush()

        v1 = ContentVersion(
            id=uuid.uuid4(),
            deliverable_id=deliv1.id,
            version_number=1,
            caption="Next-generation workflow automation is here.",
            storage_key="test_assets/vision_reel.mp4",
            file_name="vision_reel.mp4",
            file_type="video/mp4",
            file_size_bytes=1048576,
            checksum_sha256="abc111",
            uploaded_by_id=user_a.id,
        )
        t1 = Task(
            id=uuid.uuid4(),
            deliverable_id=deliv1.id,
            title="Client Signoff - Reel",
            task_type="approval",
            status=TaskStatus.client_review,
            priority=TaskPriority.high,
        )
        db.add_all([v1, t1])

        # Deliverable 2: multi-platform post
        deliv2 = Deliverable(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            title="Platform Feature Infographic",
            deliverable_type="graphic",
            platform="both",
            planned_date=target_planned,
            status=DeliverableStatus.client_review,
        )
        db.add(deliv2)
        await db.flush()

        v2 = ContentVersion(
            id=uuid.uuid4(),
            deliverable_id=deliv2.id,
            version_number=1,
            caption="Transform enterprise collaboration.",
            storage_key="test_assets/infographic.jpg",
            file_name="infographic.jpg",
            file_type="image/jpeg",
            file_size_bytes=524288,
            checksum_sha256="abc222",
            uploaded_by_id=user_a.id,
        )
        t2 = Task(
            id=uuid.uuid4(),
            deliverable_id=deliv2.id,
            title="Client Signoff - Infographic",
            task_type="approval",
            status=TaskStatus.client_review,
            priority=TaskPriority.medium,
        )
        db.add_all([v2, t2])

        await db.commit()

        return {
            "agency": agency,
            "client": client,
            "reviewer_user": reviewer_user,
            "campaign": campaign,
            "deliv1": deliv1,
            "v1": v1,
            "deliv2": deliv2,
            "v2": v2,
            "ig_account": ig_account,
            "fb_account": fb_account,
        }


@pytest.mark.asyncio
async def test_portal_approval_auto_schedules_with_social_account(
    anon_client: AsyncClient,
    setup_portal_autoschedule_hierarchy,
):
    """
    When client reviewer approves a deliverable with connected active social accounts
    and an approved media asset, it transitions to `scheduled` and spawns a `PublicationJob`.
    """
    data = setup_portal_autoschedule_hierarchy
    token = _make_token(data["reviewer_user"].id)
    headers = {"Authorization": f"Bearer {token}"}

    deliv_id = str(data["deliv1"].id)
    ver_id = str(data["v1"].id)

    resp = await anon_client.post(
        f"/portal/deliverables/{deliv_id}/versions/{ver_id}/decision",
        json={"decision": "approved", "comment": "Looks phenomenal, cleared for release!"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["status"] == "scheduled"
    assert body["is_auto_scheduled"] is True
    assert body["scheduled_at"] is not None
    assert body["publishing_platform"] == "instagram"

    # Verify database state
    async with TestSessionLocal() as db:
        deliv = (await db.execute(select(Deliverable).where(Deliverable.id == data["deliv1"].id))).scalar_one()
        assert deliv.status == DeliverableStatus.scheduled
        assert deliv.scheduled_at is not None

        # Verify PublicationJob
        jobs = (
            await db.execute(select(PublicationJob).where(PublicationJob.deliverable_id == data["deliv1"].id))
        ).scalars().all()
        assert len(jobs) == 1
        job = jobs[0]
        assert job.status == JobStatus.scheduled
        assert job.platform == "instagram"
        assert job.client_social_account_id == data["ig_account"].id
        assert job.content_version_id == data["v1"].id
        assert job.caption_snapshot == "Next-generation workflow automation is here."

        # Verify task is approved
        tasks = (
            await db.execute(select(Task).where(Task.deliverable_id == data["deliv1"].id))
        ).scalars().all()
        for t in tasks:
            assert t.status == TaskStatus.approved


@pytest.mark.asyncio
async def test_portal_approval_without_social_account_gracefully_approves(
    anon_client: AsyncClient,
    setup_portal_autoschedule_hierarchy,
):
    """
    When a client approves a deliverable for which NO active social accounts exist,
    it transitions gracefully to `approved` without crashing or scheduling empty jobs.
    """
    data = setup_portal_autoschedule_hierarchy
    token = _make_token(data["reviewer_user"].id)
    headers = {"Authorization": f"Bearer {token}"}

    # Deactivate social accounts
    async with TestSessionLocal() as db:
        accounts = (
            await db.execute(select(ClientSocialAccount).where(ClientSocialAccount.client_id == data["client"].id))
        ).scalars().all()
        for a in accounts:
            a.is_active = False
        await db.commit()

    deliv_id = str(data["deliv1"].id)
    ver_id = str(data["v1"].id)

    resp = await anon_client.post(
        f"/portal/deliverables/{deliv_id}/versions/{ver_id}/decision",
        json={"decision": "approved", "comment": "Approved for agency manual dispatch."},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["status"] == "approved"
    assert body["is_auto_scheduled"] is False

    async with TestSessionLocal() as db:
        deliv = (await db.execute(select(Deliverable).where(Deliverable.id == data["deliv1"].id))).scalar_one()
        assert deliv.status == DeliverableStatus.approved

        jobs = (
            await db.execute(
                select(PublicationJob).where(
                    PublicationJob.deliverable_id == data["deliv1"].id,
                    PublicationJob.status == JobStatus.scheduled,
                )
            )
        ).scalars().all()
        assert len(jobs) == 0


@pytest.mark.asyncio
async def test_portal_changes_requested_cancels_scheduled_jobs(
    anon_client: AsyncClient,
    setup_portal_autoschedule_hierarchy,
):
    """
    If a deliverable was scheduled, requesting changes cancels pending publication jobs
    and clears scheduled_at timestamp.
    """
    data = setup_portal_autoschedule_hierarchy
    token = _make_token(data["reviewer_user"].id)
    headers = {"Authorization": f"Bearer {token}"}

    deliv_id = str(data["deliv1"].id)
    ver_id = str(data["v1"].id)

    # 1. First approve (auto-schedules)
    await anon_client.post(
        f"/portal/deliverables/{deliv_id}/versions/{ver_id}/decision",
        json={"decision": "approved"},
        headers=headers,
    )

    # 2. Then client decides to request revision
    resp = await anon_client.post(
        f"/portal/deliverables/{deliv_id}/versions/{ver_id}/decision",
        json={"decision": "changes_requested", "comment": "Need to update logo on title slide."},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["status"] == "changes_requested"
    assert body["scheduled_at"] is None

    # Check jobs cancelled
    async with TestSessionLocal() as db:
        deliv = (await db.execute(select(Deliverable).where(Deliverable.id == data["deliv1"].id))).scalar_one()
        assert deliv.status == DeliverableStatus.changes_requested
        assert deliv.scheduled_at is None

        jobs = (
            await db.execute(select(PublicationJob).where(PublicationJob.deliverable_id == data["deliv1"].id))
        ).scalars().all()
        for j in jobs:
            assert j.status == JobStatus.cancelled


@pytest.mark.asyncio
async def test_portal_batch_decision_sprint_approval(
    anon_client: AsyncClient,
    setup_portal_autoschedule_hierarchy,
):
    """
    Client reviewer executes batch approval for all sprint deliverables in a single click:
    both items are auto-scheduled, creating publication jobs according to their platforms.
    """
    data = setup_portal_autoschedule_hierarchy
    token = _make_token(data["reviewer_user"].id)
    headers = {"Authorization": f"Bearer {token}"}

    d1_id = str(data["deliv1"].id)
    d2_id = str(data["deliv2"].id)

    resp = await anon_client.post(
        "/portal/deliverables/batch-decision",
        json={
            "deliverable_ids": [d1_id, d2_id],
            "decision": "approved",
            "comment": "Batch approved entire sprint deliverables.",
        },
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["total_processed"] == 2
    assert body["scheduled_count"] == 2
    assert body["approved_count"] == 0
    assert len(body["deliverables"]) == 2

    async with TestSessionLocal() as db:
        # Deliverable 1 has 1 job (instagram)
        jobs1 = (
            await db.execute(
                select(PublicationJob).where(
                    PublicationJob.deliverable_id == data["deliv1"].id,
                    PublicationJob.status == JobStatus.scheduled,
                )
            )
        ).scalars().all()
        assert len(jobs1) == 1

        # Deliverable 2 has platform="both" -> creates 2 jobs (instagram & facebook)
        jobs2 = (
            await db.execute(
                select(PublicationJob).where(
                    PublicationJob.deliverable_id == data["deliv2"].id,
                    PublicationJob.status == JobStatus.scheduled,
                )
            )
        ).scalars().all()
        assert len(jobs2) == 2
        plats = {j.platform for j in jobs2}
        assert plats == {"instagram", "facebook"}


@pytest.mark.asyncio
async def test_portal_strict_reviewer_client_isolation(
    anon_client: AsyncClient,
    agency_b_data,
    setup_portal_autoschedule_hierarchy,
):
    """
    Strict Tenant Isolation:
    Reviewer for Client A cannot approve or batch-approve deliverables for Client B.
    """
    data_a = setup_portal_autoschedule_hierarchy
    user_b, agency_b = agency_b_data

    # Create Client B and Deliverable B in Agency B
    async with TestSessionLocal() as db:
        client_b = Client(
            id=uuid.uuid4(),
            agency_id=agency_b.id,
            business_name="Unrelated Global Ltd",
            industry="aerospace",
            status="active",
        )
        db.add(client_b)
        await db.flush()

        camp_b = Campaign(
            id=uuid.uuid4(),
            client_id=client_b.id,
            name="Q4 Aerospace Campaign",
            status=CampaignStatus.in_production,
        )
        db.add(camp_b)
        await db.flush()

        deliv_b = Deliverable(
            id=uuid.uuid4(),
            campaign_id=camp_b.id,
            title="Satellite Launch Reel",
            deliverable_type="video",
            platform="instagram",
            status=DeliverableStatus.client_review,
        )
        db.add(deliv_b)
        await db.flush()

        ver_b = ContentVersion(
            id=uuid.uuid4(),
            deliverable_id=deliv_b.id,
            version_number=1,
            storage_key="test/sat.mp4",
            file_name="sat.mp4",
            checksum_sha256="sat123",
            uploaded_by_id=user_b.id,
        )
        db.add(ver_b)
        await db.commit()

        deliv_b_id = str(deliv_b.id)
        ver_b_id = str(ver_b.id)

    # Use Client A's reviewer token to attempt deciding on Client B's deliverable
    token_a = _make_token(data_a["reviewer_user"].id)
    headers_a = {"Authorization": f"Bearer {token_a}"}

    single_resp = await anon_client.post(
        f"/portal/deliverables/{deliv_b_id}/versions/{ver_b_id}/decision",
        json={"decision": "approved"},
        headers=headers_a,
    )
    assert single_resp.status_code == 404

    # Batch attempt mixing Client A's deliverable and Client B's deliverable
    batch_resp = await anon_client.post(
        "/portal/deliverables/batch-decision",
        json={
            "deliverable_ids": [str(data_a["deliv1"].id), deliv_b_id],
            "decision": "approved",
        },
        headers=headers_a,
    )
    assert batch_resp.status_code == 403
