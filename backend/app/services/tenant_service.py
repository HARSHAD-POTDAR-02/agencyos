from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.campaign import Campaign
from app.models.client import Client
from app.models.deliverable import Deliverable


async def get_client_for_agency(
    client_id: uuid.UUID,
    agency_id: uuid.UUID,
    db: AsyncSession,
) -> Client:
    """
    Load a Client by ID and enforce that it belongs to the given agency.
    Raises 404 if not found, 403 if tenant mismatch.
    """
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if client is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found.")
    if client.agency_id != agency_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Client does not belong to this agency.",
        )
    return client


async def assert_campaign_belongs_to_agency(
    campaign_id: uuid.UUID,
    agency_id: uuid.UUID,
    db: AsyncSession,
) -> Campaign:
    """
    Verify campaign → client → agency chain.
    Returns the Campaign on success; raises 404 / 403 otherwise.
    """
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found.")

    # Follow the chain: campaign → client → agency
    client_result = await db.execute(
        select(Client).where(Client.id == campaign.client_id)
    )
    client = client_result.scalar_one_or_none()
    if client is None or client.agency_id != agency_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Campaign does not belong to this agency.",
        )
    return campaign


async def assert_deliverable_belongs_to_agency(
    deliverable_id: uuid.UUID,
    agency_id: uuid.UUID,
    db: AsyncSession,
) -> Deliverable:
    """
    Verify deliverable → campaign → client → agency chain.
    Returns the Deliverable on success; raises 404 / 403 otherwise.
    """
    result = await db.execute(
        select(Deliverable).where(Deliverable.id == deliverable_id)
    )
    deliverable = result.scalar_one_or_none()
    if deliverable is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Deliverable not found."
        )

    campaign_result = await db.execute(
        select(Campaign).where(Campaign.id == deliverable.campaign_id)
    )
    campaign = campaign_result.scalar_one_or_none()
    if campaign is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found."
        )

    client_result = await db.execute(
        select(Client).where(Client.id == campaign.client_id)
    )
    client = client_result.scalar_one_or_none()
    if client is None or client.agency_id != agency_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Deliverable does not belong to this agency.",
        )
    return deliverable
