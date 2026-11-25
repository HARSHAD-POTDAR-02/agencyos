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
    hero_focus: list[str] = Field(default_factory=list, description="Hero entities featured in this scene")

    @model_validator(mode="before")
    @classmethod
    def normalize_scene(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        d = dict(data)
        sn = d.get("scene_number") if d.get("scene_number") is not None else d.get("scene", 1)
        try:
            d["scene_number"] = max(1, int(sn or 1))
        except Exception:
            d["scene_number"] = 1
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
    image_prompt: str | None = Field(default=None, description="Clean photographic visual prompt for Flux Klein (no text overlays, logos, or typography)")
    slide_type: Literal["cover", "content", "takeaway", "cta"] = "content"

    @model_validator(mode="before")
    @classmethod
    def normalize_slide(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        d = dict(data)
        sn = d.get("slide_number") if d.get("slide_number") is not None else d.get("slide", 1)
        try:
            d["slide_number"] = max(1, int(sn or 1))
        except Exception:
            d["slide_number"] = 1
        if not d.get("headline"):
            d["headline"] = d.get("title") or d.get("header") or "Key Takeaway"
        if not d.get("body_copy"):
            d["body_copy"] = d.get("content") or d.get("copy") or d.get("caption") or d.get("text") or ""
        if not d.get("visual_layout"):
            d["visual_layout"] = d.get("visual") or d.get("layout") or d.get("image") or d.get("visual_concept") or "Clean brand aesthetic with bold typography"

        st = str(d.get("slide_type") or "content").lower().strip()
        if st in ("cover", "hook", "title", "intro", "first"):
            d["slide_type"] = "cover"
        elif st in ("cta", "call_to_action", "action", "outro", "end", "last"):
            d["slide_type"] = "cta"
        elif st in ("takeaway", "summary", "conclusion", "recap"):
            d["slide_type"] = "takeaway"
        else:
            d["slide_type"] = "content"
        return d


class DeliverablePlan(BaseModel):
    """
    Polymorphic production-ready plan for a single social deliverable.
    Adapts based on deliverable_type (reel, carousel, static_graphic, text_post).
    """
    deliverable_id: uuid.UUID | None = None
    slot_index: int = Field(default=0, ge=0, description="0-indexed sequence position matching DeliverableSlot")
    title: str = Field(min_length=3)
    deliverable_type: str = Field(description="reel, carousel, static_graphic, text_post")
    platform: str = Field(description="instagram, facebook, linkedin")
    planned_week: int = Field(default=1, ge=1, le=5)
    planned_day: int = Field(default=1, ge=1, description="Day number of the sprint (e.g. 1 for Day 1, 2 for Day 2)")
    scheduled_date: str | None = Field(default=None, description="Exact calendar date (YYYY-MM-DD)")
    date_label: str | None = Field(default=None, description="Human readable date label, e.g. 'Nov 08, 2026'")
    strategic_angle: str = Field(default="Core Brand Theme")
    hook_category: str | None = Field(default=None, description="Hook category from DeliverableSlot")
    hook_options: list[str] = Field(default_factory=list, description="Alternative tested hook concepts")
    primary_hook: str = Field(default="", description="Recommended opening hook")
    caption: str = Field(default="", description="Complete, copywritten social caption")
    hashtags: list[str] = Field(default_factory=list)
    call_to_action: str = Field(default="Follow for more")
    allowed_proof_points: list[str] = Field(default_factory=list, description="Grounding proof points inherited from slot")
    factual_boundary_constraints: list[str] = Field(default_factory=list, description="Boundary constraints inherited from slot")
    hero_entity: str | None = Field(default=None, description="Featured hero offering, product, or core brand entity")
    hero_focus: list[str] = Field(default_factory=list, description="All matching hero entities for this deliverable")
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

        # Sanitize non-UUID deliverable_id (e.g. LLM generates "deliv-001")
        raw_deliv_id = d.get("deliverable_id")
        if raw_deliv_id is not None:
            try:
                uuid.UUID(str(raw_deliv_id))
            except Exception:
                d["deliverable_id"] = None

        # Sanitize non-UUID scope_item_id (e.g. LLM generates "scope-001")
        raw_scope_id = d.get("scope_item_id")
        if raw_scope_id is not None:
            try:
                uuid.UUID(str(raw_scope_id))
            except Exception:
                d["scope_item_id"] = None

        # Sanitize planned_week (clamp between 1 and 5)
        try:
            week_raw = d.get("planned_week") if d.get("planned_week") is not None else d.get("week", 1)
            week_val = int(week_raw or 1)
            if week_val < 1:
                week_val = 1
            elif week_val > 5:
                week_val = 5
            d["planned_week"] = week_val
        except Exception:
            d["planned_week"] = 1

        # Sanitize slot_index (ensure >= 0)
        try:
            slot_raw = d.get("slot_index") if d.get("slot_index") is not None else d.get("slot", 0)
            d["slot_index"] = max(0, int(slot_raw or 0))
        except Exception:
            d["slot_index"] = 0

        # Sanitize planned_day (ensure >= 1)
        try:
            day_raw = d.get("planned_day") if d.get("planned_day") is not None else d.get("day", 1)
            day_val = int(day_raw or 1)
            d["planned_day"] = max(1, day_val)
        except Exception:
            d["planned_day"] = 1

        if not d.get("title") or len(str(d.get("title")).strip()) < 3:
            d["title"] = d.get("primary_hook") or d.get("headline") or f"Deliverable Day {d.get('planned_day', 1)}"
        if not d.get("strategic_angle"):
            d["strategic_angle"] = d.get("pillar") or d.get("angle") or "Core Brand Theme"
        if not d.get("primary_hook"):
            d["primary_hook"] = d.get("hook") or d.get("title") or "Check this out"
        if not d.get("call_to_action"):
            d["call_to_action"] = d.get("cta") or "Learn more in bio"
        if not d.get("caption"):
            d["caption"] = d.get("body") or d.get("copy") or d.get("description") or d["primary_hook"]

        # Strict 1-based sequential normalization for storyboard scenes (eliminates duplicate Scene 1)
        if d.get("reel_scenes") and isinstance(d["reel_scenes"], list):
            norm_scenes = []
            for sc_idx, sc in enumerate(d["reel_scenes"], start=1):
                if isinstance(sc, dict):
                    sc_dict = dict(sc)
                    sc_dict["scene_number"] = sc_idx
                    norm_scenes.append(sc_dict)
                elif hasattr(sc, "model_copy"):
                    norm_scenes.append(sc.model_copy(update={"scene_number": sc_idx}))
                else:
                    norm_scenes.append(sc)
            d["reel_scenes"] = norm_scenes

        # Strict 1-based sequential normalization for carousel slides (eliminates duplicate Slide 1)
        if d.get("carousel_slides") and isinstance(d["carousel_slides"], list):
            norm_slides = []
            for sl_idx, sl in enumerate(d["carousel_slides"], start=1):
                if isinstance(sl, dict):
                    sl_dict = dict(sl)
                    sl_dict["slide_number"] = sl_idx
                    norm_slides.append(sl_dict)
                elif hasattr(sl, "model_copy"):
                    norm_slides.append(sl.model_copy(update={"slide_number": sl_idx}))
                else:
                    norm_slides.append(sl)
            d["carousel_slides"] = norm_slides

        return d


