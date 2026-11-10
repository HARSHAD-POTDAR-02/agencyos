from __future__ import annotations

import uuid
from datetime import date
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contract import Contract, ContractStatus, ScopeItem
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


async def get_clients_scope_progress(
    client_ids: list[uuid.UUID],
    db: AsyncSession,
    period_month: int | None = None,
    period_year: int | None = None,
) -> dict[uuid.UUID, dict[str, Any]]:
    """
    For a list of client IDs, calculate their dynamic monthly scope (based on active contracts & scope items)
    and their delivery progress (completed / posted deliverables in the current month).
    """
    if not client_ids:
        return {}

    today = date.today()
    month = period_month or today.month
    year = period_year or today.year

    # 1. Fetch all active/draft contracts for these clients
    contract_res = await db.execute(
        select(Contract).where(
            Contract.client_id.in_(client_ids),
            Contract.status != ContractStatus.ended,
        )
    )
    contracts = contract_res.scalars().all()

    contracts_by_client: dict[uuid.UUID, list[Contract]] = {cid: [] for cid in client_ids}
    contract_ids: list[uuid.UUID] = []
    contract_to_client: dict[uuid.UUID, uuid.UUID] = {}

    for c in contracts:
        contracts_by_client[c.client_id].append(c)
        contract_ids.append(c.id)
        contract_to_client[c.id] = c.client_id

    # 2. Fetch scope items for these contracts
    scope_items_by_client: dict[uuid.UUID, list[ScopeItem]] = {cid: [] for cid in client_ids}
    if contract_ids:
        scope_res = await db.execute(
            select(ScopeItem).where(ScopeItem.contract_id.in_(contract_ids))
        )
        for si in scope_res.scalars().all():
            cid = contract_to_client.get(si.contract_id)
            if cid:
                scope_items_by_client[cid].append(si)

    # 3. Fetch deliverables for these clients in the target month & year
    from app.models.campaign import Campaign
    deliv_res = await db.execute(
        select(Deliverable, Campaign.client_id)
        .join(Campaign, Deliverable.campaign_id == Campaign.id)
        .where(
            Campaign.client_id.in_(client_ids),
            Campaign.period_month == month,
            Campaign.period_year == year,
            Deliverable.status != DeliverableStatus.cancelled,
        )
    )
    delivs_by_client: dict[uuid.UUID, list[Deliverable]] = {cid: [] for cid in client_ids}
    for d, cid in deliv_res.all():
        delivs_by_client[cid].append(d)

    # 4. Build progress summary for each client
    result: dict[uuid.UUID, dict[str, Any]] = {}
    for cid in client_ids:
        c_list = contracts_by_client.get(cid, [])
        s_list = scope_items_by_client.get(cid, [])
        d_list = delivs_by_client.get(cid, [])

        total_contracted = sum(si.monthly_quantity for si in s_list)

        if len(c_list) > 0 and total_contracted == 0:
            # Fallback if contracts exist without explicit scope items
            total_contracted = len(c_list) * 30
            scope_text = f"{total_contracted} Reels / month"
        elif s_list:
            type_counts: dict[str, int] = {}
            for si in s_list:
                dtype = si.deliverable_type.capitalize()
                if not dtype.endswith("s"):
                    dtype += "s"
                type_counts[dtype] = type_counts.get(dtype, 0) + si.monthly_quantity
            
            if len(type_counts) <= 2:
                scope_text = ", ".join(f"{qty} {dt}" for dt, qty in type_counts.items()) + " / month"
            else:
                scope_text = f"{total_contracted} Deliverables / month"
        else:
            scope_text = "No active contract"

        total_published = sum(1 for d in d_list if d.status == DeliverableStatus.published)
        total_approved = sum(1 for d in d_list if d.status == DeliverableStatus.approved)
        total_completed = total_published + total_approved
        total_in_progress = sum(1 for d in d_list if d.status in (
            DeliverableStatus.in_production,
            DeliverableStatus.internal_review,
            DeliverableStatus.client_review,
            DeliverableStatus.changes_requested,
        ))
        total_planned = len(d_list)

        progress_pct = (
            min(100, max(0, round((total_completed / total_contracted) * 100)))
            if total_contracted > 0
            else 0
        )

        result[cid] = {
            "contracts_count": len(c_list),
            "monthly_scope_text": scope_text,
            "total_contracted": total_contracted,
            "total_completed": total_completed,
            "total_published": total_published,
            "total_approved": total_approved,
            "total_in_progress": total_in_progress,
            "total_planned": total_planned,
            "progress_percent": progress_pct,
        }

    return result
