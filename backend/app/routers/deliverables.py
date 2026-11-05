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

import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies import get_current_user, require_agency_member
from app.models.content_version import ContentVersion
from app.models.deliverable import Deliverable, DeliverableStatus
from app.models.user import Membership, User
from app.schemas.deliverable import ContentVersionOut, DeliverableDetailOut
from app.schemas.campaign import DeliverableOut
from app.services.storage_service import delete_file, save_file
from app.services.tenant_service import assert_deliverable_belongs_to_agency

router = APIRouter(tags=["deliverables"])


class DeliverableStatusUpdate(BaseModel):
    status: DeliverableStatus

ALLOWED_MIME_PREFIXES = ("video/", "image/", "application/")
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
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> list[ContentVersionOut]:
    """List all content versions for a deliverable, ordered by version number."""
    await assert_deliverable_belongs_to_agency(deliverable_id, agency_id, db)
    result = await db.execute(
        select(ContentVersion)
        .where(ContentVersion.deliverable_id == deliverable_id)
        .order_by(ContentVersion.version_number)
    )
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
    membership: Membership = Depends(require_agency_member),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ContentVersionOut:
    """
    Upload a new content version for a deliverable.
    Accepts video (.mp4, .mov) or image (.jpg, .png, .gif, .webp) files.
    Automatically increments version_number.
    Also bumps deliverable status → in_production if still not_started.
    """
    await assert_deliverable_belongs_to_agency(deliverable_id, agency_id, db)

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


class DeliverableStatusUpdate(BaseModel):
    status: DeliverableStatus


@router.patch(
    "/agencies/{agency_id}/deliverables/{deliverable_id}",
    response_model=DeliverableOut,
)
async def update_deliverable_status(
    agency_id: uuid.UUID,
    deliverable_id: uuid.UUID,
    payload: DeliverableStatusUpdate,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> DeliverableOut:
    """Update the status of a deliverable (e.g. move to internal_review, approved, published)."""
    deliverable = await _get_deliverable_or_404(deliverable_id, agency_id, db)
    deliverable.status = payload.status
    await db.commit()
    await db.refresh(deliverable)
    return DeliverableOut.model_validate(deliverable)
