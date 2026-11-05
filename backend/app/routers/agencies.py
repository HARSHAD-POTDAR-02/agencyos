from __future__ import annotations

import uuid
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies import get_current_user, require_agency_member, require_role
from app.models.campaign import Campaign
from app.models.client import Client, ClientStatus
from app.models.contract import Contract, ContractStatus
from app.models.deliverable import Deliverable, DeliverableStatus
from app.models.task import Task, TaskPriority, TaskStatus
from app.models.user import Membership, RoleEnum, User
from app.schemas.agency import (
    ActivityItem,
    AgencyBadgeCountsOut,
    AgencyCreate,
    AgencyOut,
    DashboardStatsOut,
    DeadlineItem,
    InviteMemberRequest,
    MembershipOut,
)
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


@router.get("/{agency_id}/badge-counts", response_model=AgencyBadgeCountsOut)
async def get_agency_badge_counts(
    agency_id: uuid.UUID,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> AgencyBadgeCountsOut:
    """Get live badge notification counts for the agency sidebar navigation."""
    # Total tasks in agency
    tasks_query = (
        select(func.count(Task.id))
        .join(Deliverable, Task.deliverable_id == Deliverable.id)
        .join(Campaign, Deliverable.campaign_id == Campaign.id)
        .join(Client, Campaign.client_id == Client.id)
        .where(Client.agency_id == agency_id)
    )
    tasks_count = (await db.execute(tasks_query)).scalar() or 0

    # Remaining / active tasks in agency (excluding done and approved)
    tasks_active_query = (
        select(func.count(Task.id))
        .join(Deliverable, Task.deliverable_id == Deliverable.id)
        .join(Campaign, Deliverable.campaign_id == Campaign.id)
        .join(Client, Campaign.client_id == Client.id)
        .where(
            Client.agency_id == agency_id,
            Task.status.notin_([TaskStatus.done, TaskStatus.approved]),
        )
    )
    tasks_active = (await db.execute(tasks_active_query)).scalar() or 0

    # Pending approvals (awaiting review or changes requested)
    pending_statuses = [
        DeliverableStatus.client_review,
        DeliverableStatus.internal_review,
        DeliverableStatus.changes_requested,
    ]
    approvals_pending_query = (
        select(func.count(Deliverable.id))
        .join(Campaign, Deliverable.campaign_id == Campaign.id)
        .join(Client, Campaign.client_id == Client.id)
        .where(Client.agency_id == agency_id, Deliverable.status.in_(pending_statuses))
    )
    approvals_pending = (await db.execute(approvals_pending_query)).scalar() or 0

    # Total approvals queue items (including recently approved)
    all_queue_statuses = pending_statuses + [DeliverableStatus.approved]
    approvals_total_query = (
        select(func.count(Deliverable.id))
        .join(Campaign, Deliverable.campaign_id == Campaign.id)
        .join(Client, Campaign.client_id == Client.id)
        .where(Client.agency_id == agency_id, Deliverable.status.in_(all_queue_statuses))
    )
    approvals_total = (await db.execute(approvals_total_query)).scalar() or 0

    return AgencyBadgeCountsOut(
        tasks_count=tasks_count,
        tasks_active=tasks_active,
        approvals_count=approvals_pending,
        approvals_total=approvals_total,
    )


@router.get("/{agency_id}/dashboard-stats", response_model=DashboardStatsOut)
async def get_agency_dashboard_stats(
    agency_id: uuid.UUID,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> DashboardStatsOut:
    """Get live aggregated dashboard metrics and feed data for the agency."""
    # 1. Clients breakdown
    clients_res = await db.execute(
        select(Client.status, func.count(Client.id))
        .where(Client.agency_id == agency_id)
        .group_by(Client.status)
    )
    status_counts = dict(clients_res.all())
    clients_active = status_counts.get(ClientStatus.active, 0)
    clients_onboarding = status_counts.get(ClientStatus.onboarding, 0)
    clients_paused = status_counts.get(ClientStatus.paused, 0)
    clients_offboarded = status_counts.get(ClientStatus.offboarded, 0)
    clients_total = clients_active + clients_onboarding + clients_paused + clients_offboarded

    # 2. Tasks breakdown
    tasks_base = (
        select(Task.status, Task.priority)
        .join(Deliverable, Task.deliverable_id == Deliverable.id)
        .join(Campaign, Deliverable.campaign_id == Campaign.id)
        .join(Client, Campaign.client_id == Client.id)
        .where(Client.agency_id == agency_id)
    )
    tasks_rows = (await db.execute(tasks_base)).all()
    tasks_total = len(tasks_rows)
    tasks_remaining = sum(
        1 for s, _ in tasks_rows if s not in (TaskStatus.done, TaskStatus.approved)
    )
    tasks_high_priority = sum(
        1 for s, p in tasks_rows
        if p in (TaskPriority.high, TaskPriority.urgent)
        and s not in (TaskStatus.done, TaskStatus.approved)
    )
    tasks_in_review = sum(
        1 for s, _ in tasks_rows
        if s in (TaskStatus.internal_review, TaskStatus.client_review)
    )
    tasks_todo = sum(1 for s, _ in tasks_rows if s == TaskStatus.todo)
    tasks_by_status: dict[str, int] = {}
    for s, _ in tasks_rows:
        tasks_by_status[s.value] = tasks_by_status.get(s.value, 0) + 1

    # 3. Deliverables breakdown
    deliverables_base = (
        select(Deliverable.status)
        .join(Campaign, Deliverable.campaign_id == Campaign.id)
        .join(Client, Campaign.client_id == Client.id)
        .where(Client.agency_id == agency_id)
    )
    deliv_rows = (await db.execute(deliverables_base)).scalars().all()
    deliverables_total = len(deliv_rows)
    deliverables_done = sum(
        1 for s in deliv_rows if s in (DeliverableStatus.approved, DeliverableStatus.published)
    )
    deliverables_by_status: dict[str, int] = {}
    for s in deliv_rows:
        deliverables_by_status[s.value] = deliverables_by_status.get(s.value, 0) + 1

    # 4. Retainers breakdown
    contracts_query = (
        select(
            func.coalesce(func.sum(Contract.monthly_fee_inr), 0.0),
            func.count(Contract.id),
        )
        .join(Client, Contract.client_id == Client.id)
        .where(Client.agency_id == agency_id, Contract.status == ContractStatus.active)
    )
    contracts_res = (await db.execute(contracts_query)).one()
    total_retainer = float(contracts_res[0] or 0.0)
    active_contracts_count = contracts_res[1] or 0

    # 5. Upcoming Deadlines (tasks with due_date not done/approved)
    today = date.today()
    deadlines_query = (
        select(Task, Client.business_name)
        .join(Deliverable, Task.deliverable_id == Deliverable.id)
        .join(Campaign, Deliverable.campaign_id == Campaign.id)
        .join(Client, Campaign.client_id == Client.id)
        .where(
            Client.agency_id == agency_id,
            Task.due_date.isnot(None),
            Task.status.notin_([TaskStatus.done, TaskStatus.approved]),
        )
        .order_by(Task.due_date.asc())
        .limit(5)
    )
    deadline_rows = (await db.execute(deadlines_query)).all()
    upcoming_deadlines: list[DeadlineItem] = []
    for task, client_name in deadline_rows:
        days = (task.due_date - today).days if task.due_date else 0
        upcoming_deadlines.append(
            DeadlineItem(
                id=task.id,
                title=task.title,
                client_name=client_name,
                due_date=task.due_date.isoformat() if task.due_date else "",
                days_remaining=days,
                task_type=task.task_type,
            )
        )

    # 6. Recent Activity
    activity_items: list[ActivityItem] = []

    # Recent deliverables
    deliv_activity_query = (
        select(Deliverable, Client.business_name)
        .join(Campaign, Deliverable.campaign_id == Campaign.id)
        .join(Client, Campaign.client_id == Client.id)
        .where(Client.agency_id == agency_id)
        .order_by(Deliverable.updated_at.desc())
        .limit(6)
    )
    deliv_activity = (await db.execute(deliv_activity_query)).all()
    for d, c_name in deliv_activity:
        readable_status = d.status.value.replace("_", " ").title()
        activity_items.append(
            ActivityItem(
                id=d.id,
                kind="deliverable_update",
                title=f"{c_name.strip()}: {d.title}",
                subtitle=f"{d.deliverable_type.replace('_', ' ').title()} on {d.platform.title()}",
                status=readable_status,
                timestamp=d.updated_at or d.created_at,
            )
        )

    # Recent tasks
    tasks_activity_query = (
        select(Task, Client.business_name)
        .join(Deliverable, Task.deliverable_id == Deliverable.id)
        .join(Campaign, Deliverable.campaign_id == Campaign.id)
        .join(Client, Campaign.client_id == Client.id)
        .where(Client.agency_id == agency_id)
        .order_by(Task.updated_at.desc())
        .limit(6)
    )
    task_activity = (await db.execute(tasks_activity_query)).all()
    for t, c_name in task_activity:
        readable_status = t.status.value.replace("_", " ").title()
        activity_items.append(
            ActivityItem(
                id=t.id,
                kind="task_update",
                title=f"{c_name.strip()}: {t.title}",
                subtitle=f"{t.task_type or 'Task'} • {t.priority.value.title()} Priority",
                status=readable_status,
                timestamp=t.updated_at or t.created_at,
            )
        )

    # Recent clients
    clients_activity_query = (
        select(Client)
        .where(Client.agency_id == agency_id)
        .order_by(Client.created_at.desc())
        .limit(3)
    )
    client_activity = (await db.execute(clients_activity_query)).scalars().all()
    for cl in client_activity:
        activity_items.append(
            ActivityItem(
                id=cl.id,
                kind="client_created",
                title=f"Client workspace: {cl.business_name}",
                subtitle=f"{cl.industry or 'Client'} • {cl.status.value.title()}",
                status=cl.status.value.title(),
                timestamp=cl.created_at,
            )
        )

    # Sort all activity items descending by timestamp and take top 8
    activity_items.sort(key=lambda x: x.timestamp, reverse=True)
    recent_activity = activity_items[:8]

    return DashboardStatsOut(
        clients_total=clients_total,
        clients_active=clients_active,
        clients_onboarding=clients_onboarding,
        clients_paused=clients_paused,
        clients_offboarded=clients_offboarded,
        tasks_total=tasks_total,
        tasks_remaining=tasks_remaining,
        tasks_high_priority=tasks_high_priority,
        tasks_in_review=tasks_in_review,
        tasks_todo=tasks_todo,
        deliverables_total=deliverables_total,
        deliverables_done=deliverables_done,
        deliverables_by_status=deliverables_by_status,
        tasks_by_status=tasks_by_status,
        total_monthly_retainer_inr=total_retainer,
        active_contracts_count=active_contracts_count,
        recent_activity=recent_activity,
        upcoming_deadlines=upcoming_deadlines,
    )

