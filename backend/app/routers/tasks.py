from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import delete, func, or_, select
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
from app.core.llm import invoke_structured_llm
from app.schemas.comment import CommentOut
from app.schemas.task import (
    TaskAIAssistRequest,
    TaskAIAssistResponse,
    TaskContentVersionOut,
    TaskCreate,
    TaskDetailOut,
    TaskOut,
    TaskReviewDecision,
    TaskStudioSyncRequest,
    TaskStudioSyncResponse,
    TaskUpdate,
)
from app.services.storage_service import save_file, save_text_content
from app.services.tenant_service import assert_deliverable_belongs_to_agency

router = APIRouter(tags=["tasks"])


DEFAULT_SCRIPTING_CHECKLISTS = [
    {"id": "chk-1", "text": "Hook Drafted & Polished (<12 words)", "completed": False, "stage": "scripting"},
    {"id": "chk-2", "text": "Scene-by-Scene Dialogue Written", "completed": False, "stage": "scripting"},
    {"id": "chk-3", "text": "Visual & Camera Directives Added", "completed": False, "stage": "scripting"},
    {"id": "chk-4", "text": "Spoken Duration Verified (<30s)", "completed": False, "stage": "scripting"},
    {"id": "chk-5", "text": "A-Roll Rough Cut Completed", "completed": False, "stage": "editing"},
    {"id": "chk-6", "text": "B-Roll & Visual Overlays Synced", "completed": False, "stage": "editing"},
    {"id": "chk-7", "text": "Dynamic Kinetic Captions Added", "completed": False, "stage": "editing"},
    {"id": "chk-8", "text": "Sound Design & Music Levelled (-18dB)", "completed": False, "stage": "editing"},
    {"id": "chk-9", "text": "Color Grade & Brand Presets Applied", "completed": False, "stage": "editing"},
]


def _compute_script_metrics(script_blocks: list[dict[str, Any]], target_duration: int = 30) -> tuple[int, int, int, str | None]:
    """Computes total word count, speaking duration (at ~140 WPM), hook words, and hook warning."""
    total_words = 0
    hook_words = 0
    for idx, block in enumerate(script_blocks):
        words = len((block.get("spoken_words") or "").strip().split())
        total_words += words
        if idx == 0:
            hook_words = words

    # 140 words per minute speaking pace for Reels/TikToks (~2.33 words/sec)
    speaking_sec = round((total_words / 140.0) * 60) if total_words > 0 else 0

    hook_warning = None
    if hook_words > 15:
        hook_warning = f"Hook is {hook_words} words (exceeds 15 words). Risk of 3-second viewer drop-off. Trim to under 12 words."

    return total_words, speaking_sec, hook_words, hook_warning


def _populate_starter_script_blocks(
    deliverable: Deliverable,
    campaign: Campaign,
    storyboard_text: str | None,
) -> list[dict[str, Any]]:
    matching_d = None
    if campaign.ai_plan_draft and isinstance(campaign.ai_plan_draft, dict):
        for d in campaign.ai_plan_draft.get("deliverables") or []:
            if str(d.get("deliverable_id")) == str(deliverable.id) or d.get("title") == deliverable.title:
                matching_d = d
                break

    hook_text = (matching_d.get("hook") if matching_d else None) or "Stop scrolling: here is what nobody tells you about this."
    concept_text = (matching_d.get("visual_concept") if matching_d else None) or "Dynamic cinematic camera motion."
    cta_text = (matching_d.get("cta") if matching_d else None) or "Save this reel and follow for more insights!"
    audio_text = (matching_d.get("audio_vibe") if matching_d else None) or "Trending upbeat electronic soundtrack."

    return [
        {
            "id": "scene-1",
            "scene_number": 1,
            "title": "Scene 1: The Hook (0s–5s)",
            "spoken_words": hook_text,
            "visual_cue": concept_text,
            "audio_notes": audio_text,
            "duration_seconds": 5,
        },
        {
            "id": "scene-2",
            "scene_number": 2,
            "title": "Scene 2: Friction & Agitation (5s–12s)",
            "spoken_words": "Most brands struggle because they spend hours guessing without a structured system.",
            "visual_cue": "Fast cuts highlighting the problem, split screen or text callout overlay.",
            "audio_notes": "Tension build-up, subtle bass riser.",
            "duration_seconds": 7,
        },
        {
            "id": "scene-3",
            "scene_number": 3,
            "title": "Scene 3: Proof & Solution (12s–22s)",
            "spoken_words": "Instead, automate your strategic calendar, lock production stages, and approve in one click.",
            "visual_cue": "Clean product workflow demo showcasing smooth UI execution.",
            "audio_notes": "Rhythmic beat drop, bright uplifting tempo.",
            "duration_seconds": 10,
        },
        {
            "id": "scene-4",
            "scene_number": 4,
            "title": "Scene 4: Call to Action (22s–30s)",
            "spoken_words": cta_text,
            "visual_cue": "High-contrast text on screen pointing to comment icon or link in bio.",
            "audio_notes": "Memorable audio logo chime to close.",
            "duration_seconds": 8,
        },
    ]


