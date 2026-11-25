from __future__ import annotations

import asyncio
import base64
import logging
import re
import uuid
from typing import Literal

import httpx
from sqlalchemy import func, select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.websockets import AgencyWSEvent, ws_manager
from app.models.brand_profile import BrandProfile
from app.models.campaign import Campaign
from app.models.client import Client
from app.models.content_version import ContentVersion
from app.models.deliverable import Deliverable, DeliverableStatus
from app.services.credit_service import (
    IMAGE_GENERATION_CREDIT_COST,
    deduct_agency_credits,
)
from app.services.storage_service import save_remote_bytes
from app.services.tunnel_service import get_effective_media_url

logger = logging.getLogger(__name__)

FLUX_KLEIN_ENDPOINT = "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux-3-image-klein"
MAX_FLUX_PIXELS = 1_062_400

VisualPreset = Literal["square_1_1", "portrait_4_5", "reel_9_16"]

RESOLUTION_PRESETS: dict[VisualPreset, tuple[int, int, str]] = {
    "square_1_1": (1024, 1024, "1:1 Square Feed"),
    "portrait_4_5": (896, 1120, "4:5 Portrait Feed / Carousel"),
    "reel_9_16": (768, 1360, "9:16 Reel Cover"),
}


def resolve_preset_dimensions(preset: VisualPreset) -> tuple[int, int, str]:
    if preset not in RESOLUTION_PRESETS:
        raise ValueError(f"Unsupported visual preset: {preset}")
    width, height, label = RESOLUTION_PRESETS[preset]
    if width * height > MAX_FLUX_PIXELS or width % 16 != 0 or height % 16 != 0:
        raise ValueError(f"Invalid Flux Klein dimensions: {width}x{height}")
    return width, height, label


def compile_clean_visual_prompt(
    user_prompt: str | None,
    deliverable_title: str,
    deliverable_type: str,
    client_name: str,
    brand_tone: str | None = None,
    visual_notes: str | None = None,
) -> str:
    """
    Compile a clean photographic/editorial prompt grounded in the deliverable and client brand,
    stripping text-overlay instructions and forbidding rendered typography or hallucinated logos.
    """
    base_subject = (user_prompt or "").strip() or f"{deliverable_title} ({deliverable_type})"
    # Strip explicit text/quote requests so Flux does not hallucinate garbled lettering
    cleaned_subject = re.sub(
        r'\b(text|caption|headline|title|logo|watermark|typography|words?)\s*[:=]\s*["\'][^"\']*["\']',
        "",
        base_subject,
        flags=re.IGNORECASE,
    ).strip()
    if not cleaned_subject:
        cleaned_subject = deliverable_title

    parts = [
        f"Editorial commercial photography: {cleaned_subject}.",
    ]
    if visual_notes:
        parts.append(f"Visual direction: {visual_notes.strip()}.")
    elif brand_tone:
        parts.append(f"Mood and aesthetic: {brand_tone.strip()}.")

    parts.append(
        "Natural directional studio lighting, crisp textures, balanced framing, clean visual composition."
    )
    compiled = " ".join(parts)
    return compiled[:1950]


