from __future__ import annotations

from app.campaign_intelligence.specialists.base import SpecialistAdapter, SpecialistResult
from app.campaign_intelligence.specialists.brand_adapter import BrandSpecialistAdapter
from app.campaign_intelligence.specialists.content_architect_adapter import ContentArchitectAdapter
from app.campaign_intelligence.specialists.market_research_adapter import MarketResearchSpecialistAdapter
from app.campaign_intelligence.specialists.performance_adapter import PerformanceSpecialistAdapter
from app.campaign_intelligence.specialists.quality_evaluator_adapter import QualityEvaluatorAdapter
from app.campaign_intelligence.specialists.strategist_adapter import CampaignStrategistAdapter

SPECIALIST_REGISTRY: dict[str, SpecialistAdapter] = {
    "brand_intelligence": BrandSpecialistAdapter(),
    "market_research": MarketResearchSpecialistAdapter(),
    "historical_performance": PerformanceSpecialistAdapter(),
    "campaign_strategist": CampaignStrategistAdapter(),
    "director": CampaignStrategistAdapter(),  # Campaign Director routes to Strategist
    "content_architect": ContentArchitectAdapter(),
    "quality_evaluator": QualityEvaluatorAdapter(),
}


def get_specialist_adapter(specialist_id: str | None) -> SpecialistAdapter:
    """Retrieve specialist adapter by ID, defaulting to Campaign Strategist / Director."""
    target_id = specialist_id or "director"
    if target_id in SPECIALIST_REGISTRY:
        return SPECIALIST_REGISTRY[target_id]
    return SPECIALIST_REGISTRY["director"]


__all__ = [
    "SpecialistAdapter",
    "SpecialistResult",
    "BrandSpecialistAdapter",
    "ContentArchitectAdapter",
    "MarketResearchSpecialistAdapter",
    "PerformanceSpecialistAdapter",
    "QualityEvaluatorAdapter",
    "CampaignStrategistAdapter",
    "SPECIALIST_REGISTRY",
    "get_specialist_adapter",
]