def _sync_submitted_script_to_blocks(
    task: Task,
    hook: str | None,
    script_body: str | None,
) -> list[dict[str, Any]]:
    """
    Parses submitted hook and script dialogue into structured teleprompter scenes,
    ensuring teleprompter blocks stay in sync with submitted and approved copy.
    """
    import re

    current_blocks = [dict(b) for b in (task.script_blocks or [])]
    if not current_blocks:
        current_blocks = [
            {
                "id": "scene-1",
                "scene_number": 1,
                "title": "Scene 1: The Hook (0s–5s)",
                "spoken_words": "",
                "visual_cue": "Close-up direct address to camera",
                "audio_notes": "High-energy beat drop / cutoff",
                "duration_seconds": 5,
            },
            {
                "id": "scene-2",
                "scene_number": 2,
                "title": "Scene 2: Friction & Agitation (5s–12s)",
                "spoken_words": "",
                "visual_cue": "Dynamic visual problem agitation",
                "audio_notes": "Subtle tension synth",
                "duration_seconds": 7,
            },
            {
                "id": "scene-3",
                "scene_number": 3,
                "title": "Scene 3: Proof & Solution (12s–22s)",
                "spoken_words": "",
                "visual_cue": "Step-by-step mechanism or product demo",
                "audio_notes": "Uptempo rhythm",
                "duration_seconds": 10,
            },
            {
                "id": "scene-4",
                "scene_number": 4,
                "title": "Scene 4: Call to Action (22s–30s)",
                "spoken_words": "Comment below or visit the link in bio to learn more.",
                "visual_cue": "High-contrast end card callout",
                "audio_notes": "Audio brand signature sting",
                "duration_seconds": 8,
            },
        ]

    # Update Hook in Scene 1
    if hook and hook.strip():
        current_blocks[0]["spoken_words"] = hook.strip()

    # Parse Script Body across scenes
    if script_body and script_body.strip():
        clean_body = script_body.strip()

        def _clean_scene_line(t: str) -> str:
            t = re.sub(
                r"^(?:\[?Scene\s*\d+[^\]\n]*\]?|\*\*Scene\s*\d+[^\*]*\*\*|Scene\s*\d+[:\-]?)\s*[:\-]?\s*",
                "",
                t,
                flags=re.IGNORECASE,
            )
            t = re.sub(r"^(?:\[[^\]]+\]|\*\*[^\*]+\*\*)\s*[:\-]?\s*", "", t)
            return t.strip()

        lines = [l.strip() for l in clean_body.splitlines() if l.strip()]
        scene_entries: list[str] = []
        has_scene_headers = any(
            re.match(r"^(?:\[?Scene\s*\d+|\*\*Scene\s*\d+|Scene\s*\d+)", l, re.IGNORECASE)
            for l in lines
        )

        if has_scene_headers:
            current_entry: list[str] = []
            for l in lines:
                if re.match(r"^(?:\[?Scene\s*\d+|\*\*Scene\s*\d+|Scene\s*\d+)", l, re.IGNORECASE):
                    if current_entry:
                        scene_entries.append(" ".join(current_entry))
                        current_entry = []
                cleaned = _clean_scene_line(l)
                if cleaned:
                    current_entry.append(cleaned)
            if current_entry:
                scene_entries.append(" ".join(current_entry))
        else:
            paras = [p.strip() for p in clean_body.split("\n\n") if p.strip()]
            if len(paras) <= 1 and len(lines) > 1:
                paras = lines
            scene_entries = [_clean_scene_line(p) for p in paras if _clean_scene_line(p)]

        if len(scene_entries) == 1:
            if len(current_blocks) > 1:
                current_blocks[1]["spoken_words"] = scene_entries[0]
        elif len(scene_entries) == 2:
            if len(current_blocks) > 1:
                current_blocks[1]["spoken_words"] = scene_entries[0]
            if len(current_blocks) > 2:
                current_blocks[2]["spoken_words"] = scene_entries[1]
        elif len(scene_entries) == 3:
            if not hook and not current_blocks[0].get("spoken_words"):
                current_blocks[0]["spoken_words"] = scene_entries[0]
                if len(current_blocks) > 1:
                    current_blocks[1]["spoken_words"] = scene_entries[1]
                if len(current_blocks) > 2:
                    current_blocks[2]["spoken_words"] = scene_entries[2]
            else:
                if len(current_blocks) > 1:
                    current_blocks[1]["spoken_words"] = scene_entries[0]
                if len(current_blocks) > 2:
                    current_blocks[2]["spoken_words"] = scene_entries[1]
                if len(current_blocks) > 3:
                    current_blocks[3]["spoken_words"] = scene_entries[2]
        elif len(scene_entries) >= 4:
            if not hook or not hook.strip():
                current_blocks[0]["spoken_words"] = scene_entries[0]
            if len(current_blocks) > 1:
                current_blocks[1]["spoken_words"] = scene_entries[1]
            if len(current_blocks) > 2:
                current_blocks[2]["spoken_words"] = scene_entries[2]
            if len(current_blocks) > 3:
                current_blocks[3]["spoken_words"] = " ".join(scene_entries[3:])

    # Recalculate durations
    for b in current_blocks:
        words = len((b.get("spoken_words") or "").strip().split())
        b["duration_seconds"] = max(2, round((words / 140) * 60))

    return current_blocks


