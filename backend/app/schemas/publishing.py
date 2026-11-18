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


class InstagramProfileTelemetry(BaseModel):
    connected: bool = False
    id: str | None = None
    username: str | None = None
    name: str | None = None
    profile_picture_url: str | None = None
    followers_count: int = 0
    follows_count: int = 0
    media_count: int = 0
    biography: str | None = None
    website: str | None = None


class FacebookProfileTelemetry(BaseModel):
    connected: bool = False
    id: str | None = None
    page_name: str | None = None
    fan_count: int = 0
    followers_count: int = 0
    talking_about_count: int = 0
    link: str | None = None
    avatar_url: str | None = None


class LiveMetaPostItem(BaseModel):
    id: str
    platform: str  # "instagram" | "facebook"
    caption: str | None = None
    media_type: str | None = None  # "IMAGE", "VIDEO", "CAROUSEL_ALBUM", "STATUS"
    media_url: str | None = None
    permalink: str
    timestamp: str | None = None
    likes_count: int = 0
    comments_count: int = 0
    shares_count: int = 0
    reach_count: int = 0
    views_count: int = 0
    saved_count: int = 0
    is_deliverable_match: bool = False
    deliverable_title: str | None = None


class AgencyRoiMetrics(BaseModel):
    monthly_retainer_fee: float = 0.0
    currency: str = "INR"
    total_audience: int = 0
    total_social_interactions: int = 0
    live_engagement_rate: float = 0.0
    cost_per_approved_asset: float = 0.0
    estimated_production_value: float = 0.0
    estimated_earned_media_value: float = 0.0
    roi_multiplier: float = 0.0
    breakdown_text: str = ""


class EngagementRateMetrics(BaseModel):
    err_rate: float = 0.0  # Engagement Rate by Reach: (Total Engagements / Reach) * 100
    erf_rate: float = 0.0  # Engagement Rate by Followers: (Avg Engagements per Post / Followers) * 100
    total_engagements: int = 0
    total_reach: int = 0
    total_views: int = 0
    total_saves: int = 0
    avg_engagements_per_post: float = 0.0
    formula_used: str = "(Total Engagements / Reach) × 100"
    benchmark_status: str = "High Organic Performance (1.5% – 5.0% Benchmark)"
    is_live_insights_verified: bool = True


class ContentFormatDistribution(BaseModel):
    videos_count: int = 0
    images_count: int = 0
    carousels_count: int = 0
    other_count: int = 0


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
    # Live Meta Telemetry & Agency ROI Engine
    instagram_profile: InstagramProfileTelemetry | None = None
    facebook_profile: FacebookProfileTelemetry | None = None
    live_meta_posts: list[LiveMetaPostItem] = []
    roi_metrics: AgencyRoiMetrics | None = None
    format_distribution: ContentFormatDistribution | None = None
    engagement_rate_metrics: EngagementRateMetrics | None = None


