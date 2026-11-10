from __future__ import annotations

import uuid
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


class ReelScene(BaseModel):
    """A timestamped visual and audio beat within a video/reel."""
    scene_number: int = Field(default=1, ge=1)
    timestamp_range: str = Field(default="0:00 - 0:03", description="e.g. '0:00 - 0:03'")
    visual_action: str = Field(description="Director action: camera movement, talent motion, graphics")
    on_screen_text: str = Field(default="", description="Text overlay on frame")
    spoken_audio_or_voiceover: str = Field(default="", description="Spoken dialogue or voiceover script")
    b_roll_notes: str | None = Field(default=None, description="Supporting footage notes")

    @model_validator(mode="before")
    @classmethod
    def normalize_scene(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        d = dict(data)
        d.setdefault("scene_number", d.get("scene") or 1)
        d.setdefault("timestamp_range", d.get("timestamp") or "0:00 - 0:03")
        if not d.get("visual_action"):
            d["visual_action"] = d.get("visual") or d.get("action") or d.get("description") or "Camera angle on subject"
        d.setdefault("on_screen_text", d.get("text") or "")
        d.setdefault("spoken_audio_or_voiceover", d.get("voiceover") or d.get("audio") or d.get("script") or "")
        return d


class CarouselSlide(BaseModel):
    """A single card in a swipeable multi-image/carousel post."""
    slide_number: int = Field(default=1, ge=1)
    headline: str = Field(description="Dominant slide title")
    body_copy: str = Field(default="", description="Body text or bullet points")
    visual_layout: str = Field(default="Clean typography layout with brand aesthetic", description="Layout specification: illustration, mockup, diagram")
    slide_type: Literal["cover", "content", "takeaway", "cta"] = "content"

    @model_validator(mode="before")
    @classmethod
    def normalize_slide(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        d = dict(data)
        d.setdefault("slide_number", d.get("slide") or 1)
        if not d.get("headline"):
            d["headline"] = d.get("title") or d.get("header") or "Key Takeaway"
        if not d.get("body_copy"):
            d["body_copy"] = d.get("content") or d.get("copy") or d.get("caption") or d.get("text") or ""
        if not d.get("visual_layout"):
            d["visual_layout"] = d.get("visual") or d.get("layout") or d.get("image") or d.get("visual_concept") or "Clean brand aesthetic with bold typography"
        return d


class DeliverablePlan(BaseModel):
    """
    Polymorphic production-ready plan for a single social deliverable.
    Adapts based on deliverable_type (reel, carousel, static_graphic, text_post).
    """
    deliverable_id: uuid.UUID | None = None
    title: str = Field(min_length=3)
    deliverable_type: str = Field(description="reel, carousel, static_graphic, text_post")
    platform: str = Field(description="instagram, linkedin, twitter, facebook, youtube")
    planned_week: int = Field(default=1, ge=1, le=5)
    planned_day: int = Field(default=1, ge=1, description="Day number of the sprint (e.g. 1 for Day 1, 2 for Day 2)")
    scheduled_date: str | None = Field(default=None, description="Exact calendar date (YYYY-MM-DD)")
    date_label: str | None = Field(default=None, description="Human readable date label, e.g. 'Nov 08, 2026'")
    strategic_angle: str = Field(default="Core Brand Theme")
    hook_options: list[str] = Field(default_factory=list, description="Alternative tested hook concepts")
    primary_hook: str = Field(default="", description="Recommended opening hook")
    caption: str = Field(default="", description="Complete, copywritten social caption")
    hashtags: list[str] = Field(default_factory=list)
    call_to_action: str = Field(default="Follow for more")
    scope_item_id: uuid.UUID | None = None

    # Format-specific polymorphic fields
    reel_scenes: list[ReelScene] | None = Field(default_factory=list, description="Filled when deliverable_type == 'reel'")
    carousel_slides: list[CarouselSlide] | None = Field(default_factory=list, description="Filled when deliverable_type == 'carousel'")
    graphic_copy: str | None = Field(default=None, description="Filled when deliverable_type == 'static_graphic'")
    visual_asset_prompt: str | None = Field(default=None, description="Image generation or design brief prompt")
    audio_track_guidance: str | None = Field(default=None, description="Music/SFX pacing and genre guidance")
    production_notes: str | None = Field(default=None, description="Guidance for videographer/designer")

    @model_validator(mode="before")
    @classmethod
    def normalize_plan(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        d = dict(data)
        if not d.get("deliverable_type"):
            d["deliverable_type"] = d.get("format") or d.get("type") or "reel"
        d["deliverable_type"] = str(d["deliverable_type"]).lower()
        if not d.get("platform"):
            d["platform"] = "instagram" if "reel" in d["deliverable_type"] else "linkedin"
        d["platform"] = str(d["platform"]).lower()
        d.setdefault("planned_week", d.get("week") or 1)
        if not d.get("strategic_angle"):
            d["strategic_angle"] = d.get("pillar") or d.get("angle") or "Core Brand Theme"
        if not d.get("primary_hook"):
            d["primary_hook"] = d.get("hook") or d.get("title") or "Check this out"
        if not d.get("call_to_action"):
            d["call_to_action"] = d.get("cta") or "Learn more in bio"
        if not d.get("caption"):
            d["caption"] = d.get("body") or d.get("copy") or d.get("description") or d["primary_hook"]
        return d


