from __future__ import annotations

import hashlib
import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.campaign import Campaign
from app.models.client import Client
from app.models.comment import DeliverableComment
from app.models.content_version import ContentVersion
from app.models.deliverable import Deliverable, DeliverableStatus
from app.models.studio_artifact import (
    CampaignStudioSession,
    StudioArtifact,
    StudioArtifactStatus,
    StudioArtifactVersion,
    StudioExport,
)
from app.models.task import Task, TaskPriority, TaskStatus

logger = logging.getLogger(__name__)


def compute_request_fingerprint(payload: dict[str, Any]) -> str:
    """Compute deterministic SHA-256 fingerprint from canonical JSON serialization."""
    canonical_json = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()


async def get_or_create_studio_session(
    campaign_id: uuid.UUID,
    client_id: uuid.UUID,
    agency_id: uuid.UUID,
    user_id: uuid.UUID | None,
    db: AsyncSession,
) -> CampaignStudioSession:
    """
    Retrieve or create a studio session with strict multi-tenant ownership validation.
    Guarantees that the campaign belongs to the client and the client belongs to the agency.
    """
    # 1. Tenancy validation
    query = (
        select(Campaign)
        .join(Client, Campaign.client_id == Client.id)
        .where(
            Campaign.id == campaign_id,
            Campaign.client_id == client_id,
            Client.agency_id == agency_id,
        )
    )
    result = await db.execute(query)
    campaign = result.scalars().first()
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found or does not belong to authorized agency/client tenancy.",
        )

    # 2. Find existing session or create a new one
    sess_query = (
        select(CampaignStudioSession)
        .where(
            CampaignStudioSession.campaign_id == campaign_id,
            CampaignStudioSession.agency_id == agency_id,
            CampaignStudioSession.client_id == client_id,
        )
        .order_by(desc(CampaignStudioSession.created_at))
    )
    sess_result = await db.execute(sess_query)
    session = sess_result.scalars().first()

    if not session:
        session = CampaignStudioSession(
            id=uuid.uuid4(),
            campaign_id=campaign_id,
            client_id=client_id,
            agency_id=agency_id,
            created_by_id=user_id,
            title=f"Studio Session: {campaign.name}",
        )
        db.add(session)
        await db.flush()

    return session


async def save_or_revise_artifact(
    session_id: uuid.UUID,
    agency_id: uuid.UUID,
    client_id: uuid.UUID,
    campaign_id: uuid.UUID,
    artifact_type: str,
    title: str,
    payload: dict[str, Any],
    actor_type: str,
    actor_id: str,
    db: AsyncSession,
    artifact_id: uuid.UUID | None = None,
    parent_version_id: uuid.UUID | None = None,
    change_summary: str | None = None,
    supporting_evidence_refs: list[dict[str, Any]] | None = None,
) -> tuple[StudioArtifact, StudioArtifactVersion]:
    """
    Save a new artifact or atomically append a new immutable revision.
    Uses SELECT ... FOR UPDATE on the parent artifact row to eliminate race conditions
    when concurrent workers or user revisions increment the version number.
    """
    if artifact_id:
        # 1. Update existing artifact with pessimistic row lock
        stmt = (
            select(StudioArtifact)
            .where(
                StudioArtifact.id == artifact_id,
                StudioArtifact.agency_id == agency_id,
                StudioArtifact.campaign_id == campaign_id,
            )
            .with_for_update()
        )
        result = await db.execute(stmt)
        artifact = result.scalars().first()
        if not artifact:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Studio artifact {artifact_id} not found in this campaign.",
            )

        new_version_number = artifact.current_version_number + 1
        artifact.current_version_number = new_version_number
        artifact.title = title or artifact.title
        # Critical security rule: Any new revision automatically resets status to draft
        artifact.status = StudioArtifactStatus.draft.value
        artifact.updated_at = datetime.now(timezone.utc)
    else:
        # 2. Create new artifact (version 1)
        artifact = StudioArtifact(
            id=uuid.uuid4(),
            session_id=session_id,
            agency_id=agency_id,
            client_id=client_id,
            campaign_id=campaign_id,
            artifact_type=artifact_type,
            title=title,
            status=StudioArtifactStatus.draft.value,
            current_version_number=1,
        )
        db.add(artifact)
        await db.flush()
        new_version_number = 1

    # 3. Create immutable artifact version record
    version = StudioArtifactVersion(
        id=uuid.uuid4(),
        artifact_id=artifact.id,
        version_number=new_version_number,
        parent_version_id=parent_version_id,
        actor_type=actor_type,
        actor_id=actor_id,
        schema_version="1.0",
        payload=payload,
        supporting_evidence_refs=supporting_evidence_refs,
        change_summary=change_summary,
        is_approved=False,
    )
    db.add(version)
    await db.flush()

    return artifact, version


