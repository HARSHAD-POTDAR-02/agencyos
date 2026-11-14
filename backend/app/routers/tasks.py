from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.core.database import get_db
from app.dependencies import get_current_user, require_agency_member
from app.models.approval import Approval, ApprovalDecision
from app.models.campaign import Campaign
from app.models.client import Client
from app.models.comment import DeliverableComment
from app.models.content_version import ContentVersion
from app.models.deliverable import Deliverable, DeliverableStatus
from app.models.studio_artifact import StudioArtifactVersion, StudioExport
from app.models.task import Task, TaskPriority, TaskStatus
from app.models.user import Membership, RoleEnum, User
from app.schemas.comment import CommentOut
from app.schemas.task import (
    TaskContentVersionOut,
    TaskCreate,
    TaskDetailOut,
    TaskOut,
    TaskReviewDecision,
    TaskUpdate,
)
from app.services.storage_service import save_file, save_text_content
from app.services.tenant_service import assert_deliverable_belongs_to_agency

router = APIRouter(tags=["tasks"])


async def _build_task_detail(agency_id: uuid.UUID, task_id: uuid.UUID, db: AsyncSession) -> TaskDetailOut:
    stmt = (
        select(Task)
        .options(
            joinedload(Task.deliverable).joinedload(Deliverable.campaign).joinedload(Campaign.client),
            joinedload(Task.assignee),
        )
        .where(Task.id == task_id)
    )
    result = await db.execute(stmt)
    task = result.scalars().first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")

    deliverable = task.deliverable
    campaign = deliverable.campaign
    client = campaign.client
    if client.agency_id != agency_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this task.")

    # Get assignee role in this agency if assigned
    assignee_role = None
    if task.assignee_id:
        m_stmt = select(Membership.role).where(
            Membership.agency_id == agency_id,
            Membership.user_id == task.assignee_id,
        )
        assignee_role_val = await db.scalar(m_stmt)
        if assignee_role_val:
            assignee_role = (
                assignee_role_val.value
                if hasattr(assignee_role_val, "value")
                else str(assignee_role_val)
            )

    # Submissions (all ContentVersions for this deliverable)
    cv_stmt = (
        select(ContentVersion)
        .options(selectinload(ContentVersion.approval))
        .where(ContentVersion.deliverable_id == deliverable.id)
        .order_by(ContentVersion.version_number.asc())
    )
    cv_res = await db.execute(cv_stmt)
    versions = cv_res.scalars().all()

    submissions: list[TaskContentVersionOut] = []
    for cv in versions:
        item = TaskContentVersionOut.model_validate(cv)
        item.url = f"/uploads/{cv.storage_key}"
        if cv.approval:
            item.approval_status = (
                cv.approval.decision.value
                if hasattr(cv.approval.decision, "value")
                else str(cv.approval.decision)
            )
            item.approval_notes = cv.approval.comment
        submissions.append(item)

    # Review Comments
    comm_stmt = (
        select(DeliverableComment)
        .options(joinedload(DeliverableComment.author))
        .where(DeliverableComment.deliverable_id == deliverable.id)
        .order_by(DeliverableComment.created_at.asc())
    )
    comm_res = await db.execute(comm_stmt)
    comments = comm_res.scalars().all()

    review_comments = [
        CommentOut(
            id=c.id,
            deliverable_id=c.deliverable_id,
            content_version_id=c.content_version_id,
            author_id=c.author_id,
            author_name=c.author_name or (c.author.full_name if c.author else "Team"),
            author_role=None,
            message=c.message,
            is_internal=c.is_internal,
            created_at=c.created_at,
        )
        for c in comments
    ]

    # Audience & Brand Voice
    target_aud: list[str] = []
    if hasattr(campaign, "target_audience") and getattr(campaign, "target_audience"):
        val = getattr(campaign, "target_audience")
        if isinstance(val, list):
            target_aud = [str(x) for x in val]
        elif isinstance(val, str):
            target_aud = [str(val)]
    elif campaign.ai_plan_draft and isinstance(campaign.ai_plan_draft, dict):
        val = campaign.ai_plan_draft.get("target_audience")
        if isinstance(val, list):
            target_aud = [str(x) for x in val]
        elif isinstance(val, str):
            target_aud = [str(val)]

    brand_voice = None
    if client:
        if hasattr(client, "brand_voice") and client.brand_voice:
            brand_voice = client.brand_voice
        elif hasattr(client, "meta") and isinstance(client.meta, dict):
            brand_voice = client.meta.get("brand_voice")

    # Storyboard text from Task notes or StudioExport
    storyboard_text = task.notes or ""
    if not storyboard_text or len(storyboard_text) < 50:
        exp_stmt = select(StudioExport).where(StudioExport.campaign_id == campaign.id)
        exp_res = await db.execute(exp_stmt)
        exports = exp_res.scalars().all()
        for exp in exports:
            if str(deliverable.id) in str(exp.production_mapping):
                ver_stmt = select(StudioArtifactVersion).where(
                    StudioArtifactVersion.id == exp.artifact_version_id
                )
                ver_res = await db.execute(ver_stmt)
                art_ver = ver_res.scalars().first()
                if art_ver and art_ver.payload:
                    storyboard_text = (
                        art_ver.payload.get("storyboard")
                        or art_ver.payload.get("script")
                        or str(art_ver.payload)
                    )
                break

    return TaskDetailOut(
        id=task.id,
        deliverable_id=task.deliverable_id,
        title=task.title,
        task_type=task.task_type,
        assignee_id=task.assignee_id,
        assignee_name=task.assignee.full_name if task.assignee else None,
        assignee_role=assignee_role,
        status=task.status,
        priority=task.priority,
        due_date=task.due_date,
        blocked_reason=task.blocked_reason,
        notes=task.notes,
        created_at=task.created_at,
        updated_at=task.updated_at,
        client_id=client.id,
        client_name=client.business_name,
        campaign_id=campaign.id,
        campaign_title=campaign.name,
        campaign_objective=campaign.objective,
        deliverable_title=deliverable.title,
        deliverable_type=deliverable.deliverable_type,
        platform=deliverable.platform,
        brand_voice=brand_voice,
        target_audience=target_aud,
        storyboard_text=storyboard_text,
        reference_assets=[],
        submissions=submissions,
        review_comments=review_comments,
    )


