from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.user import RoleEnum


class AgencyCreate(BaseModel):
    name: str
    slug: str | None = None
    timezone: str = "Asia/Kolkata"


class AgencyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str
    timezone: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class MembershipOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    agency_id: uuid.UUID
    role: RoleEnum
    is_active: bool
    created_at: datetime


class InviteMemberRequest(BaseModel):
    email: str
    role: RoleEnum


class AgencyBadgeCountsOut(BaseModel):
    tasks_count: int
    tasks_active: int
    approvals_count: int
    approvals_total: int


# ── Dashboard Stats ──

class ActivityItem(BaseModel):
    id: uuid.UUID
    kind: str  # "task_update", "deliverable_update", "client_created", "comment"
    title: str
    subtitle: str
    status: str
    timestamp: datetime


class DeadlineItem(BaseModel):
    id: uuid.UUID
    title: str
    client_name: str
    due_date: str  # ISO date string
    days_remaining: int
    task_type: str | None = None


class DashboardStatsOut(BaseModel):
    # Clients
    clients_total: int
    clients_active: int
    clients_onboarding: int
    clients_paused: int
    clients_offboarded: int

    # Tasks
    tasks_total: int
    tasks_remaining: int
    tasks_high_priority: int
    tasks_in_review: int
    tasks_todo: int

    # Deliverables
    deliverables_total: int
    deliverables_done: int
    deliverables_by_status: dict[str, int] = {}

    # Tasks breakdown by status
    tasks_by_status: dict[str, int] = {}

    # Retainers
    total_monthly_retainer_inr: float
    active_contracts_count: int

    # Recent Activity
    recent_activity: list[ActivityItem]

    # Upcoming Deadlines
    upcoming_deadlines: list[DeadlineItem]


# ── Global Search & Notifications ──

class SearchResultItem(BaseModel):
    id: uuid.UUID
    category: str  # "client", "deliverable", "campaign", "task"
    title: str
    subtitle: str
    url: str
    badge: str | None = None


class AgencySearchOut(BaseModel):
    query: str
    results: list[SearchResultItem]


class AgencyNotificationItem(BaseModel):
    id: str
    category: str  # "approval", "publish", "task", "client"
    title: str
    description: str
    timestamp: datetime
    url: str
    is_urgent: bool = False


class AgencyNotificationsOut(BaseModel):
    unread_count: int
    notifications: list[AgencyNotificationItem]