async def approve_artifact_version(
    artifact_id: uuid.UUID,
    version_number: int,
    agency_id: uuid.UUID,
    campaign_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> StudioArtifactVersion:
    """
    Explicitly approve a specific artifact version.
    Enforces that approval is bound to the EXACT version number.
    Subsequent revisions will require fresh approval.
    """
    # 1. Tenancy check on parent artifact
    stmt = (
        select(StudioArtifact)
        .where(
            StudioArtifact.id == artifact_id,
            StudioArtifact.agency_id == agency_id,
            StudioArtifact.campaign_id == campaign_id,
        )
        .with_for_update()
    )
    art_result = await db.execute(stmt)
    artifact = art_result.scalars().first()
    if not artifact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artifact not found in this campaign.",
        )

    # 2. Find exact version
    v_stmt = select(StudioArtifactVersion).where(
        StudioArtifactVersion.artifact_id == artifact_id,
        StudioArtifactVersion.version_number == version_number,
    )
    v_result = await db.execute(v_stmt)
    version = v_result.scalars().first()
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Artifact version {version_number} does not exist.",
        )

    # 3. Record version approval
    version.is_approved = True
    version.approved_by_id = user_id
    version.approved_at = datetime.now(timezone.utc)

    # If this is the current active version, update artifact status
    if artifact.current_version_number == version_number:
        artifact.status = StudioArtifactStatus.approved.value
        artifact.updated_at = datetime.now(timezone.utc)

    await db.flush()
    return version


async def check_idempotency_or_existing_export(
    agency_id: uuid.UUID,
    idempotency_key: str,
    request_fingerprint: str,
    db: AsyncSession,
) -> StudioExport | None:
    """
    Check for an existing export under (agency_id, idempotency_key).
    - If found and fingerprints match: returns the existing export record (idempotent recovery).
    - If found but fingerprints differ: raises HTTP 400 Bad Request.
    - If not found: returns None (proceed with export).
    """
    stmt = select(StudioExport).where(
        StudioExport.agency_id == agency_id,
        StudioExport.idempotency_key == idempotency_key,
    )
    result = await db.execute(stmt)
    existing = result.scalars().first()

    if existing:
        if existing.request_fingerprint != request_fingerprint:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Idempotency key reused with differing request payload parameters.",
            )
        logger.info(
            f"Idempotent export hit for agency {agency_id}, key '{idempotency_key}'. Returning existing mapping."
        )
        return existing

    return None


