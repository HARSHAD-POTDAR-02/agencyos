from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies import get_current_user, require_agency_member
from app.models.approval import Approval
from app.models.brand_profile import BrandProfile
from app.models.campaign import Campaign
from app.models.client import Client
from app.models.comment import DeliverableComment
from app.models.content_version import ContentVersion
from app.models.contract import Contract, ScopeItem
from app.models.deliverable import Deliverable
from app.models.client_reviewer import ClientReviewer
from app.models.client_social_account import ClientSocialAccount
from app.models.task import Task
from app.models.user import Membership, RoleEnum, User
from app.core.security import hash_password
from app.schemas.campaign import QuotaSummaryOut
from app.schemas.client import ClientCreate, ClientListItem, ClientOut, ClientUpdate
from app.schemas.portal import ClientReviewerCreate, ClientReviewerOut
from app.schemas.contract import (
    BrandProfileOut,
    BrandProfileUpdate,
    ContractCreate,
    ContractOut,
)
from app.services.quota_service import get_monthly_quota_summary, get_clients_scope_progress
from app.services.tenant_service import get_client_for_agency

router = APIRouter(prefix="/agencies/{agency_id}/clients", tags=["clients"])


@router.post("", response_model=ClientOut, status_code=status.HTTP_201_CREATED)
async def create_client(
    agency_id: uuid.UUID,
    payload: ClientCreate,
    membership: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> ClientOut:
    """Create a new client under the agency."""
    client = Client(
        id=uuid.uuid4(),
        agency_id=agency_id,
        **payload.model_dump(),
    )
    db.add(client)
    await db.commit()
    await db.refresh(client)
    return ClientOut.model_validate(client)


@router.get("", response_model=list[ClientOut])
async def list_clients(
    agency_id: uuid.UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> list[ClientOut]:
    """List all clients for the agency (paginated) with dynamic monthly scope & delivery progress."""
    result = await db.execute(
        select(Client)
        .where(Client.agency_id == agency_id)
        .offset(skip)
        .limit(limit)
    )
    clients = result.scalars().all()
    client_ids = [c.id for c in clients]
    scope_map = await get_clients_scope_progress(client_ids, db)

    out: list[ClientOut] = []
    for c in clients:
        c_dict = ClientOut.model_validate(c).model_dump()
        c_dict["scope_progress"] = scope_map.get(c.id)
        out.append(ClientOut(**c_dict))
    return out


@router.get("/{client_id}", response_model=ClientOut)
async def get_client(
    agency_id: uuid.UUID,
    client_id: uuid.UUID,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> ClientOut:
    """Retrieve a single client, enforcing tenant isolation, with dynamic monthly scope."""
    client = await get_client_for_agency(client_id, agency_id, db)
    scope_map = await get_clients_scope_progress([client.id], db)
    c_dict = ClientOut.model_validate(client).model_dump()
    c_dict["scope_progress"] = scope_map.get(client.id)
    return ClientOut(**c_dict)


@router.patch("/{client_id}", response_model=ClientOut)
async def update_client(
    agency_id: uuid.UUID,
    client_id: uuid.UUID,
    payload: ClientUpdate,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> ClientOut:
    """Partially update a client."""
    client = await get_client_for_agency(client_id, agency_id, db)
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(client, field, value)
    await db.commit()
    await db.refresh(client)
    scope_map = await get_clients_scope_progress([client.id], db)
    c_dict = ClientOut.model_validate(client).model_dump()
    c_dict["scope_progress"] = scope_map.get(client.id)
    return ClientOut(**c_dict)


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client(
    agency_id: uuid.UUID,
    client_id: uuid.UUID,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Delete a client workspace and cascade delete all their campaigns, contracts, and deliverables."""
    client = await get_client_for_agency(client_id, agency_id, db)

    # 1. Cascade delete all deliverables, tasks, comments, approvals, content versions for client's campaigns
    campaign_res = await db.execute(select(Campaign.id).where(Campaign.client_id == client_id))
    campaign_ids = list(campaign_res.scalars().all())
    if campaign_ids:
        deliv_res = await db.execute(select(Deliverable.id).where(Deliverable.campaign_id.in_(campaign_ids)))
        deliv_ids = list(deliv_res.scalars().all())
        if deliv_ids:
            cv_res = await db.execute(select(ContentVersion.id).where(ContentVersion.deliverable_id.in_(deliv_ids)))
            cv_ids = list(cv_res.scalars().all())
            if cv_ids:
                await db.execute(delete(Approval).where(Approval.content_version_id.in_(cv_ids)))
            await db.execute(delete(DeliverableComment).where(DeliverableComment.deliverable_id.in_(deliv_ids)))
            await db.execute(delete(ContentVersion).where(ContentVersion.deliverable_id.in_(deliv_ids)))
            await db.execute(delete(Task).where(Task.deliverable_id.in_(deliv_ids)))
            await db.execute(delete(Deliverable).where(Deliverable.id.in_(deliv_ids)))
        await db.execute(delete(Campaign).where(Campaign.id.in_(campaign_ids)))

    # 2. Cascade delete contracts and scope items
    contract_res = await db.execute(select(Contract.id).where(Contract.client_id == client_id))
    contract_ids = list(contract_res.scalars().all())
    if contract_ids:
        await db.execute(delete(ScopeItem).where(ScopeItem.contract_id.in_(contract_ids)))
        await db.execute(delete(Contract).where(Contract.id.in_(contract_ids)))

    # 3. Cascade delete brand profiles, reviewers, social accounts
    await db.execute(delete(BrandProfile).where(BrandProfile.client_id == client_id))
    await db.execute(delete(ClientReviewer).where(ClientReviewer.client_id == client_id))
    await db.execute(delete(ClientSocialAccount).where(ClientSocialAccount.client_id == client_id))

    # 4. Delete the client
    await db.delete(client)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{client_id}/quota", response_model=list[QuotaSummaryOut])
async def get_quota(
    agency_id: uuid.UUID,
    client_id: uuid.UUID,
    period_month: int = Query(..., ge=1, le=12),
    period_year: int = Query(..., ge=2000, le=2100),
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> list[QuotaSummaryOut]:
    """Return quota usage summary for a client in a given month/year."""
    await get_client_for_agency(client_id, agency_id, db)
    summary = await get_monthly_quota_summary(client_id, period_month, period_year, db)
    return [QuotaSummaryOut(**s) for s in summary]


# ── Brand Profile Endpoints ──
@router.get("/{client_id}/brand-profile", response_model=BrandProfileOut | None)
async def get_brand_profile(
    agency_id: uuid.UUID,
    client_id: uuid.UUID,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> BrandProfileOut | None:
    """Get the confirmed or latest brand profile for a client."""
    await get_client_for_agency(client_id, agency_id, db)
    result = await db.execute(
        select(BrandProfile)
        .where(BrandProfile.client_id == client_id)
        .order_by(BrandProfile.version.desc())
    )
    profile = result.scalars().first()
    if profile is None:
        return None
    return BrandProfileOut.model_validate(profile)


@router.put("/{client_id}/brand-profile", response_model=BrandProfileOut)
async def upsert_brand_profile(
    agency_id: uuid.UUID,
    client_id: uuid.UUID,
    payload: BrandProfileUpdate,
    membership: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> BrandProfileOut:
    """Upsert brand guidelines & voice profile for a client."""
    await get_client_for_agency(client_id, agency_id, db)
    result = await db.execute(
        select(BrandProfile)
        .where(BrandProfile.client_id == client_id)
        .order_by(BrandProfile.version.desc())
    )
    existing = result.scalars().first()

    if existing is None:
        profile = BrandProfile(
            id=uuid.uuid4(),
            client_id=client_id,
            version=1,
            is_confirmed=payload.is_confirmed or False,
            brand_voice=payload.brand_voice,
            tone_examples=payload.tone_examples,
            approved_phrases=payload.approved_phrases,
            prohibited_claims=payload.prohibited_claims,
            target_audience=payload.target_audience,
            content_pillars=payload.content_pillars,
            goals=payload.goals,
        )
        db.add(profile)
    else:
        # Update existing
        update_data = payload.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(existing, field, value)
        profile = existing

    await db.commit()
    await db.refresh(profile)
    return BrandProfileOut.model_validate(profile)


# ── Contract & Retainer Quota Endpoints ──
@router.get("/{client_id}/contracts", response_model=list[ContractOut])
async def list_contracts(
    agency_id: uuid.UUID,
    client_id: uuid.UUID,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> list[ContractOut]:
    """List all retainer contracts and their scope items for a client."""
    await get_client_for_agency(client_id, agency_id, db)
    result = await db.execute(
        select(Contract).where(Contract.client_id == client_id).order_by(Contract.created_at.desc())
    )
    contracts = result.scalars().all()
    return [ContractOut.model_validate(c) for c in contracts]


@router.post("/{client_id}/contracts", response_model=ContractOut, status_code=status.HTTP_201_CREATED)
async def create_contract(
    agency_id: uuid.UUID,
    client_id: uuid.UUID,
    payload: ContractCreate,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> ContractOut:
    """Create a new contract and associated monthly scope items."""
    await get_client_for_agency(client_id, agency_id, db)
    
    contract_data = payload.model_dump(exclude={"scope_items"})
    contract = Contract(
        id=uuid.uuid4(),
        client_id=client_id,
        **contract_data,
    )
    db.add(contract)
    await db.flush()

    for item in payload.scope_items:
        scope = ScopeItem(
            id=uuid.uuid4(),
            contract_id=contract.id,
            deliverable_type=item.deliverable_type,
            platform=item.platform,
            monthly_quantity=item.monthly_quantity,
        )
        db.add(scope)

    await db.commit()
    await db.refresh(contract)
    return ContractOut.model_validate(contract)


# ---------------------------------------------------------------------------
# Client Reviewers
# ---------------------------------------------------------------------------


@router.get("/{client_id}/reviewers", response_model=list[ClientReviewerOut])
async def list_client_reviewers(
    agency_id: uuid.UUID,
    client_id: uuid.UUID,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> list[ClientReviewerOut]:
    """List all reviewers assigned to this client."""
    await get_client_for_agency(client_id, agency_id, db)

    result = await db.execute(
        select(ClientReviewer, User)
        .join(User, ClientReviewer.user_id == User.id)
        .where(ClientReviewer.client_id == client_id)
        .order_by(ClientReviewer.created_at.desc())
    )

    reviewers: list[ClientReviewerOut] = []
    for cr, u in result.all():
        reviewers.append(
            ClientReviewerOut(
                id=cr.id,
                client_id=cr.client_id,
                user_id=cr.user_id,
                email=u.email,
                full_name=u.full_name,
                created_at=cr.created_at,
            )
        )
    return reviewers


@router.post(
    "/{client_id}/reviewers",
    response_model=ClientReviewerOut,
    status_code=status.HTTP_201_CREATED,
)
async def invite_client_reviewer(
    agency_id: uuid.UUID,
    client_id: uuid.UUID,
    payload: ClientReviewerCreate,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> ClientReviewerOut:
    """
    Invite or link a client reviewer to this client.
    Creates user account if needed, sets role=client, and registers client review permissions.
    """
    await get_client_for_agency(client_id, agency_id, db)

    # Check if user already exists
    user_res = await db.execute(select(User).where(User.email == payload.email))
    user = user_res.scalar_one_or_none()

    if user is None:
        user = User(
            id=uuid.uuid4(),
            email=payload.email,
            hashed_password=hash_password(payload.password),
            full_name=payload.full_name,
        )
        db.add(user)
        await db.flush()

    # Ensure agency membership exists with role=client
    mem_res = await db.execute(
        select(Membership).where(
            Membership.user_id == user.id,
            Membership.agency_id == agency_id,
        )
    )
    membership = mem_res.scalar_one_or_none()
    if membership is None:
        membership = Membership(
            id=uuid.uuid4(),
            user_id=user.id,
            agency_id=agency_id,
            role=RoleEnum.client,
        )
        db.add(membership)
        await db.flush()

    # Ensure client reviewer link exists
    rev_res = await db.execute(
        select(ClientReviewer).where(
            ClientReviewer.client_id == client_id,
            ClientReviewer.user_id == user.id,
        )
    )
    reviewer = rev_res.scalar_one_or_none()
    if reviewer is None:
        reviewer = ClientReviewer(
            id=uuid.uuid4(),
            client_id=client_id,
            user_id=user.id,
        )
        db.add(reviewer)
        await db.commit()
        await db.refresh(reviewer)
    else:
        await db.commit()

    return ClientReviewerOut(
        id=reviewer.id,
        client_id=reviewer.client_id,
        user_id=reviewer.user_id,
        email=user.email,
        full_name=user.full_name,
        created_at=reviewer.created_at,
    )