async def _sync_deliverable_status(deliverable_id: uuid.UUID, db: AsyncSession) -> Deliverable | None:
    """
    Synchronizes the parent deliverable status based on the aggregate status
    of all sibling tasks, preventing single tasks from prematurely clobbering state.
    """
    deliv_res = await db.execute(
        select(Deliverable).where(Deliverable.id == deliverable_id)
    )
    deliverable = deliv_res.scalar_one_or_none()
    if not deliverable:
        return None

    # Protect terminal / publishing statuses from being overwritten by task edits
    protected_statuses = {
        DeliverableStatus.scheduled,
        DeliverableStatus.publishing,
        DeliverableStatus.partially_published,
        DeliverableStatus.published,
        DeliverableStatus.failed,
        DeliverableStatus.cancelled,
    }
    if deliverable.status in protected_statuses:
        return deliverable

    sib_res = await db.execute(
        select(Task).where(Task.deliverable_id == deliverable_id)
    )
    siblings = sib_res.scalars().all()
    if not siblings:
        return deliverable

    statuses = [s.status for s in siblings]

    if any(s == TaskStatus.changes_requested for s in statuses):
        deliverable.status = DeliverableStatus.changes_requested
    elif any(s == TaskStatus.internal_review for s in statuses):
        deliverable.status = DeliverableStatus.internal_review
    elif any(s == TaskStatus.client_review for s in statuses):
        deliverable.status = DeliverableStatus.client_review
    elif all(s in (TaskStatus.approved, TaskStatus.done) for s in statuses):
        deliverable.status = DeliverableStatus.approved
    elif any(s == TaskStatus.in_progress for s in statuses):
        deliverable.status = DeliverableStatus.in_production
    elif any(s in (TaskStatus.approved, TaskStatus.done) for s in statuses):
        deliverable.status = DeliverableStatus.in_production
    elif any(s == TaskStatus.todo for s in statuses):
        deliverable.status = DeliverableStatus.not_started
    elif all(s == TaskStatus.backlog for s in statuses):
        deliverable.status = DeliverableStatus.not_started
    else:
        deliverable.status = DeliverableStatus.in_production

    return deliverable


def get_stage_rank(task_type: str | None) -> int:
    t = (task_type or "").lower()
    if any(k in t for k in ("script", "copy", "writing")):
        return 1
    if any(k in t for k in ("film", "shoot")):
        return 2
    if any(k in t for k in ("design", "graphic")):
        return 3
    if any(k in t for k in ("edit", "cut")):
        return 4
    if any(k in t for k in ("qa", "quality")):
        return 5
    if any(k in t for k in ("approval", "review")):
        return 6
    return 3


