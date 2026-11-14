from __future__ import annotations

import abc
from typing import Any
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.campaign_intelligence.collaboration.schemas import ArtifactType
from app.campaign_intelligence.schemas.studio_context import CampaignStudioContext


class SpecialistResult(BaseModel):
    """Normalized response returned by any specialist adapter in Campaign Studio."""
    specialist_id: str
    specialist_name: str
    reply: str
    artifact_type: ArtifactType | None = None
    artifact_payload: dict[str, Any] | None = None
    activity_logs: list[str] = Field(default_factory=list)
    suggested_followups: list[str] = Field(default_factory=list)


class SpecialistAdapter(abc.ABC):
    """Abstract base class for all specialist adapters bridging agents into Campaign Studio."""

    def __init__(self, specialist_id: str, specialist_name: str):
        self.specialist_id = specialist_id
        self.specialist_name = specialist_name

    @abc.abstractmethod
    async def execute(
        self,
        query: str,
        context: CampaignStudioContext,
        db: AsyncSession,
        on_event: Any | None = None,
        **kwargs: Any,
    ) -> SpecialistResult:
        """Execute conversational request using existing agent logic and return structured result."""
        pass
