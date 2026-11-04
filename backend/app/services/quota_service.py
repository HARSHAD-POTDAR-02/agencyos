from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contract import Contract, ScopeItem
from app.models.deliverable import Deliverable, DeliverableStatus


async def get_monthly_quota_summary(
    client_id: uuid.UUID,
    period_month: int,
    period_year: int,
    db: AsyncSession,
) -> list[dict[str, Any]]:
    """
    For every ScopeItem linked to the client's active/draft contracts, count
    deliverables by status for the given period.

    Returns a list of dicts matching QuotaSummaryOut.
    """
    # Gather all scope items for this client
    contract_result = await db.execute(
        select(Contract).where(Contract.client_id == client_id)
    )
    contracts = contract_result.scalars().all()

    summary: list[dict[str, Any]] = []
    for contract in contracts:
        scope_result = await db.execute(
            select(ScopeItem).where(ScopeItem.contract_id == contract.id)
        )
        scope_items = scope_result.scalars().all()

        for si in scope_items:
            # Count deliverables matching this scope item in the period
            # (via campaign.period_month / period_year)
            from app.models.campaign import Campaign

            deliverable_result = await db.execute(
                select(Deliverable)
                .join(Campaign, Deliverable.campaign_id == Campaign.id)
                .where(
                    Campaign.client_id == client_id,
                    Campaign.period_month == period_month,
                    Campaign.period_year == period_year,
                    Deliverable.scope_item_id == si.id,
                )
            )
            deliverables = deliverable_result.scalars().all()

            counts: dict[str, int] = {s.value: 0 for s in DeliverableStatus}
            for d in deliverables:
                counts[d.status.value] += 1

            contracted = si.monthly_quantity
            produced = (
                counts.get(DeliverableStatus.approved.value, 0)
                + counts.get(DeliverableStatus.published.value, 0)
                + counts.get(DeliverableStatus.in_production.value, 0)
                + counts.get(DeliverableStatus.not_started.value, 0)
                + counts.get(DeliverableStatus.internal_review.value, 0)
                + counts.get(DeliverableStatus.client_review.value, 0)
                + counts.get(DeliverableStatus.changes_requested.value, 0)
            )
            remaining = max(0, contracted - produced)

            summary.append(
                {
                    "scope_item_id": si.id,
                    "deliverable_type": si.deliverable_type,
                    "platform": si.platform,
                    "monthly_quantity": si.monthly_quantity,
                    "contracted": contracted,
                    "not_started": counts.get(DeliverableStatus.not_started.value, 0),
                    "in_production": counts.get(DeliverableStatus.in_production.value, 0),
                    "approved": counts.get(DeliverableStatus.approved.value, 0),
                    "published": counts.get(DeliverableStatus.published.value, 0),
                    "remaining": remaining,
                }
            )

    return summary


async def check_quota_overage(
    client_id: uuid.UUID,
    period_month: int,
    period_year: int,
    deliverable_type: str,
    platform: str,
    db: AsyncSession,
) -> bool:
    """
    Returns True if the number of planned deliverables (all non-cancelled)
    exceeds the contracted quantity for the given type/platform combo.
    """
    from app.models.campaign import Campaign

    # Find matching scope items
    contract_result = await db.execute(
        select(Contract).where(Contract.client_id == client_id)
    )
    contracts = contract_result.scalars().all()
    contract_ids = [c.id for c in contracts]
    if not contract_ids:
        return False

    scope_result = await db.execute(
        select(ScopeItem).where(
            ScopeItem.contract_id.in_(contract_ids),
            ScopeItem.deliverable_type == deliverable_type,
            ScopeItem.platform == platform,
        )
    )
    scope_items = scope_result.scalars().all()
    if not scope_items:
        # No contracted quota at all → any deliverable is an overage
        return True

    total_contracted = sum(si.monthly_quantity for si in scope_items)
    scope_item_ids = [si.id for si in scope_items]

    # Count non-cancelled deliverables in the period for this type/platform
    count_result = await db.execute(
        select(func.count(Deliverable.id))
        .join(Campaign, Deliverable.campaign_id == Campaign.id)
        .where(
            Campaign.client_id == client_id,
            Campaign.period_month == period_month,
            Campaign.period_year == period_year,
            Deliverable.scope_item_id.in_(scope_item_ids),
            Deliverable.status != DeliverableStatus.cancelled,
        )
    )
    total_planned: int = count_result.scalar_one() or 0

    return total_planned > total_contracted
