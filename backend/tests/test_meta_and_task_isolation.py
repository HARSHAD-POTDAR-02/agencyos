import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.client import Client
from app.models.campaign import Campaign
from app.models.deliverable import Deliverable, DeliverableStatus
from app.models.task import Task, TaskStatus
from app.models.content_version import ContentVersion
from app.models.client_social_account import ClientSocialAccount
from tests.conftest import TestSessionLocal


@pytest.mark.asyncio
async def test_task_approval_isolation_on_client_approval(agency_a_client: AsyncClient, agency_a_data):
    """
    Test 1: When a client approves a deliverable version, ONLY the approval/review task
    is marked as approved. Scripting, filming, and editing tasks must NOT be prematurely approved.
    """
    user_a, agency = agency_a_data

    async with TestSessionLocal() as db:
        client = Client(id=uuid.uuid4(), agency_id=agency.id, business_name="Hotel Maratha")
        campaign = Campaign(id=uuid.uuid4(), client_id=client.id, name="Winter Reels")
        deliverable = Deliverable(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            title="Thali Special Reel",
            deliverable_type="reel",
            platform="instagram",
            status=DeliverableStatus.client_review,
        )
        task_script = Task(
            id=uuid.uuid4(),
            deliverable_id=deliverable.id,
            title="Scripting: Hook & Concept",
            task_type="scripting",
            status=TaskStatus.todo,
        )
        task_film = Task(
            id=uuid.uuid4(),
            deliverable_id=deliverable.id,
            title="Video Shooting / Asset Prep",
            task_type="filming",
            status=TaskStatus.backlog,
        )
        task_edit = Task(
            id=uuid.uuid4(),
            deliverable_id=deliverable.id,
            title="Video Editing & Sound Sync",
            task_type="editing",
            status=TaskStatus.in_progress,
        )
        task_review = Task(
            id=uuid.uuid4(),
            deliverable_id=deliverable.id,
            title="Internal & Client Review",
            task_type="approval",
            status=TaskStatus.client_review,
        )
        version = ContentVersion(
            id=uuid.uuid4(),
            deliverable_id=deliverable.id,
            version_number=1,
            storage_key="test/sample.mp4",
            file_name="sample.mp4",
            file_type="video/mp4",
            file_size_bytes=1024,
            checksum_sha256="abc123",
            uploaded_by_id=user_a.id,
        )
        db.add_all([client, campaign, deliverable, task_script, task_film, task_edit, task_review, version])
        await db.commit()

        deliv_id = str(deliverable.id)
        version_id = str(version.id)
        script_id = task_script.id
        film_id = task_film.id
        edit_id = task_edit.id
        review_id = task_review.id

    # Agency approves the version
    res = await agency_a_client.post(
        f"/agencies/{agency.id}/content-versions/{version_id}/approve",
        json={"decision": "approved", "comment": "Client loved the cut!"},
    )
    assert res.status_code == 201

    # Verify task statuses in DB
    async with TestSessionLocal() as db:
        tasks = (await db.execute(select(Task).where(Task.deliverable_id == uuid.UUID(deliv_id)))).scalars().all()
        task_map = {t.id: t for t in tasks}

        # ONLY the review/approval task should be approved
        assert task_map[review_id].status == TaskStatus.approved

        # Production tasks must maintain their actual progress and NOT be approved
        assert task_map[script_id].status == TaskStatus.todo
        assert task_map[film_id].status == TaskStatus.backlog
        assert task_map[edit_id].status == TaskStatus.in_progress


