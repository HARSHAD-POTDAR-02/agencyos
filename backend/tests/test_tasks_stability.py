import uuid
from datetime import date, datetime, timedelta
import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.agency import Agency
from app.models.campaign import Campaign
from app.models.client import Client
from app.models.content_version import ContentVersion
from app.models.deliverable import Deliverable, DeliverableStatus
from app.models.task import Task, TaskPriority, TaskStatus
from app.models.user import Membership, RoleEnum, User
from tests.conftest import TestSessionLocal, _make_token
from app.main import app
from httpx import ASGITransport


@pytest.mark.asyncio
async def test_task_notes_large_text(agency_a_client: AsyncClient, agency_a_data):
    """
    Test 1: Task.notes supports large Text payloads (>2000 chars) without truncation.
    """
    user_a, agency = agency_a_data
    large_notes = "A" * 4500  # Exceeds old String(2000) ceiling

    async with TestSessionLocal() as db:
        client = Client(id=uuid.uuid4(), agency_id=agency.id, business_name="Text Scale Client")
        campaign = Campaign(id=uuid.uuid4(), client_id=client.id, name="Text Campaign")
        deliv = Deliverable(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            title="Long Brief Reel",
            deliverable_type="reel",
            platform="instagram",
        )
        task = Task(
            id=uuid.uuid4(),
            deliverable_id=deliv.id,
            title="Scripting with Huge Storyboard",
            task_type="scripting",
            status=TaskStatus.todo,
            notes=large_notes,
        )
        db.add_all([client, campaign, deliv, task])
        await db.commit()
        task_id = str(task.id)

    res = await agency_a_client.get(f"/agencies/{agency.id}/tasks/{task_id}")
    assert res.status_code == 200
    data = res.json()
    assert len(data["notes"]) == 4500
    assert data["notes"] == large_notes


@pytest.mark.asyncio
async def test_task_submissions_scoped_to_task_id(agency_a_client: AsyncClient, agency_a_data):
    """
    Test 2: ContentVersion submissions are filtered by task_id in _build_task_detail.
    """
    user_a, agency = agency_a_data

    async with TestSessionLocal() as db:
        client = Client(id=uuid.uuid4(), agency_id=agency.id, business_name="Scoping Client")
        campaign = Campaign(id=uuid.uuid4(), client_id=client.id, name="Scoping Campaign")
        deliv = Deliverable(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            title="Scoped Deliverable",
            deliverable_type="reel",
            platform="instagram",
        )
        task_script = Task(
            id=uuid.uuid4(),
            deliverable_id=deliv.id,
            title="Scripting Task",
            task_type="scripting",
            status=TaskStatus.todo,
        )
        task_edit = Task(
            id=uuid.uuid4(),
            deliverable_id=deliv.id,
            title="Editing Task",
            task_type="editing",
            status=TaskStatus.backlog,
        )
        # ContentVersion scoped to task_script
        cv_script = ContentVersion(
            id=uuid.uuid4(),
            deliverable_id=deliv.id,
            task_id=task_script.id,
            version_number=1,
            storage_key="test/script_v1.txt",
            file_name="script_v1.txt",
            file_type="text/plain",
            checksum_sha256="hash1",
            uploaded_by_id=user_a.id,
        )
        # ContentVersion scoped to task_edit
        cv_edit = ContentVersion(
            id=uuid.uuid4(),
            deliverable_id=deliv.id,
            task_id=task_edit.id,
            version_number=2,
            storage_key="test/edit_v2.mp4",
            file_name="edit_v2.mp4",
            file_type="video/mp4",
            checksum_sha256="hash2",
            uploaded_by_id=user_a.id,
        )
        db.add_all([client, campaign, deliv, task_script, task_edit, cv_script, cv_edit])
        await db.commit()
        script_task_id = str(task_script.id)
        edit_task_id = str(task_edit.id)

    # When querying task_script, only cv_script should appear
    res_script = await agency_a_client.get(f"/agencies/{agency.id}/tasks/{script_task_id}")
    assert res_script.status_code == 200
    sub_script = res_script.json()["submissions"]
    assert len(sub_script) == 1
    assert sub_script[0]["file_name"] == "script_v1.txt"

    # When querying task_edit, only cv_edit should appear
    res_edit = await agency_a_client.get(f"/agencies/{agency.id}/tasks/{edit_task_id}")
    assert res_edit.status_code == 200
    sub_edit = res_edit.json()["submissions"]
    assert len(sub_edit) == 1
    assert sub_edit[0]["file_name"] == "edit_v2.mp4"


