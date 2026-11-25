from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any
from pydantic import BaseModel, Field


class ReviewTokenOut(BaseModel):
    token: str
    review_url: str
    is_active: bool
    views_count: int
    last_accessed_at: datetime | None = None
    created_at: datetime
    expires_at: datetime | None = None
    suggested_recipient_email: str | None = None
    suggested_recipient_name: str | None = None

    class Config:
        from_attributes = True


class SendReviewEmailRequest(BaseModel):
    recipient_email: str | None = None
    custom_note: str | None = None
    move_to_client_review: bool = True


class SendReviewEmailOut(BaseModel):
    token: str
    review_url: str
    full_review_url: str
    client_name: str
    recipient_email: str | None = None
    sent: bool
    configured: bool
    provider: str
    error: str | None = None


class ReviewCommentCreate(BaseModel):
    author_name: str = Field(..., min_length=1, max_length=120)
    message: str = Field(..., min_length=1, max_length=2000)
    content_version_id: uuid.UUID | None = None
    timestamp_seconds: float | None = None


class ReviewCommentOut(BaseModel):
    id: uuid.UUID
    author_name: str
    author_role: str  # "client" | "agency"
    message: str
    timestamp_seconds: float | None = None
    content_version_id: uuid.UUID | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class ReviewDecisionRequest(BaseModel):
    decision: str = Field(..., pattern="^(approved|changes_requested)$")
    reviewer_name: str = Field(..., min_length=1, max_length=120)
    feedback_notes: str | None = None


class PublicContentVersionOut(BaseModel):
    id: uuid.UUID
    version_number: int
    file_name: str
    file_type: str | None = None
    file_size_bytes: int | None = None
    url: str | None = None
    caption: str | None = None
    notes: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class PublicReviewRoomOut(BaseModel):
    token: str
    deliverable_id: uuid.UUID
    title: str
    deliverable_type: str
    platform: str
    status: str
    planned_date: date | None = None
    scheduled_at: datetime | None = None
    live_post_url: str | None = None
    client_id: uuid.UUID
    client_name: str
    brand_voice: str | None = None
    campaign_id: uuid.UUID
    campaign_name: str
    script_blocks: list[dict[str, Any]] = []
    content_versions: list[PublicContentVersionOut] = []
    comments: list[ReviewCommentOut] = []
    views_count: int = 0
    created_at: datetime
    is_active: bool = True

    class Config:
        from_attributes = True
