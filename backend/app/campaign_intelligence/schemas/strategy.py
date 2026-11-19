from __future__ import annotations

import ast
import json
import logging
import re
from typing import Any
from pydantic import BaseModel, Field, field_validator, model_validator

logger = logging.getLogger(__name__)


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

    @field_validator("target_emotions", mode="before")
    @classmethod
    def normalize_emotions(cls, v: Any) -> list[str]:
        if isinstance(v, str):
            return [x.strip() for x in v.split(",") if x.strip()]
        if isinstance(v, list):
            return [str(x) for x in v]
        return []


class CampaignStrategy(BaseModel):
    """
    Synthesized strategy artifact produced by Campaign Strategist.
    Connects brand context, market opportunities, and historical evidence.
    """
    campaign_theme: str
    primary_objective: str
    target_audience_definition: str
    strategic_thesis: str | None = Field(
        default=None,
        description="The central strategic thesis or provocative core argument"
    )
    core_tension: str | None = Field(
        default=None,
        description="The fundamental psychological friction point or unspoken truth addressed"
    )
    funnel_narrative: dict[str, str] = Field(
        default_factory=dict,
        description="Phased narrative journey (e.g. Awareness, Consideration, Conversion)"
    )
    strategic_angles: list[StrategicAngle] = Field(default_factory=list)
    messaging_pillars: list[MessagingPillar] = Field(default_factory=list)
    platform_distribution_strategy: dict[str, str] = Field(
        default_factory=dict,
        description="Platform to strategic role mapping (e.g. {'instagram': 'Top-of-funnel reach', 'linkedin': 'Professional authority'})"
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

    @field_validator("funnel_narrative", mode="before")
    @classmethod
    def normalize_funnel_narrative(cls, v: Any) -> dict[str, str]:
        if isinstance(v, dict):
            return {str(k): str(val) for k, val in v.items()}
        if isinstance(v, str):
            for parser in (ast.literal_eval, json.loads):
                try:
                    p = parser(v)
                    if isinstance(p, dict):
                        return {str(k): str(val) for k, val in p.items()}
                except Exception:
                    pass
            parts = re.findall(r"([a-zA-Z0-9_\s\-]+)[:=]\s*([^;\n]+)", v)
            if parts:
                return {p[0].strip(): p[1].strip() for p in parts}
            if v.strip():
                return {"narrative": v.strip()}
            return {}
        if isinstance(v, list):
            res = {}
            for idx, item in enumerate(v):
                if isinstance(item, dict):
                    for k, val in item.items():
                        res[str(k)] = str(val)
                elif item:
                    res[f"stage_{idx + 1}"] = str(item)
            return res
        return {}

    @field_validator("platform_distribution_strategy", mode="before")
    @classmethod
    def normalize_platform_distribution(cls, v: Any) -> dict[str, str]:
        if isinstance(v, dict):
            return {str(k): str(val) for k, val in v.items()}
        if isinstance(v, str):
            for parser in (ast.literal_eval, json.loads):
                try:
                    p = parser(v)
                    if isinstance(p, dict):
                        return {str(k): str(val) for k, val in p.items()}
                except Exception:
                    pass
            if v.strip():
                return {"primary": v.strip()}
            return {}
        if isinstance(v, list):
            res = {}
            for idx, item in enumerate(v):
                if isinstance(item, dict):
                    for k, val in item.items():
                        res[str(k)] = str(val)
                elif item:
                    res[f"platform_{idx + 1}"] = str(item)
            return res
        return {}

    @field_validator("budget_allocation", mode="before")
    @classmethod
    def normalize_budget_allocation(cls, v: Any) -> dict[str, float]:
        if isinstance(v, dict):
            clean = {}
            for k, val in v.items():
                if isinstance(val, (int, float)):
                    clean[str(k)] = float(val)
                elif isinstance(val, str):
                    nums = re.findall(r"\d+(?:\.\d+)?", val)
                    clean[str(k)] = float(nums[0]) if nums else 0.0
                else:
                    clean[str(k)] = 0.0
            return clean
        if isinstance(v, str):
            for parser in (ast.literal_eval, json.loads):
                try:
                    p = parser(v)
                    if isinstance(p, dict):
                        return cls.normalize_budget_allocation(p)
                except Exception:
                    pass
            # Check percentage patterns like "70% Instagram, 30% LinkedIn"
            pairs = re.findall(r"(\d+(?:\.\d+)?)\s*%\s*(?:for\s+|on\s+)?([a-zA-Z0-9_\s]+)", v)
            if pairs:
                return {p[1].strip().lower(): float(p[0]) for p in pairs}
            pairs_rev = re.findall(r"([a-zA-Z0-9_\s]+)\s*[:=]\s*(\d+(?:\.\d+)?)\s*%?", v)
            if pairs_rev:
                return {p[0].strip().lower(): float(p[1]) for p in pairs_rev}
            if v.strip():
                return {"allocation_summary": 100.0}
            return {}
        if isinstance(v, (int, float)):
            return {"total": float(v)}
        return {}

    @field_validator("success_benchmarks", mode="before")
    @classmethod
    def normalize_benchmarks(cls, v: Any) -> dict[str, str]:
        if isinstance(v, dict):
            return {str(k): str(val) for k, val in v.items()}
        if isinstance(v, str):
            for parser in (ast.literal_eval, json.loads):
                try:
                    p = parser(v)
                    if isinstance(p, dict):
                        return {str(k): str(val) for k, val in p.items()}
                except Exception:
                    pass
            if v.strip():
                return {"target": v.strip()}
            return {}
        if isinstance(v, list):
            res = {}
            for idx, item in enumerate(v):
                if isinstance(item, dict):
                    for k, val in item.items():
                        res[str(k)] = str(val)
                elif item:
                    res[f"benchmark_{idx + 1}"] = str(item)
            return res
        return {}

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