@pytest.mark.asyncio
async def test_cross_tenant_assignee_blocked(agency_a_client: AsyncClient, agency_a_data, agency_b_data):
    """
    Test 3: Cross-tenant assignee injection is rejected with HTTP 400.
    """
    user_a, agency_a = agency_a_data
    user_b, agency_b = agency_b_data

    async with TestSessionLocal() as db:
        client = Client(id=uuid.uuid4(), agency_id=agency_a.id, business_name="Tenant Safe Client")
        campaign = Campaign(id=uuid.uuid4(), client_id=client.id, name="Security Campaign")
        deliv = Deliverable(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            title="Secured Reel",
            deliverable_type="reel",
            platform="instagram",
        )
        task = Task(
            id=uuid.uuid4(),
            deliverable_id=deliv.id,
            title="Security Check Task",
            task_type="scripting",
            status=TaskStatus.todo,
        )
        db.add_all([client, campaign, deliv, task])
        await db.commit()
        task_id = str(task.id)
        deliv_id = str(deliv.id)

    # 1. Reject cross-tenant assignee on PATCH update
    res_patch = await agency_a_client.patch(
        f"/agencies/{agency_a.id}/tasks/{task_id}",
        json={"assignee_id": str(user_b.id)},
    )
    assert res_patch.status_code == 400
    assert "Assignee does not belong to this agency" in res_patch.json()["detail"]

    # 2. Reject cross-tenant assignee on POST create
    res_create = await agency_a_client.post(
        f"/agencies/{agency_a.id}/deliverables/{deliv_id}/tasks",
        json={
            "title": "Malicious Assigned Task",
            "task_type": "editing",
            "assignee_id": str(user_b.id),
        },
    )
    assert res_create.status_code == 400
    assert "Assignee does not belong to this agency" in res_create.json()["detail"]


@pytest.mark.asyncio
async def test_role_restriction_on_task_approval(agency_a_data):
    """
    Test 4: Non-manager specialists cannot mark tasks as approved or done directly via PATCH.
    """
    user_owner, agency = agency_a_data

    async with TestSessionLocal() as db:
        # Create a specialist user with writer role
        specialist_user = User(
            id=uuid.uuid4(),
            email="specialist_writer@example.com",
            full_name="Sam Writer",
            hashed_password="fakehashpassword",
            is_active=True,
        )
        db.add(specialist_user)
        await db.flush()

        spec_membership = Membership(
            id=uuid.uuid4(),
            user_id=specialist_user.id,
            agency_id=agency.id,
            role=RoleEnum.writer,
        )
        db.add(spec_membership)

        client = Client(id=uuid.uuid4(), agency_id=agency.id, business_name="Role Check Client")
        campaign = Campaign(id=uuid.uuid4(), client_id=client.id, name="Role Campaign")
        deliv = Deliverable(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            title="Role Deliverable",
            deliverable_type="reel",
            platform="instagram",
        )
        task = Task(
            id=uuid.uuid4(),
            deliverable_id=deliv.id,
            title="Scripting Under Review",
            task_type="scripting",
            status=TaskStatus.internal_review,
        )
        db.add_all([client, campaign, deliv, task])
        await db.commit()
        task_id = str(task.id)
        writer_id = specialist_user.id

    # Create client authenticated as the specialist (writer)
    writer_token = _make_token(writer_id)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", headers={"Authorization": f"Bearer {writer_token}"}) as writer_client:
        # Writer attempts to mark task as approved directly
        res_forbidden = await writer_client.patch(
            f"/agencies/{agency.id}/tasks/{task_id}",
            json={"status": "approved"},
        )
        assert res_forbidden.status_code == 403
        assert "Only agency owners, managers, and account managers" in res_forbidden.json()["detail"]

    # Owner client marks task as approved -> succeeds
    owner_token = _make_token(user_owner.id)
    async with AsyncClient(transport=transport, base_url="http://test", headers={"Authorization": f"Bearer {owner_token}"}) as owner_client:
        res_ok = await owner_client.patch(
            f"/agencies/{agency.id}/tasks/{task_id}",
            json={"status": "approved"},
        )
        assert res_ok.status_code == 200
        assert res_ok.json()["status"] == "approved"


