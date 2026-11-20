from __future__ import annotations

from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


class FindingSeverity(str, Enum):
    critical = "critical"
    blocking = "blocking"
    warning = "warning"
    info = "info"

    def __eq__(self, other: Any) -> bool:
        other_val = getattr(other, "value", other)
        if self.value in ("critical", "blocking") and str(other_val) in ("critical", "blocking"):
            return True
        return str.__eq__(self.value, str(other_val))

    def __hash__(self) -> int:
        return hash("critical" if self.value in ("critical", "blocking") else self.value)


class FindingCategory(str, Enum):
    brand_compliance = "brand_compliance"
    brand_voice = "brand_voice"
    prohibited_term = "prohibited_term"
    prohibited_claim = "prohibited_claim"
    quota_mismatch = "quota_mismatch"
    strategic_alignment = "strategic_alignment"
    production_feasibility = "production_feasibility"
    platform_best_practice = "platform_best_practice"
    cliche_slop = "cliche_slop"
    brand_boundary = "brand_boundary"
    commercial_unverified_claim = "commercial_unverified_claim"
    technical_compliance = "technical_compliance"
    visual_production_feasibility = "visual_production_feasibility"
    hook_length_cta = "hook_length_cta"


class QualityFinding(BaseModel):
    """Specific compliance or quality issue identified during evaluation."""
    category: FindingCategory | str
    severity: FindingSeverity | str
    deliverable_index: int | None = Field(default=None, description="Index of affected deliverable if applicable")
    deliverable_title: str | None = None
    issue_description: str = Field(default="")
    issue: str = Field(default="")
    remediation_instruction: str = Field(default="")

    @model_validator(mode="before")
    @classmethod
    def sync_finding_fields(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        d = dict(data)
        desc = d.get("issue_description") or d.get("issue") or ""
        d["issue_description"] = desc
        d.setdefault("issue", desc)

        sev = d.get("severity")
        if isinstance(sev, str):
            sev_lower = sev.lower().strip()
            if sev_lower in ("critical", "blocking", "high", "urgent", "blocker"):
                d["severity"] = FindingSeverity.critical
            elif sev_lower in ("info", "low", "minor", "suggestion"):
                d["severity"] = FindingSeverity.info
            else:
                d["severity"] = FindingSeverity.warning
        return d


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
    failing_deliverable_indices: list[int] = Field(
        default_factory=list,
        description="0-indexed deliverable slots with blocking issues for selective repair",
    )
    revision_required: bool = False
    revision_instruction: RevisionInstruction | None = None
    evaluated_at: str = Field(description="ISO timestamp of evaluation")

    @model_validator(mode="before")
    @classmethod
    def populate_failing_indices(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        d = dict(data)
        if "failing_deliverable_indices" not in d or not d.get("failing_deliverable_indices"):
            raw_findings = d.get("findings") or []
            indices: set[int] = set()
            for f in raw_findings:
                if isinstance(f, dict):
                    sev = str(f.get("severity") or "").lower().strip()
                    idx = f.get("deliverable_index")
                else:
                    sev = str(getattr(f, "severity", "")).lower().strip()
                    idx = getattr(f, "deliverable_index", None)
                if sev in ("blocking", "critical") and idx is not None:
                    try:
                        indices.add(int(idx))
                    except (ValueError, TypeError):
                        pass
            d["failing_deliverable_indices"] = sorted(list(indices))
        return d
