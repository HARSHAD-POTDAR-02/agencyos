from __future__ import annotations

import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.agency import Agency
from app.models.brand_profile import BrandProfile
from app.models.campaign import Campaign
from app.models.client import Client
from app.models.deliverable import Deliverable
from app.models.task import Task, TaskPriority, TaskStatus
from app.models.user import RoleEnum, User
from app.services.taste_capture_service import (
    capture_cortex_taste_memory,
    get_client_taste_memory,
)
from tests.conftest import TestSessionLocal


@pytest.mark.asyncio
async def test_per_task_scoped_discussions(agency_a_client: AsyncClient, agency_a_data):
    """
    Track 5 - Feature 1: Per-Task Scoped Discussion & Revision Threads.
    Comments made on Task A must be strictly isolated to Task A and not leak into Task B.
    """
    user_a, agency = agency_a_data

    async with TestSessionLocal() as db:
        client = Client(id=uuid.uuid4(), agency_id=agency.id, business_name="Scoped Discussion Client")
        campaign = Campaign(id=uuid.uuid4(), client_id=client.id, name="Scoped Campaign")
        deliv = Deliverable(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            title="Scoped Deliverable",
            deliverable_type="reel",
            platform="instagram",
        )
        task_a = Task(
            id=uuid.uuid4(),
            agency_id=agency.id,
            deliverable_id=deliv.id,
            title="Scriptwriting Specialist Task",
            task_type="scripting",
            status=TaskStatus.in_progress,
        )
        task_b = Task(
            id=uuid.uuid4(),
            agency_id=agency.id,
            deliverable_id=deliv.id,
            title="Video Editing Specialist Task",
            task_type="editing",
            status=TaskStatus.todo,
        )
        db.add_all([client, campaign, deliv, task_a, task_b])
        await db.commit()
        task_a_id = str(task_a.id)
        task_b_id = str(task_b.id)

    # 1. Post comments to Task A
    post_res1 = await agency_a_client.post(
        f"/agencies/{agency.id}/tasks/{task_a_id}/comments",
        json={"message": "Script revision: Make the opening hook punchier under 10 words.", "is_internal": True},
    )
    assert post_res1.status_code == 201
    comm1 = post_res1.json()
    assert comm1["message"] == "Script revision: Make the opening hook punchier under 10 words."
    assert comm1["task_id"] == task_a_id

    post_res2 = await agency_a_client.post(
        f"/agencies/{agency.id}/tasks/{task_a_id}/comments",
        json={"message": "Writer: Updated Scene 1 hook per feedback.", "is_internal": True},
    )
    assert post_res2.status_code == 201

    # 2. Query comments for Task A -> exactly 2 comments
    list_a = await agency_a_client.get(f"/agencies/{agency.id}/tasks/{task_a_id}/comments")
    assert list_a.status_code == 200
    comments_a = list_a.json()
    assert len(comments_a) == 2
    assert all(c["task_id"] == task_a_id for c in comments_a)

    # 3. Query comments for Task B -> exactly 0 comments (strictly isolated)
    list_b = await agency_a_client.get(f"/agencies/{agency.id}/tasks/{task_b_id}/comments")
    assert list_b.status_code == 200
    comments_b = list_b.json()
    assert len(comments_b) == 0

    # 4. Check Task Detail endpoint includes task_comments
    detail_a = await agency_a_client.get(f"/agencies/{agency.id}/tasks/{task_a_id}")
    assert detail_a.status_code == 200
    detail_data = detail_a.json()
    assert "task_comments" in detail_data
    assert len(detail_data["task_comments"]) == 2