@pytest.mark.asyncio
async def test_downstream_task_unlocking_carousel(agency_a_client: AsyncClient, agency_a_data):
    """
    Test 5: Downstream unlocking properly transitions Carousel stages:
    copywriting -> design -> qa -> approval without stranding any tasks in backlog.
    """
    user_a, agency = agency_a_data

    async with TestSessionLocal() as db:
        client = Client(id=uuid.uuid4(), agency_id=agency.id, business_name="Carousel Client")
        campaign = Campaign(id=uuid.uuid4(), client_id=client.id, name="Carousel Sprint")
        deliv = Deliverable(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            title="Carousel 10 Tips",
            deliverable_type="carousel",
            platform="linkedin",
            status=DeliverableStatus.in_production,
        )
        t_copy = Task(
            id=uuid.uuid4(),
            deliverable_id=deliv.id,
            title="Copywriting",
            task_type="copywriting",
            status=TaskStatus.internal_review,
        )
        t_design = Task(
            id=uuid.uuid4(),
            deliverable_id=deliv.id,
            title="Visual Design",
            task_type="design",
            status=TaskStatus.backlog,
        )
        t_qa = Task(
            id=uuid.uuid4(),
            deliverable_id=deliv.id,
            title="Graphic QA",
            task_type="qa",
            status=TaskStatus.backlog,
        )
        t_appr = Task(
            id=uuid.uuid4(),
            deliverable_id=deliv.id,
            title="Approval Review",
            task_type="approval",
            status=TaskStatus.backlog,
        )
        db.add_all([client, campaign, deliv, t_copy, t_design, t_qa, t_appr])
        await db.commit()
        copy_id = str(t_copy.id)
        design_id = str(t_design.id)
        qa_id = str(t_qa.id)
        appr_id = str(t_appr.id)

    # 1. Approve copywriting -> unlocks design
    res1 = await agency_a_client.post(
        f"/agencies/{agency.id}/tasks/{copy_id}/review",
        json={"decision": "approved", "feedback_notes": "Great copy."},
    )
    assert res1.status_code == 200
    async with TestSessionLocal() as db:
        t_d = await db.get(Task, uuid.UUID(design_id))
        assert t_d.status == TaskStatus.todo  # UNLOCKED

    # 2. Approve design -> unlocks qa (Previously this was stranded!)
    res2 = await agency_a_client.post(
        f"/agencies/{agency.id}/tasks/{design_id}/review",
        json={"decision": "approved", "feedback_notes": "Clean layout."},
    )
    assert res2.status_code == 200
    async with TestSessionLocal() as db:
        t_q = await db.get(Task, uuid.UUID(qa_id))
        assert t_q.status == TaskStatus.todo  # UNLOCKED

    # 3. Approve qa -> unlocks approval task
    res3 = await agency_a_client.post(
        f"/agencies/{agency.id}/tasks/{qa_id}/review",
        json={"decision": "approved", "feedback_notes": "QA passed."},
    )
    assert res3.status_code == 200
    async with TestSessionLocal() as db:
        t_a = await db.get(Task, uuid.UUID(appr_id))
        assert t_a.status == TaskStatus.todo  # UNLOCKED

    # 4. Final approval -> deliverable reaches client_review / approved
    res4 = await agency_a_client.post(
        f"/agencies/{agency.id}/tasks/{appr_id}/review",
        json={"decision": "approved", "feedback_notes": "Ready for client."},
    )
    assert res4.status_code == 200
    async with TestSessionLocal() as db:
        d = await db.get(Deliverable, deliv.id)
        assert d.status in (DeliverableStatus.client_review, DeliverableStatus.approved)


