"""
Deliverable routes — content versioning and file uploads.

Endpoints:
  GET  /agencies/{agency_id}/deliverables/{deliverable_id}
  GET  /agencies/{agency_id}/deliverables/{deliverable_id}/versions
  POST /agencies/{agency_id}/deliverables/{deliverable_id}/versions  (multipart)
  DELETE /agencies/{agency_id}/deliverables/{deliverable_id}/versions/{version_id}
  PATCH /agencies/{agency_id}/deliverables/{deliverable_id}  (status update)
"""
from __future__ import annotations

import asyncio
from datetime import date
from pathlib import Path
from typing import Literal
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies import get_current_user, require_agency_member
from app.models.campaign import Campaign
from app.models.client import Client
from app.models.content_version import ContentVersion
from app.models.comment import DeliverableComment
from app.models.deliverable import Deliverable, DeliverableStatus
from app.models.task import Task, TaskStatus
from app.models.user import Membership, User
from app.schemas.comment import CommentCreate, CommentOut
from app.schemas.deliverable import ContentVersionOut, DeliverableDetailOut
from app.schemas.campaign import DeliverableOut, DeliverableUpdate
from app.services.credit_service import IMAGE_GENERATION_CREDIT_COST, precheck_agency_credits
from app.services.storage_service import delete_file, save_file
from app.services.tenant_service import assert_deliverable_belongs_to_agency
from app.services.visual_generation_service import (
    VisualPreset,
    execute_visual_generation_job,
    resolve_preset_dimensions,
)

router = APIRouter(tags=["deliverables"])


class DeliverableStatusUpdate(BaseModel):
    status: DeliverableStatus

ALLOWED_MIME_PREFIXES = ("video/", "image/", "application/", "text/")
ALLOWED_DOCUMENT_EXTENSIONS = (".pdf", ".docx", ".doc", ".txt", ".rtf", ".csv", ".json")
MAX_FILE_SIZE_MB = 500


async def _get_deliverable_or_404(
    deliverable_id: uuid.UUID,
    agency_id: uuid.UUID,
    db: AsyncSession,
) -> Deliverable:
    await assert_deliverable_belongs_to_agency(deliverable_id, agency_id, db)
    result = await db.execute(
        select(Deliverable).where(Deliverable.id == deliverable_id)
    )
    deliverable = result.scalar_one_or_none()
    if deliverable is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deliverable not found.")
    return deliverable


# ---------------------------------------------------------------------------
# GET deliverables list for agency
# ---------------------------------------------------------------------------


