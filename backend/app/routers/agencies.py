from __future__ import annotations

import uuid
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

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
    AgencyNotificationItem,
    AgencyNotificationsOut,
    AgencyOut,
    AgencySearchOut,
    DashboardStatsOut,
    DeadlineItem,
    InviteMemberRequest,
    MembershipOut,
    SearchResultItem,
    UpdateMemberRoleRequest,
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
    current_mem: Membership = Depends(require_role(RoleEnum.owner, RoleEnum.manager)),
    db: AsyncSession = Depends(get_db),
) -> MembershipOut:
    """Invite or add a specialist/team member to the agency. Creates account if user does not exist."""
    from app.core.security import hash_password

    email_clean = payload.email.lower().strip()
    result = await db.execute(select(User).where(User.email == email_clean))
    target_user = result.scalar_one_or_none()

    if target_user is None:
        temp_pwd = payload.password or "AgencyPass123!"
        target_user = User(
            id=uuid.uuid4(),
            email=email_clean,
            hashed_password=hash_password(temp_pwd),
            full_name=payload.full_name or email_clean.split("@")[0],
        )
        db.add(target_user)
        await db.flush()
    else:
        if payload.full_name and not target_user.full_name:
            target_user.full_name = payload.full_name
            db.add(target_user)

    # Check for existing membership
    existing = await db.execute(
        select(Membership).where(
            Membership.user_id == target_user.id,
            Membership.agency_id == agency_id,
        )
    )
    existing_mem = existing.scalar_one_or_none()
    if existing_mem:
        if not existing_mem.is_active:
            existing_mem.is_active = True
            existing_mem.role = payload.role
            await db.commit()
            await db.refresh(existing_mem)
            out = MembershipOut.model_validate(existing_mem)
            out.user_full_name = target_user.full_name
            out.user_email = target_user.email
            return out
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
    out = MembershipOut.model_validate(membership)
    out.user_full_name = target_user.full_name
    out.user_email = target_user.email
    return out


@router.patch("/{agency_id}/members/{membership_id}", response_model=MembershipOut)
async def update_member_role(
    agency_id: uuid.UUID,
    membership_id: uuid.UUID,
    payload: UpdateMemberRoleRequest,
    current_mem: Membership = Depends(require_role(RoleEnum.owner, RoleEnum.manager)),
    db: AsyncSession = Depends(get_db),
) -> MembershipOut:
    """Update a team member's role (e.g. promote to editor, writer, manager)."""
    result = await db.execute(
        select(Membership).options(selectinload(Membership.user)).where(
            Membership.id == membership_id,
            Membership.agency_id == agency_id,
        )
    )
    mem = result.scalar_one_or_none()
    if not mem:
        raise HTTPException(status_code=404, detail="Member not found.")

    mem.role = payload.role
    await db.commit()
    await db.refresh(mem)
    out = MembershipOut.model_validate(mem)
    if mem.user:
        out.user_full_name = mem.user.full_name
        out.user_email = mem.user.email
    return out


