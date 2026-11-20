from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Literal
import httpx
import requests
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.campaign_intelligence.collaboration.schemas import (
    ArtifactType,
    CarouselDeckArtifactPayload,
    CarouselSlideCard,
    HookComparisonCard,
    HookComparisonPayload,
    SceneCard,
    SocialPlatform,
    StoryboardArtifactPayload,
)
from app.campaign_intelligence.schemas.studio_context import CampaignStudioContext
from app.campaign_intelligence.specialists.base import SpecialistAdapter, SpecialistResult
from app.core.config import settings
from app.core.llm import invoke_structured_llm

logger = logging.getLogger(__name__)


# =====================================================================
# Output Schemas
# =====================================================================

class StoryboardGenerationOutput(BaseModel):
    conversational_intro: str
    deliverable_title: str
    target_duration_seconds: int = 20
    strategic_pillar: str = "Core Value"
    scenes: list[SceneCard] = Field(
        min_length=1,
        description="A sequential list of at least 3 to 15 distinct scene cards breaking down the entire video beat-by-beat into 3-6 second cuts. You MUST NOT output only 1 scene.",
    )
    caption: str = Field(default="", description="Full publishable post caption with hashtags and emojis. MUST NOT be empty.")
    hashtags: list[str] = Field(default_factory=list, description="5 to 10 relevant hashtags.")
    call_to_action: str = Field(default="", description="Clear closing call to action.")
    suggested_followups: list[str] = Field(default_factory=list)


class TargetedSceneRevisionOutput(BaseModel):
    conversational_intro: str
    shot_type: str = Field(description="Camera framing or shot type, e.g. Macro Close-Up, POV Whip Pan, Talking Head")
    visual_action: str = Field(description="Director action and talent guidance")
    voiceover_script: str = Field(description="Spoken dialogue or voiceover")
    on_screen_text: str = Field(default="", description="Text overlay on screen")
    audio_sfx_cue: str | None = Field(default=None, description="Sound effect or beat cue")
    ai_visual_prompt: str | None = Field(default=None, description="Visual prompt for image/video generation")
    suggested_followups: list[str] = Field(default_factory=list)


class TargetedSlideRevisionOutput(BaseModel):
    conversational_intro: str
    headline: str = Field(description="Slide headline")
    body_copy: str = Field(default="", description="Slide body text")
    visual_layout: str = Field(default="Clean typography layout with brand aesthetic", description="Design or illustration guidance")
    slide_type: Literal["cover", "content", "takeaway", "cta"] = "content"
    suggested_followups: list[str] = Field(default_factory=list)


class TargetedCopyRevisionOutput(BaseModel):
    conversational_intro: str
    revised_text: str = Field(description="The updated text for the targeted field (caption, CTA, or hashtags)")
    suggested_followups: list[str] = Field(default_factory=list)


class HookAnalysisOutput(BaseModel):
    conversational_intro: str
    topic: str
    target_audience: str
    hooks: list[HookComparisonCard] = Field(min_length=2)
    recommended_hook_id: str
    suggested_followups: list[str] = Field(default_factory=list)


class CarouselGenerationOutput(BaseModel):
    conversational_intro: str
    deliverable_title: str
    slides: list[CarouselSlideCard] = Field(min_length=2)
    caption: str = ""
    hashtags: list[str] = Field(default_factory=list)
    call_to_action: str = ""
    suggested_followups: list[str] = Field(default_factory=list)


class SceneScriptUpdate(BaseModel):
    scene_number: int = Field(description="Scene number (1-based index matching existing scenes)")
    voiceover_script: str = Field(description="Spoken dialogue or voiceover for this scene")
    on_screen_text: str = Field(default="", description="Text overlay on screen")
    visual_action: str | None = Field(default=None, description="Updated visual action if altered, otherwise null to keep existing")


class ReviseAllScenesOutput(BaseModel):
    conversational_intro: str
    scenes: list[SceneScriptUpdate] = Field(min_length=1, description="Updated scripts and on-screen text for each scene")
    caption: str | None = Field(default=None, description="Updated full caption if modified to match the new script style")
    call_to_action: str | None = Field(default=None, description="Updated call to action if applicable")
    suggested_followups: list[str] = Field(default_factory=list)


class SlideCopyUpdate(BaseModel):
    slide_number: int = Field(description="Slide number (1-based index)")
    headline: str = Field(description="Updated headline for this slide")
    body_copy: str = Field(description="Updated body text for this slide")
    visual_layout: str | None = Field(default=None, description="Updated visual layout if altered")


class ReviseAllSlidesOutput(BaseModel):
    conversational_intro: str
    slides: list[SlideCopyUpdate] = Field(min_length=1, description="Updated copy for each slide")
    caption: str | None = Field(default=None, description="Updated post caption if modified")
    call_to_action: str | None = Field(default=None, description="Updated call to action")
    suggested_followups: list[str] = Field(default_factory=list)


# =====================================================================
# Timing & Intent Classification Helpers
# =====================================================================