@router.get(
    "/agencies/{agency_id}/deliverables",
    response_model=list[DeliverableOut],
)
async def list_agency_deliverables(
    agency_id: uuid.UUID,
    client_id: uuid.UUID | None = Query(None),
    campaign_id: uuid.UUID | None = Query(None),
    month: int | None = Query(None, ge=1, le=12),
    year: int | None = Query(None, ge=2020, le=2050),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    platform: str | None = Query(None),
    deliverable_status: DeliverableStatus | None = Query(None, alias="status"),
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> list[DeliverableOut]:
    """List all deliverables for an agency, with calendar date range, client, campaign, and platform filters."""
    query = (
        select(
            Deliverable,
            Campaign.name.label("campaign_title"),
            Client.id.label("client_id"),
            Client.business_name.label("client_name"),
        )
        .join(Campaign, Deliverable.campaign_id == Campaign.id)
        .join(Client, Campaign.client_id == Client.id)
        .where(Client.agency_id == agency_id)
    )
    if campaign_id:
        query = query.where(Deliverable.campaign_id == campaign_id)
    if client_id:
        query = query.where(Campaign.client_id == client_id)
    if platform and platform.lower() != "all":
        query = query.where(func.lower(Deliverable.platform) == platform.lower())
    if deliverable_status:
        query = query.where(Deliverable.status == deliverable_status)
    if start_date:
        query = query.where(Deliverable.planned_date >= start_date)
    if end_date:
        query = query.where(Deliverable.planned_date <= end_date)
    if month and year:
        query = query.where(
            func.extract("month", Deliverable.planned_date) == month,
            func.extract("year", Deliverable.planned_date) == year,
        )
    elif year:
        query = query.where(func.extract("year", Deliverable.planned_date) == year)

    query = query.order_by(Deliverable.planned_date.asc().nullslast(), Deliverable.created_at.desc())
    result = await db.execute(query)
    rows = result.all()

    if not rows:
        return []

    deliv_ids = [r[0].id for r in rows]

    # Pre-fetch latest content versions for these deliverables
    cv_res = await db.execute(
        select(ContentVersion)
        .where(ContentVersion.deliverable_id.in_(deliv_ids))
        .order_by(ContentVersion.version_number.desc())
    )
    all_versions = cv_res.scalars().all()
    latest_cv_map: dict[uuid.UUID, ContentVersion] = {}
    for cv in all_versions:
        if cv.deliverable_id not in latest_cv_map:
            latest_cv_map[cv.deliverable_id] = cv

    # Pre-fetch sibling tasks to compute progress
    t_res = await db.execute(
        select(Task).where(Task.deliverable_id.in_(deliv_ids))
    )
    all_tasks = t_res.scalars().all()
    tasks_map: dict[uuid.UUID, list[Task]] = {}
    for t in all_tasks:
        tasks_map.setdefault(t.deliverable_id, []).append(t)

    out: list[DeliverableOut] = []
    for d, camp_title, c_id, c_name in rows:
        item = DeliverableOut.model_validate(d)
        item.campaign_title = camp_title
        item.client_id = c_id
        item.client_name = c_name

        # Attach latest asset details
        latest_cv = latest_cv_map.get(d.id)
        if latest_cv:
            item.latest_caption = latest_cv.caption
            item.latest_asset_url = f"/uploads/{latest_cv.storage_key}"
            item.latest_file_type = latest_cv.file_type

        # Attach tasks metrics
        d_tasks = tasks_map.get(d.id, [])
        item.tasks_count = len(d_tasks)
        item.tasks_completed_count = sum(1 for t in d_tasks if t.status in (TaskStatus.approved, TaskStatus.done))

        out.append(item)

    return out


# ---------------------------------------------------------------------------
# GET deliverable detail
# ---------------------------------------------------------------------------


@router.get(
    "/agencies/{agency_id}/deliverables/{deliverable_id}",
    response_model=DeliverableDetailOut,
)
async def get_deliverable(
    agency_id: uuid.UUID,
    deliverable_id: uuid.UUID,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> DeliverableDetailOut:
    """Return a deliverable and its full content version history."""
    deliverable = await _get_deliverable_or_404(deliverable_id, agency_id, db)
    return DeliverableDetailOut.model_validate(deliverable)


# ---------------------------------------------------------------------------
# GET versions list
# ---------------------------------------------------------------------------


@router.get(
    "/agencies/{agency_id}/deliverables/{deliverable_id}/versions",
    response_model=list[ContentVersionOut],
)
async def list_versions(
    agency_id: uuid.UUID,
    deliverable_id: uuid.UUID,
    task_id: uuid.UUID | None = Query(None),
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> list[ContentVersionOut]:
    """List all content versions for a deliverable, optionally filtered by task."""
    await assert_deliverable_belongs_to_agency(deliverable_id, agency_id, db)
    query = (
        select(ContentVersion)
        .where(ContentVersion.deliverable_id == deliverable_id)
        .order_by(ContentVersion.version_number)
    )
    if task_id is not None:
        query = query.where(ContentVersion.task_id == task_id)
    result = await db.execute(query)
    versions = result.scalars().all()
    return [ContentVersionOut.model_validate(v) for v in versions]


# ---------------------------------------------------------------------------
# POST upload a new version
# ---------------------------------------------------------------------------


@router.post(
    "/agencies/{agency_id}/deliverables/{deliverable_id}/versions",
    response_model=ContentVersionOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_version(
    agency_id: uuid.UUID,
    deliverable_id: uuid.UUID,
    file: UploadFile = File(...),
    caption: str | None = Form(None),
    notes: str | None = Form(None),
    task_id: uuid.UUID | None = Form(None),
    membership: Membership = Depends(require_agency_member),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ContentVersionOut:
    """
    Upload a new content version for a deliverable.
    Accepts video (.mp4, .mov), image (.jpg, .png, .gif, .webp), or document (.pdf, .docx, .doc, .txt) files.
    Optionally tags the asset to a specific production task (e.g. scripting, filming, editing).
    Automatically increments version_number.
    Also bumps deliverable status → in_production if still not_started.
    """
    await assert_deliverable_belongs_to_agency(deliverable_id, agency_id, db)

    # Validate file type
    suffix = Path(file.filename or "").suffix.lower()
    is_valid_type = (
        not file.content_type
        or any(file.content_type.startswith(prefix) for prefix in ALLOWED_MIME_PREFIXES)
        or suffix in ALLOWED_DOCUMENT_EXTENSIONS
    )
    if not is_valid_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file format. Please upload a video, image, PDF, Word doc (.docx), or text (.txt) file.",
        )

    # Validate task if provided
    if task_id is not None:
        task = await db.get(Task, task_id)
        if not task or task.deliverable_id != deliverable_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Specified task does not belong to this deliverable.",
            )
        # Advance task status if currently in todo or backlog
        if task.status in (TaskStatus.todo, TaskStatus.backlog):
            task.status = TaskStatus.in_progress

    # Count existing versions to determine new version_number
    count_result = await db.execute(
        select(func.count()).where(ContentVersion.deliverable_id == deliverable_id)
    )
    version_number = (count_result.scalar() or 0) + 1

    # Save file to local filesystem
    storage_key, checksum, file_size = await save_file(file, deliverable_id)

    content_version = ContentVersion(
        id=uuid.uuid4(),
        deliverable_id=deliverable_id,
        task_id=task_id,
        version_number=version_number,
        storage_key=storage_key,
        file_name=file.filename or "upload",
        file_type=file.content_type,
        file_size_bytes=file_size,
        checksum_sha256=checksum,
        caption=caption,
        notes=notes,
        uploaded_by_id=current_user.id,
    )
    db.add(content_version)

    # Bump deliverable status if still at not_started
    deliv_result = await db.execute(
        select(Deliverable).where(Deliverable.id == deliverable_id)
    )
    deliverable = deliv_result.scalar_one_or_none()
    if deliverable and deliverable.status == DeliverableStatus.not_started:
        deliverable.status = DeliverableStatus.in_production

    await db.commit()
    await db.refresh(content_version)
    return ContentVersionOut.model_validate(content_version)


# ---------------------------------------------------------------------------
# POST generate AI visual asset asynchronously (NVIDIA Flux-3-Image-Klein -> S3/B2)
# ---------------------------------------------------------------------------


class GenerateVisualRequest(BaseModel):
    preset: VisualPreset = "portrait_4_5"
    prompt: str | None = Field(None, max_length=1500)
    slide_index: int | None = Field(None, ge=1, le=20)
    steps: int = Field(35, ge=1, le=50)
    task_id: uuid.UUID | None = None


class GenerateVisualAcceptedOut(BaseModel):
    status: Literal["queued"] = "queued"
    job_id: str
    deliverable_id: uuid.UUID
    preset: VisualPreset
    width: int
    height: int
    credit_cost: int
    credits_available: int


@router.post(
    "/agencies/{agency_id}/deliverables/{deliverable_id}/generate-visual",
    response_model=GenerateVisualAcceptedOut,
    status_code=status.HTTP_202_ACCEPTED,
)
async def generate_deliverable_visual(
    agency_id: uuid.UUID,
    deliverable_id: uuid.UUID,
    payload: GenerateVisualRequest,
    _: Membership = Depends(require_agency_member),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GenerateVisualAcceptedOut:
    """
    Pre-check agency credits, validate Flux Klein resolution preset (1024x1024, 896x1120, or 768x1360),
    and queue asynchronous visual generation uploaded strictly to remote S3/B2 storage.
    """
    await _get_deliverable_or_404(deliverable_id, agency_id, db)

    if payload.task_id is not None:
        task = await db.get(Task, payload.task_id)
        if not task or task.deliverable_id != deliverable_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Specified task does not belong to this deliverable.",
            )

    try:
        width, height, _label = resolve_preset_dimensions(payload.preset)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    credits_available = await precheck_agency_credits(
        agency_id=agency_id,
        required_credits=IMAGE_GENERATION_CREDIT_COST,
        db=db,
    )

    job_id = uuid.uuid4().hex
    asyncio.create_task(
        execute_visual_generation_job(
            job_id=job_id,
            agency_id=agency_id,
            deliverable_id=deliverable_id,
            user_id=current_user.id,
            preset=payload.preset,
            raw_prompt=payload.prompt,
            slide_index=payload.slide_index,
            steps=payload.steps,
            task_id=payload.task_id,
        )
    )

    return GenerateVisualAcceptedOut(
        status="queued",
        job_id=job_id,
        deliverable_id=deliverable_id,
        preset=payload.preset,
        width=width,
        height=height,
        credit_cost=IMAGE_GENERATION_CREDIT_COST,
        credits_available=credits_available,
    )


# ---------------------------------------------------------------------------
# DELETE a version
# ---------------------------------------------------------------------------


@router.delete(
    "/agencies/{agency_id}/deliverables/{deliverable_id}/versions/{version_id}",
    status_code=status.HTTP_200_OK,
)
async def delete_version(
    agency_id: uuid.UUID,
    deliverable_id: uuid.UUID,
    version_id: uuid.UUID,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a specific content version and its stored file."""
    await assert_deliverable_belongs_to_agency(deliverable_id, agency_id, db)
    result = await db.execute(
        select(ContentVersion).where(
            ContentVersion.id == version_id,
            ContentVersion.deliverable_id == deliverable_id,
        )
    )
    version = result.scalar_one_or_none()
    if version is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found.")

    delete_file(version.storage_key)
    await db.delete(version)
    await db.commit()


# ---------------------------------------------------------------------------
# PATCH deliverable status
# ---------------------------------------------------------------------------


@router.patch(
    "/agencies/{agency_id}/deliverables/{deliverable_id}",
    response_model=DeliverableOut,
)
async def update_deliverable(
    agency_id: uuid.UUID,
    deliverable_id: uuid.UUID,
    payload: DeliverableUpdate,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> DeliverableOut:
    """Update deliverable status, scheduled date, or planned calendar date."""
    deliverable = await _get_deliverable_or_404(deliverable_id, agency_id, db)

    # 1. Update planned_date if provided (Rescheduling on Content Calendar)
    if payload.planned_date is not None:
        deliverable.planned_date = payload.planned_date
        # Stagger sibling task deadlines backward from the new planned date
        tasks_res = await db.execute(
            select(Task).where(Task.deliverable_id == deliverable.id)
        )
        tasks = tasks_res.scalars().all()
        if tasks:
            from datetime import timedelta
            for t in tasks:
                t_type = (t.task_type or "").lower()
                if any(w in t_type for w in ["script", "copy", "writing"]):
                    t.due_date = payload.planned_date - timedelta(days=4)
                elif any(w in t_type for w in ["shoot", "film"]):
                    t.due_date = payload.planned_date - timedelta(days=2)
                elif any(w in t_type for w in ["edit", "design", "motion"]):
                    t.due_date = payload.planned_date - timedelta(days=1)
                else:
                    t.due_date = payload.planned_date

    # 2. Update scheduled_at if provided
    if payload.scheduled_at is not None:
        deliverable.scheduled_at = payload.scheduled_at
    if payload.scheduled_timezone is not None:
        deliverable.scheduled_timezone = payload.scheduled_timezone
    if payload.title is not None and payload.title.strip():
        deliverable.title = payload.title.strip()

    # 3. Synchronize status if provided
    if payload.status is not None:
        deliverable.status = payload.status

        # Synchronize linked tasks (preserve production stages when reviewing/approving)
        task_map = {
            DeliverableStatus.not_started: TaskStatus.todo,
            DeliverableStatus.in_production: TaskStatus.in_progress,
            DeliverableStatus.internal_review: TaskStatus.internal_review,
            DeliverableStatus.client_review: TaskStatus.client_review,
            DeliverableStatus.changes_requested: TaskStatus.changes_requested,
            DeliverableStatus.approved: TaskStatus.approved,
        }
        if deliverable.status in task_map:
            tasks_res = await db.execute(
                select(Task).where(Task.deliverable_id == deliverable.id)
            )
            tasks = tasks_res.scalars().all()
            if deliverable.status in (
                DeliverableStatus.internal_review,
                DeliverableStatus.client_review,
                DeliverableStatus.changes_requested,
                DeliverableStatus.approved,
            ):
                review_tasks = [t for t in tasks if t.task_type in ("approval", "review")]
                if review_tasks:
                    for t in review_tasks:
                        t.status = task_map[deliverable.status]
                else:
                    for t in tasks:
                        t.status = task_map[deliverable.status]
            else:
                for t in tasks:
                    t.status = task_map[deliverable.status]

    await db.commit()
    await db.refresh(deliverable)
    out = DeliverableOut.model_validate(deliverable)
    if deliverable.campaign:
        out.campaign_title = deliverable.campaign.name
        if deliverable.campaign.client:
            out.client_id = deliverable.campaign.client.id
            out.client_name = deliverable.campaign.client.business_name
    return out


# ---------------------------------------------------------------------------
# Comments
# ---------------------------------------------------------------------------


@router.post(
    "/agencies/{agency_id}/deliverables/{deliverable_id}/comments",
    response_model=CommentOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_deliverable_comment(
    agency_id: uuid.UUID,
    deliverable_id: uuid.UUID,
    payload: CommentCreate,
    membership: Membership = Depends(require_agency_member),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CommentOut:
    """Post an internal or client-facing comment on a deliverable."""
    await assert_deliverable_belongs_to_agency(deliverable_id, agency_id, db)

    comment = DeliverableComment(
        id=uuid.uuid4(),
        deliverable_id=deliverable_id,
        content_version_id=payload.content_version_id,
        author_id=current_user.id,
        message=payload.message,
        is_internal=payload.is_internal,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)

    return CommentOut(
        id=comment.id,
        deliverable_id=comment.deliverable_id,
        content_version_id=comment.content_version_id,
        author_id=comment.author_id,
        author_name=current_user.full_name or current_user.email,
        author_role=membership.role.value,
        message=comment.message,
        is_internal=comment.is_internal,
        created_at=comment.created_at,
    )