def format_production_brief(payload: dict[str, Any], artifact_type: str) -> str:
    """
    Format a complete, structured creative production brief for assignees,
    including video shoot scripts, scene breakdowns, dialogues, cues, and post copy.
    """
    title = payload.get("deliverable_title") or "Creative Production Brief"
    raw_platform = payload.get("platform") or "Instagram"
    platform_str = raw_platform.value if hasattr(raw_platform, "value") else str(raw_platform).split(".")[-1]

    if "scenes" in payload and isinstance(payload["scenes"], list):
        scenes = payload["scenes"]
        target_dur = payload.get("target_duration_seconds", 20)
        pillar = payload.get("strategic_pillar", "Core Brand")

        lines = [
            f"Storyboard with {len(scenes)} scenes ready for shoot.",
            "",
            f"# Creative Shoot Brief: {title}",
            f"**Platform**: {platform_str.upper()} | **Duration**: {target_dur}s | **Strategic Pillar**: {pillar}",
            "",
            "## Scene-by-Scene Shoot Script:",
        ]

        for sc in scenes:
            num = sc.get("scene_number", 1)
            ts = sc.get("timestamp_range", "0:00 - 0:03")
            shot = sc.get("shot_type", "Standard Shot")
            action = sc.get("visual_action", "Action details")
            vo = sc.get("voiceover_script", "")
            ost = sc.get("on_screen_text", "")
            sfx = sc.get("audio_sfx_cue", "")
            prompt = sc.get("ai_visual_prompt", "")

            lines.append(f"### Scene {num} [{ts}] • {shot}")
            lines.append(f"- **Visual Action**: {action}")
            if vo:
                lines.append(f"- **Voiceover / Dialogue**: \"{vo}\"")
            if ost:
                lines.append(f"- **On-Screen Text**: {ost}")
            if sfx:
                lines.append(f"- **Audio / SFX Cue**: {sfx}")
            if prompt:
                lines.append(f"- **Visual Prompt**: {prompt}")
            lines.append("")

        caption = payload.get("full_caption")
        hashtags = payload.get("hashtags")
        cta = payload.get("call_to_action")

        if caption or cta or hashtags:
            lines.append("## Post Copy & Off-Ramp:")
            if caption:
                lines.append(f"**Caption**: {caption}")
            if hashtags:
                tag_str = (
                    " ".join([f"#{t.replace('#', '')}" for t in hashtags])
                    if isinstance(hashtags, list)
                    else str(hashtags)
                )
                lines.append(f"**Hashtags**: {tag_str}")
            if cta:
                lines.append(f"**Call to Action**: {cta}")

        return "\n".join(lines).strip()

    elif "slides" in payload and isinstance(payload["slides"], list):
        slides = payload["slides"]
        lines = [
            f"Carousel deck with {len(slides)} slides ready for design.",
            "",
            f"# Carousel Deck Creative Brief: {title}",
            f"**Platform**: {platform_str.upper()} | **Slide Count**: {len(slides)}",
            "",
            "## Slide-by-Slide Layout & Copy:",
        ]

        for sl in slides:
            s_num = sl.get("slide_number", 1)
            hl = sl.get("headline", "")
            body = sl.get("body_copy", "")
            layout = sl.get("visual_layout") or sl.get("visual_layout_note", "")

            lines.append(f"### Slide {s_num}: {hl}")
            if body:
                lines.append(f"- **Body Copy**: {body}")
            if layout:
                lines.append(f"- **Visual Layout**: {layout}")
            lines.append("")

        caption = payload.get("full_caption")
        cta = payload.get("call_to_action")
        if caption or cta:
            lines.append("## Post Copy:")
            if caption:
                lines.append(f"**Caption**: {caption}")
            if cta:
                lines.append(f"**Call to Action**: {cta}")

        return "\n".join(lines).strip()

    return f"Production asset ready for execution: {title}"


