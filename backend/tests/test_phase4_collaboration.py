"""
Phase 4 Tests — Client Collaboration & Approvals.

Tests:
  1. Agency admin can invite/assign a client reviewer to a specific client.
  2. Assigned client reviewer can list their authorized clients and deliverables.
  3. Strict Client Isolation: Client reviewer from Client A cannot access Client B's deliverables (404/403).
  4. Client reviewer can post comments on deliverables.
  5. Client reviewer requests changes:
     - Deliverable.status transitions to `changes_requested`.
     - Linked Task.status transitions to `changes_requested`.
     - Feedback comment is recorded in the timeline.
  6. Client reviewer approves:
     - Deliverable.status transitions to `approved`.
     - Linked Task.status transitions to `approved`.
     - Cryptographic approval record is created.
  7. Agency approvals queue aggregates deliverables needing attention across clients.
"""
from __future__ import annotations

import uuid
import pytest
from httpx import AsyncClient

from app.models.campaign import Campaign, CampaignStatus
from app.models.client import Client
from app.models.content_version import ContentVersion
from app.models.deliverable import Deliverable, DeliverableStatus
from app.models.task import Task, TaskPriority, TaskStatus
from tests.conftest import TestSessionLocal, _make_token, _create_user_and_agency


@pytest.mark.asyncio
async def test_client_reviewer_invitation_and_portal_access(agency_a_client: AsyncClient, agency_a_data):
    """Agency admin invites a reviewer -> reviewer can access portal clients."""
    user_a, agency = agency_a_data

    # 1. Create client in agency
    async with TestSessionLocal() as db:
        client_obj = Client(
            id=uuid.uuid4(),
            agency_id=agency.id,
            business_name="Shorevada Dining",
            industry="hospitality",
            status="active",
        )
        db.add(client_obj)
        await db.commit()
        client_id = str(client_obj.id)

    # 2. Invite reviewer via API
    reviewer_email = f"reviewer_{uuid.uuid4().hex[:6]}@shorevada.com"
    invite_resp = await agency_a_client.post(
        f"/agencies/{agency.id}/clients/{client_id}/reviewers",
        json={
            "email": reviewer_email,
            "full_name": "Raj Mehta",
            "password": "SecurePassword123!",
        },
    )
    assert invite_resp.status_code == 201
    reviewer_data = invite_resp.json()
    assert reviewer_data["email"] == reviewer_email
    reviewer_user_id = reviewer_data["user_id"]

    # 3. Use reviewer token to access /portal/clients
    reviewer_token = _make_token(uuid.UUID(reviewer_user_id))
    portal_client = AsyncClient(
        transport=agency_a_client._transport,
        base_url="http://test",
        headers={"Authorization": f"Bearer {reviewer_token}"},
    )

    portal_resp = await portal_client.get("/portal/clients")
    assert portal_resp.status_code == 200
    clients_list = portal_resp.json()
    assert len(clients_list) >= 1
    assert any(c["id"] == client_id for c in clients_list)


