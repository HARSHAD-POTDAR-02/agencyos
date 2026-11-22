import uuid
import pytest
from httpx import AsyncClient

from app.models.agency import Agency
from app.models.campaign import Campaign
from app.models.client import Client
from app.models.content_version import ContentVersion
from app.models.deliverable import Deliverable, DeliverableStatus
from app.models.task import Task, TaskStatus
from tests.conftest import TestSessionLocal


@pytest.mark.asyncio
async def test_magic_link_review_room_lifecycle(
    agency_a_client: AsyncClient,
    agency_a_data,
):
    """
    End-to-end verification of Track 6 Magic-Link Zero-Login Review Room:
    1. Agency generates tokenized review link.
    2. Client views review room without login headers (verifies views_count increment).
    3. Client leaves timestamped feedback comment.
    4. Client confirms one-tap approval.
    5. Verifies deliverable & task statuses transition to approved.
    6. Agency revokes token, verifying public access is blocked.
    """
    user_a, agency = agency_a_data

    async with TestSessionLocal() as db:
        client = Client(id=uuid.uuid4(), agency_id=agency.id, business_name="Vortex Tech")
        db.add(client)
        await db.flush()

        camp = Campaign(
            id=uuid.uuid4(),
            client_id=client.id,
            name="Q4 Growth Campaign",
        )
        db.add(camp)
        await db.flush()

        deliv = Deliverable(
            id=uuid.uuid4(),
            campaign_id=camp.id,
            title="SaaS Product Launch Reel",
            deliverable_type="reel",
            platform="instagram",
            status=DeliverableStatus.client_review,
        )
        db.add(deliv)
        await db.flush()

        # Add Content Version
        cv = ContentVersion(
            id=uuid.uuid4(),
            deliverable_id=deliv.id,
            version_number=1,
            storage_key="test_video_v1.mp4",
            file_name="product_launch_v1.mp4",
            file_type="video/mp4",
            file_size_bytes=1048576,
            checksum_sha256="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            caption="Transform your agency operations with AI #AgencyOS",
            notes="V1 rough cut for client review.",
            uploaded_by_id=user_a.id,
        )
        # Add Sibling Tasks
        task1 = Task(
            id=uuid.uuid4(),
            deliverable_id=deliv.id,
            title="Scriptwriting",
            task_type="scripting",
            status=TaskStatus.internal_review,
            script_blocks=[
                {"id": "s1", "title": "Scene 1: Hook", "spoken_words": "Stop wasting budget.", "duration_seconds": 4}
            ],
            assignee_id=user_a.id,
        )
        task2 = Task(
            id=uuid.uuid4(),
            deliverable_id=deliv.id,
            title="Video Editing",
            task_type="editing",
            status=TaskStatus.internal_review,
            assignee_id=user_a.id,
        )
        db.add_all([cv, task1, task2])
        await db.commit()

        agency_id = str(agency.id)
        deliv_id = str(deliv.id)

    # 1. Agency generates magic review link
    gen_res = await agency_a_client.post(
        f"/agencies/{agency_id}/deliverables/{deliv_id}/review-token"
    )
    assert gen_res.status_code == 200, gen_res.text
    token_data = gen_res.json()
    assert "token" in token_data
    token = token_data["token"]
    assert token.startswith("rvw_")
    assert token_data["is_active"] is True
    assert token_data["views_count"] == 0

    # Idempotent call returns existing active token
    gen_again = await agency_a_client.post(
        f"/agencies/{agency_id}/deliverables/{deliv_id}/review-token"
    )
    assert gen_again.status_code == 200
    assert gen_again.json()["token"] == token

    # 2. Public Client views review room (NO AUTH HEADERS!)
    # Create an unauthenticated client
    async with AsyncClient(transport=agency_a_client._transport, base_url="http://test") as public_client:
        pub_res = await public_client.get(f"/public/review/{token}")
        assert pub_res.status_code == 200, pub_res.text
        room_data = pub_res.json()
        assert room_data["title"] == "SaaS Product Launch Reel"
        assert room_data["client_name"] == "Vortex Tech"
        assert len(room_data["content_versions"]) == 1
        assert room_data["content_versions"][0]["file_name"] == "product_launch_v1.mp4"
        assert len(room_data["script_blocks"]) == 1
        assert room_data["views_count"] == 1

        # 3. Client posts timestamped feedback comment
        comment_res = await public_client.post(
            f"/public/review/{token}/comments",
            json={
                "author_name": "Sarah Jenkins",
                "message": "The transition here at 0:03 is too abrupt. Smooth the beat sync.",
                "timestamp_seconds": 3.2,
                "content_version_id": room_data["content_versions"][0]["id"],
            },
        )
        assert comment_res.status_code == 200, comment_res.text
        c_data = comment_res.json()
        assert c_data["author_name"] == "Sarah Jenkins"
        assert c_data["author_role"] == "client"
        assert c_data["timestamp_seconds"] == 3.2

        # 4. Client submits one-tap approval decision
        decision_res = await public_client.post(
            f"/public/review/{token}/decision",
            json={
                "decision": "approved",
                "reviewer_name": "Sarah Jenkins",
                "feedback_notes": "Awesome revision. Approved for live publishing!",
            },
        )
        assert decision_res.status_code == 200, decision_res.text
        dec_data = decision_res.json()
        assert dec_data["status"] == "approved"

    # 5. Verify deliverable & tasks updated in DB
    async with TestSessionLocal() as db:
        deliv_check = await db.get(Deliverable, uuid.UUID(deliv_id))
        assert deliv_check.status == DeliverableStatus.approved

        # Sibling tasks should be approved
        t1_check = await db.get(Task, task1.id)
        assert t1_check.status == TaskStatus.approved
        t2_check = await db.get(Task, task2.id)
        assert t2_check.status == TaskStatus.approved

    # 6. Agency revokes magic review token
    del_res = await agency_a_client.delete(
        f"/agencies/{agency_id}/deliverables/{deliv_id}/review-token"
    )
    assert del_res.status_code == 204

    # Subsequent public access should be rejected
    async with AsyncClient(transport=agency_a_client._transport, base_url="http://test") as public_client:
        revoked_res = await public_client.get(f"/public/review/{token}")
        assert revoked_res.status_code == 404
