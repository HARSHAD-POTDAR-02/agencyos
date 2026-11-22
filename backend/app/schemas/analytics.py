from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class HistoricalPostOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_id: uuid.UUID
    social_account_id: uuid.UUID | None = None
    platform: str
    external_post_id: str
    media_type: str
    deliverable_format: str
    caption: str | None = None
    permalink: str | None = None
    media_url: str | None = None
    published_at: datetime | None = None
    likes_count: int = 0
    comments_count: int = 0
    shares_count: int = 0
    saves_count: int = 0
    views_count: int = 0
    reach_count: int = 0
    impressions_count: int = 0
    engagement_rate: float = 0.0
    is_outlier: bool = False
    outlier_score: float = 0.0
    extracted_hook: str | None = None
    hook_archetype: str | None = None
    content_pillar: str | None = None
    created_at: datetime


class FormatBenchmarkItem(BaseModel):
    deliverable_format: str
    platform: str
    total_posts: int
    share_of_volume_pct: float
    avg_likes: float
    avg_comments: float
    avg_shares: float
    avg_reach: float
    avg_views: float
    avg_engagement_rate: float
    top_hooks: list[str] = Field(default_factory=list)
    is_dominant_format: bool = False


class WinningOutlierPost(BaseModel):
    id: str
    platform: str
    external_post_id: str
    deliverable_format: str
    published_at: datetime | None = None
    media_url: str | None = None
    permalink: str | None = None
    caption_snippet: str
    extracted_hook: str
    hook_archetype: str
    likes: int
    comments: int
    reach: int
    views: int
    engagement_rate: float
    outlier_multiplier: float


class ClientAnalyticsBenchmarksOut(BaseModel):
    client_id: uuid.UUID
    client_name: str
    data_sufficiency: str  # "cold_start", "sparse", "sufficient"
    total_posts_analyzed: int
    date_range_days: int
    earliest_post_date: datetime | None = None
    latest_post_date: datetime | None = None
    baseline_engagement_rate: float
    baseline_avg_reach: float
    baseline_avg_views: float
    dominant_winning_format: str
    outlier_multiplier_ceiling: float
    format_benchmarks: list[FormatBenchmarkItem]
    top_winning_outliers: list[WinningOutlierPost]
    winning_hooks_and_angles: list[str]
    underperforming_patterns: list[str]
    recommended_format_mix: dict[str, int]
    campaign_studio_synced: bool = True


class BackfillRequest(BaseModel):
    limit: int = Field(default=100, ge=10, le=250)
    days: int = Field(default=180, ge=30, le=365)


class BackfillResponse(BaseModel):
    success: bool
    client_id: uuid.UUID
    posts_ingested: int
    posts_updated: int
    total_historical_posts: int
    top_outliers_identified: int
    dominant_format: str
    baseline_engagement_rate: float
    message: str
