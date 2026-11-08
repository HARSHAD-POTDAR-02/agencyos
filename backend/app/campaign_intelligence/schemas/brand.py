from __future__ import annotations

import uuid
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class FeedbackClassification(str, Enum):
    """Categorization of historical feedback items."""
    explicit_rule = "explicit_rule"
    repeated_preference = "repeated_preference"
    deliverable_specific = "deliverable_specific"
    internal_reviewer = "internal_reviewer"


class FeedbackItem(BaseModel):
    """A classified feedback comment or review item."""
    classification: FeedbackClassification
    content: str
    source_deliverable_id: uuid.UUID | None = None
    author_name: str | None = None
    is_internal: bool = False


class VerifiedOffer(BaseModel):
    """An approved, verified client product, service, or promotional offer."""
    name: str
    description: str
    source: str = Field(description="Origin: confirmed_brand_profile, contract_notes, or client_record")
    is_verified: bool = True


class ProhibitedTerm(BaseModel):
    """Exact string/keyword forbidden from client content."""
    term: str
    is_exact_match: bool = True
    reason: str | None = None


class ProhibitedClaim(BaseModel):
    """Semantic claim or assertion forbidden from client content."""
    claim: str
    semantic_context: str | None = None
    reason: str | None = None


class ToneGuideline(BaseModel):
    """Actionable tone boundaries."""
    do: list[str] = Field(default_factory=list, description="Prescribed tone practices")
    dont: list[str] = Field(default_factory=list, description="Proscribed tone practices")


class ContractQuota(BaseModel):
    """Contractual deliverable quota information."""
    scope_item_id: uuid.UUID | None = None
    deliverable_type: str
    platform: str
    monthly_quantity: int
    contracted: int = 0
    remaining: int = 0


class BrandContext(BaseModel):
    """
    Validated brand knowledge artifact produced by Brand Intelligence.
    Separates immutable confirmed facts from inferred context and knowledge gaps.
    """
    client_id: uuid.UUID
    agency_id: uuid.UUID
    business_name: str
    industry: str | None = None
    website: str | None = None
    brand_positioning: str | None = None

    # Brand identity & tone
    brand_voice: list[str] = Field(default_factory=list)
    tone_guidelines: ToneGuideline = Field(default_factory=ToneGuideline)
    target_audience: list[str] = Field(default_factory=list)
    content_pillars: list[str] = Field(default_factory=list)
    approved_phrases: list[str] = Field(default_factory=list)

    # Compliance boundaries
    prohibited_terms: list[ProhibitedTerm] = Field(default_factory=list)
    prohibited_claims: list[ProhibitedClaim] = Field(default_factory=list)

    # Offerings & commercial constraints
    verified_offers: list[VerifiedOffer] = Field(default_factory=list)
    contract_quotas: list[ContractQuota] = Field(default_factory=list)

    # Historical reviewer learnings
    classified_feedback: list[FeedbackItem] = Field(default_factory=list)

    # Epistemic separation (Facts vs Assumptions vs Gaps vs Conflicts)
    confirmed_facts: list[str] = Field(
        default_factory=list,
        description="Immutable facts verified directly from the database"
    )
    assumptions: list[str] = Field(
        default_factory=list,
        description="Explicitly identified inferences made by the LLM"
    )
    conflicts: list[str] = Field(
        default_factory=list,
        description="Identified contradictions between brief requests and brand rules"
    )
    knowledge_gaps: list[str] = Field(
        default_factory=list,
        description="Missing brand data fields reported transparently without fabrication"
    )

