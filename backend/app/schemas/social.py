from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ClientSocialAccountCreate(BaseModel):
    platform: str = "instagram"  # "instagram", "facebook"
    account_name: str | None = None
    account_handle: str | None = None
    instagram_business_id: str | None = None
    facebook_page_id: str | None = None
    access_token: str
    token_expires_at: datetime | None = None


class ClientSocialAccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_id: uuid.UUID
    platform: str
    account_name: str | None
    account_handle: str | None
    instagram_business_id: str | None
    facebook_page_id: str | None
    is_active: bool
    token_expires_at: datetime | None
    created_at: datetime
    updated_at: datetime


class VerifyAccountRequest(BaseModel):
    access_token: str
    instagram_business_id: str


class VerifyAccountResponse(BaseModel):
    id: str
    username: str | None = None
    name: str | None = None
    profile_picture_url: str | None = None


class ExchangeTokenRequest(BaseModel):
    app_id: str
    app_secret: str
    short_lived_token: str


class ExchangeTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int | None = None
