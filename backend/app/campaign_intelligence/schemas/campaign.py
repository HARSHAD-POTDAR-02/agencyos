from __future__ import annotations

import uuid
from datetime import date
from typing import Any

from pydantic import BaseModel, Field


class CampaignBrief(BaseModel):
    """
    Validated campaign brief input provided by the agency or client.
    """
    client_id: uuid.UUID
    agency_id: uuid.UUID
    period_month: int = Field(ge=1, le=12, description="Target campaign month (1-12)")
    period_year: int = Field(ge=2020, le=2100, description="Target campaign year")
    start_date: date | None = Field(default=None, description="Campaign sprint start date")
    end_date: date | None = Field(default=None, description="Campaign sprint end date")
    duration_days: int | None = Field(default=None, ge=1, le=365, description="Length of campaign sprint in days")
    objective: str = Field(min_length=3, description="Core business or marketing objective")
    custom_brief: str | None = Field(default=None, description="Detailed brief or instructions")
    target_audience: list[str] = Field(default_factory=list, description="Target demographics/personas")
    platforms: list[str] = Field(default_factory=list, description="Target social platforms (e.g. instagram, linkedin)")
    deliverable_preferences: list[str] = Field(default_factory=list, description="Format preferences (e.g. reel, carousel)")
    pinned_entities: list[str] = Field(default_factory=list, description="Verified hero products, services, or core brand features to emphasize")
    budget: float | None = Field(default=None, ge=0.0, description="Campaign budget if applicable")
    additional_constraints: list[str] = Field(default_factory=list, description="Explicit restrictions or rules")
    success_criteria: list[str] = Field(default_factory=list, description="Metrics or goals defining campaign success")

