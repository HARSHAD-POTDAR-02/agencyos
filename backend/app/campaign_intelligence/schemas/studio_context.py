from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any
from pydantic import BaseModel, Field

from app.campaign_intelligence.schemas.brand import BrandContext
from app.campaign_intelligence.schemas.campaign import CampaignBrief
from app.campaign_intelligence.schemas.performance import PerformancePlaybook
from app.campaign_intelligence.schemas.research import MarketResearchReport
from app.campaign_intelligence.schemas.strategy import CampaignStrategy


class CampaignStudioContext(BaseModel):
    """
    Immutable, authorized intelligence snapshot provided to specialists during interaction.
    Enforces immutability via frozen=True and tracks exact source versions for provenance.
    """
    context_snapshot_id: uuid.UUID = Field(default_factory=uuid.uuid4)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    agency_id: uuid.UUID
    client_id: uuid.UUID
    campaign_id: uuid.UUID
    client_name: str
    client_industry: str | None = None
    client_location: str | None = None
    campaign_brief: CampaignBrief

    # Specialized Intelligence Snapshots
    brand_context: BrandContext | None = None
    market_research: MarketResearchReport | None = None
    performance_playbook: PerformancePlaybook | None = None
    campaign_strategy: CampaignStrategy | None = None

    # Active Artifact Reference (Preserves continuity across specialist switches)
    active_artifact_id: uuid.UUID | str | None = None
    active_artifact_type: str | None = None
    active_artifact_version: int | None = None
    active_artifact_payload: dict[str, Any] | None = None

    # Discovered & Pinned Brand Entities (Offerings, Products, USPs)
    discovered_entities: list[str] = Field(default_factory=list)
    pinned_entities: list[str] = Field(default_factory=list)

    # Provenance tracking
    source_versions: dict[str, int | str] = Field(default_factory=dict)
    context_schema_version: str = "1.0"
    mode: str | None = None

    model_config = {
        "frozen": True,
        "arbitrary_types_allowed": True,
    }