async def export_artifact_to_production(
    agency_id: uuid.UUID,
    campaign_id: uuid.UUID,
    artifact_id: uuid.UUID,
    expected_version_number: int,
    user_id: uuid.UUID,
    idempotency_key: str,
    raw_payload_dict: dict[str, Any],
    db: AsyncSession,
    assignee_id: uuid.UUID | None = None,
    default_due_date: Any = None,
    target_format: str | None = None,
    deliverable_name: str | None = None,
) -> tuple[StudioExport, bool]:
    """
    Export an approved studio draft artifact version into actual production tables (Deliverable, Task).
    Guarantees:
    1. Idempotency recovery: identical requests return cached export mapping with is_replay=True.
    2. Version locking: export is rejected if version is not approved or version mismatch.
    3. Multi-tenant validation: campaign, artifact, and export share identical agency_id.
    4. Atomicity: Deliverable, Task, StudioExport, and artifact status update commit together.
    """
    # 1. Check idempotency & canonical request fingerprint
    fingerprint = compute_request_fingerprint(raw_payload_dict)
    existing_export = await check_idempotency_or_existing_export(
        agency_id=agency_id,
        idempotency_key=idempotency_key,
        request_fingerprint=fingerprint,
        db=db,
    )
    if existing_export:
        return existing_export, True

    # 2. Lock parent artifact and validate tenant relationship
    art_stmt = (
        select(StudioArtifact)
        .where(
            StudioArtifact.id == artifact_id,
            StudioArtifact.agency_id == agency_id,
            StudioArtifact.campaign_id == campaign_id,
        )
        .with_for_update()
    )
    art_res = await db.execute(art_stmt)
    artifact = art_res.scalars().first()
    if not artifact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Studio artifact not found for this campaign.",
        )

    # 3. Retrieve the exact version number
    ver_stmt = select(StudioArtifactVersion).where(
        StudioArtifactVersion.artifact_id == artifact_id,
        StudioArtifactVersion.version_number == expected_version_number,
    )
    ver_res = await db.execute(ver_stmt)
    version = ver_res.scalars().first()
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Artifact version {expected_version_number} does not exist.",
        )

    # 4. Enforce approval requirement
    if not version.is_approved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Artifact version {expected_version_number} has not been approved. Approval is required before exporting to production.",
        )

    # 5. Determine deliverable attributes
    fmt = target_format or version.payload.get("format_type") or artifact.artifact_type
    platform = version.payload.get("platform") or "instagram"
    title = deliverable_name or version.payload.get("deliverable_title") or artifact.title

    # 6. Create production Deliverable
    deliverable = Deliverable(
        id=uuid.uuid4(),
        campaign_id=campaign_id,
        title=title,
        deliverable_type=fmt,
        platform=platform,
        status=DeliverableStatus.in_production,
        planned_date=default_due_date,
    )
    db.add(deliverable)
    await db.flush()

    # 7. Extract caption and hashtags for deliverable copy
    full_caption = version.payload.get("full_caption") or version.payload.get("caption") or ""
    hashtags = version.payload.get("hashtags") or []
    if hashtags and isinstance(hashtags, list):
        tag_str = " ".join([h if h.startswith("#") else f"#{h}" for h in hashtags])
        if tag_str not in full_caption:
            caption_text = f"{full_caption}\n\n{tag_str}".strip()
        else:
            caption_text = full_caption.strip()
    else:
        caption_text = full_caption.strip()

    # 8. Create production Task pipeline with enriched creative brief
    brief_markdown = format_production_brief(version.payload, artifact.artifact_type)
    task_notes = brief_markdown[:1980] if len(brief_markdown) > 1980 else brief_markdown

    # 9. Save creative brief to upload storage
    upload_dir = Path(settings.UPLOAD_DIR) / str(deliverable.id)
    upload_dir.mkdir(parents=True, exist_ok=True)
    brief_filename = f"{artifact.artifact_type}_shoot_brief_v{version.version_number}.txt"
    unique_file_name = f"{uuid.uuid4().hex}_{brief_filename}"
    file_path = upload_dir / unique_file_name
    brief_bytes = brief_markdown.encode("utf-8")
    file_path.write_bytes(brief_bytes)

    storage_key = f"{deliverable.id}/{unique_file_name}"
    checksum = hashlib.sha256(brief_bytes).hexdigest()
    file_size = len(brief_bytes)

    # 10. Generate stage-based tasks matching the tasks kanban board
    fmt_lower = (fmt or "").lower()
    art_type_lower = (artifact.artifact_type or "").lower()

    created_tasks: list[Task] = []

    if "carousel" in fmt_lower or "carousel" in art_type_lower:
        # Carousel Multi-Stage Pipeline
        t_script = Task(
            id=uuid.uuid4(),
            deliverable_id=deliverable.id,
            title=f"Copywriting & Slide Framework ({title[:30]})",
            task_type="scripting",
            status=TaskStatus.todo,
            priority=TaskPriority.high,
            assignee_id=assignee_id,
            due_date=default_due_date,
            notes=task_notes,
        )
        t_design = Task(
            id=uuid.uuid4(),
            deliverable_id=deliverable.id,
            title=f"Visual Design & Slide Layout ({title[:30]})",
            task_type="editing",
            status=TaskStatus.backlog,
            priority=TaskPriority.high,
            due_date=default_due_date,
            notes=task_notes,
        )
        t_review = Task(
            id=uuid.uuid4(),
            deliverable_id=deliverable.id,
            title=f"Graphic QA & Slide Review ({title[:30]})",
            task_type="approval",
            status=TaskStatus.backlog,
            priority=TaskPriority.medium,
            due_date=default_due_date,
            notes="Verify slide typography, brand palette, and copy against approved studio brief.",
        )
        created_tasks.extend([t_script, t_design, t_review])
        primary_task = t_script
        content_version_task = t_script
    elif "reel" in fmt_lower or "video" in fmt_lower or "storyboard" in art_type_lower:
        # Video Reel Multi-Stage Pipeline
        t_script = Task(
            id=uuid.uuid4(),
            deliverable_id=deliverable.id,
            title=f"Script & Shot Prep ({title[:30]})",
            task_type="scripting",
            status=TaskStatus.todo,
            priority=TaskPriority.high,
            assignee_id=assignee_id,
            due_date=default_due_date,
            notes=task_notes,
        )
        t_shoot = Task(
            id=uuid.uuid4(),
            deliverable_id=deliverable.id,
            title=f"Shoot / Raw Footage Capture ({title[:30]})",
            task_type="filming",
            status=TaskStatus.backlog,
            priority=TaskPriority.high,
            due_date=default_due_date,
            notes=task_notes,
        )
        t_edit = Task(
            id=uuid.uuid4(),
            deliverable_id=deliverable.id,
            title=f"Video Editing & Audio Mix ({title[:30]})",
            task_type="editing",
            status=TaskStatus.backlog,
            priority=TaskPriority.medium,
            due_date=default_due_date,
            notes="Cut raw footage to match scene durations and pacing; sync sound effects and voiceovers as specified in storyboard.",
        )
        t_review = Task(
            id=uuid.uuid4(),
            deliverable_id=deliverable.id,
            title=f"Internal & Client Review ({title[:30]})",
            task_type="approval",
            status=TaskStatus.backlog,
            priority=TaskPriority.low,
            due_date=default_due_date,
            notes="Review exported video render against the approved studio storyboard.",
        )
        created_tasks.extend([t_script, t_shoot, t_edit, t_review])
        primary_task = t_script
        content_version_task = t_script
    else:
        # Generic Pipeline
        t_script = Task(
            id=uuid.uuid4(),
            deliverable_id=deliverable.id,
            title=f"Script & Concept ({title[:30]})",
            task_type="scripting",
            status=TaskStatus.todo,
            priority=TaskPriority.high,
            assignee_id=assignee_id,
            due_date=default_due_date,
            notes=task_notes,
        )
        t_prod = Task(
            id=uuid.uuid4(),
            deliverable_id=deliverable.id,
            title=f"Produce: {title}",
            task_type="filming",
            status=TaskStatus.backlog,
            priority=TaskPriority.medium,
            due_date=default_due_date,
            notes=task_notes,
        )
        t_review = Task(
            id=uuid.uuid4(),
            deliverable_id=deliverable.id,
            title=f"Review & QA ({title[:30]})",
            task_type="approval",
            status=TaskStatus.backlog,
            priority=TaskPriority.low,
            due_date=default_due_date,
            notes="Review production asset before client delivery.",
        )
        created_tasks.extend([t_script, t_prod, t_review])
        primary_task = t_script
        content_version_task = t_script

    for t in created_tasks:
        db.add(t)
    await db.flush()

    # 11. Create initial ContentVersion (Version 1) containing the approved brief and caption
    content_version = ContentVersion(
        id=uuid.uuid4(),
        deliverable_id=deliverable.id,
        task_id=content_version_task.id,
        version_number=1,
        storage_key=storage_key,
        file_name=brief_filename,
        file_type="text/plain",
        file_size_bytes=file_size,
        checksum_sha256=checksum,
        caption=caption_text or None,
        notes=f"Approved in Campaign Studio ({artifact.artifact_type} v{version.version_number})",
        uploaded_by_id=user_id,
    )
    db.add(content_version)
    await db.flush()

    # 12. Attach complete creative production brief as internal DeliverableComment
    brief_comment = DeliverableComment(
        id=uuid.uuid4(),
        deliverable_id=deliverable.id,
        author_id=user_id,
        message=brief_markdown[:1980],
        is_internal=True,
    )
    db.add(brief_comment)
    await db.flush()

    # 13. Mark artifact status as exported
    artifact.status = StudioArtifactStatus.exported.value
    artifact.updated_at = datetime.now(timezone.utc)

    # 14. Record StudioExport audit record
    production_mapping = {
        "deliverable_id": str(deliverable.id),
        "deliverable_title": deliverable.title,
        "task_id": str(primary_task.id),
        "task_title": primary_task.title,
        "tasks": [
            {"id": str(t.id), "title": t.title, "task_type": t.task_type, "status": t.status.value}
            for t in created_tasks
        ],
        "content_version_id": str(content_version.id),
    }

    export_rec = StudioExport(
        id=uuid.uuid4(),
        artifact_version_id=version.id,
        agency_id=agency_id,
        client_id=artifact.client_id,
        campaign_id=campaign_id,
        exported_by_id=user_id,
        idempotency_key=idempotency_key,
        request_fingerprint=fingerprint,
        production_mapping=production_mapping,
        export_status="completed",
    )
    db.add(export_rec)
    await db.flush()

    return export_rec, False