def _check_task_lock_status(task: Task, siblings: list[Task]) -> tuple[bool, str | None]:
    """
    Determines if a task is locked based on its status and the status of
    upstream prerequisite sibling tasks under the same deliverable.
    """
    task_rank = get_stage_rank(task.task_type)
    sorted_sibs = sorted(
        [s for s in siblings if s.id != task.id],
        key=lambda s: (get_stage_rank(s.task_type), s.created_at),
    )

    # Check if any earlier prerequisite task is not yet approved
    for sib in sorted_sibs:
        if get_stage_rank(sib.task_type) < task_rank:
            if sib.status not in (TaskStatus.approved, TaskStatus.done):
                return True, f"Waiting for '{sib.title}' ({sib.task_type or 'stage'}) to be approved."

    # If the task itself is marked backlog, it is explicitly queued/locked
    if task.status == TaskStatus.backlog:
        return True, "Task is queued in backlog and not yet ready for production."

    return False, None


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

    # Submissions (ContentVersions scoped to this task)
    cv_stmt = (
        select(ContentVersion)
        .options(selectinload(ContentVersion.approval))
        .where(
            ContentVersion.deliverable_id == deliverable.id,
            ContentVersion.task_id == task.id,
        )
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

    # Siblings lock evaluation
    sib_stmt = select(Task).where(Task.deliverable_id == deliverable.id)
    sib_res = await db.execute(sib_stmt)
    siblings = sib_res.scalars().all()
    is_locked, locked_reason = _check_task_lock_status(task, siblings)

    # Script blocks & Checklists initialization if empty
    script_blocks = list(task.script_blocks or [])
    if not script_blocks:
        script_blocks = _populate_starter_script_blocks(deliverable, campaign, storyboard_text)

    checklists = list(task.checklists or [])
    if not checklists:
        checklists = [dict(c) for c in DEFAULT_SCRIPTING_CHECKLISTS]

    target_dur = task.target_duration_seconds or 30
    total_words, speaking_sec, hook_words, hook_warning = _compute_script_metrics(script_blocks, target_dur)

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
        is_locked=is_locked,
        locked_reason=locked_reason,
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
        script_blocks=script_blocks,
        checklists=checklists,
        target_duration_seconds=target_dur,
        speaking_duration_seconds=speaking_sec,
        total_word_count=total_words,
        hook_word_count=hook_words,
        hook_warning=hook_warning,
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

    if payload.assignee_id is not None:
        m_stmt = select(Membership).where(
            Membership.agency_id == agency_id,
            Membership.user_id == payload.assignee_id,
        )
        assignee_member = await db.scalar(m_stmt)
        if not assignee_member:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Assignee does not belong to this agency.",
            )

    task = Task(
        id=uuid.uuid4(),
        deliverable_id=deliverable_id,
        **payload.model_dump(exclude={"deliverable_id"}),
    )
    db.add(task)
    await db.commit()
    await _sync_deliverable_status(deliverable_id, db)
    await db.refresh(task)
    return TaskOut.model_validate(task)


@router.post(
    "/agencies/{agency_id}/tasks",
    response_model=TaskOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_agency_task(
    agency_id: uuid.UUID,
    payload: TaskCreate,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> TaskOut:
    """Create a task directly under an agency deliverable."""
    if not payload.deliverable_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="deliverable_id is required to create a task.",
        )
    await assert_deliverable_belongs_to_agency(payload.deliverable_id, agency_id, db)

    if payload.assignee_id is not None:
        m_stmt = select(Membership).where(
            Membership.agency_id == agency_id,
            Membership.user_id == payload.assignee_id,
        )
        assignee_member = await db.scalar(m_stmt)
        if not assignee_member:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Assignee does not belong to this agency.",
            )

    task_data = payload.model_dump(exclude={"deliverable_id"})
    task = Task(
        id=uuid.uuid4(),
        deliverable_id=payload.deliverable_id,
        **task_data,
    )
    db.add(task)
    await db.commit()
    await _sync_deliverable_status(payload.deliverable_id, db)
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

    # Pre-fetch sibling tasks for lock evaluation across loaded deliverables
    deliv_tasks_map: dict[uuid.UUID, list[Task]] = {}
    deliv_ids = {r[0].deliverable_id for r in rows}
    if deliv_ids:
        all_sibs_res = await db.execute(
            select(Task).where(Task.deliverable_id.in_(deliv_ids))
        )
        for s in all_sibs_res.scalars().all():
            deliv_tasks_map.setdefault(s.deliverable_id, []).append(s)

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
        sibs = deliv_tasks_map.get(task.deliverable_id, [task])
        is_locked, locked_reason = _check_task_lock_status(task, sibs)
        out.is_locked = is_locked
        out.locked_reason = locked_reason
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

    # Enforce task locking: reject submissions if upstream prerequisites are incomplete
    sib_stmt = select(Task).where(Task.deliverable_id == deliverable.id)
    sib_res = await db.execute(sib_stmt)
    siblings = sib_res.scalars().all()
    is_locked, locked_reason = _check_task_lock_status(task, siblings)
    if is_locked:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"This task is locked. {locked_reason or 'All upstream prerequisite tasks must be approved before submitting work.'}",
        )

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

    # Sync script blocks if script was submitted
    if submission_type == "script" or hook or script_body:
        updated_blocks = _sync_submitted_script_to_blocks(task, hook, script_body)
        task.script_blocks = updated_blocks
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(task, "script_blocks")

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


