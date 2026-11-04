from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies import get_current_user, require_agency_member
from app.models.brand_profile import BrandProfile
from app.models.client import Client
from app.models.contract import Contract, ScopeItem
from app.models.user import Membership, User
from app.schemas.campaign import QuotaSummaryOut
from app.schemas.client import ClientCreate, ClientListItem, ClientOut, ClientUpdate
from app.schemas.contract import (
    BrandProfileOut,
    BrandProfileUpdate,
    ContractCreate,
    ContractOut,
)
from app.services.quota_service import get_monthly_quota_summary
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
    """List all clients for the agency (paginated)."""
    result = await db.execute(
        select(Client)
        .where(Client.agency_id == agency_id)
        .offset(skip)
        .limit(limit)
    )
    clients = result.scalars().all()
    return [ClientOut.model_validate(c) for c in clients]


@router.get("/{client_id}", response_model=ClientOut)
async def get_client(
    agency_id: uuid.UUID,
    client_id: uuid.UUID,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> ClientOut:
    """Retrieve a single client, enforcing tenant isolation."""
    client = await get_client_for_agency(client_id, agency_id, db)
    return ClientOut.model_validate(client)


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
    return ClientOut.model_validate(client)


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
