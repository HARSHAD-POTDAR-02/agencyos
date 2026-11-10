from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.client import ClientStatus


class ClientCreate(BaseModel):
    business_name: str
    industry: str | None = None
    website: str | None = None
    location: str | None = None
    contact_person: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    account_manager_id: uuid.UUID | None = None
    status: ClientStatus = ClientStatus.onboarding


class ClientUpdate(BaseModel):
    business_name: str | None = None
    industry: str | None = None
    website: str | None = None
    location: str | None = None
    contact_person: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    account_manager_id: uuid.UUID | None = None
    status: ClientStatus | None = None


class ClientScopeProgress(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    contracts_count: int = 0
    monthly_scope_text: str = "No active contract"
    total_contracted: int = 0
    total_completed: int = 0
    total_published: int = 0
    total_approved: int = 0
    total_in_progress: int = 0
    total_planned: int = 0
    progress_percent: int = 0


class ClientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    agency_id: uuid.UUID
    business_name: str
    industry: str | None
    website: str | None
    location: str | None
    contact_person: str | None
    contact_email: str | None
    contact_phone: str | None
    account_manager_id: uuid.UUID | None
    status: ClientStatus
    created_at: datetime
    updated_at: datetime
    scope_progress: ClientScopeProgress | None = None


class ClientListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    business_name: str
    industry: str | None
    status: ClientStatus
    contact_person: str | None
    created_at: datetime