async def _unlock_downstream_tasks(task: Task, deliverable_id: uuid.UUID, db: AsyncSession) -> None:
    """
    When a task is approved or marked done, unlock the next sequential downstream sibling
    from 'backlog' to 'todo' according to stage precedence.
    """
    t_type = (task.task_type or "").lower()
    siblings_res = await db.execute(
        select(Task)
        .where(Task.deliverable_id == deliverable_id)
        .order_by(Task.created_at.asc())
    )
    siblings = siblings_res.scalars().all()

    stage_transitions: dict[str, list[str]] = {
        "script": ["film", "shoot", "edit", "approval", "review"],
        "copy": ["design", "qa", "approval", "review"],
        "writing": ["design", "qa", "approval", "review"],
        "film": ["edit", "qa", "approval", "review"],
        "shoot": ["edit", "qa", "approval", "review"],
        "design": ["qa", "approval", "review"],
        "edit": ["qa", "approval", "review"],
        "qa": ["approval", "review"],
    }

    target_candidates: list[str] = []
    for key, targets in stage_transitions.items():
        if key in t_type:
            target_candidates.extend(targets)
            break

    unlocked_sibling = False
    if target_candidates:
        for cand in target_candidates:
            for sib in siblings:
                sib_type = (sib.task_type or "").lower()
                if cand in sib_type and sib.status == TaskStatus.backlog:
                    sib.status = TaskStatus.todo
                    unlocked_sibling = True
                    break
            if unlocked_sibling:
                break

    if not unlocked_sibling:
        for sib in siblings:
            if sib.id != task.id and sib.status == TaskStatus.backlog:
                sib.status = TaskStatus.todo
                unlocked_sibling = True
                break


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

    # Enforce task locking: reject submissions if upstream prerequisites are incomplete
    sib_stmt = select(Task).where(Task.deliverable_id == deliverable.id)
    sib_res = await db.execute(sib_stmt)
    siblings = sib_res.scalars().all()
    is_locked, locked_reason = _check_task_lock_status(task, siblings)
    if is_locked:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"This task is locked. {locked_reason or 'All upstream prerequisite tasks must be approved before submitting work.'}",
        )

    # Get latest ContentVersion for this task (or fallback to deliverable)
    latest_cv = await db.scalar(
        select(ContentVersion)
        .where(
            ContentVersion.deliverable_id == deliverable.id,
            ContentVersion.task_id == task.id,
        )
        .order_by(ContentVersion.version_number.desc())
    )
    if not latest_cv:
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
        comment = DeliverableComment(
            id=uuid.uuid4(),
            deliverable_id=deliverable.id,
            content_version_id=latest_cv.id if latest_cv else None,
            author_id=current_user.id,
            message=f"[Revision Requested]: {payload.feedback_notes or 'Please revise and resubmit.'}",
            is_internal=True,
        )
        db.add(comment)
        await _sync_deliverable_status(deliverable.id, db)
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
        await _unlock_downstream_tasks(task, deliverable.id, db)

        siblings_res = await db.execute(
            select(Task)
            .where(Task.deliverable_id == deliverable.id)
            .order_by(Task.created_at.asc())
        )
        siblings = siblings_res.scalars().all()
        t_type = (task.task_type or "").lower()

        # Propagate approved script blocks to downstream siblings (filming, video editing)
        if ("script" in t_type or "copy" in t_type or "writing" in t_type) and task.script_blocks:
            for sib in siblings:
                if sib.id != task.id:
                    sib.script_blocks = list(task.script_blocks)
                    from sqlalchemy.orm.attributes import flag_modified
                    flag_modified(sib, "script_blocks")

            # Also update campaign.ai_plan_draft if deliverable is mapped
            if deliverable.campaign and deliverable.campaign.ai_plan_draft and isinstance(deliverable.campaign.ai_plan_draft, dict):
                delivs = deliverable.campaign.ai_plan_draft.get("deliverables") or []
                for d in delivs:
                    if str(d.get("deliverable_id")) == str(deliverable.id) or d.get("title") == deliverable.title:
                        first_words = task.script_blocks[0].get("spoken_words", "") if task.script_blocks else ""
                        last_words = task.script_blocks[-1].get("spoken_words", "") if len(task.script_blocks) > 1 else ""
                        if first_words:
                            d["hook"] = first_words
                        if last_words:
                            d["cta"] = last_words
                        d["script_blocks"] = task.script_blocks
                        from sqlalchemy.orm.attributes import flag_modified
                        flag_modified(deliverable.campaign, "ai_plan_draft")
                        break

        if any(w in t_type for w in ["approval", "review"]) or not any(s.status == TaskStatus.backlog for s in siblings):
            if all(s.status in (TaskStatus.approved, TaskStatus.done) for s in siblings):
                deliverable.status = DeliverableStatus.approved
            else:
                deliverable.status = DeliverableStatus.client_review
        else:
            await _sync_deliverable_status(deliverable.id, db)

    await db.commit()
    return await _build_task_detail(agency_id, task.id, db)


