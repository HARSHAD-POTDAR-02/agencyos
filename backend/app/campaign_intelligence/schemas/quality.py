from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class FindingSeverity(str, Enum):
    critical = "critical"
    warning = "warning"
    info = "info"


class FindingCategory(str, Enum):
    brand_compliance = "brand_compliance"
    prohibited_term = "prohibited_term"
    prohibited_claim = "prohibited_claim"
    quota_mismatch = "quota_mismatch"
    strategic_alignment = "strategic_alignment"
    production_feasibility = "production_feasibility"
    platform_best_practice = "platform_best_practice"


class QualityFinding(BaseModel):
    """Specific compliance or quality issue identified during evaluation."""
    category: FindingCategory
    severity: FindingSeverity
    deliverable_index: int | None = Field(default=None, description="Index of affected deliverable if applicable")
    deliverable_title: str | None = None
    issue_description: str
    remediation_instruction: str


class RevisionInstruction(BaseModel):
    """Actionable instruction for iterative agent refinement."""
    target_agent: Literal["content_architect", "campaign_strategist", "human"]
    reason: str
    instructions: list[str] = Field(min_length=1)


class QualityEvaluation(BaseModel):
    """
    Quality Evaluation artifact produced by Quality Evaluator and Deterministic Validator.
    Determines whether campaign proceeds to Human Approval or routes back for revision.
    """
    is_approved_for_human_review: bool
    compliance_score: float = Field(ge=0.0, le=1.0, description="Calculated ratio of compliance checks passed")
    findings: list[QualityFinding] = Field(default_factory=list)
    revision_required: bool = False
    revision_instruction: RevisionInstruction | None = None
    evaluated_at: str = Field(description="ISO timestamp of evaluation")