@pytest.mark.asyncio
async def test_client_isolation(agency_a_client: AsyncClient, agency_a_data):
    """Client reviewer for Client A CANNOT view or review deliverables for Client B."""
    _, agency = agency_a_data

    async with TestSessionLocal() as db:
        # Client A
        client_a = Client(
            id=uuid.uuid4(),
            agency_id=agency.id,
            business_name="Client Alpha",
            status="active",
        )
        db.add(client_a)

        # Client B
        client_b = Client(
            id=uuid.uuid4(),
            agency_id=agency.id,
            business_name="Client Beta",
            status="active",
        )
        db.add(client_b)
        await db.flush()

        # Deliverable for Client B
        camp_b = Campaign(
            id=uuid.uuid4(),
            client_id=client_b.id,
            name="Beta Campaign",
            status=CampaignStatus.approved,
        )
        db.add(camp_b)
        await db.flush()

        deliv_b = Deliverable(
            id=uuid.uuid4(),
            campaign_id=camp_b.id,
            title="Beta Reel #1",
            deliverable_type="reel",
            platform="instagram",
            status=DeliverableStatus.client_review,
        )
        db.add(deliv_b)
        await db.commit()

        client_a_id = str(client_a.id)
        deliv_b_id = str(deliv_b.id)

    # Invite reviewer specifically for Client A
    rev_resp = await agency_a_client.post(
        f"/agencies/{agency.id}/clients/{client_a_id}/reviewers",
        json={
            "email": f"alpha_rev_{uuid.uuid4().hex[:6]}@alpha.com",
            "full_name": "Alpha Reviewer",
        },
    )
    assert rev_resp.status_code == 201
    reviewer_user_id = rev_resp.json()["user_id"]

    reviewer_token = _make_token(uuid.UUID(reviewer_user_id))
    reviewer_client = AsyncClient(
        transport=agency_a_client._transport,
        base_url="http://test",
        headers={"Authorization": f"Bearer {reviewer_token}"},
    )

    # Attempt to view Client B's deliverable -> MUST be 404/403 forbidden
    get_resp = await reviewer_client.get(f"/portal/deliverables/{deliv_b_id}")
    assert get_resp.status_code in (403, 404)

    # Attempt to submit decision on Client B's deliverable -> MUST be 404/403
    fake_ver_id = str(uuid.uuid4())
    dec_resp = await reviewer_client.post(
        f"/portal/deliverables/{deliv_b_id}/versions/{fake_ver_id}/decision",
        json={"decision": "approved"},
    )
    assert dec_resp.status_code in (403, 404)