@pytest.mark.asyncio
async def test_deliverable_status_aggregation_not_clobbered(agency_a_client: AsyncClient, agency_a_data):
    """
    Test 6: Completing Task 1 does NOT prematurely mark the parent deliverable as approved
    when sibling tasks are still pending.
    """
    user_a, agency = agency_a_data

    async with TestSessionLocal() as db:
        client = Client(id=uuid.uuid4(), agency_id=agency.id, business_name="Aggregation Client")
        campaign = Campaign(id=uuid.uuid4(), client_id=client.id, name="Aggregation Campaign")
        deliv = Deliverable(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            title="Multi-task Reel",
            deliverable_type="reel",
            platform="instagram",
            status=DeliverableStatus.not_started,
        )
        task_1 = Task(
            id=uuid.uuid4(),
            deliverable_id=deliv.id,
            title="Scripting",
            task_type="scripting",
            status=TaskStatus.todo,
        )
        task_2 = Task(
            id=uuid.uuid4(),
            deliverable_id=deliv.id,
            title="Video Shooting",
            task_type="filming",
            status=TaskStatus.backlog,
        )
        task_3 = Task(
            id=uuid.uuid4(),
            deliverable_id=deliv.id,
            title="Video Editing",
            task_type="editing",
            status=TaskStatus.backlog,
        )
        db.add_all([client, campaign, deliv, task_1, task_2, task_3])
        await db.commit()
        t1_id = str(task_1.id)
        deliv_id = deliv.id

    # Mark task_1 as done/approved by owner
    res = await agency_a_client.patch(
        f"/agencies/{agency.id}/tasks/{t1_id}",
        json={"status": "approved"},
    )
    assert res.status_code == 200

    # Deliverable status must NOT be approved; it must be in_production because task_2 and task_3 are pending!
    async with TestSessionLocal() as db:
        d = await db.get(Deliverable, deliv_id)
        assert d.status == DeliverableStatus.in_production
        assert d.status != DeliverableStatus.approved


@pytest.mark.asyncio
async def test_staggered_due_dates_in_campaign_export(agency_a_client: AsyncClient, agency_a_data):
    """
    Test 7: Tasks generated from campaign conversion have realistic staggered due dates.
    """
    user_a, agency = agency_a_data
    target_date = date.today() + timedelta(days=10)

    async with TestSessionLocal() as db:
        client = Client(id=uuid.uuid4(), agency_id=agency.id, business_name="Stagger Client")
        campaign = Campaign(
            id=uuid.uuid4(),
            client_id=client.id,
            name="Stagger Campaign",
            ai_plan_draft={
                "deliverables": [
                    {
                        "day_number": 1,
                        "title": "Lead Time Reel",
                        "format": "reel",
                        "platform": "instagram",
                        "planned_date": target_date.isoformat(),
                        "hook": "Stop wasting time",
                    }
                ]
            },
        )
        db.add_all([client, campaign])
        await db.commit()
        camp_id = str(campaign.id)

    # Convert campaign to tasks
    res = await agency_a_client.post(
        f"/agencies/{agency.id}/campaigns/{camp_id}/convert-to-tasks",
        json={"days": [1]},
    )
    assert res.status_code == 200
    assert res.json()["tasks_created"] == 4

    async with TestSessionLocal() as db:
        tasks = (
            await db.execute(
                select(Task)
                .join(Deliverable, Task.deliverable_id == Deliverable.id)
                .where(Deliverable.campaign_id == uuid.UUID(camp_id))
                .order_by(Task.due_date.asc())
            )
        ).scalars().all()

        assert len(tasks) == 4
        # Verify due dates are staggered sequentially:
        # Scripting (T-3), Shooting (T-2), Editing (T-1), Review (T)
        task_types = {t.task_type: t.due_date for t in tasks}
        assert task_types["scripting"] == target_date - timedelta(days=3)
        assert task_types["filming"] == target_date - timedelta(days=2)
        assert task_types["editing"] == target_date - timedelta(days=1)
        assert task_types["approval"] == target_date