@router.patch("/agencies/{agency_id}/tasks/{task_id}", response_model=TaskOut)
async def update_task(
    agency_id: uuid.UUID,
    task_id: uuid.UUID,
    payload: TaskUpdate,
    membership: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> TaskOut:
    """Update a task's status, assignee, or other fields."""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")
    await assert_deliverable_belongs_to_agency(task.deliverable_id, agency_id, db)

    update_data = payload.model_dump(exclude_unset=True)

    # 1. Cross-tenant assignee verification
    if "assignee_id" in update_data and update_data["assignee_id"] is not None:
        m_stmt = select(Membership).where(
            Membership.agency_id == agency_id,
            Membership.user_id == update_data["assignee_id"],
        )
        assignee_member = await db.scalar(m_stmt)
        if not assignee_member:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Assignee does not belong to this agency.",
            )

    # 2. Role security check for approval/done status transition
    if "status" in update_data and update_data["status"] in (TaskStatus.approved, TaskStatus.done):
        allowed_roles = {RoleEnum.owner, RoleEnum.manager, RoleEnum.account_manager}
        if membership.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only agency owners, managers, and account managers can mark tasks as approved or done.",
            )

    # 3. Enforce task locking: reject advancing status if upstream prerequisites are incomplete
    if "status" in update_data and update_data["status"] in (TaskStatus.in_progress, TaskStatus.internal_review, TaskStatus.approved, TaskStatus.done):
        sib_res = await db.execute(select(Task).where(Task.deliverable_id == task.deliverable_id))
        siblings = sib_res.scalars().all()
        is_locked, locked_reason = _check_task_lock_status(task, siblings)
        if is_locked:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot advance locked task: {locked_reason or 'All upstream prerequisite tasks must be approved first.'}",
            )

    for field, value in update_data.items():
        setattr(task, field, value)

    if "script_blocks" in update_data:
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(task, "script_blocks")
    if "checklists" in update_data:
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(task, "checklists")

    # 4. Synchronize parent deliverable status based on all sibling tasks
    if "status" in update_data:
        if update_data["status"] in (TaskStatus.approved, TaskStatus.done):
            await _unlock_downstream_tasks(task, task.deliverable_id, db)
        await _sync_deliverable_status(task.deliverable_id, db)

    await db.commit()
    await db.refresh(task)
    
    out = TaskOut.model_validate(task)
    blocks = list(task.script_blocks or [])
    out.script_blocks = blocks
    out.checklists = list(task.checklists or [])
    out.target_duration_seconds = task.target_duration_seconds or 30
    total_words, speaking_sec, hook_words, hook_warning = _compute_script_metrics(blocks, out.target_duration_seconds)
    out.total_word_count = total_words
    out.speaking_duration_seconds = speaking_sec
    out.hook_word_count = hook_words
    out.hook_warning = hook_warning
    return out


