from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict

from app.models.campaign import CampaignStatus
from app.models.deliverable import DeliverableStatus


class CampaignCreate(BaseModel):
    name: str
    period_month: int | None = None
    period_year: int | None = None
    objective: str | None = None
    status: CampaignStatus = CampaignStatus.draft


class CampaignOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_id: uuid.UUID
    name: str
    period_month: int | None
    period_year: int | None
    objective: str | None
    status: CampaignStatus
    ai_plan_draft: dict[str, Any] | None
    approved_by_id: uuid.UUID | None
    approved_at: datetime | None
    created_at: datetime
    updated_at: datetime


class DeliverableCreate(BaseModel):
    title: str
    deliverable_type: str
    platform: str
    planned_date: date | None = None
    scope_item_id: uuid.UUID | None = None
    status: DeliverableStatus = DeliverableStatus.not_started


class DeliverableOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    campaign_id: uuid.UUID
    scope_item_id: uuid.UUID | None
    title: str
    deliverable_type: str
    platform: str
    planned_date: date | None
    status: DeliverableStatus
    published_at: datetime | None = None
    live_post_url: str | None = None
    external_post_id: str | None = None
    publishing_platform: str | None = None
    views_count: int | None = 0
    likes_count: int | None = 0
    comments_count: int | None = 0
    shares_count: int | None = 0
    client_id: uuid.UUID | None = None
    client_name: str | None = None
    created_at: datetime
    updated_at: datetime


class QuotaSummaryOut(BaseModel):
    scope_item_id: uuid.UUID
    deliverable_type: str
    platform: str
    monthly_quantity: int
    contracted: int
    not_started: int
    in_production: int
    approved: int
    published: int
    remaining: int


class GeneratePlanRequest(BaseModel):
    period_month: int = 11
    period_year: int = 2026
    start_date: str | None = None  # Format: YYYY-MM-DD
    end_date: str | None = None    # Format: YYYY-MM-DD
    duration_days: int | None = None
    objective: str | None = None
    custom_brief: str | None = None


class ConvertToTasksResponse(BaseModel):
    campaign_id: uuid.UUID
    deliverables_created: int
    tasks_created: int
    status: str


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatBriefRequest(BaseModel):
    messages: list[ChatMessage]
    period_month: int | None = None
    period_year: int | None = None
    start_date: str | None = None
    end_date: str | None = None


class ChatBriefResponse(BaseModel):
    reply: str
    suggested_objective: str | None = None
    suggested_custom_brief: str | None = None
    suggested_period_month: int | None = None
    suggested_period_year: int | None = None
    suggested_start_date: str | None = None
    suggested_end_date: str | None = None
    suggested_duration_days: int | None = None
    is_ready_to_generate: bool = False

