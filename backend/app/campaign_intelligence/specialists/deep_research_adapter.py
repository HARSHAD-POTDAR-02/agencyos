from __future__ import annotations

import logging
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession

from app.campaign_intelligence.schemas.studio_context import CampaignStudioContext
from app.campaign_intelligence.specialists.base import SpecialistAdapter, SpecialistResult
from app.campaign_intelligence.research.deep_research_graph import run_deep_research

logger = logging.getLogger(__name__)


class DeepResearchSpecialistAdapter(SpecialistAdapter):
    """
    Multi-stage Deep Research Specialist powered by LangGraph.
    
    Implements the official LangGraph Deep Research architecture:
    1. Scoping Supervisor: Decomposes complex queries into isolated sub-topic facets.
    2. Sub-Researcher Workers: Executes focused web search and compact page extractions per facet.
    3. Editorial Compiler: Recombines multi-topic dossiers into publication-grade competitive intelligence.
    """

    def __init__(self) -> None:
        super().__init__(
            specialist_id="deep_research",
            specialist_name="Deep Research Analyst",
        )

    async def execute(
        self,
        query: str,
        context: CampaignStudioContext,
        db: AsyncSession,
        on_event: Any | None = None,
    ) -> SpecialistResult:
        logger.info(f"DeepResearchSpecialistAdapter executing multi-stage research for: '{query[:60]}...'")
        return await run_deep_research(
            query=query,
            context=context,
            max_global_budget=6,
            on_event=on_event,
        )