@router.post(
    "/agencies/{agency_id}/deliverables/{deliverable_id}/tasks",
    response_model=TaskOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_task(
    agency_id: uuid.UUID,
    deliverable_id: uuid.UUID,
    payload: TaskCreate,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> TaskOut:
    """Create a task for a deliverable."""
    await assert_deliverable_belongs_to_agency(deliverable_id, agency_id, db)
    task = Task(
        id=uuid.uuid4(),
        deliverable_id=deliverable_id,
        **payload.model_dump(),
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return TaskOut.model_validate(task)


@router.get("/agencies/{agency_id}/tasks", response_model=list[TaskOut])
async def list_agency_tasks(
    agency_id: uuid.UUID,
    task_status: TaskStatus | None = Query(None, alias="status"),
    assignee_id: uuid.UUID | None = Query(None),
    client_id: uuid.UUID | None = Query(None),
    deliverable_id: uuid.UUID | None = Query(None),
    my_tasks: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> list[TaskOut]:
    """
    List all tasks for an agency, with optional filters:
    - status
    - assignee_id
    - client_id
    - deliverable_id
    - my_tasks: filters by current logged-in user
    """
    query = (
        select(
            Task,
            Deliverable.title.label("deliv_title"),
            Deliverable.deliverable_type.label("deliv_type"),
            Campaign.id.label("camp_id"),
            Campaign.name.label("camp_title"),
            Client.id.label("cli_id"),
            Client.business_name.label("cli_name"),
            User.full_name.label("assignee_name"),
        )
        .join(Deliverable, Task.deliverable_id == Deliverable.id)
        .join(Campaign, Deliverable.campaign_id == Campaign.id)
        .join(Client, Campaign.client_id == Client.id)
        .outerjoin(User, Task.assignee_id == User.id)
        .where(Client.agency_id == agency_id)
    )

    if my_tasks:
        query = query.where(Task.assignee_id == current_user.id)
    elif assignee_id is not None:
        query = query.where(Task.assignee_id == assignee_id)

    if task_status is not None:
        query = query.where(Task.status == task_status)
    if client_id is not None:
        query = query.where(Campaign.client_id == client_id)
    if deliverable_id is not None:
        query = query.where(Task.deliverable_id == deliverable_id)

    query = query.order_by(Task.due_date.asc().nullslast(), Task.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    rows = result.all()

    out_list: list[TaskOut] = []
    for task, deliv_title, deliv_type, camp_id, camp_title, cli_id, cli_name, assignee_name in rows:
        out = TaskOut.model_validate(task)
        out.deliverable_title = deliv_title
        out.deliverable_type = deliv_type
        out.campaign_id = camp_id
        out.campaign_title = camp_title
        out.client_id = cli_id
        out.client_name = cli_name
        out.assignee_name = assignee_name
        out_list.append(out)

    return out_list


@router.get("/agencies/{agency_id}/tasks/{task_id}", response_model=TaskDetailOut)
async def get_task_detail(
    agency_id: uuid.UUID,
    task_id: uuid.UUID,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> TaskDetailOut:
    """Get full task details, creative context, submissions, and review history."""
    return await _build_task_detail(agency_id, task_id, db)


@router.post(
    "/agencies/{agency_id}/tasks/{task_id}/submissions",
    response_model=TaskContentVersionOut,
    status_code=status.HTTP_201_CREATED,
)
async def submit_task_work(
    agency_id: uuid.UUID,
    task_id: uuid.UUID,
    submission_type: str = Form("file"),  # "script" | "file" | "media"
    script_title: str | None = Form(None),
    hook: str | None = Form(None),
    script_body: str | None = Form(None),
    caption: str | None = Form(None),
    notes: str | None = Form(None),
    file: UploadFile | None = File(None),
    current_user: User = Depends(get_current_user),
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> TaskContentVersionOut:
    """
    Submit work for a task:
    - Text script submission (creates versioned text artifact)
    - Binary media upload (creates versioned file artifact)
    Transitions task & deliverable to internal_review.
    """
    stmt = (
        select(Task)
        .options(
            joinedload(Task.deliverable).joinedload(Deliverable.campaign).joinedload(Campaign.client)
        )
        .where(Task.id == task_id)
    )
    result = await db.execute(stmt)
    task = result.scalars().first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")

    deliverable = task.deliverable
    if deliverable.campaign.client.agency_id != agency_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    max_ver = (
        await db.scalar(
            select(func.coalesce(func.max(ContentVersion.version_number), 0)).where(
                ContentVersion.deliverable_id == deliverable.id
            )
        )
        or 0
    )
    next_ver = max_ver + 1

    if file is not None and file.filename:
        storage_key, checksum, size = await save_file(file, deliverable.id)
        file_name = file.filename
        file_type = file.content_type or "application/octet-stream"
    else:
        # Script / Text submission
        lines = []
        if script_title:
            lines.append(f"TITLE: {script_title}")
        if hook:
            lines.append(f"\n[HOOK / OPENING]\n{hook}")
        if script_body:
            lines.append(f"\n[SCRIPT / SCENE BREAKDOWN]\n{script_body}")
        if caption:
            lines.append(f"\n[SUGGESTED CAPTION]\n{caption}")
        if notes:
            lines.append(f"\n[PRODUCTION NOTES]\n{notes}")
        full_text = "\n".join(lines) if lines else (notes or "Empty script draft.")
        base_name = script_title or "script"
        cleaned_base = "".join(c for c in base_name if c.isalnum() or c in (" ", "_", "-")).strip().replace(" ", "_")
        target_name = f"{cleaned_base or 'script'}_v{next_ver}.txt"
        storage_key, checksum, size = save_text_content(deliverable.id, target_name, full_text)
        file_name = target_name
        file_type = "text/plain"

    cv = ContentVersion(
        id=uuid.uuid4(),
        deliverable_id=deliverable.id,
        task_id=task.id,
        version_number=next_ver,
        storage_key=storage_key,
        file_name=file_name,
        file_type=file_type,
        file_size_bytes=size,
        checksum_sha256=checksum,
        caption=caption,
        notes=notes or hook,
        uploaded_by_id=current_user.id,
    )
    db.add(cv)

    # Auto-assign task if currently unassigned
    if not task.assignee_id:
        task.assignee_id = current_user.id

    # Update statuses
    task.status = TaskStatus.internal_review
    deliverable.status = DeliverableStatus.internal_review

    # Log internal activity comment
    comment = DeliverableComment(
        id=uuid.uuid4(),
        deliverable_id=deliverable.id,
        content_version_id=cv.id,
        author_id=current_user.id,
        message=f"Submitted {file_name} (Version {next_ver}) for internal review.",
        is_internal=True,
    )
    db.add(comment)

    await db.commit()
    await db.refresh(cv)

    out = TaskContentVersionOut.model_validate(cv)
    out.url = f"/uploads/{cv.storage_key}"
    return out


@router.post(
    "/agencies/{agency_id}/tasks/{task_id}/review",
    response_model=TaskDetailOut,
)
async def review_task_work(
    agency_id: uuid.UUID,
    task_id: uuid.UUID,
    payload: TaskReviewDecision,
    current_user: User = Depends(get_current_user),
    membership: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> TaskDetailOut:
    """
    Internal Quality Review:
    - Agency owner, manager, or account manager reviews task submission.
    - If approved: marks task approved, unlocks downstream stage (e.g. script -> editing -> client review).
    - If changes_requested: marks task changes_requested and records revision notes.
    """
    allowed_roles = {RoleEnum.owner, RoleEnum.manager, RoleEnum.account_manager}
    if membership.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only agency owners, managers, and account managers can review and approve submissions.",
        )

    stmt = (
        select(Task)
        .options(
            joinedload(Task.deliverable).joinedload(Deliverable.campaign).joinedload(Campaign.client)
        )
        .where(Task.id == task_id)
    )
    result = await db.execute(stmt)
    task = result.scalars().first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")

    deliverable = task.deliverable
    if deliverable.campaign.client.agency_id != agency_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    # Get latest ContentVersion for this deliverable
    latest_cv = await db.scalar(
        select(ContentVersion)
        .where(ContentVersion.deliverable_id == deliverable.id)
        .order_by(ContentVersion.version_number.desc())
    )

    decision_enum = (
        ApprovalDecision.approved
        if payload.decision == "approved"
        else ApprovalDecision.changes_requested
    )

    if latest_cv:
        existing_appr = await db.scalar(
            select(Approval).where(Approval.content_version_id == latest_cv.id)
        )
        if existing_appr:
            existing_appr.decision = decision_enum
            existing_appr.comment = payload.feedback_notes
            existing_appr.reviewer_id = current_user.id
            existing_appr.reviewed_at = datetime.utcnow()
        else:
            approval = Approval(
                id=uuid.uuid4(),
                content_version_id=latest_cv.id,
                reviewer_id=current_user.id,
                decision=decision_enum,
                comment=payload.feedback_notes,
            )
            db.add(approval)

    if payload.decision == "changes_requested":
        task.status = TaskStatus.changes_requested
        deliverable.status = DeliverableStatus.changes_requested
        comment = DeliverableComment(
            id=uuid.uuid4(),
            deliverable_id=deliverable.id,
            content_version_id=latest_cv.id if latest_cv else None,
            author_id=current_user.id,
            message=f"[Revision Requested]: {payload.feedback_notes or 'Please revise and resubmit.'}",
            is_internal=True,
        )
        db.add(comment)
    elif payload.decision == "approved":
        task.status = TaskStatus.approved
        comment = DeliverableComment(
            id=uuid.uuid4(),
            deliverable_id=deliverable.id,
            content_version_id=latest_cv.id if latest_cv else None,
            author_id=current_user.id,
            message=f"[Internal Approval]: {payload.feedback_notes or 'Submission approved.'}",
            is_internal=True,
        )
        db.add(comment)

        # Downstream task unlocking logic
        t_type = (task.task_type or "").lower()
        siblings_res = await db.execute(
            select(Task).where(Task.deliverable_id == deliverable.id)
        )
        siblings = siblings_res.scalars().all()

        if any(w in t_type for w in ["script", "copy", "writing"]):
            # Unlocks filming or editing task
            for sib in siblings:
                sib_type = (sib.task_type or "").lower()
                if any(w in sib_type for w in ["shoot", "film", "edit", "design"]) and sib.status == TaskStatus.backlog:
                    sib.status = TaskStatus.todo
                    break
        elif any(w in t_type for w in ["shoot", "film"]):
            # Unlocks editing task
            for sib in siblings:
                sib_type = (sib.task_type or "").lower()
                if "edit" in sib_type and sib.status == TaskStatus.backlog:
                    sib.status = TaskStatus.todo
                    break
        elif any(w in t_type for w in ["edit", "design", "approval"]):
            # Video or design render approved -> Deliverable is ready for Client Portal!
            deliverable.status = DeliverableStatus.client_review

    await db.commit()
    return await _build_task_detail(agency_id, task.id, db)


@router.patch("/agencies/{agency_id}/tasks/{task_id}", response_model=TaskOut)
async def update_task(
    agency_id: uuid.UUID,
    task_id: uuid.UUID,
    payload: TaskUpdate,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> TaskOut:
    """Update a task's status, assignee, or other fields."""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")
    await assert_deliverable_belongs_to_agency(task.deliverable_id, agency_id, db)

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(task, field, value)

    if "status" in update_data:
        status_map = {
            TaskStatus.backlog: DeliverableStatus.not_started,
            TaskStatus.todo: DeliverableStatus.not_started,
            TaskStatus.in_progress: DeliverableStatus.in_production,
            TaskStatus.internal_review: DeliverableStatus.internal_review,
            TaskStatus.client_review: DeliverableStatus.client_review,
            TaskStatus.changes_requested: DeliverableStatus.changes_requested,
            TaskStatus.approved: DeliverableStatus.approved,
            TaskStatus.done: DeliverableStatus.approved,
        }
        if task.status in status_map:
            deliv_res = await db.execute(
                select(Deliverable).where(Deliverable.id == task.deliverable_id)
            )
            deliverable = deliv_res.scalar_one_or_none()
            if deliverable:
                deliverable.status = status_map[task.status]

    await db.commit()
    await db.refresh(task)
    return TaskOut.model_validate(task)
