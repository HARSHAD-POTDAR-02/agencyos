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


class ClientListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    business_name: str
    industry: str | None
    status: ClientStatus
    contact_person: str | None
    created_at: datetime