@pytest.mark.asyncio
async def test_task_locking_blocks_premature_submission_and_advancement(
    agency_a_client: AsyncClient, agency_a_data
):
    """
    Test 8: Upstream prerequisite tasks lock downstream stages.
    Locked tasks cannot receive submissions and cannot be advanced to in_progress or review.
    """
    user_a, agency = agency_a_data

    async with TestSessionLocal() as db:
        client = Client(id=uuid.uuid4(), agency_id=agency.id, business_name="Lock Test Client")
        campaign = Campaign(id=uuid.uuid4(), client_id=client.id, name="Lock Test Campaign")
        deliv = Deliverable(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            title="Lock Test Deliverable",
            deliverable_type="reel",
            platform="instagram",
        )
        task_script = Task(
            id=uuid.uuid4(),
            deliverable_id=deliv.id,
            title="Scripting Hook & Scenes",
            task_type="scripting",
            status=TaskStatus.todo,
        )
        task_film = Task(
            id=uuid.uuid4(),
            deliverable_id=deliv.id,
            title="Raw Footage Shooting",
            task_type="filming",
            status=TaskStatus.backlog,
        )
        task_edit = Task(
            id=uuid.uuid4(),
            deliverable_id=deliv.id,
            title="Video Editing Cut",
            task_type="editing",
            status=TaskStatus.backlog,
        )
        db.add_all([client, campaign, deliv, task_script, task_film, task_edit])
        await db.commit()
        script_id = str(task_script.id)
        film_id = str(task_film.id)
        edit_id = str(task_edit.id)

    # 1. Check Task Detail for editing task: must be locked
    res = await agency_a_client.get(f"/agencies/{agency.id}/tasks/{edit_id}")
    assert res.status_code == 200
    edit_data = res.json()
    assert edit_data["is_locked"] is True
    assert "Waiting for 'Scripting Hook & Scenes'" in edit_data["locked_reason"]

    # 2. Check Agency Tasks list: editing task must show is_locked: True
    res_list = await agency_a_client.get(f"/agencies/{agency.id}/tasks")
    assert res_list.status_code == 200
    items = res_list.json()
    edit_item = next(it for it in items if it["id"] == edit_id)
    assert edit_item["is_locked"] is True
    assert edit_item["locked_reason"] is not None

    # 3. Attempting to submit work on locked editing task MUST return 400
    res_sub = await agency_a_client.post(
        f"/agencies/{agency.id}/tasks/{edit_id}/submissions",
        json={"notes": "Premature cut submission"},
    )
    assert res_sub.status_code == 400
    assert "This task is locked" in res_sub.json()["detail"]

    # 4. Attempting to advance status to in_progress on locked task MUST return 400
    res_patch = await agency_a_client.patch(
        f"/agencies/{agency.id}/tasks/{edit_id}",
        json={"status": "in_progress"},
    )
    assert res_patch.status_code == 400
    assert "Cannot advance locked task" in res_patch.json()["detail"]

    # 5. Now approve scripting and filming tasks
    await agency_a_client.patch(
        f"/agencies/{agency.id}/tasks/{script_id}",
        json={"status": "approved"},
    )
    await agency_a_client.patch(
        f"/agencies/{agency.id}/tasks/{film_id}",
        json={"status": "approved"},
    )

    # 6. Check editing task again: now all upstream are approved, task should unlock!
    res_unlocked = await agency_a_client.get(f"/agencies/{agency.id}/tasks/{edit_id}")
    assert res_unlocked.status_code == 200
    assert res_unlocked.json()["is_locked"] is False
    assert res_unlocked.json()["locked_reason"] is None

    # 7. Advancing status is now allowed!
    res_patch_ok = await agency_a_client.patch(
        f"/agencies/{agency.id}/tasks/{edit_id}",
        json={"status": "in_progress"},
    )
    assert res_patch_ok.status_code == 200
    assert res_patch_ok.json()["status"] == "in_progress"


