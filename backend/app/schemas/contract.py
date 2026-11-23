from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.contract import ContractStatus


# ── Brand Profile Schemas ──
class BrandProfileCreate(BaseModel):
    brand_voice: str | None = None
    tone_examples: list[str] | dict[str, Any] | str | None = None
    approved_phrases: list[str] | dict[str, Any] | str | None = None
    prohibited_claims: list[str] | dict[str, Any] | str | None = None
    target_audience: list[str] | dict[str, Any] | str | None = None
    content_pillars: list[str] | dict[str, Any] | str | None = None
    goals: list[str] | dict[str, Any] | str | None = None
    is_confirmed: bool = False


class BrandProfileUpdate(BaseModel):
    brand_voice: str | None = None
    tone_examples: list[str] | dict[str, Any] | str | None = None
    approved_phrases: list[str] | dict[str, Any] | str | None = None
    prohibited_claims: list[str] | dict[str, Any] | str | None = None
    target_audience: list[str] | dict[str, Any] | str | None = None
    content_pillars: list[str] | dict[str, Any] | str | None = None
    goals: list[str] | dict[str, Any] | str | None = None
    is_confirmed: bool | None = None


class BrandProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_id: uuid.UUID
    version: int
    is_confirmed: bool
    confirmed_by_id: uuid.UUID | None
    confirmed_at: datetime | None
    brand_voice: str | None
    tone_examples: Any | None
    approved_phrases: Any | None
    prohibited_claims: Any | None
    target_audience: Any | None
    content_pillars: Any | None
    goals: Any | None
    created_at: datetime


class AutoPopulateBrandProfileRequest(BaseModel):
    website_url: str | None = None


class AutoPopulateBrandProfileResponse(BaseModel):
    brand_voice: str
    tone_examples: list[str]
    content_pillars: list[str]
    target_audience: list[str]
    approved_phrases: list[str]
    prohibited_claims: list[str]
    goals: list[str] = Field(default_factory=list)
    crawled_pages_count: int = 0
    crawled_urls: list[str] = Field(default_factory=list)
    source_website: str


# ── Scope Item Schemas ──
class ScopeItemCreate(BaseModel):
    deliverable_type: str  # e.g. "reel", "post", "story"
    platform: str = "instagram"  # e.g. "instagram", "facebook"
    monthly_quantity: int


class ScopeItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    contract_id: uuid.UUID
    deliverable_type: str
    platform: str
    monthly_quantity: int
    created_at: datetime


# ── Contract Schemas ──
class ContractCreate(BaseModel):
    name: str = "Monthly Content Retainer"
    start_date: date
    end_date: date | None = None
    monthly_fee_inr: float | None = None
    revision_allowance: int = 2
    notes: str | None = None
    status: ContractStatus = ContractStatus.active
    scope_items: list[ScopeItemCreate] = []


class ContractOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_id: uuid.UUID
    name: str
    start_date: date
    end_date: date | None
    monthly_fee_inr: float | None
    status: ContractStatus
    revision_allowance: int
    notes: str | None
    created_at: datetime
    updated_at: datetime
    scope_items: list[ScopeItemOut] = []
