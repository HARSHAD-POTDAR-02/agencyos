from __future__ import annotations

from enum import Enum
from pydantic import BaseModel, Field


class DataSufficiency(str, Enum):
    sufficient = "sufficient"
    sparse = "sparse"
    cold_start = "cold_start"


class FormatPerformanceSummary(BaseModel):
    """Aggregated statistical performance for a specific deliverable type and platform."""
    deliverable_type: str
    platform: str
    total_published: int = Field(default=0, ge=0)
    avg_views: float = Field(default=0.0, ge=0.0)
    avg_likes: float = Field(default=0.0, ge=0.0)
    avg_comments: float = Field(default=0.0, ge=0.0)
    avg_shares: float = Field(default=0.0, ge=0.0)
    avg_engagement_rate: float = Field(default=0.0, ge=0.0, description="Percentage (e.g. 3.5 for 3.5%)")
    top_performing_angles: list[str] = Field(default_factory=list)


class AudienceFatigueSignal(BaseModel):
    """Detection of diminishing engagement on repeated themes or formats."""
    topic_or_format: str
    fatigue_level: str = Field(description="low, moderate, or high")
    recommendation: str


class PerformancePlaybook(BaseModel):
    """
    Historical Performance intelligence artifact.
    Contains deterministic statistical aggregations and objective insights.
    """
    data_sufficiency: DataSufficiency = DataSufficiency.cold_start
    historical_posts_analyzed: int = Field(default=0, ge=0)
    format_summaries: list[FormatPerformanceSummary] = Field(default_factory=list)
    winning_hooks_and_angles: list[str] = Field(default_factory=list)
    underperforming_patterns: list[str] = Field(default_factory=list)
    fatigue_signals: list[AudienceFatigueSignal] = Field(default_factory=list)
    recommended_format_mix: dict[str, int] = Field(default_factory=dict)