@pytest.mark.asyncio
async def test_create_and_delete_agency_task_with_role_enforcement(
    agency_a_client: AsyncClient, agency_a_data
):
    """
    Test 9: Manual task creation and role-restricted deletion.
    - Managers/Owners can create tasks directly via POST /agencies/{agency_id}/tasks.
    - Specialists cannot delete tasks (403 Forbidden).
    - Managers/Owners can delete tasks (204 No Content), removing task and associated records.
    """
    user_a, agency = agency_a_data

    async with TestSessionLocal() as db:
        client = Client(id=uuid.uuid4(), agency_id=agency.id, business_name="Manual Ops Client")
        campaign = Campaign(id=uuid.uuid4(), client_id=client.id, name="Manual Ops Campaign")
        deliv = Deliverable(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            title="Manual Task Deliverable",
            deliverable_type="reel",
            platform="instagram",
        )
        # Specialist user (writer)
        writer_user = User(
            id=uuid.uuid4(),
            email="writer_ops@agencyos.test",
            hashed_password="pw",
            full_name="Writer Ops",
        )
        writer_mem = Membership(
            id=uuid.uuid4(),
            user_id=writer_user.id,
            agency_id=agency.id,
            role=RoleEnum.writer,
        )
        db.add_all([client, campaign, deliv, writer_user, writer_mem])
        await db.commit()
        deliv_id = str(deliv.id)
        writer_id = str(writer_user.id)

    # 1. Create a task directly via POST /agencies/{agency_id}/tasks
    create_res = await agency_a_client.post(
        f"/agencies/{agency.id}/tasks",
        json={
            "deliverable_id": deliv_id,
            "title": "Ad-Hoc Scene Rewrite",
            "task_type": "scripting",
            "status": "todo",
            "priority": "high",
            "assignee_id": writer_id,
            "notes": "Fast-turnaround scene rewrite requested by client",
        },
    )
    assert create_res.status_code == 201
    created_task = create_res.json()
    assert created_task["title"] == "Ad-Hoc Scene Rewrite"
    assert created_task["deliverable_id"] == deliv_id
    assert created_task["status"] == "todo"
    task_id = created_task["id"]

    # 2. Test specialist attempt to delete task -> 403 Forbidden
    writer_token = _make_token(uuid.UUID(writer_id))
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as writer_client:
        res_del_unauth = await writer_client.delete(
            f"/agencies/{agency.id}/tasks/{task_id}",
            headers={"Authorization": f"Bearer {writer_token}"},
        )
        assert res_del_unauth.status_code == 403
        assert "Only agency owners, managers, and account managers" in res_del_unauth.json()["detail"]

    # 3. Owner/manager deletes task -> 204 No Content
    res_del_ok = await agency_a_client.delete(f"/agencies/{agency.id}/tasks/{task_id}")
    assert res_del_ok.status_code == 204

    # 4. Confirm task no longer exists -> 404 Not Found
    res_get = await agency_a_client.get(f"/agencies/{agency.id}/tasks/{task_id}")
    assert res_get.status_code == 404


@pytest.mark.asyncio
async def test_task_ai_specialist_assistant(agency_a_client: AsyncClient, agency_a_data):
    """
    Test 10: In-Task AI Specialist Assistant returns structured creative critique,
    recommended hook, expanded dialogue script, and 3 hook variations.
    """
    user_a, agency = agency_a_data

    async with TestSessionLocal() as db:
        client = Client(
            id=uuid.uuid4(),
            agency_id=agency.id,
            business_name="Quantum Fit",
        )
        campaign = Campaign(
            id=uuid.uuid4(),
            client_id=client.id,
            name="Q4 Fitness Blast",
            objective="Drive high gym membership signups",
        )
        deliv = Deliverable(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            title="High Intensity Workout Reel",
            deliverable_type="reel",
            platform="instagram",
        )
        task = Task(
            id=uuid.uuid4(),
            deliverable_id=deliv.id,
            title="Draft Workout Script",
            task_type="scripting",
            status=TaskStatus.todo,
        )
        db.add_all([client, campaign, deliv, task])
        await db.commit()
        task_id = str(task.id)

    # Call AI assist endpoint
    res = await agency_a_client.post(
        f"/agencies/{agency.id}/tasks/{task_id}/ai-assist",
        json={
            "instruction": "Audit hook for retention and generate 3 variations",
            "current_hook": "Workout with us today",
            "current_script": "Scene 1: Show dumbbell workout. Scene 2: Call to action.",
            "task_type": "scripting",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert "agent_name" in data
    assert "Lead Content Architect" in data["agent_name"] or "Creative Director" in data["agent_name"]
    assert "critique" in data and len(data["critique"]) > 0
    assert "recommended_hook" in data and len(data["recommended_hook"]) > 0
    assert "recommended_script" in data and len(data["recommended_script"]) > 0
    assert "hook_variations" in data and len(data["hook_variations"]) == 3