def normalize_storyboard_scenes_timing(
    scenes: list[SceneCard],
    target_duration_seconds: int | None = None,
) -> tuple[list[SceneCard], int]:
    """
    Ensure sequential start_ms/end_ms, monotonic timestamp_range,
    and consistent total duration.
    If target_duration_seconds is provided and raw scene timings significantly deviate,
    scale durations proportionally so total duration matches target_duration_seconds.
    If a single scene is passed for a long duration (>=15s), auto-subdivides it into
    distinct cinematic beats (3-6s each).
    """
    if not scenes:
        return [], 0

    tot_sec = target_duration_seconds or 20

    # Guard: Subdivide if only 1 scene was returned for a multi-beat reel (>=15s)
    if len(scenes) == 1 and tot_sec >= 15:
        s0 = scenes[0]
        beat_count = max(3, min(10, tot_sec // 6))
        beat_dur_ms = (tot_sec * 1000) // beat_count
        vo_parts = [p.strip() for p in re.split(r"(?<=[.!?])\s+", s0.voiceover_script or "") if p.strip()]
        subdivided: list[SceneCard] = []
        for i in range(beat_count):
            st_ms = i * beat_dur_ms
            en_ms = (i + 1) * beat_dur_ms if (i < beat_count - 1) else (tot_sec * 1000)
            st_sec = st_ms // 1000
            en_sec = en_ms // 1000
            ts_str = f"{st_sec // 60}:{st_sec % 60:02d} - {en_sec // 60}:{en_sec % 60:02d}"
            vo = vo_parts[i] if i < len(vo_parts) else (s0.voiceover_script if i == 0 else "")
            subdivided.append(SceneCard(
                scene_number=i + 1,
                start_ms=st_ms,
                end_ms=en_ms,
                timestamp_range=ts_str,
                shot_type=s0.shot_type if i == 0 else f"Scene Beat #{i+1}",
                visual_action=s0.visual_action if i == 0 else f"Continuation of {s0.visual_action[:80]}",
                voiceover_script=vo,
                on_screen_text=s0.on_screen_text if i == 0 else "",
                audio_sfx_cue=s0.audio_sfx_cue,
                ai_visual_prompt=s0.ai_visual_prompt,
            ))
        scenes = subdivided

    # First pass: calculate raw durations
    raw_durations: list[int] = []
    for s in scenes:
        d = max(2000, s.end_ms - s.start_ms) if (s.end_ms > s.start_ms) else 3000
        raw_durations.append(d)

    total_raw_ms = sum(raw_durations)

    # If target_duration_seconds is specified and differs from raw sum by > 20%, scale proportionally
    durations = raw_durations
    if target_duration_seconds and target_duration_seconds >= 5 and total_raw_ms > 0:
        target_total_ms = target_duration_seconds * 1000
        ratio = target_total_ms / total_raw_ms
        if ratio < 0.8 or ratio > 1.2:
            scaled: list[int] = []
            accum = 0
            for i, d in enumerate(raw_durations):
                if i == len(raw_durations) - 1:
                    scaled_d = max(2000, target_total_ms - accum)
                else:
                    scaled_d = max(2000, int(d * ratio))
                    accum += scaled_d
                scaled.append(scaled_d)
            durations = scaled

    normalized: list[SceneCard] = []
    curr_ms = 0
    for idx, (s, dur) in enumerate(zip(scenes, durations)):
        s_num = idx + 1
        start = curr_ms
        end = curr_ms + dur
        curr_ms = end

        start_sec = start // 1000
        end_sec = end // 1000
        ts_range = f"{start_sec // 60}:{start_sec % 60:02d} - {end_sec // 60}:{end_sec % 60:02d}"

        normalized.append(
            s.model_copy(update={
                "scene_number": s_num,
                "start_ms": start,
                "end_ms": end,
                "timestamp_range": ts_range,
            })
        )
    total_seconds = max(5, (curr_ms + 999) // 1000)
    return normalized, total_seconds


def parse_target_duration(query: str, default_duration: int = 20) -> int:
    """
    Extract target video duration in seconds from user query.
    Handles '60s', '60 sec', '60 secs', '60 second', '60 seconds', '1 minute', '2 minutes', etc.
    Clamps between 5 and 180 seconds.
    """
    lower = query.lower()

    # Minute patterns: "1 minute", "2 min", "1.5 minutes"
    min_match = re.search(r"\b(\d+(?:\.\d+)?)\s*(?:minutes?|mins?)\b", lower)
    if min_match:
        try:
            val = float(min_match.group(1))
            return max(5, min(180, int(val * 60)))
        except ValueError:
            pass

    # Second patterns: "60 seconds", "60 sec", "60s", "30-second", "15 second"
    sec_match = re.search(r"\b(\d+)\s*(?:-|–)?\s*(?:seconds?|secs?|s)\b", lower)
    if sec_match:
        try:
            val = int(sec_match.group(1))
            return max(5, min(180, val))
        except ValueError:
            pass

    return default_duration


def parse_insert_position(query: str, current_count: int) -> int:
    """
    Parse natural language insertion targets:
    - 'between 1 and 2' -> index 1 (becomes new Scene/Slide 2)
    - 'between scene 2 and 3' -> index 2
    - 'after scene 1' -> index 1
    - 'before scene 2' -> index 1
    - 'at the beginning' / 'as scene 1' -> index 0
    - 'at the end' -> index current_count
    """
    lower = query.lower()

    # 'between X and Y' (e.g. 'between 1 and 2', 'between scene 1 and scene 2')
    btw_match = re.search(r"\bbetween\s+(?:the\s+)?(?:scenes?|slides?)?\s*(\d+)\s+(?:and|&)\s+(?:scenes?|slides?)?\s*(\d+)\b", lower)
    if btw_match:
        pos = min(int(btw_match.group(1)), int(btw_match.group(2)))
        return pos  # 0-based insertion index

    # 'after scene X' / 'after slide X'
    after_match = re.search(r"\bafter\s+(?:the\s+)?(?:scenes?|slides?)\s*(\d+)\b", lower)
    if after_match:
        return int(after_match.group(1))

    # 'before scene X' / 'before slide X'
    before_match = re.search(r"\bbefore\s+(?:the\s+)?(?:scenes?|slides?)\s*(\d+)\b", lower)
    if before_match:
        return max(0, int(before_match.group(1)) - 1)

    # 'as scene X' / 'as slide X'
    as_match = re.search(r"\bas\s+(?:the\s+)?(?:scenes?|slides?)\s*(\d+)\b", lower)
    if as_match:
        return max(0, int(as_match.group(1)) - 1)

    if any(kw in lower for kw in [
        "at the beginning", "at the start", "first scene", "first slide",
        "at beginning", "at start", "hook scene", "hook slide", "as a hook", "as hook", "new hook"
    ]):
        return 0

    return current_count


# =====================================================================
# LLM Intent Classification (NVIDIA NIM)
# =====================================================================

async def classify_storyboard_intent_nim(query: str, current_scene_count: int) -> dict[str, Any] | None:
    """
    Call NVIDIA NIM 'nvidia/nemotron-3.5-bolt-e4b' to classify user edit intent.
    Uses httpx.AsyncClient with a fast 5s timeout. Returns structured intent dict or None on failure.
    """
    api_key = getattr(settings, "NVIDIA_API_KEY", "") or os.environ.get("NVIDIA_API_KEY", "")
    if not api_key:
        return None

    base_url = getattr(settings, "NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1").rstrip("/")
    url = f"{base_url}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    system_prompt = f"""You are an expert intent classifier for a video storyboard editor.
The active storyboard currently has {current_scene_count} scenes (Scene 1 to Scene {current_scene_count}).
Classify the user prompt into one operation:
- STRUCTURAL_ADD: adding or inserting a NEW scene anywhere (beginning, hook, middle, between, end).
- STRUCTURAL_DELETE: deleting or removing an existing scene.
- TARGETED_SCENE_EDIT: modifying an EXISTING scene in place without adding/removing scenes.
- TARGETED_FIELD_EDIT: modifying only caption, CTA, hashtags, or title.
- REVISE_ALL_SCENES: revising voiceovers/script/dialogue/language/tone across existing scenes, or asking to 'use that in the storyboard' / 'apply this script' / 'update script for all scenes'.
- FULL_REWRITE: starting completely over from scratch or requesting a new draft/storyboard/duration (e.g. 'start over', 'scrap this', 'completely new concept', 'create a 60 sec draft', 'draft a 60 second reel', 'new 30s storyboard').

Output JSON only without any markdown formatting or extra text:
{{
  "operation": "STRUCTURAL_ADD" | "STRUCTURAL_DELETE" | "TARGETED_SCENE_EDIT" | "TARGETED_FIELD_EDIT" | "REVISE_ALL_SCENES" | "FULL_REWRITE",
  "target_scene_number": null or integer (1-based),
  "insert_index": null or integer (0-based index for insertion; 0 for beginning/hook, 1 for after scene 1 or between 1 and 2, {current_scene_count} for end),
  "target_field": null or "caption" | "cta" | "hashtags" | "title"
}}"""

    payload = {
        "model": "nvidia/nemotron-3.5-bolt-e4b",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": query},
        ],
        "temperature": 0.1,
        "max_tokens": 150,
    }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.post(url, headers=headers, json=payload)
            if r.status_code == 200:
                content = r.json()["choices"][0]["message"]["content"]
                cleaned = content.strip().strip("```json").strip("```").strip()
                return json.loads(cleaned)
    except Exception as ex:
        logger.warning(f"NVIDIA NIM intent classification fallback triggered: {ex}")
    return None


async def classify_carousel_intent_nim(query: str, current_slide_count: int) -> dict[str, Any] | None:
    """
    Call NVIDIA NIM 'nvidia/nemotron-3.5-bolt-e4b' to classify carousel edit intent.
    Uses httpx.AsyncClient with a fast 5s timeout.
    """
    api_key = getattr(settings, "NVIDIA_API_KEY", "") or os.environ.get("NVIDIA_API_KEY", "")
    if not api_key:
        return None

    base_url = getattr(settings, "NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1").rstrip("/")
    url = f"{base_url}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    system_prompt = f"""You are an expert intent classifier for a carousel deck editor.
The active deck currently has {current_slide_count} slides (Slide 1 to Slide {current_slide_count}).
Classify the user prompt into one operation:
- STRUCTURAL_ADD: adding or inserting a NEW slide anywhere.
- STRUCTURAL_DELETE: deleting or removing an existing slide.
- TARGETED_SLIDE_EDIT: modifying an EXISTING slide in place.
- TARGETED_FIELD_EDIT: modifying only caption or CTA.
- REVISE_ALL_SLIDES: revising headlines and copy across all slides.
- FULL_REWRITE: starting completely over from scratch.

Output JSON only without any markdown formatting or extra text:
{{
  "operation": "STRUCTURAL_ADD" | "STRUCTURAL_DELETE" | "TARGETED_SLIDE_EDIT" | "TARGETED_FIELD_EDIT" | "REVISE_ALL_SLIDES" | "FULL_REWRITE",
  "target_slide_number": null or integer (1-based),
  "insert_index": null or integer (0-based index for insertion; 0 for cover/first, {current_slide_count} for end),
  "target_field": null or "caption" | "cta"
}}"""

    payload = {
        "model": "nvidia/nemotron-3.5-bolt-e4b",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": query},
        ],
        "temperature": 0.1,
        "max_tokens": 150,
    }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.post(url, headers=headers, json=payload)
            if r.status_code == 200:
                content = r.json()["choices"][0]["message"]["content"]
                cleaned = content.strip().strip("```json").strip("```").strip()
                return json.loads(cleaned)
    except Exception as ex:
        logger.warning(f"NVIDIA NIM carousel intent classification fallback: {ex}")
    return None


def classify_storyboard_operation_rules(query: str, active_payload: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    """Deterministic regex rule fallback for storyboard operation classification."""
    lower = query.lower()

    if any(phrase in lower for phrase in [
        "start over", "from scratch", "scrap this", "completely new",
        "new concept", "brand new script", "new storyboard",
        "create a", "create new", "draft a", "new draft", "new reel"
    ]) and not any(kw in lower for kw in ["new scene", "another scene", "insert", "add a", "between"]):
        return "FULL_REWRITE", {}

    del_match = re.search(r"\b(?:delete|remove|drop|cut)\s+(?:the\s+)?(?:scenes?|slides?|shots?|cards?)\s*(\d+)\b", lower)
    if del_match:
        return "STRUCTURAL_EDIT", {"action": "delete", "target_number": int(del_match.group(1))}

    if (
        any(kw in lower for kw in ["caption", "post description", "post copy"])
        and not any(s in lower for s in ["scene", "shot", "card", "hook", "storyboard", "script", "voiceover", "dialogue"])
    ):
        return "TARGETED_EDIT", {"target_type": "caption"}
    if any(kw in lower for kw in ["call to action", "cta", "closing line", "closing cta"]) and not any(s in lower for s in ["scene", "shot", "card", "hook"]):
        return "TARGETED_EDIT", {"target_type": "cta"}
    if any(kw in lower for kw in ["hashtag", "hashtags", "tag", "tags"]) and not any(s in lower for s in ["scene", "shot", "card", "hook"]):
        return "TARGETED_EDIT", {"target_type": "hashtags"}

    is_add_scene_intent = (
        bool(re.search(r"\b(?:add|insert|include|put)\b.*\b(?:scenes?|slides?|cards?|shots?|hooks?)\b", lower))
        or bool(re.search(r"\b(?:add|insert|include|put)\s+(?:a\s+)?(?:new\s+)?(?:another\s+)?(?:\w+\s+)?(?:scene|card|shot|hook)\b", lower))
        or (
            any(v in lower for v in ["add ", "insert ", "put "])
            and any(p in lower for p in ["between", "after scene", "before scene", "at the beginning", "at the start", "at the end", "as scene"])
        )
        or any(kw in lower for kw in ["new scene", "new hook scene", "another scene", "insert hook", "add hook"])
    )

    if is_add_scene_intent:
        num_scenes = len(active_payload.get("scenes", []))
        insert_idx = parse_insert_position(query, num_scenes)
        return "STRUCTURAL_EDIT", {"action": "add", "insert_index": insert_idx}

    scene_match = re.search(r"\bscene\s*(\d+)\b", lower)
    target_num = None
    if scene_match:
        target_num = int(scene_match.group(1))
    else:
        ordinals = {
            "first scene": 1, "1st scene": 1, "hook scene": 1,
            "second scene": 2, "2nd scene": 2,
            "third scene": 3, "3rd scene": 3,
            "fourth scene": 4, "4th scene": 4,
            "fifth scene": 5, "5th scene": 5,
        }
        for k, v in ordinals.items():
            if k in lower:
                target_num = v
                break

    if target_num is not None and not any(kw in lower for kw in ["all scenes", "all the scenes", "every scene"]):
        return "TARGETED_EDIT", {"target_type": "scene", "target_number": target_num}

    if any(kw in lower for kw in ["rename", "deliverable title"]):
        return "TARGETED_EDIT", {"target_type": "title"}
    if (
        any(kw in lower for kw in ["caption", "post description", "post copy"])
        and not any(kw in lower for kw in ["scene", "scenes", "storyboard", "script", "voiceover", "dialogue"])
    ):
        return "TARGETED_EDIT", {"target_type": "caption"}

    if "hook" in lower and not any(kw in lower for kw in ["all", "scenes", "storyboard"]):
        return "TARGETED_EDIT", {"target_type": "scene", "target_number": 1}

    return "REVISE_ALL_SCENES", {}


async def classify_storyboard_operation(query: str, active_payload: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    """
    Classify user query into:
    1. TARGETED_EDIT (specific scene, caption, cta, hashtags, title)
    2. STRUCTURAL_EDIT (add scene, delete scene)
    3. REVISE_ALL_SCENES (script/voiceover changes across all scenes)
    4. FULL_REWRITE (regenerate whole storyboard from scratch)

    Uses NVIDIA NIM 'nvidia/nemotron-3.5-bolt-e4b' as primary LLM classifier,
    with deterministic regex rules as a fallback.
    """
    scenes = active_payload.get("scenes", [])
    num_scenes = len(scenes)

    nim_res = await classify_storyboard_intent_nim(query, num_scenes)
    if nim_res and "operation" in nim_res:
        op = nim_res["operation"]
        if op == "STRUCTURAL_ADD":
            idx = nim_res.get("insert_index")
            if idx is None:
                idx = parse_insert_position(query, num_scenes)
            idx = max(0, min(idx, num_scenes))
            return "STRUCTURAL_EDIT", {"action": "add", "insert_index": idx}
        elif op == "STRUCTURAL_DELETE":
            target_num = nim_res.get("target_scene_number") or 1
            return "STRUCTURAL_EDIT", {"action": "delete", "target_number": target_num}
        elif op == "TARGETED_SCENE_EDIT":
            target_num = nim_res.get("target_scene_number") or 1
            return "TARGETED_EDIT", {"target_type": "scene", "target_number": target_num}
        elif op == "TARGETED_FIELD_EDIT":
            field = nim_res.get("target_field") or "caption"
            return "TARGETED_EDIT", {"target_type": field}
        elif op == "REVISE_ALL_SCENES":
            return "REVISE_ALL_SCENES", {}
        elif op == "FULL_REWRITE":
            return "FULL_REWRITE", {}

    return classify_storyboard_operation_rules(query, active_payload)


def classify_carousel_operation_rules(query: str, active_payload: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    """Deterministic regex rule fallback for carousel operation classification."""
    lower = query.lower()
    if any(phrase in lower for phrase in [
        "start over", "from scratch", "scrap this", "completely new",
        "new concept", "rewrite everything", "new carousel"
    ]):
        return "FULL_REWRITE", {}

    del_match = re.search(r"\b(?:delete|remove|drop|cut)\s+(?:the\s+)?(?:slides?|cards?)\s*(\d+)\b", lower)
    if del_match:
        return "STRUCTURAL_EDIT", {"action": "delete", "target_number": int(del_match.group(1))}

    if any(kw in lower for kw in ["call to action", "cta"]):
        return "TARGETED_EDIT", {"target_type": "cta"}

    is_add_slide_intent = (
        bool(re.search(r"\b(?:add|insert|include|put)\b.*\b(?:slides?|cards?|covers?)\b", lower))
        or bool(re.search(r"\b(?:add|insert|include|put)\s+(?:a\s+)?(?:new\s+)?(?:another\s+)?(?:\w+\s+)?(?:slide|card|cover)\b", lower))
        or (
            any(v in lower for v in ["add ", "insert ", "put "])
            and any(p in lower for p in ["between", "after slide", "before slide", "at the beginning", "at the start", "at the end", "as slide"])
        )
        or any(kw in lower for kw in ["new slide", "another slide", "new cover slide"])
    )

    if is_add_slide_intent:
        num_slides = len(active_payload.get("slides", []))
        insert_idx = parse_insert_position(query, num_slides)
        return "STRUCTURAL_EDIT", {"action": "add", "insert_index": insert_idx}

    slide_match = re.search(r"\bslide\s*(\d+)\b", lower)
    target_num = None
    if slide_match:
        target_num = int(slide_match.group(1))
    elif "cover slide" in lower or "first slide" in lower or "1st slide" in lower:
        target_num = 1
    elif "last slide" in lower or "final slide" in lower or "cta slide" in lower:
        target_num = len(active_payload.get("slides", [])) or 5

    if target_num is not None and not any(kw in lower for kw in ["all slides", "all the slides", "every slide"]):
        return "TARGETED_EDIT", {"target_type": "slide", "target_number": target_num}

    if (
        any(kw in lower for kw in ["caption", "post copy", "post description"])
        and not any(kw in lower for kw in ["slide", "slides", "deck"])
    ):
        return "TARGETED_EDIT", {"target_type": "caption"}

    return "REVISE_ALL_SLIDES", {}


async def classify_carousel_operation(query: str, active_payload: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    """
    Classify carousel editing operations using NVIDIA NIM with rules fallback.
    """
    slides = active_payload.get("slides", [])
    num_slides = len(slides)

    nim_res = await classify_carousel_intent_nim(query, num_slides)
    if nim_res and "operation" in nim_res:
        op = nim_res["operation"]
        if op == "STRUCTURAL_ADD":
            idx = nim_res.get("insert_index")
            if idx is None:
                idx = parse_insert_position(query, num_slides)
            idx = max(0, min(idx, num_slides))
            return "STRUCTURAL_EDIT", {"action": "add", "insert_index": idx}
        elif op == "STRUCTURAL_DELETE":
            target_num = nim_res.get("target_slide_number") or 1
            return "STRUCTURAL_EDIT", {"action": "delete", "target_number": target_num}
        elif op == "TARGETED_SLIDE_EDIT":
            target_num = nim_res.get("target_slide_number") or 1
            return "TARGETED_EDIT", {"target_type": "slide", "target_number": target_num}
        elif op == "TARGETED_FIELD_EDIT":
            field = nim_res.get("target_field") or "caption"
            return "TARGETED_EDIT", {"target_type": field}
        elif op == "REVISE_ALL_SLIDES":
            return "REVISE_ALL_SLIDES", {}
        elif op == "FULL_REWRITE":
            return "FULL_REWRITE", {}

    return classify_carousel_operation_rules(query, active_payload)


# =====================================================================
# Specialist Adapter
# =====================================================================

class ContentArchitectAdapter(SpecialistAdapter):
    """
    Adapter bridging ContentArchitectAgent into Campaign Studio.
    Generates structured, polymorphic deliverable artifacts:
    - StoryboardArtifactPayload (Reels/Shorts with timing, camera cues, VO, Flux prompts)
    - CarouselDeckArtifactPayload (Multi-slide decks with cover, value, CTA)
    - HookComparisonPayload (Qualitative 3-hook comparative analysis)

    Enforces Surgical Revisions:
    1. TARGETED_EDIT: Preserves all untouched elements in backend code.
    2. STRUCTURAL_EDIT: Cleanly adds/deletes scenes or slides with automatic timing re-indexing.
    3. FULL_REWRITE: Regenerates complete artifact only when requested.
    """

    def __init__(self):
        super().__init__(
            specialist_id="content_architect",
            specialist_name="Scriptwriter & Architect",
        )

    async def execute(
        self,
        query: str,
        context: CampaignStudioContext,
        db: AsyncSession,
        on_event: Any = None,
        **kwargs: Any,
    ) -> SpecialistResult:
        activity_logs: list[str] = []
        lower_q = query.lower()

        brand_voice = (
            ", ".join(context.brand_context.brand_voice)
            if context.brand_context and context.brand_context.brand_voice
            else "Engaging & Authentic"
        )
        client_name = context.client_name
        industry = context.client_industry or "General Business"

        # -------------------------------------------------------------
        # Branch 1: Active Storyboard Revision (Surgical In-Place Edits)
        # -------------------------------------------------------------
        if (
            context.active_artifact_payload
            and context.active_artifact_type == ArtifactType.storyboard.value
            and not any(kw in lower_q for kw in ["carousel", "slide deck"])
        ):
            op_type, op_info = await classify_storyboard_operation(query, context.active_artifact_payload)

            if op_type == "TARGETED_EDIT":
                return await self._handle_storyboard_targeted_edit(
                    query=query,
                    target_info=op_info,
                    context=context,
                    client_name=client_name,
                    industry=industry,
                    brand_voice=brand_voice,
                    activity_logs=activity_logs,
                )
            elif op_type == "STRUCTURAL_EDIT":
                return await self._handle_storyboard_structural_edit(
                    query=query,
                    struct_info=op_info,
                    context=context,
                    client_name=client_name,
                    industry=industry,
                    brand_voice=brand_voice,
                    activity_logs=activity_logs,
                )
            elif op_type == "REVISE_ALL_SCENES":
                return await self._handle_storyboard_revise_all_scenes(
                    query=query,
                    context=context,
                    client_name=client_name,
                    industry=industry,
                    brand_voice=brand_voice,
                    activity_logs=activity_logs,
                )

        # -------------------------------------------------------------
        # Branch 2: Active Carousel Revision (Surgical In-Place Edits)
        # -------------------------------------------------------------
        if (
            context.active_artifact_payload
            and context.active_artifact_type == ArtifactType.carousel_deck.value
            and not any(kw in lower_q for kw in ["reel", "video", "storyboard"])
        ):
            op_type, op_info = await classify_carousel_operation(query, context.active_artifact_payload)

            if op_type == "TARGETED_EDIT":
                return await self._handle_carousel_targeted_edit(
                    query=query,
                    target_info=op_info,
                    context=context,
                    client_name=client_name,
                    industry=industry,
                    brand_voice=brand_voice,
                    activity_logs=activity_logs,
                )
            elif op_type == "STRUCTURAL_EDIT":
                return await self._handle_carousel_structural_edit(
                    query=query,
                    struct_info=op_info,
                    context=context,
                    client_name=client_name,
                    industry=industry,
                    brand_voice=brand_voice,
                    activity_logs=activity_logs,
                )
            elif op_type == "REVISE_ALL_SLIDES":
                return await self._handle_carousel_revise_all_slides(
                    query=query,
                    context=context,
                    client_name=client_name,
                    industry=industry,
                    brand_voice=brand_voice,
                    activity_logs=activity_logs,
                )

        # -------------------------------------------------------------
        # Branch 3: Hook Analysis & Comparison
        # -------------------------------------------------------------
        is_hook_request = any(
            kw in lower_q for kw in ["compare hooks", "hook options", "hook variations", "hook breakdown"]
        ) or (
            context.active_artifact_type != ArtifactType.storyboard.value
            and any(kw in lower_q for kw in ["hook", "headline", "opening line"])
            and not any(kw in lower_q for kw in ["reel", "video", "carousel", "script"])
        )
        if is_hook_request:
            activity_logs.append("Synthesizing comparative hook variations with clarity & fluff analysis...")
            prompt = f"""You are the Master Scriptwriter & Content Storyboard Architect for AgencyOS.
User Request: "{query}"

Client: {client_name} ({industry})
Brand Voice: {brand_voice}

YOUR TASK:
Compare 3 distinct, high-impact hook variations for this client.
Evaluate each hook for:
1. Framework (e.g. Negative Constraint, Curiosity Gap, Sensory/Visual Pattern Interrupt, Insider Secret)
2. Psychological trigger and clarity rating (High/Medium/Low)
3. Fluff detection (True if it uses filler phrases like 'Hey guys' or 'In today's video')
4. Qualitative Pros & Cons

Return strictly matching the HookAnalysisOutput schema.
"""
            try:
                hook_res: HookAnalysisOutput = await invoke_structured_llm(
                    prompt=prompt,
                    schema_class=HookAnalysisOutput,
                    temperature=0.3,
                    model=getattr(settings, "CAMPAIGN_CONTENT_MODEL", settings.FALLBACK_MODEL),
                )
                payload = HookComparisonPayload(
                    topic=hook_res.topic,
                    target_audience=hook_res.target_audience,
                    hooks=hook_res.hooks,
                )
                activity_logs.append(f"Generated {len(hook_res.hooks)} alternative hooks (Recommended: #{hook_res.recommended_hook_id}).")
                return SpecialistResult(
                    specialist_id=self.specialist_id,
                    specialist_name=self.specialist_name,
                    reply=f"{hook_res.conversational_intro}\n\n**Recommended Hook**: #{hook_res.recommended_hook_id}",
                    artifact_type=ArtifactType.hook_comparison,
                    artifact_payload=payload.model_dump(),
                    activity_logs=activity_logs,
                    suggested_followups=hook_res.suggested_followups or [
                        "Turn recommended hook into a full Reel storyboard",
                        "Audit hooks for brand compliance",
                        "Test hook on TikTok vs Instagram",
                    ],
                )
            except Exception as ex:
                logger.warning(f"Error in hook analysis: {ex}")

        # -------------------------------------------------------------
        # Branch 4: Carousel Deck Generation (New Artifact)
        # -------------------------------------------------------------
        if any(kw in lower_q for kw in ["carousel", "slide deck", "slides"]):
            activity_logs.append("Drafting multi-slide carousel deck with visual layout instructions...")
            prompt = f"""You are the Master Scriptwriter for AgencyOS.
User Request: "{query}"

Client: {client_name} ({industry})
Brand Voice: {brand_voice}

Generate a high-density 5 to 7 slide educational/authority carousel.
Slide 1 MUST be a high-contrast cover.
Final slide MUST be a save/share CTA.
Return strictly matching CarouselGenerationOutput schema.
"""
            try:
                car_res: CarouselGenerationOutput = await invoke_structured_llm(
                    prompt=prompt,
                    schema_class=CarouselGenerationOutput,
                    temperature=0.3,
                    model=getattr(settings, "CAMPAIGN_CONTENT_MODEL", settings.FALLBACK_MODEL),
                )
                payload = CarouselDeckArtifactPayload(
                    deliverable_title=car_res.deliverable_title,
                    platform=SocialPlatform.linkedin,
                    format_type="carousel",
                    slides=car_res.slides,
                    full_caption=car_res.caption,
                    hashtags=car_res.hashtags,
                    call_to_action=car_res.call_to_action,
                )
                activity_logs.append(f"Architected {len(car_res.slides)}-slide carousel deck.")
                return SpecialistResult(
                    specialist_id=self.specialist_id,
                    specialist_name=self.specialist_name,
                    reply=car_res.conversational_intro,
                    artifact_type=ArtifactType.carousel_deck,
                    artifact_payload=payload.model_dump(),
                    activity_logs=activity_logs,
                    suggested_followups=car_res.suggested_followups or [
                        "Review carousel copy against brand rules",
                        "Export to production pipeline",
                    ],
                )
            except Exception as ex:
                logger.warning(f"Error in carousel generation: {ex}")

        # -------------------------------------------------------------
        # Branch 5: Reel / Video Storyboard Generation (New Artifact / Full Rewrite)
        # -------------------------------------------------------------
        activity_logs.append("Architecting timestamped Reel storyboard (scenes, camera cues, voiceover, Flux prompts)...")

        target_dur = parse_target_duration(query, default_duration=20)
        min_scenes = max(3, target_dur // 7)
        max_scenes = max(min_scenes + 2, target_dur // 4)
        dur_mins = target_dur // 60
        dur_secs = target_dur % 60
        end_ts = f"{dur_mins}:{dur_secs:02d}"

        pinned_clause = ""
        if context.pinned_entities:
            pinned_clause = f"""
CRITICAL HERO ENTITY GROUNDING:
The client/user has PINNED the following hero entities/offerings:
{', '.join(context.pinned_entities)}
You MUST prominently feature these exact pinned hero entities in the scenes, visual action, voiceovers, and on-screen text! Do not replace them with generic or fabricated items.
"""

        prompt = f"""You are the Master Scriptwriter & Content Storyboard Architect for AgencyOS.
User Request: "{query}"

Client: {client_name} ({industry}, Location: {context.client_location or 'General'})
Brand Voice: {brand_voice}
{pinned_clause}
YOUR TASK:
Generate a full production-ready video storyboard matching StoryboardGenerationOutput schema.
CRITICAL REQUIREMENTS:
1. Target duration: EXACTLY {target_dur} seconds.
2. Number of scenes: You MUST generate AT LEAST {min_scenes} distinct scenes (up to {max_scenes} scenes).
   - In short-form video production, every scene is a distinct 3-to-6 second camera cut. DO NOT output a single long scene!
   - Scene 1: 0:00 - 0:03 (Arresting Hook)
   - Scene 2 through Scene {min_scenes}: Sequential camera movements, talent actions, and dialogues.
   - Final scene ending at exactly {end_ts}.
3. Every scene MUST have:
   - start_ms and end_ms (strictly sequential and valid!)
   - timestamp_range (e.g. '0:00 - 0:03', '0:03 - 0:08', etc. ending at {end_ts})
   - shot_type (e.g. 'Macro Close-Up', 'POV Whip Pan', 'Talking Head', 'Overhead Pan')
   - visual_action (director guidance for camera & talent)
   - voiceover_script (spoken line or dialogue in appropriate language)
   - on_screen_text (overlay text)
   - audio_sfx_cue (ASMR sizzle, trending beat, sound effect)
   - ai_visual_prompt (photorealistic Flux / Midjourney generation prompt)
4. Full publishable caption (MUST NOT be empty; write rich post copy with emojis), 5-10 relevant hashtags, and clear CTA.
"""
        try:
            sb_res: StoryboardGenerationOutput = await invoke_structured_llm(
                prompt=prompt,
                schema_class=StoryboardGenerationOutput,
                temperature=0.3,
            )
            norm_scenes, total_dur = normalize_storyboard_scenes_timing(
                sb_res.scenes, target_duration_seconds=target_dur
            )

            # Ground scenes with hero focus entities
            if context.pinned_entities:
                for sc in norm_scenes:
                    text_blob = f"{sc.visual_action} {sc.voiceover_script} {sc.on_screen_text} {sc.ai_visual_prompt or ''}".lower()
                    matched = [e for e in context.pinned_entities if e.lower() in text_blob]
                    if matched:
                        sc.hero_focus = matched

            final_caption = (sb_res.caption or "").strip()
            if not final_caption:
                final_caption = f"✨ Discover how {client_name} delivers unmatched value and excellence! Built to exceed expectations every single day. Explore more via link in bio! 🚀"
            final_hashtags = sb_res.hashtags if sb_res.hashtags else [f"#{client_name.lower().replace(' ', '')}", f"#{industry.lower().replace(' ', '')}", "#innovation", "#growth"]
            final_cta = (sb_res.call_to_action or "").strip()
            if not final_cta:
                final_cta = "Connect with us via link in bio!"

            payload = StoryboardArtifactPayload(
                deliverable_title=sb_res.deliverable_title or f"{client_name}: Signature Showcase Reel",
                platform=SocialPlatform.instagram,
                format_type="reel",
                target_duration_seconds=total_dur,
                strategic_pillar=sb_res.strategic_pillar or "Craftsmanship",
                scenes=norm_scenes,
                full_caption=final_caption,
                hashtags=final_hashtags,
                call_to_action=final_cta,
                hero_entities=context.pinned_entities or [],
            )
            activity_logs.append(f"Successfully generated {len(norm_scenes)}-scene storyboard: '{sb_res.deliverable_title}'.")
            return SpecialistResult(
                specialist_id=self.specialist_id,
                specialist_name=self.specialist_name,
                reply=sb_res.conversational_intro,
                artifact_type=ArtifactType.storyboard,
                artifact_payload=payload.model_dump(),
                activity_logs=activity_logs,
                suggested_followups=sb_res.suggested_followups or [
                    "Audit storyboard for brand compliance",
                    "Add alternative hook options",
                    "Export to production pipeline",
                ],
            )
        except Exception as ex:
            logger.error(f"Error generating storyboard: {ex}", exc_info=True)
            fallback_scenes = [
                SceneCard(
                    scene_number=1,
                    start_ms=0,
                    end_ms=3000,
                    timestamp_range="0:00 - 0:03",
                    shot_type="Extreme Close-Up • Whip Pan",
                    visual_action=f"Fast macro camera whip towards {client_name} signature presentation.",
                    voiceover_script=f"Stop scrolling if you care about real quality in {industry}.",
                    on_screen_text=f"The secret behind {client_name}",
                    audio_sfx_cue="Whoosh hit + crisp ambient sound",
                    ai_visual_prompt=f"Cinematic close-up {industry} presentation, dramatic commercial studio lighting, 8k",
                ),
                SceneCard(
                    scene_number=2,
                    start_ms=3000,
                    end_ms=8000,
                    timestamp_range="0:03 - 0:08",
                    shot_type="Medium POV",
                    visual_action="Talent demonstrates the craft process with high tactile detail.",
                    voiceover_script="Here is exactly how we deliver excellence every single day.",
                    on_screen_text="The Craft Process",
                    audio_sfx_cue="Upbeat rhythm track",
                ),
                SceneCard(
                    scene_number=3,
                    start_ms=8000,
                    end_ms=15000,
                    timestamp_range="0:08 - 0:15",
                    shot_type="Hero Wide Shot",
                    visual_action=f"Hero reveal of finished product at {client_name}.",
                    voiceover_script="Visit us today or check the link in bio to learn more.",
                    on_screen_text=f"Experience {client_name}",
                    ai_visual_prompt=f"Hero wide shot of {client_name} storefront in action, golden hour",
                ),
            ]
            norm_fallback, fallback_dur = normalize_storyboard_scenes_timing(
                fallback_scenes, target_duration_seconds=target_dur
            )
            fallback_payload = StoryboardArtifactPayload(
                deliverable_title=f"{client_name}: Signature Showcase Reel",
                platform=SocialPlatform.instagram,
                format_type="reel",
                target_duration_seconds=fallback_dur,
                strategic_pillar="Craftsmanship",
                scenes=norm_fallback,
                full_caption=f"Discover what sets {client_name} apart. Check our link in bio!",
                hashtags=["#quality", f"#{industry.lower().replace(' ', '')}"],
                call_to_action="Follow for more behind-the-scenes",
            )
            return SpecialistResult(
                specialist_id=self.specialist_id,
                specialist_name=self.specialist_name,
                reply=f"I've drafted a {len(norm_fallback)}-scene shoot concept for **{client_name}** with timestamped camera cues, B-roll framing, and Flux visual prompts.",
                artifact_type=ArtifactType.storyboard,
                artifact_payload=fallback_payload.model_dump(),
                activity_logs=activity_logs,
                suggested_followups=["Audit compliance", "Refine scenes"],
            )

    # =====================================================================
    # Surgical In-Place Revisions: Storyboards
    # =====================================================================

    async def _handle_storyboard_targeted_edit(
        self,
        query: str,
        target_info: dict[str, Any],
        context: CampaignStudioContext,
        client_name: str,
        industry: str,
        brand_voice: str,
        activity_logs: list[str],
    ) -> SpecialistResult:
        active = context.active_artifact_payload or {}
        raw_scenes = active.get("scenes", [])
        current_scenes = [SceneCard(**s) for s in raw_scenes]
        target_type = target_info.get("target_type", "scene")

        # Case A: Specific Scene Edit
        if target_type == "scene":
            target_num = target_info.get("target_number", 1)
            target_scene = next((s for s in current_scenes if s.scene_number == target_num), None)

            if not target_scene:
                # If target scene not found, clamp to closest available
                target_scene = current_scenes[-1] if current_scenes else None
                target_num = target_scene.scene_number if target_scene else 1

            if not target_scene:
                return await self._fallback_storyboard_result(client_name, industry, activity_logs)

            # Extract surrounding context
            prev_scene = next((s for s in current_scenes if s.scene_number == target_num - 1), None)
            next_scene = next((s for s in current_scenes if s.scene_number == target_num + 1), None)

            context_lines = []
            if prev_scene:
                context_lines.append(f"Previous Scene (Scene {prev_scene.scene_number}): {prev_scene.visual_action} | VO: \"{prev_scene.voiceover_script}\"")
            if next_scene:
                context_lines.append(f"Next Scene (Scene {next_scene.scene_number}): {next_scene.visual_action} | VO: \"{next_scene.voiceover_script}\"")
            surrounding_ctx = "\n".join(context_lines) or "Single scene context."

            prompt = f"""You are the Master Scriptwriter & Content Storyboard Architect for AgencyOS.
User Request for Scene {target_num}: "{query}"

Client: {client_name} ({industry})
Brand Voice: {brand_voice}
Storyboard Title: "{active.get('deliverable_title', 'Reel')}"

CURRENT SCENE {target_num} TO REVISE:
- Shot Type: {target_scene.shot_type}
- Visual Action: {target_scene.visual_action}
- Voiceover / Spoken: "{target_scene.voiceover_script}"
- On-Screen Text: "{target_scene.on_screen_text}"
- Audio Cue: "{target_scene.audio_sfx_cue or 'None'}"
- Visual Prompt: "{target_scene.ai_visual_prompt or 'None'}"

SURROUNDING SCENES (FOR FLOW & CONTINUITY):
{surrounding_ctx}

YOUR TASK:
Output ONLY the revised Scene {target_num} matching TargetedSceneRevisionOutput schema.
Directly apply the user's modifications to Scene {target_num}. Do not rewrite any other scenes.
"""
            try:
                rev: TargetedSceneRevisionOutput = await invoke_structured_llm(
                    prompt=prompt,
                    schema_class=TargetedSceneRevisionOutput,
                    temperature=0.3,
                    model=getattr(settings, "CAMPAIGN_CONTENT_MODEL", settings.FALLBACK_MODEL),
                )

                # CODE-LEVEL ENFORCEMENT: Preserve untouched scenes 100% identically!
                updated_scenes: list[SceneCard] = []
                for s in current_scenes:
                    if s.scene_number == target_num:
                        updated_s = s.model_copy(update={
                            "shot_type": rev.shot_type or s.shot_type,
                            "visual_action": rev.visual_action or s.visual_action,
                            "voiceover_script": rev.voiceover_script or s.voiceover_script,
                            "on_screen_text": rev.on_screen_text if rev.on_screen_text is not None else s.on_screen_text,
                            "audio_sfx_cue": rev.audio_sfx_cue or s.audio_sfx_cue,
                            "ai_visual_prompt": rev.ai_visual_prompt or s.ai_visual_prompt,
                        })
                        updated_scenes.append(updated_s)
                    else:
                        # Strictly untouched!
                        updated_scenes.append(s)

                norm_scenes, total_dur = normalize_storyboard_scenes_timing(updated_scenes)
                new_payload = dict(active)
                new_payload["scenes"] = [s.model_dump() for s in norm_scenes]
                new_payload["target_duration_seconds"] = total_dur

                activity_logs.append(
                    f"Surgically updated Scene {target_num} while preserving all other {len(norm_scenes) - 1} scenes untouched."
                )

                return SpecialistResult(
                    specialist_id=self.specialist_id,
                    specialist_name=self.specialist_name,
                    reply=f"{rev.conversational_intro}\n\n*Updated Scene {target_num} in the storyboard while keeping all other scenes intact.*",
                    artifact_type=ArtifactType.storyboard,
                    artifact_payload=new_payload,
                    activity_logs=activity_logs,
                    suggested_followups=rev.suggested_followups or [
                        "Revise closing call to action",
                        "Audit compliance",
                        "Export to production",
                    ],
                )
            except Exception as ex:
                logger.error(f"Error in targeted scene edit: {ex}", exc_info=True)
                return await self._fallback_storyboard_result(client_name, industry, activity_logs)

        # Case B: Call to Action Edit
        elif target_type == "cta":
            prompt = f"""You are the Master Scriptwriter for AgencyOS.
User Request: "{query}"

Client: {client_name} ({industry})
Brand Voice: {brand_voice}
Current Call to Action: "{active.get('call_to_action', '')}"
Storyboard Title: "{active.get('deliverable_title', '')}"

Output the revised call-to-action matching TargetedCopyRevisionOutput schema.
Keep it punchy, high-converting, and aligned with the user's request.
"""
            try:
                rev: TargetedCopyRevisionOutput = await invoke_structured_llm(
                    prompt=prompt,
                    schema_class=TargetedCopyRevisionOutput,
                    temperature=0.3,
                    model=getattr(settings, "CAMPAIGN_CONTENT_MODEL", settings.FALLBACK_MODEL),
                )
                new_payload = dict(active)
                new_payload["call_to_action"] = rev.revised_text

                activity_logs.append("Surgically updated Call to Action while preserving all storyboard scenes.")
                return SpecialistResult(
                    specialist_id=self.specialist_id,
                    specialist_name=self.specialist_name,
                    reply=f"{rev.conversational_intro}\n\n**Updated CTA**: *\"{rev.revised_text}\"*",
                    artifact_type=ArtifactType.storyboard,
                    artifact_payload=new_payload,
                    activity_logs=activity_logs,
                    suggested_followups=rev.suggested_followups or [
                        "Audit compliance",
                        "Export to production pipeline",
                    ],
                )
            except Exception as ex:
                logger.error(f"Error in targeted CTA edit: {ex}", exc_info=True)
                return await self._fallback_storyboard_result(client_name, industry, activity_logs)

        # Case C: Caption or Title Edit
        else:
            field_name = "full_caption" if target_type == "caption" else "deliverable_title"
            curr_val = active.get(field_name, "")
            prompt = f"""You are the Master Scriptwriter for AgencyOS.
User Request: "{query}"

Client: {client_name} ({industry})
Brand Voice: {brand_voice}
Current {field_name}: "{curr_val}"

Output the revised {field_name} matching TargetedCopyRevisionOutput schema.
"""
            try:
                rev: TargetedCopyRevisionOutput = await invoke_structured_llm(
                    prompt=prompt,
                    schema_class=TargetedCopyRevisionOutput,
                    temperature=0.3,
                    model=getattr(settings, "CAMPAIGN_CONTENT_MODEL", settings.FALLBACK_MODEL),
                )
                new_payload = dict(active)
                new_payload[field_name] = rev.revised_text

                activity_logs.append(f"Surgically updated {field_name} while preserving all storyboard scenes.")
                return SpecialistResult(
                    specialist_id=self.specialist_id,
                    specialist_name=self.specialist_name,
                    reply=f"{rev.conversational_intro}\n\n**Updated {field_name}**: *\"{rev.revised_text}\"*",
                    artifact_type=ArtifactType.storyboard,
                    artifact_payload=new_payload,
                    activity_logs=activity_logs,
                    suggested_followups=rev.suggested_followups or [
                        "Export to production pipeline",
                    ],
                )
            except Exception as ex:
                logger.error(f"Error in targeted copy edit: {ex}", exc_info=True)
                return await self._fallback_storyboard_result(client_name, industry, activity_logs)

    async def _handle_storyboard_structural_edit(
        self,
        query: str,
        struct_info: dict[str, Any],
        context: CampaignStudioContext,
        client_name: str,
        industry: str,
        brand_voice: str,
        activity_logs: list[str],
    ) -> SpecialistResult:
        active = context.active_artifact_payload or {}
        raw_scenes = active.get("scenes", [])
        current_scenes = [SceneCard(**s) for s in raw_scenes]
        action = struct_info.get("action", "delete")

        # Case A: Delete Scene
        if action == "delete":
            target_num = struct_info.get("target_number", 1)
            remaining_scenes = [s for s in current_scenes if s.scene_number != target_num]

            if not remaining_scenes:
                remaining_scenes = current_scenes  # Prevent empty storyboard

            norm_scenes, total_dur = normalize_storyboard_scenes_timing(remaining_scenes)
            new_payload = dict(active)
            new_payload["scenes"] = [s.model_dump() for s in norm_scenes]
            new_payload["target_duration_seconds"] = total_dur

            activity_logs.append(
                f"Deleted Scene {target_num}. Re-sequenced remaining {len(norm_scenes)} scenes with smooth timecodes."
            )

            return SpecialistResult(
                specialist_id=self.specialist_id,
                specialist_name=self.specialist_name,
                reply=f"I've removed Scene {target_num} and re-indexed the remaining {len(norm_scenes)} scenes. The new target runtime is {total_dur}s.",
                artifact_type=ArtifactType.storyboard,
                artifact_payload=new_payload,
                activity_logs=activity_logs,
                suggested_followups=["Export to production pipeline", "Review timing"],
            )

        # Case B: Add Scene
        else:
            insert_idx = struct_info.get("insert_index", len(current_scenes))
            insert_idx = max(0, min(insert_idx, len(current_scenes)))

            context_flow = []
            if insert_idx > 0 and insert_idx - 1 < len(current_scenes):
                prev_s = current_scenes[insert_idx - 1]
                context_flow.append(
                    f"Preceding Scene (Scene {prev_s.scene_number}): {prev_s.visual_action} | Spoken: \"{prev_s.voiceover_script}\""
                )
            if insert_idx < len(current_scenes):
                next_s = current_scenes[insert_idx]
                context_flow.append(
                    f"Succeeding Scene (Scene {next_s.scene_number}): {next_s.visual_action} | Spoken: \"{next_s.voiceover_script}\""
                )
            flow_info = "\n".join(context_flow) if context_flow else "New scene in storyboard."

            prompt = f"""You are the Master Scriptwriter & Content Storyboard Architect for AgencyOS.
User Request: "{query}"

Client: {client_name} ({industry})
Brand Voice: {brand_voice}
Target Insertion Position: Index {insert_idx + 1} of {len(current_scenes) + 1}

SURROUNDING SCENE FLOW:
{flow_info}

Output ONLY the new Scene to insert matching TargetedSceneRevisionOutput schema.
Ensure the visual action and voiceover connect smoothly with preceding and succeeding scenes.
"""
            try:
                rev: TargetedSceneRevisionOutput = await invoke_structured_llm(
                    prompt=prompt,
                    schema_class=TargetedSceneRevisionOutput,
                    temperature=0.3,
                    model=getattr(settings, "CAMPAIGN_CONTENT_MODEL", settings.FALLBACK_MODEL),
                )

                new_card = SceneCard(
                    scene_number=insert_idx + 1,
                    start_ms=0,
                    end_ms=4000,
                    shot_type=rev.shot_type,
                    visual_action=rev.visual_action,
                    voiceover_script=rev.voiceover_script,
                    on_screen_text=rev.on_screen_text,
                    audio_sfx_cue=rev.audio_sfx_cue,
                    ai_visual_prompt=rev.ai_visual_prompt,
                )
                updated_scenes = list(current_scenes)
                updated_scenes.insert(insert_idx, new_card)
                norm_scenes, total_dur = normalize_storyboard_scenes_timing(updated_scenes)

                new_payload = dict(active)
                new_payload["scenes"] = [s.model_dump() for s in norm_scenes]
                new_payload["target_duration_seconds"] = total_dur

                pos_desc = (
                    f"as Scene {insert_idx + 1}"
                    if insert_idx < len(current_scenes)
                    else "at the end"
                )
                activity_logs.append(
                    f"Inserted new Scene {insert_idx + 1} ({pos_desc}). Re-indexed all {len(norm_scenes)} scenes."
                )

                return SpecialistResult(
                    specialist_id=self.specialist_id,
                    specialist_name=self.specialist_name,
                    reply=f"{rev.conversational_intro}\n\n*Inserted new Scene {insert_idx + 1} ({pos_desc}). All {len(norm_scenes)} scenes have been sequentially re-indexed.*",
                    artifact_type=ArtifactType.storyboard,
                    artifact_payload=new_payload,
                    activity_logs=activity_logs,
                    suggested_followups=["Audit compliance", "Export to production"],
                )
            except Exception as ex:
                logger.error(f"Error adding scene: {ex}", exc_info=True)
                return await self._fallback_storyboard_result(client_name, industry, activity_logs)

    async def _handle_storyboard_revise_all_scenes(
        self,
        query: str,
        context: CampaignStudioContext,
        client_name: str,
        industry: str,
        brand_voice: str,
        activity_logs: list[str],
    ) -> SpecialistResult:
        active = context.active_artifact_payload or {}
        raw_scenes = active.get("scenes", [])
        current_scenes = [SceneCard(**s) for s in raw_scenes]

        if not current_scenes:
            return await self._fallback_storyboard_result(client_name, industry, activity_logs)

        formatted_scenes = []
        for s in current_scenes:
            formatted_scenes.append(
                f"Scene {s.scene_number} ({s.timestamp_range}) [{s.shot_type}]:\n"
                f"  Visual Action: {s.visual_action}\n"
                f"  Current Voiceover: \"{s.voiceover_script}\"\n"
                f"  Current On-Screen Text: \"{s.on_screen_text}\""
            )
        scenes_context = "\n".join(formatted_scenes)

        active_caption = active.get("full_caption", "")
        caption_context = f"\nACTIVE CAPTION / PROPOSED COPY:\n\"{active_caption}\"\n" if active_caption else ""

        prompt = f"""You are the Master Scriptwriter & Content Storyboard Architect for AgencyOS.
User Request: "{query}"

Client: {client_name} ({industry})
Brand Voice: {brand_voice}
Storyboard Title: "{active.get('deliverable_title', 'Reel')}"
{caption_context}
CURRENT STORYBOARD SCENES ({len(current_scenes)} scenes):
{scenes_context}

YOUR TASK:
Rewrite/update the voiceover script and on-screen text across ALL {len(current_scenes)} scenes according to the user's instructions.
- If the user requested a specific dialect, language (e.g. Marathi), tone, or asks to 'use that in the storyboard' / 'change script for all scenes', distribute the lines, dialogue, and hooks across Scene 1 to Scene {len(current_scenes)} naturally.
- Keep each line paced to fit the scene timing (concise, punchy spoken phrasing).
- If the visual action needs slight adjustment to match the new voiceover, update it; otherwise preserve the core visuals.
- Return strictly matching ReviseAllScenesOutput schema.
"""
        try:
            rev: ReviseAllScenesOutput = await invoke_structured_llm(
                prompt=prompt,
                schema_class=ReviseAllScenesOutput,
                temperature=0.3,
                model=getattr(settings, "CAMPAIGN_CONTENT_MODEL", settings.FALLBACK_MODEL),
            )

            update_by_num = {u.scene_number: u for u in rev.scenes}
            updated_scenes: list[SceneCard] = []
            for s in current_scenes:
                if s.scene_number in update_by_num:
                    u = update_by_num[s.scene_number]
                    updated_s = s.model_copy(update={
                        "voiceover_script": u.voiceover_script or s.voiceover_script,
                        "on_screen_text": u.on_screen_text if u.on_screen_text is not None else s.on_screen_text,
                        "visual_action": u.visual_action if u.visual_action else s.visual_action,
                    })
                    updated_scenes.append(updated_s)
                else:
                    updated_scenes.append(s)

            norm_scenes, total_dur = normalize_storyboard_scenes_timing(updated_scenes)

            new_payload = dict(active)
            new_payload["scenes"] = [s.model_dump() for s in norm_scenes]
            new_payload["target_duration_seconds"] = total_dur
            if rev.caption:
                new_payload["full_caption"] = rev.caption
            if rev.call_to_action:
                new_payload["call_to_action"] = rev.call_to_action

            activity_logs.append(
                f"Revised voiceovers and on-screen text across all {len(norm_scenes)} scenes."
            )

            return SpecialistResult(
                specialist_id=self.specialist_id,
                specialist_name=self.specialist_name,
                reply=f"{rev.conversational_intro}\n\n*Updated voiceovers and scripts across all {len(norm_scenes)} scenes in the storyboard.*",
                artifact_type=ArtifactType.storyboard,
                artifact_payload=new_payload,
                activity_logs=activity_logs,
                suggested_followups=rev.suggested_followups or [
                    "Audit compliance",
                    "Export to production pipeline",
                ],
            )
        except Exception as ex:
            logger.error(f"Error in revise all scenes: {ex}", exc_info=True)
            return await self._fallback_storyboard_result(client_name, industry, activity_logs)

    # =====================================================================
    # Surgical In-Place Revisions: Carousels
    # =====================================================================

    async def _handle_carousel_targeted_edit(
        self,
        query: str,
        target_info: dict[str, Any],
        context: CampaignStudioContext,
        client_name: str,
        industry: str,
        brand_voice: str,
        activity_logs: list[str],
    ) -> SpecialistResult:
        active = context.active_artifact_payload or {}
        raw_slides = active.get("slides", [])
        current_slides = [CarouselSlideCard(**s) for s in raw_slides]
        target_type = target_info.get("target_type", "slide")

        if target_type == "slide":
            target_num = target_info.get("target_number", 1)
            target_slide = next((s for s in current_slides if s.slide_number == target_num), None)
            if not target_slide:
                target_slide = current_slides[0] if current_slides else None
                target_num = 1

            if not target_slide:
                return await self._fallback_storyboard_result(client_name, industry, activity_logs)

            prompt = f"""You are the Master Scriptwriter for AgencyOS.
User Request for Slide {target_num}: "{query}"

Client: {client_name} ({industry})
Brand Voice: {brand_voice}
Current Slide {target_num}:
- Headline: "{target_slide.headline}"
- Body Copy: "{target_slide.body_copy}"
- Visual Layout: "{target_slide.visual_layout}"

Output ONLY the revised Slide {target_num} matching TargetedSlideRevisionOutput schema.
"""
            try:
                rev: TargetedSlideRevisionOutput = await invoke_structured_llm(
                    prompt=prompt,
                    schema_class=TargetedSlideRevisionOutput,
                    temperature=0.3,
                    model=getattr(settings, "CAMPAIGN_CONTENT_MODEL", settings.FALLBACK_MODEL),
                )

                # CODE-LEVEL ENFORCEMENT: Preserve untouched slides 100% identically!
                updated_slides: list[CarouselSlideCard] = []
                for s in current_slides:
                    if s.slide_number == target_num:
                        updated_s = s.model_copy(update={
                            "headline": rev.headline or s.headline,
                            "body_copy": rev.body_copy if rev.body_copy is not None else s.body_copy,
                            "visual_layout": rev.visual_layout or s.visual_layout,
                            "slide_type": rev.slide_type,
                        })
                        updated_slides.append(updated_s)
                    else:
                        updated_slides.append(s)

                new_payload = dict(active)
                new_payload["slides"] = [s.model_dump() for s in updated_slides]

                activity_logs.append(
                    f"Surgically updated Slide {target_num} while preserving all other {len(updated_slides) - 1} slides untouched."
                )

                return SpecialistResult(
                    specialist_id=self.specialist_id,
                    specialist_name=self.specialist_name,
                    reply=f"{rev.conversational_intro}\n\n*Updated Slide {target_num} while keeping all other slides intact.*",
                    artifact_type=ArtifactType.carousel_deck,
                    artifact_payload=new_payload,
                    activity_logs=activity_logs,
                    suggested_followups=rev.suggested_followups or [
                        "Export to production",
                        "Audit compliance",
                    ],
                )
            except Exception as ex:
                logger.error(f"Error in targeted slide edit: {ex}", exc_info=True)
                return await self._fallback_storyboard_result(client_name, industry, activity_logs)

        # Field-level edits (CTA / caption)
        else:
            field_name = "call_to_action" if target_type == "cta" else "full_caption"
            prompt = f"""You are the Master Scriptwriter for AgencyOS.
User Request: "{query}"

Client: {client_name} ({industry})
Brand Voice: {brand_voice}
Current {field_name}: "{active.get(field_name, '')}"

Output revised text matching TargetedCopyRevisionOutput schema.
"""
            try:
                rev: TargetedCopyRevisionOutput = await invoke_structured_llm(
                    prompt=prompt,
                    schema_class=TargetedCopyRevisionOutput,
                    temperature=0.3,
                    model=getattr(settings, "CAMPAIGN_CONTENT_MODEL", settings.FALLBACK_MODEL),
                )
                new_payload = dict(active)
                new_payload[field_name] = rev.revised_text

                activity_logs.append(f"Surgically updated {field_name} while preserving all carousel slides.")
                return SpecialistResult(
                    specialist_id=self.specialist_id,
                    specialist_name=self.specialist_name,
                    reply=f"{rev.conversational_intro}\n\n**Updated {field_name}**: *\"{rev.revised_text}\"*",
                    artifact_type=ArtifactType.carousel_deck,
                    artifact_payload=new_payload,
                    activity_logs=activity_logs,
                    suggested_followups=["Export to production"],
                )
            except Exception as ex:
                logger.error(f"Error in targeted copy edit: {ex}", exc_info=True)
                return await self._fallback_storyboard_result(client_name, industry, activity_logs)

    async def _handle_carousel_structural_edit(
        self,
        query: str,
        struct_info: dict[str, Any],
        context: CampaignStudioContext,
        client_name: str,
        industry: str,
        brand_voice: str,
        activity_logs: list[str],
    ) -> SpecialistResult:
        active = context.active_artifact_payload or {}
        raw_slides = active.get("slides", [])
        current_slides = [CarouselSlideCard(**s) for s in raw_slides]
        action = struct_info.get("action", "delete")

        if action == "delete":
            target_num = struct_info.get("target_number", 1)
            remaining_slides = [s for s in current_slides if s.slide_number != target_num]
            if not remaining_slides:
                remaining_slides = current_slides

            # Re-index slide numbers
            norm_slides = [
                s.model_copy(update={"slide_number": idx + 1})
                for idx, s in enumerate(remaining_slides)
            ]
            new_payload = dict(active)
            new_payload["slides"] = [s.model_dump() for s in norm_slides]

            activity_logs.append(f"Deleted Slide {target_num}. Re-indexed remaining {len(norm_slides)} slides.")
            return SpecialistResult(
                specialist_id=self.specialist_id,
                specialist_name=self.specialist_name,
                reply=f"I've removed Slide {target_num} and re-indexed the remaining {len(norm_slides)} slides in the deck.",
                artifact_type=ArtifactType.carousel_deck,
                artifact_payload=new_payload,
                activity_logs=activity_logs,
                suggested_followups=["Export to production"],
            )
        else:
            # Add slide (supporting positional insertion)
            insert_idx = struct_info.get("insert_index", len(current_slides))
            insert_idx = max(0, min(insert_idx, len(current_slides)))

            new_slide = CarouselSlideCard(
                slide_number=insert_idx + 1,
                headline="Key Takeaway",
                body_copy="Summary of core value proposition.",
                visual_layout="Icon grid with highlighted metric callout",
                slide_type="takeaway",
            )
            updated_slides = list(current_slides)
            updated_slides.insert(insert_idx, new_slide)
            norm_slides = [
                s.model_copy(update={"slide_number": idx + 1})
                for idx, s in enumerate(updated_slides)
            ]
            new_payload = dict(active)
            new_payload["slides"] = [s.model_dump() for s in norm_slides]

            pos_desc = (
                f"as Slide {insert_idx + 1}"
                if insert_idx < len(current_slides)
                else "at the end"
            )
            activity_logs.append(f"Inserted Slide {insert_idx + 1} ({pos_desc}). Re-indexed all {len(norm_slides)} slides.")
            return SpecialistResult(
                specialist_id=self.specialist_id,
                specialist_name=self.specialist_name,
                reply=f"Inserted Slide {insert_idx + 1} ({pos_desc}) into the carousel deck. All {len(norm_slides)} slides re-indexed.",
                artifact_type=ArtifactType.carousel_deck,
                artifact_payload=new_payload,
                activity_logs=activity_logs,
                suggested_followups=["Export to production"],
            )

    async def _handle_carousel_revise_all_slides(
        self,
        query: str,
        context: CampaignStudioContext,
        client_name: str,
        industry: str,
        brand_voice: str,
        activity_logs: list[str],
    ) -> SpecialistResult:
        active = context.active_artifact_payload or {}
        raw_slides = active.get("slides", [])
        current_slides = [CarouselSlideCard(**s) for s in raw_slides]

        if not current_slides:
            return await self._fallback_storyboard_result(client_name, industry, activity_logs)

        formatted_slides = []
        for s in current_slides:
            formatted_slides.append(
                f"Slide {s.slide_number} [{s.slide_type}]:\n"
                f"  Headline: {s.headline}\n"
                f"  Body Copy: {s.body_copy}\n"
                f"  Visual Layout: {s.visual_layout}"
            )
        slides_context = "\n".join(formatted_slides)

        prompt = f"""You are the Master Scriptwriter for AgencyOS.
User Request: "{query}"

Client: {client_name} ({industry})
Brand Voice: {brand_voice}
Carousel Title: "{active.get('deliverable_title', 'Deck')}"

CURRENT SLIDES ({len(current_slides)} slides):
{slides_context}

YOUR TASK:
Rewrite/update headlines and body copy across ALL {len(current_slides)} slides according to the user's instructions.
Return strictly matching ReviseAllSlidesOutput schema.
"""
        try:
            rev: ReviseAllSlidesOutput = await invoke_structured_llm(
                prompt=prompt,
                schema_class=ReviseAllSlidesOutput,
                temperature=0.3,
                model=getattr(settings, "CAMPAIGN_CONTENT_MODEL", settings.FALLBACK_MODEL),
            )

            update_by_num = {u.slide_number: u for u in rev.scenes if hasattr(u, "slide_number")} if hasattr(rev, "scenes") else {u.slide_number: u for u in rev.slides}
            updated_slides: list[CarouselSlideCard] = []
            for s in current_slides:
                if s.slide_number in update_by_num:
                    u = update_by_num[s.slide_number]
                    updated_s = s.model_copy(update={
                        "headline": u.headline or s.headline,
                        "body_copy": u.body_copy if u.body_copy is not None else s.body_copy,
                        "visual_layout": u.visual_layout if u.visual_layout else s.visual_layout,
                    })
                    updated_slides.append(updated_s)
                else:
                    updated_slides.append(s)

            new_payload = dict(active)
            new_payload["slides"] = [s.model_dump() for s in updated_slides]
            if rev.caption:
                new_payload["full_caption"] = rev.caption
            if rev.call_to_action:
                new_payload["call_to_action"] = rev.call_to_action

            activity_logs.append(
                f"Revised headlines and copy across all {len(updated_slides)} slides."
            )

            return SpecialistResult(
                specialist_id=self.specialist_id,
                specialist_name=self.specialist_name,
                reply=f"{rev.conversational_intro}\n\n*Updated copy across all {len(updated_slides)} slides in the carousel.*",
                artifact_type=ArtifactType.carousel_deck,
                artifact_payload=new_payload,
                activity_logs=activity_logs,
                suggested_followups=["Export to production"],
            )
        except Exception as ex:
            logger.error(f"Error in revise all slides: {ex}", exc_info=True)
            return await self._fallback_storyboard_result(client_name, industry, activity_logs)

    async def _fallback_storyboard_result(
        self, client_name: str, industry: str, activity_logs: list[str]
    ) -> SpecialistResult:
        fallback_scenes = [
            SceneCard(
                scene_number=1,
                start_ms=0,
                end_ms=3000,
                timestamp_range="0:00 - 0:03",
                shot_type="Extreme Close-Up • Whip Pan",
                visual_action=f"Fast macro camera whip towards {client_name} signature presentation.",
                voiceover_script=f"Stop scrolling if you care about real quality in {industry}.",
                on_screen_text=f"The secret behind {client_name}",
            ),
        ]
        fallback_payload = StoryboardArtifactPayload(
            deliverable_title=f"{client_name}: Signature Showcase Reel",
            scenes=fallback_scenes,
        )
        return SpecialistResult(
            specialist_id=self.specialist_id,
            specialist_name=self.specialist_name,
            reply=f"I've updated the storyboard for **{client_name}**.",
            artifact_type=ArtifactType.storyboard,
            artifact_payload=fallback_payload.model_dump(),
            activity_logs=activity_logs,
        )
