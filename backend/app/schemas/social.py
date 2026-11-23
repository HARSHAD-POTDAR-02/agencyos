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
    token_status: str = "active"  # "active", "expiring_soon", "expired"
    days_remaining: int | None = None
    is_expired: bool = False
    health_message: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


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


class MetaOAuthUrlResponse(BaseModel):
    oauth_url: str
    client_id: str
    redirect_uri: str


class MetaResolveCodeRequest(BaseModel):
    code: str
    redirect_uri: str


class MetaInstagramAccount(BaseModel):
    id: str
    username: str | None = None
    name: str | None = None
    profile_picture_url: str | None = None


class MetaPageOption(BaseModel):
    page_id: str
    page_name: str
    page_access_token: str
    instagram_business_account: MetaInstagramAccount | None = None


class MetaResolveCodeResponse(BaseModel):
    pages: list[MetaPageOption]


class MetaConnectSelectedRequest(BaseModel):
    page_id: str
    page_name: str
    page_access_token: str
    connect_facebook: bool = True
    connect_instagram: bool = True
    instagram_business_id: str | None = None
    instagram_username: str | None = None