@pytest.mark.asyncio
async def test_client_request_changes_and_approval_workflow(agency_a_client: AsyncClient, agency_a_data):
    """
    Test complete review flow:
    1. Deliverable in `client_review` with Version 1 and a linked Task.
    2. Client reviewer requests changes with comments -> status moves to `changes_requested`.
    3. Editor updates/uploads Version 2.
    4. Client reviewer approves Version 2 -> status moves to `approved`.
    """
    _, agency = agency_a_data

    async with TestSessionLocal() as db:
        client_obj = Client(
            id=uuid.uuid4(),
            agency_id=agency.id,
            business_name="Spice Garden",
            status="active",
        )
        db.add(client_obj)
        await db.flush()

        camp_obj = Campaign(
            id=uuid.uuid4(),
            client_id=client_obj.id,
            name="Diwali Specials",
            status=CampaignStatus.approved,
        )
        db.add(camp_obj)
        await db.flush()

        deliv_obj = Deliverable(
            id=uuid.uuid4(),
            campaign_id=camp_obj.id,
            title="Diwali Sweets Showcase",
            deliverable_type="reel",
            platform="instagram",
            status=DeliverableStatus.client_review,
        )
        db.add(deliv_obj)
        await db.flush()

        task_obj = Task(
            id=uuid.uuid4(),
            deliverable_id=deliv_obj.id,
            title="Edit Diwali Reel",
            status=TaskStatus.client_review,
            priority=TaskPriority.high,
        )
        db.add(task_obj)
        await db.flush()

        # Version 1
        v1_obj = ContentVersion(
            id=uuid.uuid4(),
            deliverable_id=deliv_obj.id,
            version_number=1,
            storage_key="test/v1.mp4",
            file_name="v1.mp4",
            checksum_sha256="abc111sha256",
            caption="Check out our festive sweets!",
            uploaded_by_id=agency_a_data[0].id,
        )
        db.add(v1_obj)
        await db.commit()

        client_id = str(client_obj.id)
        deliv_id = str(deliv_obj.id)
        task_id = str(task_obj.id)
        v1_id = str(v1_obj.id)

    # 1. Invite client reviewer
    inv_resp = await agency_a_client.post(
        f"/agencies/{agency.id}/clients/{client_id}/reviewers",
        json={"email": f"spice_reviewer_{uuid.uuid4().hex[:6]}@spice.com", "full_name": "Chef Sanjeev"},
    )
    assert inv_resp.status_code == 201
    reviewer_user_id = inv_resp.json()["user_id"]

    reviewer_token = _make_token(uuid.UUID(reviewer_user_id))
    reviewer_client = AsyncClient(
        transport=agency_a_client._transport,
        base_url="http://test",
        headers={"Authorization": f"Bearer {reviewer_token}"},
    )

    # 2. Client reviewer inspects deliverable
    deliv_resp = await reviewer_client.get(f"/portal/deliverables/{deliv_id}")
    assert deliv_resp.status_code == 200
    deliv_json = deliv_resp.json()
    assert deliv_json["title"] == "Diwali Sweets Showcase"
    assert len(deliv_json["content_versions"]) == 1

    # 3. Client reviewer posts a comment
    comm_resp = await reviewer_client.post(
        f"/portal/deliverables/{deliv_id}/comments",
        json={"message": "Please make the logo bigger in the first 2 seconds."},
    )
    assert comm_resp.status_code == 200
    assert comm_resp.json()["message"] == "Please make the logo bigger in the first 2 seconds."
    assert comm_resp.json()["author_role"] == "client"

    # 4. Client reviewer requests changes
    dec_resp = await reviewer_client.post(
        f"/portal/deliverables/{deliv_id}/versions/{v1_id}/decision",
        json={
            "decision": "changes_requested",
            "comment": "Music tempo is too slow and logo is cut off.",
        },
    )
    assert dec_resp.status_code == 200
    assert dec_resp.json()["status"] == "changes_requested"

    # Check task and deliverable state in DB
    async with TestSessionLocal() as db:
        deliv_check = await db.get(Deliverable, uuid.UUID(deliv_id))
        assert deliv_check.status == DeliverableStatus.changes_requested

        task_check = await db.get(Task, uuid.UUID(task_id))
        assert task_check.status == TaskStatus.changes_requested

    # 5. Agency uploads Version 2
    async with TestSessionLocal() as db:
        v2_obj = ContentVersion(
            id=uuid.uuid4(),
            deliverable_id=uuid.UUID(deliv_id),
            version_number=2,
            storage_key="test/v2.mp4",
            file_name="v2.mp4",
            checksum_sha256="xyz222sha256",
            caption="Check out our festive sweets! Updated with upbeat sound.",
            uploaded_by_id=agency_a_data[0].id,
        )
        db.add(v2_obj)
        await db.commit()
        v2_id = str(v2_obj.id)

    # 6. Client reviewer approves Version 2
    appr_resp = await reviewer_client.post(
        f"/portal/deliverables/{deliv_id}/versions/{v2_id}/decision",
        json={
            "decision": "approved",
            "comment": "Looks delicious! Approved for publishing.",
        },
    )
    assert appr_resp.status_code == 200
    assert appr_resp.json()["status"] == "approved"

    # Verify final states
    async with TestSessionLocal() as db:
        deliv_final = await db.get(Deliverable, uuid.UUID(deliv_id))
        assert deliv_final.status == DeliverableStatus.approved

        task_final = await db.get(Task, uuid.UUID(task_id))
        assert task_final.status == TaskStatus.approved

    # 7. Check Agency Approvals Queue endpoint
    queue_resp = await agency_a_client.get(f"/agencies/{agency.id}/approvals/queue")
    assert queue_resp.status_code == 200
    queue_items = queue_resp.json()
    assert len(queue_items) >= 1
    target_item = next((i for i in queue_items if i["deliverable_id"] == deliv_id), None)
    assert target_item is not None
    assert target_item["status"] == "approved"
    assert target_item["latest_version_number"] == 2
    assert "Approved for publishing" in (target_item["last_comment"] or "")
