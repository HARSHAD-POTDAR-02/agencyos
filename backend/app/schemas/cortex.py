from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, Field, field_validator


class FactType(str, Enum):
    GUARDRAIL = "guardrail"
    PERSONA = "persona"
    WINNING_PATTERN = "winning_pattern"
    TABOO = "taboo"


class FactStatus(str, Enum):
    PROPOSED = "proposed"
    ACTIVE = "active"
    SUPERSEDED = "superseded"
    ARCHIVED = "archived"


class MemoryScope(str, Enum):
    AGENCY = "agency"
    CLIENT = "client"
    CAMPAIGN = "campaign"


class RevisionTriplePayload(BaseModel):
    task_id: UUID
    client_id: UUID
    channel: str
    rejected_draft_v1: str
    revision_feedback: str
    approved_draft_v2: str


class ExtractedFactCandidate(BaseModel):
    fact_type: FactType
    scope: MemoryScope = MemoryScope.CLIENT
    statement: str = Field(..., min_length=8, max_length=500)
    rationale: str
    channels: List[str] = Field(default_factory=lambda: ["all"])
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    provenance_quote: str
    provenance_location: str
    conflicting_fact_id: Optional[UUID] = None
    conflict_explanation: Optional[str] = None

    @field_validator("conflicting_fact_id", mode="before")
    @classmethod
    def clean_conflicting_fact_id(cls, v):
        if not v or v == "" or v == "null" or v == "None":
            return None
        return v


class FactReviewDecision(BaseModel):
    action: str = Field(..., pattern="^(approve|supersede_existing|reject)$")
    target_superseded_fact_id: Optional[UUID] = None
    override_channels: Optional[List[str]] = None
    expires_at: Optional[datetime] = None
    reviewer_notes: Optional[str] = None

    @field_validator("target_superseded_fact_id", mode="before")
    @classmethod
    def clean_target_superseded_fact_id(cls, v):
        if not v or v == "" or v == "null" or v == "None":
            return None
        return v


class ComplianceViolation(BaseModel):
    rule_id: UUID
    rule_code: str
    fact_type: FactType
    severity: str = Field(..., pattern="^(BLOCK|WARN)$")
    explanation: str
    suggested_fix: str


class DraftAuditResponse(BaseModel):
    passed: bool
    is_compliant: bool = True
    checked_rules_count: int
    compliance_score: float = 1.0
    violations: List[ComplianceViolation]


class AgentCortexContext(BaseModel):
    client_id: UUID
    channel: str
    guardrails: List[Dict[str, Any]]
    taboos: List[Dict[str, Any]]
    personas: List[Dict[str, Any]]
    semantic_playbooks: List[Dict[str, Any]]


# Extended API Schemas for endpoints
class DocumentIngestPayload(BaseModel):
    client_id: UUID
    title: str
    content: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class TranscriptIngestPayload(BaseModel):
    client_id: UUID
    call_title: str
    transcript_text: str
    call_date: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class DraftAuditRequest(BaseModel):
    client_id: UUID
    channel: str = "all"
    draft_content: str
    campaign_id: Optional[UUID] = None


class AskAgencyBrainRequest(BaseModel):
    client_id: UUID
    query: str
    channel: Optional[str] = "all"
    top_k: int = 5


class CitedSource(BaseModel):
    source_id: UUID
    title: str
    chunk_type: str
    snippet: str
    similarity_score: float


class AskAgencyBrainResponse(BaseModel):
    answer: str
    active_guardrails_applied: List[str]
    cited_sources: List[CitedSource]


class BrandFactResponse(BaseModel):
    id: UUID
    client_id: Optional[UUID] = None
    scope: str
    campaign_id: Optional[UUID] = None
    fact_type: str
    status: str
    statement: str
    rationale: Optional[str] = None
    channels: List[str]
    confidence_score: float
    source_id: Optional[UUID] = None
    provenance_quote: Optional[str] = None
    provenance_location: Optional[str] = None
    supersedes_fact_id: Optional[UUID] = None
    expires_at: Optional[datetime] = None
    approved_by: Optional[UUID] = None
    approved_at: Optional[datetime] = None
    created_at: datetime
    conflicting_fact: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class LivingBrandVaultResponse(BaseModel):
    client_id: UUID
    client_name: str
    compiled_markdown: str
    total_active_rules: int
    guardrails_count: int
    taboos_count: int
    personas_count: int
    winning_patterns_count: int
    last_recompiled_at: datetime
    active_facts: List[BrandFactResponse] = []