async def render_flux_klein_image(
    prompt: str,
    width: int,
    height: int,
    steps: int = 35,
    cfg_scale: float = 3.5,
) -> tuple[bytes, str, str]:
    """
    Call NVIDIA NIM Flux-3-Image-Klein asynchronously and return (image_bytes, content_type, file_ext).
    """
    if width * height > MAX_FLUX_PIXELS:
        raise ValueError(f"Requested resolution {width}x{height} exceeds Flux Klein pixel limit.")

    api_key = (settings.NVIDIA_API_KEY or "").strip()
    if not api_key:
        raise RuntimeError("NVIDIA_API_KEY is not configured in backend environment.")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    payload = {
        "prompt": prompt,
        "width": width,
        "height": height,
        "steps": max(1, min(50, steps)),
        "cfg_scale": cfg_scale,
        "samples": 1,
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(FLUX_KLEIN_ENDPOINT, headers=headers, json=payload)

    if resp.status_code != 200:
        raise RuntimeError(
            f"NVIDIA Flux Klein API returned HTTP {resp.status_code}: {resp.text[:400]}"
        )

    body = resp.json()
    artifacts = body.get("artifacts") if isinstance(body, dict) else None
    if not artifacts or not isinstance(artifacts, list) or not artifacts[0].get("base64"):
        finish_reason = artifacts[0].get("finishReason") if artifacts and isinstance(artifacts, list) else None
        raise RuntimeError(
            f"NVIDIA Flux Klein returned no image (finishReason={finish_reason or 'unknown'}). "
            "Try simplifying the prompt or removing any brand/restricted terms."
        )

    b64_str = artifacts[0]["base64"]
    if "," in b64_str and b64_str.startswith("data:image"):
        b64_str = b64_str.split(",", 1)[1]

    raw_bytes = base64.b64decode(b64_str)
    if raw_bytes.startswith(b"\x89PNG"):
        return raw_bytes, "image/png", ".png"
    return raw_bytes, "image/jpeg", ".jpg"


async def execute_visual_generation_job(
    job_id: str,
    agency_id: uuid.UUID,
    deliverable_id: uuid.UUID,
    user_id: uuid.UUID,
    preset: VisualPreset,
    raw_prompt: str | None,
    slide_index: int | None,
    steps: int,
    task_id: uuid.UUID | None,
) -> None:
    """
    Background worker coroutine:
      1. Compiles clean brand-aware prompt
      2. Calls Flux Klein asynchronously
      3. Persists asset directly to Backblaze B2 / S3 (no local disk write)
      4. Creates ContentVersion row in Postgres
      5. Deducts agency credits ONLY after storage + DB persistence succeed
      6. Broadcasts VISUAL_ASSETS_READY via ws_manager.broadcast_to_agency
    """
    width, height, preset_label = resolve_preset_dimensions(preset)

    try:
        async with AsyncSessionLocal() as db:
            row_res = await db.execute(
                select(Deliverable, Campaign, Client)
                .join(Campaign, Deliverable.campaign_id == Campaign.id)
                .join(Client, Campaign.client_id == Client.id)
                .where(
                    Deliverable.id == deliverable_id,
                    Client.agency_id == agency_id,
                )
            )
            row = row_res.first()
            if not row:
                raise RuntimeError("Deliverable not found for agency.")

            deliverable, _campaign, client = row

            bp_res = await db.execute(
                select(BrandProfile).where(BrandProfile.client_id == client.id)
            )
            brand_profile = bp_res.scalar_one_or_none()
            brand_tone = getattr(brand_profile, "tone_of_voice", None) if brand_profile else None
            visual_notes = getattr(brand_profile, "visual_guidelines", None) if brand_profile else None

            compiled_prompt = compile_clean_visual_prompt(
                user_prompt=raw_prompt,
                deliverable_title=deliverable.title,
                deliverable_type=str(deliverable.deliverable_type),
                client_name=client.business_name,
                brand_tone=brand_tone,
                visual_notes=visual_notes,
            )

            # 1. Call NVIDIA Flux-3-Image-Klein
            image_bytes, content_type, ext = await render_flux_klein_image(
                prompt=compiled_prompt,
                width=width,
                height=height,
                steps=steps,
            )

            # 2. Upload strictly to S3 / Backblaze B2 (zero local storage)
            slide_tag = f"_slide{slide_index}" if slide_index else ""
            file_name = f"flux_klein_{preset}{slide_tag}{ext}"
            storage_key, checksum, file_size = await save_remote_bytes(
                data=image_bytes,
                deliverable_id=deliverable_id,
                file_name=file_name,
                content_type=content_type,
            )

            # 3. Determine next version_number & attach ContentVersion
            count_res = await db.execute(
                select(func.count()).where(ContentVersion.deliverable_id == deliverable_id)
            )
            version_number = (count_res.scalar() or 0) + 1

            note_parts = [
                f"AI Render (Flux-3-Image-Klein · {width}x{height} {preset_label})",
            ]
            if slide_index:
                note_parts.append(f"Slide {slide_index}")
            note_parts.append(f"Prompt: {compiled_prompt[:240]}")

            content_version = ContentVersion(
                id=uuid.uuid4(),
                deliverable_id=deliverable_id,
                task_id=task_id,
                version_number=version_number,
                storage_key=storage_key,
                file_name=file_name,
                file_type=content_type,
                file_size_bytes=file_size,
                checksum_sha256=checksum,
                caption=None,
                notes=" · ".join(note_parts),
                uploaded_by_id=user_id,
            )
            db.add(content_version)

            if deliverable.status == DeliverableStatus.not_started:
                deliverable.status = DeliverableStatus.in_production

            # 4. Deduct credits ONLY after S3 upload and ContentVersion insert succeed
            credits_remaining = await deduct_agency_credits(
                agency_id=agency_id,
                amount=IMAGE_GENERATION_CREDIT_COST,
                db=db,
            )

            await db.commit()
            await db.refresh(content_version)

            media_url = get_effective_media_url(storage_key)

            # 5. Broadcast WebSocket completion event
            await ws_manager.broadcast_to_agency(
                agency_id=agency_id,
                event=AgencyWSEvent.VISUAL_ASSETS_READY,
                data={
                    "job_id": job_id,
                    "deliverable_id": str(deliverable_id),
                    "content_version_id": str(content_version.id),
                    "version_number": version_number,
                    "storage_key": storage_key,
                    "media_url": media_url,
                    "preset": preset,
                    "width": width,
                    "height": height,
                    "slide_index": slide_index,
                    "credits_deducted": IMAGE_GENERATION_CREDIT_COST,
                    "credits_remaining": credits_remaining,
                },
            )
            logger.info(
                f"Visual render job {job_id} completed for deliverable {deliverable_id} "
                f"(version {version_number}, {width}x{height}, credits_remaining={credits_remaining})."
            )

    except Exception as exc:
        logger.error(f"Visual render job {job_id} failed for deliverable {deliverable_id}: {exc}")
        try:
            await ws_manager.broadcast_to_agency(
                agency_id=agency_id,
                event=AgencyWSEvent.VISUAL_ASSET_FAILED,
                data={
                    "job_id": job_id,
                    "deliverable_id": str(deliverable_id),
                    "error": str(exc)[:300],
                    "credits_deducted": 0,
                },
            )
        except Exception:
            pass
