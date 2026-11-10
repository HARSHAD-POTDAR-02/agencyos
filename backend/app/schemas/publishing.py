from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict


class PublishDeliverableRequest(BaseModel):
    mode: Literal["automated", "manual"] = "automated"
    platform: str = "instagram"  # "instagram", "facebook", "both"
    live_post_url: str | None = None
    caption_override: str | None = None
    media_url_override: str | None = None
    share_to_feed: bool = True


class PublishDeliverableResponse(BaseModel):
    success: bool
    deliverable_id: uuid.UUID
    status: str
    live_post_url: str | None
    external_post_id: str | None
    published_at: datetime
    platform: str
    message: str
    platform_results: dict[str, Any] | None = None


class DeliverableMetricsUpdate(BaseModel):
    views_count: int | None = None
    likes_count: int | None = None
    comments_count: int | None = None
    shares_count: int | None = None


class TopDeliverableItem(BaseModel):
    id: uuid.UUID
    title: str
    deliverable_type: str
    platform: str
    live_post_url: str | None
    views_count: int
    likes_count: int
    comments_count: int


class ScheduleDeliverableRequest(BaseModel):
    scheduled_at: datetime
    scheduled_timezone: str = "UTC"
    platform: str = "both"  # "instagram", "facebook", "both"
    caption_override: str | None = None
    share_to_feed: bool = True


class RescheduleDeliverableRequest(BaseModel):
    new_scheduled_at: datetime
    scheduled_timezone: str | None = None


class ScheduledJobOut(BaseModel):
    id: uuid.UUID
    platform: str
    status: str
    scheduled_at: datetime
    scheduled_timezone: str
    next_attempt_at: datetime
    attempts_count: int
    last_error_message: str | None = None


class ScheduleDeliverableResponse(BaseModel):
    success: bool
    deliverable_id: uuid.UUID
    status: str
    scheduled_at: datetime
    scheduled_timezone: str
    jobs: list[ScheduledJobOut]
    message: str


class ScheduledDeliverableItem(BaseModel):
    deliverable_id: uuid.UUID
    campaign_id: uuid.UUID
    client_id: uuid.UUID
    client_name: str
    title: str
    deliverable_type: str
    platform: str
    status: str
    scheduled_at: datetime
    scheduled_timezone: str
    seconds_remaining: float
    jobs: list[ScheduledJobOut]
    thumbnail_url: str | None = None


class MonthlyReportOut(BaseModel):
    client_id: uuid.UUID
    client_name: str
    month: int
    year: int
    total_scope_quota: int
    deliverables_delivered: int
    deliverables_published: int
    quota_fulfillment_rate: float
    total_views: int
    total_likes: int
    total_comments: int
    avg_engagement_rate: float
    top_deliverables: list[TopDeliverableItem]
    executive_summary: str
