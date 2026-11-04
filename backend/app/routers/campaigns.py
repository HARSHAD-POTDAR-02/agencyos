from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies import require_agency_member
from app.models.campaign import Campaign
from app.models.deliverable import Deliverable
from app.models.user import Membership
from app.schemas.campaign import (
    CampaignCreate,
    CampaignOut,
    DeliverableCreate,
    DeliverableOut,
)
from app.services.tenant_service import (
    assert_campaign_belongs_to_agency,
    get_client_for_agency,
)

router = APIRouter(tags=["campaigns"])


@router.post(
    "/agencies/{agency_id}/clients/{client_id}/campaigns",
    response_model=CampaignOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_campaign(
    agency_id: uuid.UUID,
    client_id: uuid.UUID,
    payload: CampaignCreate,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> CampaignOut:
    """Create a campaign for a client."""
    await get_client_for_agency(client_id, agency_id, db)
    campaign = Campaign(
        id=uuid.uuid4(),
        client_id=client_id,
        **payload.model_dump(),
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return CampaignOut.model_validate(campaign)


@router.get(
    "/agencies/{agency_id}/clients/{client_id}/campaigns",
    response_model=list[CampaignOut],
)
async def list_campaigns(
    agency_id: uuid.UUID,
    client_id: uuid.UUID,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> list[CampaignOut]:
    """List all campaigns for a client."""
    await get_client_for_agency(client_id, agency_id, db)
    result = await db.execute(
        select(Campaign).where(Campaign.client_id == client_id)
    )
    campaigns = result.scalars().all()
    return [CampaignOut.model_validate(c) for c in campaigns]


@router.get(
    "/agencies/{agency_id}/campaigns/{campaign_id}",
    response_model=CampaignOut,
)
async def get_campaign(
    agency_id: uuid.UUID,
    campaign_id: uuid.UUID,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> CampaignOut:
    """Get campaign detail, verifying agency ownership."""
    campaign = await assert_campaign_belongs_to_agency(campaign_id, agency_id, db)
    return CampaignOut.model_validate(campaign)


@router.patch(
    "/agencies/{agency_id}/campaigns/{campaign_id}",
    response_model=CampaignOut,
)
async def update_campaign(
    agency_id: uuid.UUID,
    campaign_id: uuid.UUID,
    payload: CampaignCreate,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> CampaignOut:
    """Update a campaign."""
    campaign = await assert_campaign_belongs_to_agency(campaign_id, agency_id, db)
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(campaign, field, value)
    await db.commit()
    await db.refresh(campaign)
    return CampaignOut.model_validate(campaign)


@router.post(
    "/agencies/{agency_id}/campaigns/{campaign_id}/deliverables",
    response_model=DeliverableOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_deliverable(
    agency_id: uuid.UUID,
    campaign_id: uuid.UUID,
    payload: DeliverableCreate,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> DeliverableOut:
    """Add a deliverable to a campaign."""
    await assert_campaign_belongs_to_agency(campaign_id, agency_id, db)
    deliverable = Deliverable(
        id=uuid.uuid4(),
        campaign_id=campaign_id,
        **payload.model_dump(),
    )
    db.add(deliverable)
    await db.commit()
    await db.refresh(deliverable)
    return DeliverableOut.model_validate(deliverable)