@pytest.mark.asyncio
async def test_task_media_scoping_and_upload(agency_a_client: AsyncClient, agency_a_data):
    """
    Test 2: Media uploaded with a task_id is scoped to that task and does NOT
    leak into other tasks.
    """
    user_a, agency = agency_a_data

    async with TestSessionLocal() as db:
        client = Client(id=uuid.uuid4(), agency_id=agency.id, business_name="Hotel Maratha")
        campaign = Campaign(id=uuid.uuid4(), client_id=client.id, name="Winter Reels")
        deliverable = Deliverable(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            title="Biryani Showcase",
            deliverable_type="reel",
            platform="instagram",
            status=DeliverableStatus.in_production,
        )
        task_script = Task(
            id=uuid.uuid4(),
            deliverable_id=deliverable.id,
            title="Scripting: Hook & Concept",
            task_type="scripting",
            status=TaskStatus.todo,
        )
        task_edit = Task(
            id=uuid.uuid4(),
            deliverable_id=deliverable.id,
            title="Video Editing & Sound Sync",
            task_type="editing",
            status=TaskStatus.todo,
        )
        db.add_all([client, campaign, deliverable, task_script, task_edit])
        await db.commit()

        deliv_id = str(deliverable.id)
        script_id = str(task_script.id)
        edit_id = str(task_edit.id)

    # 1. Upload a video scoped ONLY to Video Editing task
    video_content = b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 200
    res_upload = await agency_a_client.post(
        f"/agencies/{agency.id}/deliverables/{deliv_id}/versions",
        data={"caption": "Rough Cut #1", "task_id": edit_id},
        files={"file": ("edit_v1.mp4", video_content, "video/mp4")},
    )
    assert res_upload.status_code == 201
    upload_data = res_upload.json()
    assert upload_data["task_id"] == edit_id

    # 2. Query versions filtered for the Scripting task -> MUST BE EMPTY (no video leakage)
    res_script_versions = await agency_a_client.get(
        f"/agencies/{agency.id}/deliverables/{deliv_id}/versions?task_id={script_id}"
    )
    assert res_script_versions.status_code == 200
    assert len(res_script_versions.json()) == 0

    # 3. Query versions filtered for Video Editing -> returns the video
    res_edit_versions = await agency_a_client.get(
        f"/agencies/{agency.id}/deliverables/{deliv_id}/versions?task_id={edit_id}"
    )
    assert res_edit_versions.status_code == 200
    assert len(res_edit_versions.json()) == 1
    assert res_edit_versions.json()[0]["file_name"] == "edit_v1.mp4"


@pytest.mark.asyncio
async def test_dual_platform_both_publishing(agency_a_client: AsyncClient, agency_a_data, monkeypatch):
    """
    Test 3: Publishing to platform='both' publishes to both platforms, or handles partial success
    if one platform succeeds and the other fails, informing the user.
    """
    user_a, agency = agency_a_data

    async with TestSessionLocal() as db:
        client = Client(id=uuid.uuid4(), agency_id=agency.id, business_name="Hotel Maratha")
        campaign = Campaign(id=uuid.uuid4(), client_id=client.id, name="Winter Reels")
        deliverable = Deliverable(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            title="Grand Opening Reel",
            deliverable_type="reel",
            platform="both",
            status=DeliverableStatus.approved,
        )
        version = ContentVersion(
            id=uuid.uuid4(),
            deliverable_id=deliverable.id,
            version_number=1,
            storage_key="test/reel.mp4",
            file_name="reel.mp4",
            file_type="video/mp4",
            checksum_sha256="xyz789",
            uploaded_by_id=user_a.id,
        )
        ig_acc = ClientSocialAccount(
            id=uuid.uuid4(),
            client_id=client.id,
            platform="instagram",
            instagram_business_id="ig_12345",
            access_token="fake_ig_token",
            is_active=True,
        )
        fb_acc = ClientSocialAccount(
            id=uuid.uuid4(),
            client_id=client.id,
            platform="facebook",
            facebook_page_id="fb_page_67890",
            access_token="fake_fb_token",
            is_active=True,
        )
        db.add_all([client, campaign, deliverable, version, ig_acc, fb_acc])
        await db.commit()
        deliv_id = str(deliverable.id)

    # Mock Instagram to fail, Facebook to succeed
    async def mock_ig_fail(*args, **kwargs):
        from app.services.meta_publisher import MetaPublishingError
        raise MetaPublishingError("Instagram rate limited")

    async def mock_fb_success(*args, **kwargs):
        return {
            "post_id": "fb_post_999",
            "permalink": "https://www.facebook.com/watch/?v=999",
            "platform": "facebook",
        }

    monkeypatch.setattr("app.routers.publishing.publish_instagram_reel", mock_ig_fail)
    monkeypatch.setattr("app.routers.publishing.publish_facebook_page_post", mock_fb_success)

    pub_res = await agency_a_client.post(
        f"/agencies/{agency.id}/deliverables/{deliv_id}/publish",
        json={"mode": "automated", "platform": "both"},
    )
    assert pub_res.status_code == 200
    data = pub_res.json()
    assert data["success"] is True
    assert data["platform"] == "both"
    assert "Facebook Page successfully" in data["message"]
    assert "Instagram failed" in data["message"]
    assert data["platform_results"]["facebook"]["success"] is True
    assert data["platform_results"]["instagram"]["success"] is False
