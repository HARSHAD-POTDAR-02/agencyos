from __future__ import annotations

import ast
import json
import logging
import re
from typing import Any, Literal
from pydantic import BaseModel, Field, field_validator, model_validator

logger = logging.getLogger(__name__)


HookCategory = Literal[
    "sensory_showcase",
    "behind_the_scenes",
    "pain_mirror",
    "counter_intuitive_myth",
    "live_proof_demo",
    "social_proof",
    "founder_or_expert_pov",
    "direct_offer",
]

DeliverableType = Literal[
    "reel",
    "carousel",
    "static",
    "text_thread",
    "static_graphic",
    "text_post",
]


class DeliverableSlot(BaseModel):
    """
    Individual content unit slot planned by Campaign Strategist.
    Grounds format, angle, hook category, buyer language, and factual constraints
    before micro-batch generation in Agent 5.
    """
    slot_index: int = Field(default=0, ge=0, description="0-indexed sequence position")
    planned_day: int = Field(default=1, ge=1, description="Sprint day e.g. Day 1, Day 3")
    deliverable_type: str = Field(description="reel, carousel, static, text_thread")
    target_platform: str = Field(description="instagram, linkedin, tiktok, facebook, youtube")
    funnel_stage: Literal[
        "top_of_funnel_awareness",
        "middle_of_funnel_consideration",
        "bottom_of_funnel_conversion",
    ] = "top_of_funnel_awareness"
    target_persona: str = Field(default="Target Audience")
    hook_category: HookCategory = Field(default="pain_mirror")
    strategic_angle_ref: str = Field(default="Core Strategic Angle")
    core_message: str = Field(default="")
    allowed_proof_points: list[str] = Field(default_factory=list)
    buyer_language_refs: list[str] = Field(default_factory=list)
    factual_boundary_constraints: list[str] = Field(default_factory=list)

    @field_validator("deliverable_type", mode="before")
    @classmethod
    def normalize_type(cls, v: Any) -> str:
        s = str(v).lower().strip()
        if "reel" in s or "video" in s or "short" in s:
            return "reel"
        if "carousel" in s or "slide" in s or "deck" in s:
            return "carousel"
        if "static" in s or "image" in s or "graphic" in s:
            return "static"
        if "text" in s or "thread" in s or "post" in s:
            return "text_thread"
        return s or "reel"

    @field_validator("target_platform", mode="before")
    @classmethod
    def normalize_platform(cls, v: Any) -> str:
        s = str(v).lower().strip()
        if "insta" in s:
            return "instagram"
        if "link" in s:
            return "linkedin"
        if "tik" in s:
            return "tiktok"
        if "face" in s or "fb" in s:
            return "facebook"
        if "tube" in s or "yt" in s:
            return "youtube"
        return s or "instagram"

    @field_validator("funnel_stage", mode="before")
    @classmethod
    def normalize_funnel_stage(cls, v: Any) -> str:
        s = str(v).lower().strip()
        if "top" in s or "aware" in s:
            return "top_of_funnel_awareness"
        if "mid" in s or "consid" in s or "eval" in s:
            return "middle_of_funnel_consideration"
        if "bot" in s or "conv" in s or "clos" in s or "action" in s:
            return "bottom_of_funnel_conversion"
        return "top_of_funnel_awareness"

    @field_validator("hook_category", mode="before")
    @classmethod
    def normalize_hook_category(cls, v: Any) -> str:
        s = str(v).lower().strip().replace("-", "_").replace(" ", "_")
        allowed = [
            "sensory_showcase",
            "behind_the_scenes",
            "pain_mirror",
            "counter_intuitive_myth",
            "live_proof_demo",
            "social_proof",
            "founder_or_expert_pov",
            "direct_offer",
        ]
        if s in allowed:
            return s
        for a in allowed:
            if a in s or s in a:
                return a
        if "myth" in s or "counter" in s:
            return "counter_intuitive_myth"
        if "demo" in s or "proof" in s:
            return "live_proof_demo"
        if "social" in s or "testim" in s or "case" in s:
            return "social_proof"
        if "pain" in s or "mirror" in s:
            return "pain_mirror"
        if "behind" in s or "bts" in s:
            return "behind_the_scenes"
        if "offer" in s or "cta" in s:
            return "direct_offer"
        if "founder" in s or "pov" in s or "expert" in s:
            return "founder_or_expert_pov"
        return "sensory_showcase"


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
    deliverable_slots: list[DeliverableSlot] = Field(
        default_factory=list,
        description="Deterministic deliverable slot plan specifying format, platform, persona, hook category, and factual boundaries for every planned content piece",
    )

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

    @field_validator("deliverable_slots", mode="before")
    @classmethod
    def normalize_slots(cls, v: Any) -> list[Any]:
        if not isinstance(v, list):
            return []
        slots = []
        for idx, item in enumerate(v):
            if isinstance(item, dict):
                d = dict(item)
                if "slot_index" not in d or d.get("slot_index") is None:
                    d["slot_index"] = idx
                if "planned_day" not in d or not d.get("planned_day"):
                    d["planned_day"] = idx * 2 + 1
                slots.append(d)
            else:
                slots.append(item)
        return slots



