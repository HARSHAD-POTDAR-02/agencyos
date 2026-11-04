from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies import get_current_user, require_agency_member, require_role
from app.models.user import Membership, RoleEnum, User
from app.schemas.agency import AgencyCreate, AgencyOut, InviteMemberRequest, MembershipOut
from app.services.auth_service import create_agency_with_owner

router = APIRouter(prefix="/agencies", tags=["agencies"])


@router.post("", response_model=AgencyOut, status_code=status.HTTP_201_CREATED)
async def create_agency(
    payload: AgencyCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AgencyOut:
    """Create a new agency and assign the requester as owner."""
    from app.models.agency import Agency
    # Check slug uniqueness if explicitly provided
    if payload.slug:
        result = await db.execute(select(Agency).where(Agency.slug == payload.slug))
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Slug already taken."
            )
    agency = await create_agency_with_owner(payload.name, current_user, db)
    # Override slug if provided explicitly
    if payload.slug and payload.slug != agency.slug:
        agency.slug = payload.slug
    if payload.timezone:
        agency.timezone = payload.timezone
    await db.commit()
    await db.refresh(agency)
    return AgencyOut.model_validate(agency)


@router.get("/me", response_model=list[AgencyOut])
async def list_my_agencies(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[AgencyOut]:
    """List all agencies the current user belongs to."""
    from app.models.agency import Agency
    result = await db.execute(
        select(Agency)
        .join(Membership, Membership.agency_id == Agency.id)
        .where(
            Membership.user_id == current_user.id,
            Membership.is_active.is_(True),
        )
    )
    agencies = result.scalars().all()
    return [AgencyOut.model_validate(a) for a in agencies]


@router.get("/{agency_id}", response_model=AgencyOut)
async def get_agency(
    agency_id: uuid.UUID,
    membership: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> AgencyOut:
    """Get agency detail. Caller must be a member."""
    from app.models.agency import Agency
    result = await db.execute(select(Agency).where(Agency.id == agency_id))
    agency = result.scalar_one_or_none()
    if agency is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agency not found.")
    return AgencyOut.model_validate(agency)


@router.post("/{agency_id}/members", response_model=MembershipOut, status_code=201)
async def invite_member(
    agency_id: uuid.UUID,
    payload: InviteMemberRequest,
    _: Membership = Depends(require_role(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db),
) -> MembershipOut:
    """Invite a user to the agency (owner only). The user must already exist."""
    result = await db.execute(select(User).where(User.email == payload.email.lower()))
    target_user = result.scalar_one_or_none()
    if target_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No user found with that email. They must register first.",
        )
    # Check for existing membership
    existing = await db.execute(
        select(Membership).where(
            Membership.user_id == target_user.id,
            Membership.agency_id == agency_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a member of this agency.",
        )
    membership = Membership(
        id=uuid.uuid4(),
        user_id=target_user.id,
        agency_id=agency_id,
        role=payload.role,
    )
    db.add(membership)
    await db.commit()
    await db.refresh(membership)
    return MembershipOut.model_validate(membership)


@router.get("/{agency_id}/members", response_model=list[MembershipOut])
async def list_members(
    agency_id: uuid.UUID,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> list[MembershipOut]:
    """List all members of an agency."""
    result = await db.execute(
        select(Membership).where(
            Membership.agency_id == agency_id,
            Membership.is_active.is_(True),
        )
    )
    memberships = result.scalars().all()
    return [MembershipOut.model_validate(m) for m in memberships]
