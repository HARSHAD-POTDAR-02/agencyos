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