@router.delete("/{agency_id}/members/{membership_id}")
async def remove_member(
    agency_id: uuid.UUID,
    membership_id: uuid.UUID,
    current_mem: Membership = Depends(require_role(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    """Remove / deactivate an agency team member."""
    result = await db.execute(
        select(Membership).where(
            Membership.id == membership_id,
            Membership.agency_id == agency_id,
        )
    )
    mem = result.scalar_one_or_none()
    if not mem:
        raise HTTPException(status_code=404, detail="Member not found.")
    if mem.user_id == current_mem.user_id:
        raise HTTPException(status_code=400, detail="Cannot remove yourself as agency owner.")

    mem.is_active = False
    await db.commit()
    return {"ok": True}


@router.get("/{agency_id}/members", response_model=list[MembershipOut])
async def list_members(
    agency_id: uuid.UUID,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> list[MembershipOut]:
    """List all members of an agency."""
    result = await db.execute(
        select(Membership).options(selectinload(Membership.user)).where(
            Membership.agency_id == agency_id,
            Membership.is_active.is_(True),
        )
    )
    memberships = result.scalars().all()
    out: list[MembershipOut] = []
    for m in memberships:
        if not m.user:
            continue
        item = MembershipOut.model_validate(m)
        item.user_full_name = m.user.full_name
        item.user_email = m.user.email
        out.append(item)
    return out


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


@router.get("/{agency_id}/search", response_model=AgencySearchOut)
async def search_agency_resources(
    agency_id: uuid.UUID,
    q: str = Query("", max_length=100),
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> AgencySearchOut:
    """
    Search across clients, deliverables, campaigns, and tasks for an agency.
    """
    term = q.strip().lower()
    results: list[SearchResultItem] = []

    if not term:
        # Return recent/active items as quick shortcuts
        # Top 3 clients
        c_res = await db.execute(
            select(Client)
            .where(Client.agency_id == agency_id)
            .order_by(Client.created_at.desc())
            .limit(3)
        )
        for c in c_res.scalars().all():
            results.append(
                SearchResultItem(
                    id=c.id,
                    category="client",
                    title=c.business_name,
                    subtitle=f"{c.industry or 'General Industry'} • {c.location or 'Workspace'}",
                    url=f"/clients/{c.id}",
                    badge=c.status.value.title(),
                )
            )

        # Top 3 active deliverables
        d_res = await db.execute(
            select(Deliverable, Client.business_name)
            .join(Campaign, Deliverable.campaign_id == Campaign.id)
            .join(Client, Campaign.client_id == Client.id)
            .where(Client.agency_id == agency_id)
            .order_by(Deliverable.updated_at.desc())
            .limit(3)
        )
        for d, c_name in d_res.all():
            results.append(
                SearchResultItem(
                    id=d.id,
                    category="deliverable",
                    title=d.title,
                    subtitle=f"{c_name.strip()} • {d.deliverable_type.replace('_', ' ').title()}",
                    url=f"/deliverables/{d.id}",
                    badge=d.status.value.replace("_", " ").title(),
                )
            )

        # Top 2 campaigns
        cam_res = await db.execute(
            select(Campaign, Client.business_name)
            .join(Client, Campaign.client_id == Client.id)
            .where(Client.agency_id == agency_id)
            .order_by(Campaign.created_at.desc())
            .limit(2)
        )
        for cam, c_name in cam_res.all():
            results.append(
                SearchResultItem(
                    id=cam.id,
                    category="campaign",
                    title=cam.name,
                    subtitle=f"{c_name.strip()} • {cam.period_month}/{cam.period_year or ''}",
                    url=f"/campaigns?clientId={cam.client_id}&campaignId={cam.id}",
                    badge="Campaign",
                )
            )
        return AgencySearchOut(query="", results=results)

    pattern = f"%{term}%"

    # 1. Search clients
    c_res = await db.execute(
        select(Client)
        .where(
            Client.agency_id == agency_id,
            or_(
                Client.business_name.ilike(pattern),
                Client.industry.ilike(pattern),
                Client.location.ilike(pattern),
            ),
        )
        .limit(5)
    )
    for c in c_res.scalars().all():
        results.append(
            SearchResultItem(
                id=c.id,
                category="client",
                title=c.business_name,
                subtitle=f"{c.industry or 'Client Workspace'} • {c.location or ''}".strip(" •"),
                url=f"/clients/{c.id}",
                badge=c.status.value.title(),
            )
        )

    # 2. Search deliverables
    d_res = await db.execute(
        select(Deliverable, Client.business_name)
        .join(Campaign, Deliverable.campaign_id == Campaign.id)
        .join(Client, Campaign.client_id == Client.id)
        .where(
            Client.agency_id == agency_id,
            or_(
                Deliverable.title.ilike(pattern),
                Deliverable.deliverable_type.ilike(pattern),
                Deliverable.platform.ilike(pattern),
            ),
        )
        .limit(6)
    )
    for d, c_name in d_res.all():
        results.append(
            SearchResultItem(
                id=d.id,
                category="deliverable",
                title=d.title,
                subtitle=f"{c_name.strip()} • {d.deliverable_type.replace('_', ' ').title()} on {d.platform.title()}",
                url=f"/deliverables/{d.id}",
                badge=d.status.value.replace("_", " ").title(),
            )
        )

    # 3. Search campaigns
    cam_res = await db.execute(
        select(Campaign, Client.business_name)
        .join(Client, Campaign.client_id == Client.id)
        .where(
            Client.agency_id == agency_id,
            or_(
                Campaign.name.ilike(pattern),
                Campaign.objective.ilike(pattern),
            ),
        )
        .limit(4)
    )
    for cam, c_name in cam_res.all():
        results.append(
            SearchResultItem(
                id=cam.id,
                category="campaign",
                title=cam.name,
                subtitle=f"{c_name.strip()} • {cam.objective or 'Campaign Sprint'}",
                url=f"/campaigns?clientId={cam.client_id}&campaignId={cam.id}",
                badge="Campaign",
            )
        )

    # 4. Search tasks
    t_res = await db.execute(
        select(Task, Client.business_name)
        .join(Deliverable, Task.deliverable_id == Deliverable.id)
        .join(Campaign, Deliverable.campaign_id == Campaign.id)
        .join(Client, Campaign.client_id == Client.id)
        .where(
            Client.agency_id == agency_id,
            or_(
                Task.title.ilike(pattern),
                Task.task_type.ilike(pattern),
            ),
        )
        .limit(4)
    )
    for t, c_name in t_res.all():
        results.append(
            SearchResultItem(
                id=t.id,
                category="task",
                title=t.title,
                subtitle=f"{c_name.strip()} • {t.priority.value.title()} Priority",
                url=f"/tasks",
                badge=t.status.value.replace("_", " ").title(),
            )
        )

    return AgencySearchOut(query=q, results=results)


@router.get("/{agency_id}/notifications", response_model=AgencyNotificationsOut)
async def get_agency_notifications(
    agency_id: uuid.UUID,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> AgencyNotificationsOut:
    """
    Get live actionable notifications for the agency (approvals, publishing, urgent tasks, new workspaces).
    """
    notifications: list[AgencyNotificationItem] = []

    # 1. Pending approvals & reviews
    pending_res = await db.execute(
        select(Deliverable, Client.business_name)
        .join(Campaign, Deliverable.campaign_id == Campaign.id)
        .join(Client, Campaign.client_id == Client.id)
        .where(
            Client.agency_id == agency_id,
            Deliverable.status.in_([
                DeliverableStatus.client_review,
                DeliverableStatus.internal_review,
                DeliverableStatus.changes_requested,
                DeliverableStatus.approved,
            ]),
        )
        .order_by(Deliverable.updated_at.desc())
        .limit(5)
    )
    for d, c_name in pending_res.all():
        if d.status == DeliverableStatus.approved:
            title = f"{c_name.strip()}: Content Approved"
            desc = f'"{d.title}" is approved and ready to be published live.'
            is_urgent = False
        elif d.status == DeliverableStatus.changes_requested:
            title = f"{c_name.strip()}: Changes Requested"
            desc = f'Feedback received on "{d.title}". Needs creator revision.'
            is_urgent = True
        else:
            title = f"{c_name.strip()}: Review Pending"
            desc = f'"{d.title}" is waiting in the review queue for sign-off.'
            is_urgent = False

        notifications.append(
            AgencyNotificationItem(
                id=f"deliv-{d.id}",
                category="approval",
                title=title,
                description=desc,
                timestamp=d.updated_at or d.created_at,
                url=f"/deliverables/{d.id}",
                is_urgent=is_urgent,
            )
        )

    # 2. Recently published deliverables
    pub_res = await db.execute(
        select(Deliverable, Client.business_name)
        .join(Campaign, Deliverable.campaign_id == Campaign.id)
        .join(Client, Campaign.client_id == Client.id)
        .where(
            Client.agency_id == agency_id,
            Deliverable.status == DeliverableStatus.published,
        )
        .order_by(Deliverable.published_at.desc())
        .limit(4)
    )
    for d, c_name in pub_res.all():
        notifications.append(
            AgencyNotificationItem(
                id=f"pub-{d.id}",
                category="publish",
                title=f"{c_name.strip()}: Published Live 🚀",
                description=f'"{d.title}" was posted to {d.publishing_platform or d.platform}.',
                timestamp=d.published_at or d.updated_at or d.created_at,
                url=f"/deliverables/{d.id}",
                is_urgent=False,
            )
        )

    # 3. High priority / urgent tasks pending
    urgent_tasks = await db.execute(
        select(Task, Client.business_name)
        .join(Deliverable, Task.deliverable_id == Deliverable.id)
        .join(Campaign, Deliverable.campaign_id == Campaign.id)
        .join(Client, Campaign.client_id == Client.id)
        .where(
            Client.agency_id == agency_id,
            Task.priority.in_([TaskPriority.urgent, TaskPriority.high]),
            Task.status.notin_([TaskStatus.done, TaskStatus.approved]),
        )
        .order_by(Task.updated_at.desc())
        .limit(3)
    )
    for t, c_name in urgent_tasks.all():
        notifications.append(
            AgencyNotificationItem(
                id=f"task-{t.id}",
                category="task",
                title=f"{c_name.strip()}: Urgent Task",
                description=f'"{t.title}" is flagged as {t.priority.value.upper()}.',
                timestamp=t.updated_at or t.created_at,
                url=f"/tasks",
                is_urgent=True,
            )
        )

    # Sort notifications descending by timestamp
    notifications.sort(key=lambda x: x.timestamp, reverse=True)

    return AgencyNotificationsOut(
        unread_count=len(notifications),
        notifications=notifications,
    )

