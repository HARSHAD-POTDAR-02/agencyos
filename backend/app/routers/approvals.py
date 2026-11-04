from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies import get_current_user, require_agency_member
from app.models.approval import Approval
from app.models.campaign import Campaign
from app.models.client import Client
from app.models.content_version import ContentVersion
from app.models.deliverable import Deliverable
from app.models.user import Membership, RoleEnum, User
from app.schemas.approval import ApprovalCreate, ApprovalOut
from app.services.tenant_service import assert_deliverable_belongs_to_agency

router = APIRouter(tags=["approvals"])


@router.post(
    "/agencies/{agency_id}/content-versions/{version_id}/approve",
    response_model=ApprovalOut,
    status_code=status.HTTP_201_CREATED,
)
async def submit_approval(
    agency_id: uuid.UUID,
    version_id: uuid.UUID,
    payload: ApprovalCreate,
    membership: Membership = Depends(require_agency_member),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApprovalOut:
    """
    Submit an approval decision for a content version.
    Reviewer must hold the 'client' role or be an internal agency member.
    """
    # Enforce reviewer role: client, or internal (not client) roles are allowed
    allowed_roles = {
        RoleEnum.client,
        RoleEnum.owner,
        RoleEnum.account_manager,
        RoleEnum.strategist,
    }
    if membership.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your role is not permitted to submit approvals.",
        )

    # Load the content version
    result = await db.execute(
        select(ContentVersion).where(ContentVersion.id == version_id)
    )
    content_version = result.scalar_one_or_none()
    if content_version is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Content version not found."
        )

    # Verify the content version belongs to this agency via deliverable chain
    await assert_deliverable_belongs_to_agency(content_version.deliverable_id, agency_id, db)

    # Prevent duplicate approval for the same version
    existing = await db.execute(
        select(Approval).where(Approval.content_version_id == version_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This content version already has an approval decision.",
        )

    approval = Approval(
        id=uuid.uuid4(),
        content_version_id=version_id,
        reviewer_id=current_user.id,
        decision=payload.decision,
        comment=payload.comment,
    )
    db.add(approval)
    await db.commit()
    await db.refresh(approval)
    return ApprovalOut.model_validate(approval)


@router.get("/agencies/{agency_id}/approvals", response_model=list[ApprovalOut])
async def list_pending_approvals(
    agency_id: uuid.UUID,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> list[ApprovalOut]:
    """
    List all approvals for content versions that belong to this agency.
    Includes all decisions (pending is implied by absence of approval record).
    """
    result = await db.execute(
        select(Approval)
        .join(ContentVersion, Approval.content_version_id == ContentVersion.id)
        .join(Deliverable, ContentVersion.deliverable_id == Deliverable.id)
        .join(Campaign, Deliverable.campaign_id == Campaign.id)
        .join(Client, Campaign.client_id == Client.id)
        .where(Client.agency_id == agency_id, Approval.is_valid.is_(True))
    )
    approvals = result.scalars().all()
    return [ApprovalOut.model_validate(a) for a in approvals]
