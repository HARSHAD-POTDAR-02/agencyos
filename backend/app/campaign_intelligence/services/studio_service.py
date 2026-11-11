from __future__ import annotations

import hashlib
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.campaign import Campaign
from app.models.client import Client
from app.models.studio_artifact import (
    CampaignStudioSession,
    StudioArtifact,
    StudioArtifactStatus,
    StudioArtifactVersion,
    StudioExport,
)

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
