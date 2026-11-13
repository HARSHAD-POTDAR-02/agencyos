from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Literal
from pydantic import BaseModel, Field, model_validator


# =====================================================================
# Core Domain Enums
# =====================================================================
class SocialPlatform(str, Enum):
    instagram = "instagram"
    tiktok = "tiktok"
    linkedin = "linkedin"
    facebook = "facebook"
    youtube = "youtube"


class ComplianceVerdict(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    NEEDS_REVIEW = "NEEDS_REVIEW"


class ArtifactType(str, Enum):
    storyboard = "storyboard"
    carousel_deck = "carousel_deck"
    static_post = "static_post"
    hook_comparison = "hook_comparison"
    research_evidence = "research_evidence"
    compliance_review = "compliance_review"
    campaign_blueprint = "campaign_blueprint"
    brand_positioning = "brand_positioning"
    performance_playbook = "performance_playbook"


class ArtifactStatus(str, Enum):
    draft = "draft"
    reviewed = "reviewed"
    approved = "approved"
    exported = "exported"
    superseded = "superseded"


# =====================================================================
# 1. Market Research Evidence Schemas (Source-Backed & Provenance-Tracked)
# =====================================================================
class EvidenceCitation(BaseModel):
    """Verifiable source citation backing a research observation."""
    source_title: str
    source_url: str = Field(description="Direct verifiable HTTP/HTTPS URL")
    publisher: str
    publication_date: str | None = None
    retrieval_timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    excerpt: str = Field(description="Direct verbatim quotation or documented empirical data point")
    is_direct_quote: bool = Field(default=True, description="False if summarized from source")
    geographic_relevance: str | None = None

    @model_validator(mode="after")
    def validate_url(self) -> EvidenceCitation:
        url = self.source_url.strip()
        if not (url.startswith("http://") or url.startswith("https://")):
            raise ValueError(f"source_url must start with http:// or https://: '{url}'")
        return self


class CompetitorActivity(BaseModel):
    """Directly observed competitor creative posting behavior."""
    competitor_name: str
    platform: SocialPlatform = SocialPlatform.instagram
    observed_creative_angle: str
    observed_format: str
    citation: EvidenceCitation


class InferredOpportunity(BaseModel):
    """Untapped angle or whitespace opportunity inferred by AgencyOS."""
    opportunity_description: str
    target_whitespace: str
    supporting_citations: list[EvidenceCitation] = Field(default_factory=list)


class ResearchDimensionStatus(str, Enum):
    ANSWERED = "answered"
    PARTIAL = "partial"
    MISSING = "missing"


class ResearchDimensionItem(BaseModel):
    """Tracking of requested query dimension vs evidence retrieved."""
    dimension: str
    status: ResearchDimensionStatus
    summary: str


class MarketResearchArtifactPayload(BaseModel):
    """Structured research report with explicit observed vs inferred separation."""
    query_topic: str
    observed_competitors: list[CompetitorActivity] = Field(default_factory=list)
    inferred_opportunities: list[InferredOpportunity] = Field(default_factory=list)
    verified_sources: list[EvidenceCitation] = Field(default_factory=list)
    search_limitations: str | None = None
    research_dimensions: list[ResearchDimensionItem] = Field(default_factory=list)
    discovered_count: int = 0
    inspected_count: int = 0
    claim_supported_count: int = 0


# =====================================================================
# 2. Performance Intelligence Schemas (Honest & Cold-Start Explicit)
# =====================================================================
class MetricMeasurementBasis(BaseModel):
    """Explicit measurement definition, denominator, and window."""
    denominator: str = Field(description="e.g. 'total_impressions', 'total_views', 'total_reach'")
    measurement_window_days: int = Field(ge=1, description="Number of past days analyzed (e.g. 30, 90, 180)")
    aggregation_method: str = Field(default="mean", description="Statistical aggregation: mean, median, sum")


class FormatPerformanceMetric(BaseModel):
    """Empirical performance metrics for a specific format and platform."""
    deliverable_format: str  # "reel", "carousel", "static_graphic"
    platform: SocialPlatform = SocialPlatform.instagram
    sample_size: int = Field(ge=0, default=0, description="Number of published posts in sample")
    avg_engagement_rate: float | None = Field(
        default=None,
        description="Explicitly None if sample_size == 0 (cold start)"
    )
    avg_views: float | None = Field(default=None, description="Explicitly None if sample_size == 0")
    avg_shares: float | None = Field(default=None, description="Explicitly None if sample_size == 0")
    top_performing_angles: list[str] = Field(default_factory=list)
    measurement_basis: MetricMeasurementBasis | None = None


class PerformanceArtifactPayload(BaseModel):
    """Performance Intelligence playbook with explicit data sufficiency status."""
    data_sufficiency: Literal["cold_start", "sparse", "sufficient"]
    sample_size_total: int = Field(ge=0, default=0)
    format_metrics: list[FormatPerformanceMetric] = Field(default_factory=list)
    creative_fatigue_signals: list[str] = Field(default_factory=list)
    recommended_format_ratio: dict[str, int] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_ratios(self) -> PerformanceArtifactPayload:
        for fmt, val in self.recommended_format_ratio.items():
            if val < 0:
                raise ValueError(f"Format ratio for '{fmt}' must be non-negative: {val}")
        return self


# =====================================================================
# 3. Content Architect: Storyboard, Carousel & Hook Schemas
# =====================================================================
class SceneCard(BaseModel):
    """Timestamped visual and auditory beat in a video/reel storyboard."""
    scene_number: int = Field(ge=1)
    start_ms: int = Field(ge=0, default=0)
    end_ms: int = Field(gt=0, default=3000)
    timestamp_range: str = Field(default="0:00 - 0:03")
    shot_type: str = Field(description="e.g. Extreme Close-Up, POV, Whip Pan, Talking Head")
    visual_action: str
    voiceover_script: str
    on_screen_text: str = ""
    audio_sfx_cue: str | None = None
    b_roll_notes: str | None = None
    ai_visual_prompt: str | None = Field(
        default=None,
        description="Ready-to-use Flux / Midjourney visual prompt for image/video generation"
    )

    @model_validator(mode="after")
    def validate_timing(self) -> SceneCard:
        if self.end_ms <= self.start_ms:
            raise ValueError(f"end_ms ({self.end_ms}) must be strictly greater than start_ms ({self.start_ms})")
        return self


class StoryboardArtifactPayload(BaseModel):
    """Production-ready video storyboard artifact for Reels/Shorts/TikTok."""
    deliverable_title: str
    platform: SocialPlatform = SocialPlatform.instagram
    format_type: Literal["reel"] = "reel"
    target_duration_seconds: int = Field(ge=5, le=180, default=20)
    strategic_pillar: str = "Core Value"
    scenes: list[SceneCard] = Field(min_length=1, default_factory=list)
    full_caption: str = ""
    hashtags: list[str] = Field(default_factory=list)
    call_to_action: str = ""


class CarouselSlideCard(BaseModel):
    """Single slide in a swipeable multi-card carousel deck."""
    slide_number: int = Field(ge=1)
    headline: str
    body_copy: str = ""
    visual_layout: str = "Clean typography layout with brand aesthetic"
    slide_type: Literal["cover", "content", "takeaway", "cta"] = "content"


class CarouselDeckArtifactPayload(BaseModel):
    """Production-ready carousel slide deck artifact."""
    deliverable_title: str
    platform: SocialPlatform = SocialPlatform.linkedin
    format_type: Literal["carousel"] = "carousel"
    slides: list[CarouselSlideCard] = Field(min_length=2, default_factory=list)
    full_caption: str = ""
    hashtags: list[str] = Field(default_factory=list)
    call_to_action: str = ""


class StaticPostArtifactPayload(BaseModel):
    """Production-ready static graphic deliverable artifact."""
    deliverable_title: str
    platform: SocialPlatform = SocialPlatform.instagram
    format_type: Literal["static"] = "static"
    graphic_headline: str
    visual_design_prompt: str
    caption: str
    hashtags: list[str] = Field(default_factory=list)
    call_to_action: str = ""


class HookComparisonCard(BaseModel):
    """Detailed structural analysis of a single opening hook variant."""
    hook_id: str
    opening_line: str
    framework: str = Field(description="e.g. Negative Constraint, Curiosity Gap, Insider Secret")
    psychological_trigger: str
    clarity_rating: Literal["High", "Medium", "Low"] = "High"
    fluff_detected: bool = False
    pros: str
    cons: str


class HookComparisonPayload(BaseModel):
    """Qualitative 3-way hook comparison matrix."""
    topic: str
    target_audience: str
    hooks: list[HookComparisonCard] = Field(min_length=2, default_factory=list)


# =====================================================================
# 4. Quality & Compliance Critic Schemas (Honest Verdicts & Visual Diffs)
# =====================================================================
class ComplianceCheckItem(BaseModel):
    """Individual compliance or guideline verification result."""
    check_name: str
    check_type: Literal["deterministic", "semantic_ai"]
    verdict: ComplianceVerdict
    flagged_snippet: str | None = None
    explanation: str
    suggested_correction: str | None = None
    is_blocking: bool = False


class ComplianceArtifactPayload(BaseModel):
    """Pre-flight quality and compliance audit report with derived blocking status."""
    checks: list[ComplianceCheckItem] = Field(default_factory=list)
    has_blocking_violations: bool = False
    original_text: str
    proposed_diff: str | None = Field(default=None, description="Visual unified Red/Green diff")

    @model_validator(mode="after")
    def derive_blocking_status(self) -> ComplianceArtifactPayload:
        self.has_blocking_violations = any(
            c.verdict == ComplianceVerdict.FAIL and c.is_blocking
            for c in self.checks
        )
        return self


# =====================================================================
# 5. Brand Positioning Schemas (4-Tier Epistemic Truth Architecture)
# =====================================================================
class TruthTierItem(BaseModel):
    """Grounded statement strictly classified into its epistemic source tier."""
    tier: Literal["verified_fact", "inferred_insight", "hypothesis_to_validate", "missing_information"]
    statement: str
    source_reference: str | None = None
    clarifying_question: str | None = None


class BrandPositioningPayload(BaseModel):
    """Brand positioning artifact with strict zero-hallucination truth separation."""
    business_name: str
    brand_voice: list[str] = Field(default_factory=list)
    confirmed_facts: list[TruthTierItem] = Field(default_factory=list)
    inferred_insights: list[TruthTierItem] = Field(default_factory=list)
    hypotheses_to_validate: list[TruthTierItem] = Field(default_factory=list)
    missing_information_questions: list[TruthTierItem] = Field(default_factory=list)


# =====================================================================
# 6. Campaign Strategist: Blueprint Schemas
# =====================================================================
class BlueprintStage(BaseModel):
    """Specific narrative phase within a campaign sprint."""
    stage_name: str
    day_range: str
    objective: str
    key_formats: list[str]


class CampaignBlueprintPayload(BaseModel):
    """Macro narrative arc and deliverable distribution blueprint."""
    campaign_theme: str
    slogan: str
    stages: list[BlueprintStage] = Field(default_factory=list)
    target_format_mix: dict[str, int] = Field(default_factory=dict)
