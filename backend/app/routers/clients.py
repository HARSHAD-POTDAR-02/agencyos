from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies import get_current_user, require_agency_member
from app.models.client import Client
from app.models.user import Membership, User
from app.schemas.campaign import QuotaSummaryOut
from app.schemas.client import ClientCreate, ClientListItem, ClientOut, ClientUpdate
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


@router.get("", response_model=list[ClientListItem])
async def list_clients(
    agency_id: uuid.UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> list[ClientListItem]:
    """List all clients for the agency (paginated)."""
    result = await db.execute(
        select(Client)
        .where(Client.agency_id == agency_id)
        .offset(skip)
        .limit(limit)
    )
    clients = result.scalars().all()
    return [ClientListItem.model_validate(c) for c in clients]


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