@pytest.mark.asyncio
async def test_standalone_operational_tasks(agency_a_client: AsyncClient, agency_a_data):
    """
    Track 5 - Feature 2: Standalone Operational Tasks (Phase 2 Schema Migration).
    Allows creating operational tasks without deliverable_id (e.g. Client Onboarding, Brand Audit).
    """
    user_a, agency = agency_a_data

    async with TestSessionLocal() as db:
        client = Client(id=uuid.uuid4(), agency_id=agency.id, business_name="Operations Client")
        db.add(client)
        await db.commit()
        client_id = str(client.id)

    # 1. Create Standalone Operational Task directly via agency endpoint
    payload = {
        "title": "Q4 Brand Strategy & Operational Audit",
        "task_type": "operational",
        "is_operational": True,
        "client_id": client_id,
        "priority": "high",
        "notes": "Comprehensive agency brand review and strategy session.",
    }
    create_res = await agency_a_client.post(
        f"/agencies/{agency.id}/tasks",
        json=payload,
    )
    assert create_res.status_code == 201
    task_data = create_res.json()
    task_id = task_data["id"]
    assert task_data["is_operational"] is True
    assert task_data["deliverable_id"] is None
    assert task_data["client_id"] == client_id
    assert task_data["is_locked"] is False

    # 2. Filter tasks by stage="operational" or is_operational=true
    ops_list = await agency_a_client.get(f"/agencies/{agency.id}/tasks?is_operational=true")
    assert ops_list.status_code == 200
    items = ops_list.json()
    assert any(it["id"] == task_id for it in items)

    # 3. Retrieve task detail: should initialize operational checklists and not be locked
    detail_res = await agency_a_client.get(f"/agencies/{agency.id}/tasks/{task_id}")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["is_operational"] is True
    assert detail["is_locked"] is False
    assert len(detail["checklists"]) > 0
    assert detail["checklists"][0]["stage"] == "operational"

    # 4. Submit text notes work on operational task
    sub_res = await agency_a_client.post(
        f"/agencies/{agency.id}/tasks/{task_id}/submissions",
        data={
            "submission_type": "script",
            "script_title": "Brand Audit Findings",
            "notes": "Completed initial brand guidelines and positioning audit.",
        },
    )
    assert sub_res.status_code == 201
    sub_data = sub_res.json()
    assert sub_data["task_id"] == task_id

    # 5. Review & approve operational task
    rev_res = await agency_a_client.post(
        f"/agencies/{agency.id}/tasks/{task_id}/review",
        json={"decision": "approved", "feedback_notes": "Great audit overview!"},
    )
    assert rev_res.status_code == 200
    rev_data = rev_res.json()
    assert rev_data["status"] == "approved"


@pytest.mark.asyncio
async def test_cortex_continuous_brand_memory_taste_capture(agency_a_client: AsyncClient, agency_a_data):
    """
    Track 5 - Feature 4: Cortex Continuous Brand Memory ("Taste Capture").
    Uses NVIDIA Nemotron to parse durable creative rules on manager rejection,
    and exposes client taste memory retrieval, manual additions, and deletions.
    """
    user_a, agency = agency_a_data

    async with TestSessionLocal() as db:
        client = Client(id=uuid.uuid4(), agency_id=agency.id, business_name="Taste Test Brand")
        db.add(client)
        await db.commit()
        client_id = str(client.id)

    # 1. Test manual addition of a taste rule
    manual_rule = {
        "category": "dont",
        "rule": "Never use neon yellow or comic sans fonts in overlays.",
        "reason": "Executive brand standard requires minimalist typography.",
    }
    add_res = await agency_a_client.post(
        f"/agencies/{agency.id}/clients/{client_id}/taste-memory",
        json=manual_rule,
    )
    assert add_res.status_code == 201
    created_rule = add_res.json()
    assert created_rule["category"] == "dont"
    assert created_rule["rule"] == manual_rule["rule"]
    rule_id = created_rule["id"]

    # 2. Retrieve taste memory
    get_res = await agency_a_client.get(f"/agencies/{agency.id}/clients/{client_id}/taste-memory")
    assert get_res.status_code == 200
    memory = get_res.json()
    assert len(memory) >= 1
    assert any(r["id"] == rule_id for r in memory)

    # 3. Test extraction with NVIDIA Nemotron via service
    async with TestSessionLocal() as db:
        new_rules = await capture_cortex_taste_memory(
            client_id=uuid.UUID(client_id),
            feedback_text="Please do not use corporate jargon or buzzwords like 'synergy'. Always keep the pacing brisk under 25 seconds and use warm cinematic color grading.",
            source="test_manager_review",
            db=db,
        )
        assert isinstance(new_rules, list)

    # 4. Delete the manual rule
    del_res = await agency_a_client.delete(f"/agencies/{agency.id}/clients/{client_id}/taste-memory/{rule_id}")
    assert del_res.status_code == 204

    # Verify rule was deleted
    get_after = await agency_a_client.get(f"/agencies/{agency.id}/clients/{client_id}/taste-memory")
    assert get_after.status_code == 200
    assert not any(r["id"] == rule_id for r in get_after.json())