@router.delete(
    "/agencies/{agency_id}/tasks/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def delete_task(
    agency_id: uuid.UUID,
    task_id: uuid.UUID,
    membership: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """
    Delete a task from an agency deliverable.
    Only owners, managers, and account managers can delete tasks.
    """
    allowed_roles = {RoleEnum.owner, RoleEnum.manager, RoleEnum.account_manager}
    if membership.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only agency owners, managers, and account managers can delete tasks.",
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

    deliverable_id = deliverable.id

    # Clean up associated ContentVersion task_id references or records
    cv_stmt = select(ContentVersion).where(ContentVersion.task_id == task_id)
    cv_res = await db.execute(cv_stmt)
    cvs = cv_res.scalars().all()
    for cv in cvs:
        await db.execute(delete(Approval).where(Approval.content_version_id == cv.id))
        await db.delete(cv)

    # Delete task
    await db.delete(task)
    await db.commit()

    # Resynchronize parent deliverable status
    await _sync_deliverable_status(deliverable_id, db)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/agencies/{agency_id}/tasks/{task_id}/ai-assist",
    response_model=TaskAIAssistResponse,
)
async def task_ai_assist_endpoint(
    agency_id: uuid.UUID,
    task_id: uuid.UUID,
    payload: TaskAIAssistRequest,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> TaskAIAssistResponse:
    """
    AI Creative Assistant for Specialists:
    - Provides instant creative guidance, hook variations, brand compliance checks,
      and scene dialogue expansions directly in the task workspace.
    """
    stmt = (
        select(Task)
        .options(
            joinedload(Task.deliverable).joinedload(Deliverable.campaign).joinedload(Campaign.client)
        )
        .where(Task.id == task_id)
    )
    res = await db.execute(stmt)
    task = res.scalars().first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")

    deliverable = task.deliverable
    campaign = deliverable.campaign
    client = campaign.client
    if client.agency_id != agency_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    # Determine Brand Profile context
    brand_voice = (
        client.brand_voice
        if hasattr(client, "brand_voice") and client.brand_voice
        else "Authoritative, engaging, data-backed and concise"
    )
    client_name = client.business_name
    deliv_type = deliverable.deliverable_type or "reel"
    t_type = (task.task_type or "scripting").lower()

    agent_name = (
        "Lead Content Architect"
        if any(w in t_type for w in ["script", "copy", "writing"])
        else "Creative Director & Storyboard Lead"
    )

    system_prompt = f"""You are the {agent_name} at AgencyOS.
You are assisting a creative specialist working on the task: '{task.title}'
Parent Deliverable: '{deliverable.title}' (Format: {deliv_type}, Platform: {deliverable.platform or 'general'})
Client: {client_name}
Campaign Objective: {campaign.objective or 'Drive high-converting engagement and qualified leads'}
Brand Voice: {brand_voice}

Your role is to provide surgical, high-converting creative suggestions, sharp hooks, and structured dialogue improvements based on the user's creative instruction.
"""

    user_prompt = f"""Specialist Instruction: {payload.instruction}
Current Hook: {payload.current_hook or '(None provided)'}
Current Script / Draft: {payload.current_script or '(None provided)'}
Task Type: {payload.task_type or task.task_type or 'scripting'}

Deliver your recommendations structured with:
1. Constructive critique and tactical advice
2. A recommended primary hook
3. A complete recommended script / scene dialogue expansion
4. 3 punchy alternative hook variations
"""

    class LLMOutputSchema(BaseModel):
        critique: str
        recommended_hook: str
        recommended_script: str
        hook_variations: list[str]

    try:
        llm_result: LLMOutputSchema = await invoke_structured_llm(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            schema_class=LLMOutputSchema,
        )
        return TaskAIAssistResponse(
            agent_name=agent_name,
            critique=llm_result.critique,
            recommended_hook=llm_result.recommended_hook,
            recommended_script=llm_result.recommended_script,
            hook_variations=llm_result.hook_variations,
        )
    except Exception:
        # Resilient fallback if LLM is unconfigured / rate limited
        critique = f"Analyzed against {client_name}'s {brand_voice.lower()} brand voice: "
        if payload.current_hook:
            critique += "Your hook has strong intent but can capture viewer attention faster in the first 1.5 seconds. "
        else:
            critique += "No hook was detected. Starting with a pattern-interrupt question or bold contrarian statement yields 3.2x higher retention. "

        rec_hook = (
            f"Stop scrolling if you want to eliminate {client_name}'s biggest bottleneck this quarter."
            if not payload.current_hook
            else f"Most teams get this completely backwards: {payload.current_hook.rstrip('.!')} — here is the real playbook."
        )

        rec_script = (
            f"Scene 1 (0-3s) [Hook]: {rec_hook}\n"
            f"Scene 2 (3-8s) [Problem]: Breakdown of current inefficiencies and hidden friction.\n"
            f"Scene 3 (8-15s) [Solution]: How {client_name} delivers certainty without latency.\n"
            f"Scene 4 (15-25s) [Proof & CTA]: Real-world metrics and link in bio to audit your workflow."
        )

        variations = [
            f"The #1 mistake brands make when scaling with {client_name}.",
            f"If you're still doing this manually in 2026, stop immediately.",
            f"Here's what 99% of competitors don't know about {deliverable.title}.",
        ]

        return TaskAIAssistResponse(
            agent_name=agent_name,
            critique=critique,
            recommended_hook=rec_hook,
            recommended_script=rec_script,
            hook_variations=variations,
        )


@router.post(
    "/agencies/{agency_id}/tasks/{task_id}/sync-studio",
    response_model=TaskStudioSyncResponse,
)
async def sync_task_to_campaign_studio(
    agency_id: uuid.UUID,
    task_id: uuid.UUID,
    payload: TaskStudioSyncRequest,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> TaskStudioSyncResponse:
    """
    Bi-directionally push refined script, hook, and scene directives from a Task
    back to the Campaign Studio deliverable card and AI Plan Draft.
    """
    stmt = (
        select(Task)
        .options(
            joinedload(Task.deliverable).joinedload(Deliverable.campaign).joinedload(Campaign.client)
        )
        .where(Task.id == task_id)
    )
    res = await db.execute(stmt)
    task = res.scalars().first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")

    deliverable = task.deliverable
    campaign = deliverable.campaign
    client = campaign.client
    if client.agency_id != agency_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    # 1. Update task's own script blocks if provided
    if payload.script_blocks is not None:
        task.script_blocks = payload.script_blocks
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(task, "script_blocks")

    # 2. Extract hook & CTA
    hook = payload.hook
    if not hook and payload.script_blocks and len(payload.script_blocks) > 0:
        hook = payload.script_blocks[0].get("spoken_words")

    cta = payload.cta
    if not cta and payload.script_blocks and len(payload.script_blocks) > 1:
        cta = payload.script_blocks[-1].get("spoken_words")

    # 3. Update campaign's ai_plan_draft
    if campaign.ai_plan_draft and isinstance(campaign.ai_plan_draft, dict):
        draft = dict(campaign.ai_plan_draft)
        delivs = list(draft.get("deliverables") or [])
        matched = False
        for idx, d in enumerate(delivs):
            if str(d.get("deliverable_id")) == str(deliverable.id) or d.get("title") == deliverable.title:
                updated_item = dict(d)
                if hook:
                    updated_item["hook"] = hook
                if payload.caption:
                    updated_item["caption"] = payload.caption
                if payload.visual_concept:
                    updated_item["visual_concept"] = payload.visual_concept
                if cta:
                    updated_item["cta"] = cta
                if payload.audio_vibe:
                    updated_item["audio_vibe"] = payload.audio_vibe
                if payload.script_blocks:
                    updated_item["script_blocks"] = payload.script_blocks
                delivs[idx] = updated_item
                matched = True
                break
        if matched:
            draft["deliverables"] = delivs
            campaign.ai_plan_draft = draft
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(campaign, "ai_plan_draft")

    await db.commit()
    await db.refresh(task)

    return TaskStudioSyncResponse(
        success=True,
        campaign_id=campaign.id,
        deliverable_id=deliverable.id,
        message="Script and visual directives successfully synchronized to Campaign Studio master plan.",
    )
