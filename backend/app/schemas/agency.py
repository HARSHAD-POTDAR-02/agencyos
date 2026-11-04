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
