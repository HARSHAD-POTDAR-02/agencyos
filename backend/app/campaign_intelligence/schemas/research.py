from __future__ import annotations

from pydantic import BaseModel, Field


class ResearchEvidence(BaseModel):
    """Verifiable source citation backing a research finding."""
    source_title: str
    source_url: str
    publisher: str
    publication_date: str | None = None
    excerpt: str = Field(description="Direct verbatim citation or data point")
    key_takeaway: str = Field(description="Interpretation of the evidence")
    relevance_score: float = Field(ge=0.0, le=1.0, description="Relevance to campaign scope")


class CompetitorInsight(BaseModel):
    """Observed competitor angle and differentiation opportunity."""
    competitor_name: str
    observed_angle: str
    format_used: str
    differentiation_opportunity: str
    evidence: list[ResearchEvidence] = Field(default_factory=list)


class AudienceObservation(BaseModel):
    """External audience research finding."""
    segment_name: str
    pain_point: str
    trigger_topic: str
    evidence: list[ResearchEvidence] = Field(default_factory=list)


class PlatformFormatTrend(BaseModel):
    """Platform algorithm and format shift."""
    platform: str
    format: str
    trend_description: str
    recommendation: str
    evidence: list[ResearchEvidence] = Field(default_factory=list)


class MarketResearchReport(BaseModel):
    """
    Market Research intelligence artifact with verifiable evidence citations.
    """
    industry: str
    target_audience_insights: list[AudienceObservation] = Field(default_factory=list)
    competitor_landscape: list[CompetitorInsight] = Field(default_factory=list)
    format_and_platform_trends: list[PlatformFormatTrend] = Field(default_factory=list)
    strategic_opportunities: list[str] = Field(default_factory=list)
    buyer_language_snippets: list[str] = Field(
        default_factory=list,
        description="Verbatim colloquial customer quotes, pain phrases, and unfiltered voice-of-customer snippets",
    )
    evidence_sources: list[ResearchEvidence] = Field(default_factory=list)
    confidence_score: float = Field(ge=0.0, le=1.0, default=0.8)

