from __future__ import annotations

import uuid
from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agency import Agency

IMAGE_GENERATION_CREDIT_COST = 5


async def precheck_agency_credits(
    agency_id: uuid.UUID,
    required_credits: int,
    db: AsyncSession,
) -> int:
    """
    Verify the agency has enough credits before dispatching an external AI image render.
    Raises HTTP 402 if balance is insufficient.
    """
    result = await db.execute(
        select(Agency.credits_balance).where(Agency.id == agency_id)
    )
    balance = result.scalar_one_or_none()
    if balance is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agency not found.",
        )
    if balance < required_credits:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=(
                f"Insufficient AI credits ({balance} available, {required_credits} required). "
                "Top up credits in Billing & Credits before rendering visuals."
            ),
        )
    return balance


async def deduct_agency_credits(
    agency_id: uuid.UUID,
    amount: int,
    db: AsyncSession,
) -> int:
    """
    Atomically deduct credits after a visual asset has rendered and persisted to S3/B2.
    Returns the updated balance.
    """
    stmt = (
        update(Agency)
        .where(Agency.id == agency_id, Agency.credits_balance >= amount)
        .values(credits_balance=Agency.credits_balance - amount)
        .returning(Agency.credits_balance)
    )
    res = await db.execute(stmt)
    updated = res.scalar_one_or_none()
    if updated is None:
        bal_res = await db.execute(
            select(Agency.credits_balance).where(Agency.id == agency_id)
        )
        return bal_res.scalar_one_or_none() or 0
    return int(updated)
