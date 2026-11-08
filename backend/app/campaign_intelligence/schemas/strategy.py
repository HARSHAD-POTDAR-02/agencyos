from __future__ import annotations

from typing import Any
from pydantic import BaseModel, Field, field_validator, model_validator


class StrategicAngle(BaseModel):
    """A distinct conceptual angle for the campaign."""
    angle_name: str
    rationale: str
    target_audience_segment: str
    aligned_content_pillar: str
    supporting_evidence: list[str] = Field(default_factory=list)

    @field_validator("supporting_evidence", mode="before")
    @classmethod
    def normalize_evidence(cls, v: Any) -> list[str]:
        if isinstance(v, list):
            res = []
            for x in v:
                if isinstance(x, dict):
                    res.append(" | ".join(f"{k}: {val}" for k, val in x.items()))
                else:
                    res.append(str(x))
            return res
        return v


class MessagingPillar(BaseModel):
    """Core messaging structure."""
    pillar_name: str
    core_message: str
    primary_call_to_action: str
    target_emotions: list[str] = Field(default_factory=list)


class CampaignStrategy(BaseModel):
    """
    Synthesized strategy artifact produced by Campaign Strategist.
    Connects brand context, market opportunities, and historical evidence.
    """
    campaign_theme: str
    primary_objective: str
    target_audience_definition: str
    strategic_angles: list[StrategicAngle] = Field(default_factory=list)
    messaging_pillars: list[MessagingPillar] = Field(default_factory=list)
    platform_distribution_strategy: dict[str, str] = Field(
        default_factory=dict,
        description="Platform to strategic role mapping (e.g. {'instagram': 'Top-of-funnel reach', 'linkedin': 'B2B authority'})"
    )
    pacing_and_cadence: str = Field(
        default="2-3 posts per week across 4 weeks",
        description="Posting cadence and weekly phasing",
    )
    budget_allocation: dict[str, float] = Field(default_factory=dict)
    success_benchmarks: dict[str, str] = Field(default_factory=dict)
    assumptions_and_risks: list[str] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def populate_cadence(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if not data.get("pacing_and_cadence"):
                cadence = data.get("cadence") or data.get("pacing") or data.get("weekly_cadence")
                data["pacing_and_cadence"] = str(cadence) if cadence else "2-3 posts per week across 4 weeks"
        return data

    @field_validator("assumptions_and_risks", mode="before")
    @classmethod
    def normalize_assumptions(cls, v: Any) -> list[str]:
        if isinstance(v, list):
            res = []
            for item in v:
                if isinstance(item, dict):
                    res.append(" | ".join(f"{k}: {val}" for k, val in item.items()))
                else:
                    res.append(str(item))
            return res
        return v

    @field_validator("success_benchmarks", mode="before")
    @classmethod
    def normalize_benchmarks(cls, v: Any) -> dict[str, str]:
        if isinstance(v, dict):
            return {str(k): str(val) for k, val in v.items()}
        return v

