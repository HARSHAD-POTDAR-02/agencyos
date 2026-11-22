from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.dependencies import get_current_user, require_agency_member
from app.models.approval import Approval, ApprovalDecision
from app.models.campaign import Campaign
from app.models.client import Client
from app.models.client_social_account import ClientSocialAccount
from app.models.comment import DeliverableComment
from app.models.content_version import ContentVersion
from app.models.deliverable import Deliverable, DeliverableStatus
from app.models.publication_job import JobStatus, PublicationJob
from app.models.review_token import ReviewToken, generate_review_token
from app.models.task import Task, TaskStatus
from app.models.user import Membership, User
from app.schemas.review import (
    PublicContentVersionOut,
    PublicReviewRoomOut,
    ReviewCommentCreate,
    ReviewCommentOut,
    ReviewDecisionRequest,
    ReviewTokenOut,
)
from app.services.meta_publisher import ensure_instagram_compatible_image
from app.services.scheduler_coordinator import global_wakeup_signal
from app.services.tunnel_service import get_effective_media_url

logger = logging.getLogger(__name__)

router = APIRouter(tags=["magic-link-review"])


def _resolve_schedule_datetime(
    planned_date: date | None,
    existing_scheduled_at: datetime | None = None,
) -> datetime:
    now = datetime.now(timezone.utc)
    if existing_scheduled_at:
        sched = existing_scheduled_at
        if sched.tzinfo is None:
            sched = sched.replace(tzinfo=timezone.utc)
        if sched > now + timedelta(seconds=30):
            return sched

    if planned_date:
        target = datetime.combine(planned_date, datetime.min.time()).replace(
            hour=10, minute=0, second=0, microsecond=0, tzinfo=timezone.utc
        )
        if target <= now + timedelta(minutes=5):
            return now + timedelta(minutes=5)
        return target

    return now + timedelta(hours=2)


# ===========================================================================
# 1. Agency Authenticated Endpoints: Generate & Manage Review Tokens
# ===========================================================================

@router.post(
    "/agencies/{agency_id}/deliverables/{deliverable_id}/review-token",
    response_model=ReviewTokenOut,
)
async def generate_or_get_review_token(
    agency_id: uuid.UUID,
    deliverable_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    membership: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> ReviewTokenOut:
    """
    Generates a cryptographically secure zero-login magic review token for a deliverable,
    or returns the existing active token.
    """
    # Verify deliverable belongs to agency
    deliv_res = await db.execute(
        select(Deliverable, Campaign, Client)
        .join(Campaign, Deliverable.campaign_id == Campaign.id)
        .join(Client, Campaign.client_id == Client.id)
        .where(
            Deliverable.id == deliverable_id,
            Client.agency_id == agency_id,
        )
    )
    row = deliv_res.first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deliverable not found within this agency.",
        )

    # Check for existing active token
    tok_res = await db.execute(
        select(ReviewToken).where(
            ReviewToken.deliverable_id == deliverable_id,
            ReviewToken.is_active == True,
        ).order_by(ReviewToken.created_at.desc())
    )
    existing_token = tok_res.scalars().first()

    if existing_token:
        # Check expiration (if set)
        if existing_token.expires_at is None or existing_token.expires_at > datetime.now(timezone.utc):
            return ReviewTokenOut(
                token=existing_token.token,
                review_url=f"/review/{existing_token.token}",
                is_active=existing_token.is_active,
                views_count=existing_token.views_count,
                last_accessed_at=existing_token.last_accessed_at,
                created_at=existing_token.created_at,
                expires_at=existing_token.expires_at,
            )

    # Generate fresh active token
    new_token = ReviewToken(
        id=uuid.uuid4(),
        deliverable_id=deliverable_id,
        token=generate_review_token(),
        created_by_id=current_user.id,
        is_active=True,
        views_count=0,
    )
    db.add(new_token)
    await db.commit()
    await db.refresh(new_token)

    return ReviewTokenOut(
        token=new_token.token,
        review_url=f"/review/{new_token.token}",
        is_active=new_token.is_active,
        views_count=new_token.views_count,
        last_accessed_at=new_token.last_accessed_at,
        created_at=new_token.created_at,
        expires_at=new_token.expires_at,
    )


@router.delete(
    "/agencies/{agency_id}/deliverables/{deliverable_id}/review-token",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def revoke_review_token(
    agency_id: uuid.UUID,
    deliverable_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    membership: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
):
    """Revokes all active review tokens for a deliverable."""
    await db.execute(
        update(ReviewToken)
        .where(
            ReviewToken.deliverable_id == deliverable_id,
            ReviewToken.is_active == True,
        )
        .values(is_active=False)
    )
    await db.commit()


# ===========================================================================
# 2. Public Zero-Login Endpoints (/public/review/...)
# ===========================================================================

@router.get("/public/review/{token}", response_model=PublicReviewRoomOut)
async def get_public_review_room(
    token: str,
    db: AsyncSession = Depends(get_db),
) -> PublicReviewRoomOut:
    """
    Public zero-login deliverable review room for clients.
    Increments view count, validates active token status, and loads assets & comments.
    """
    tok_res = await db.execute(
        select(ReviewToken).where(
            ReviewToken.token == token,
            ReviewToken.is_active == True,
        )
    )
    review_token = tok_res.scalar_one_or_none()

    if not review_token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Magic review link is invalid, expired, or has been revoked by the agency.",
        )

    if review_token.expires_at and review_token.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This review link has expired. Please request a new link from your agency team.",
        )

    # Increment view counter
    review_token.views_count += 1
    review_token.last_accessed_at = datetime.now(timezone.utc)

    # Fetch deliverable with full relations
    deliv_res = await db.execute(
        select(Deliverable, Campaign, Client)
        .join(Campaign, Deliverable.campaign_id == Campaign.id)
        .join(Client, Campaign.client_id == Client.id)
        .options(
            selectinload(Deliverable.content_versions),
            selectinload(Deliverable.comments),
            selectinload(Deliverable.tasks),
        )
        .where(Deliverable.id == review_token.deliverable_id)
    )
    row = deliv_res.first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deliverable associated with this review link could not be found.",
        )

    deliverable, campaign, client = row

    # Commit view count update
    await db.commit()

    # Sort versions descending by version_number
    sorted_versions = sorted(
        deliverable.content_versions or [],
        key=lambda v: v.version_number,
        reverse=True,
    )
    content_versions_out: list[PublicContentVersionOut] = []
    for v in sorted_versions:
        url = get_effective_media_url(v.storage_key) if v.storage_key else None
        content_versions_out.append(
            PublicContentVersionOut(
                id=v.id,
                version_number=v.version_number,
                file_name=v.file_name,
                file_type=v.file_type,
                file_size_bytes=v.file_size_bytes,
                url=url,
                caption=v.caption,
                notes=v.notes,
                created_at=v.created_at,
            )
        )

    # Extract non-internal comments
    public_comments: list[ReviewCommentOut] = []
    for c in sorted(deliverable.comments or [], key=lambda c: c.created_at):
        if not c.is_internal:
            public_comments.append(
                ReviewCommentOut(
                    id=c.id,
                    author_name=c.author_name or "Client Reviewer",
                    author_role="client" if not c.author_id else "agency",
                    message=c.message,
                    timestamp_seconds=c.timestamp_seconds,
                    content_version_id=c.content_version_id,
                    created_at=c.created_at,
                )
            )

    # Extract script_blocks from scriptwriting tasks if available
    script_blocks = []
    for t in deliverable.tasks or []:
        if t.script_blocks and len(t.script_blocks) > 0:
            script_blocks = t.script_blocks
            break

    return PublicReviewRoomOut(
        token=review_token.token,
        deliverable_id=deliverable.id,
        title=deliverable.title,
        deliverable_type=deliverable.deliverable_type,
        platform=deliverable.platform,
        status=deliverable.status.value,
        planned_date=deliverable.planned_date,
        scheduled_at=deliverable.scheduled_at,
        live_post_url=deliverable.live_post_url,
        client_id=client.id,
        client_name=client.business_name,
        brand_voice=client.brand_profiles[0].brand_voice if client.brand_profiles else None,
        campaign_id=campaign.id,
        campaign_name=campaign.name,
        script_blocks=script_blocks,
        content_versions=content_versions_out,
        comments=public_comments,
        views_count=review_token.views_count,
        created_at=review_token.created_at,
        is_active=review_token.is_active,
    )


@router.post("/public/review/{token}/comments", response_model=ReviewCommentOut)
async def post_public_review_comment(
    token: str,
    payload: ReviewCommentCreate,
    db: AsyncSession = Depends(get_db),
) -> ReviewCommentOut:
    """
    Allows a client to submit feedback or timestamped comments without logging in.
    """
    tok_res = await db.execute(
        select(ReviewToken).where(
            ReviewToken.token == token,
            ReviewToken.is_active == True,
        )
    )
    review_token = tok_res.scalar_one_or_none()
    if not review_token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or expired review link.",
        )

    comment = DeliverableComment(
        id=uuid.uuid4(),
        deliverable_id=review_token.deliverable_id,
        content_version_id=payload.content_version_id,
        author_id=None,
        guest_author_name=payload.author_name.strip(),
        timestamp_seconds=payload.timestamp_seconds,
        message=payload.message.strip(),
        is_internal=False,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)

    return ReviewCommentOut(
        id=comment.id,
        author_name=comment.guest_author_name or "Client Reviewer",
        author_role="client",
        message=comment.message,
        timestamp_seconds=comment.timestamp_seconds,
        content_version_id=comment.content_version_id,
        created_at=comment.created_at,
    )


@router.post("/public/review/{token}/decision", response_model=PublicReviewRoomOut)
async def submit_public_review_decision(
    token: str,
    payload: ReviewDecisionRequest,
    db: AsyncSession = Depends(get_db),
) -> PublicReviewRoomOut:
    """
    Client approves or requests changes via zero-login magic link:
    - If approved: marks deliverable and tasks approved, records approval, auto-schedules to social queue if planned date exists.
    - If changes_requested: marks deliverable and tasks changes_requested, records feedback notes.
    """
    tok_res = await db.execute(
        select(ReviewToken).where(
            ReviewToken.token == token,
            ReviewToken.is_active == True,
        )
    )
    review_token = tok_res.scalar_one_or_none()
    if not review_token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or expired review link.",
        )

    deliv_res = await db.execute(
        select(Deliverable, Campaign, Client)
        .join(Campaign, Deliverable.campaign_id == Campaign.id)
        .join(Client, Campaign.client_id == Client.id)
        .options(
            selectinload(Deliverable.content_versions),
            selectinload(Deliverable.tasks),
            selectinload(Deliverable.comments),
        )
        .where(Deliverable.id == review_token.deliverable_id)
    )
    row = deliv_res.first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deliverable not found.",
        )

    deliverable, campaign, client = row

    # Get latest content version if present
    latest_version: ContentVersion | None = None
    if deliverable.content_versions:
        sorted_vers = sorted(deliverable.content_versions, key=lambda v: v.version_number, reverse=True)
        latest_version = sorted_vers[0]

    reviewer_name = payload.reviewer_name.strip()

    if payload.decision == "approved":
        # 1. Update Deliverable Status
        is_auto_scheduled = False
        if latest_version and latest_version.storage_key:
            # Check for connected social accounts
            accounts_res = await db.execute(
                select(ClientSocialAccount).where(
                    ClientSocialAccount.client_id == client.id,
                    ClientSocialAccount.is_active == True,
                )
            )
            social_accounts = list(accounts_res.scalars().all())

            deliv_platform = (deliverable.platform or "instagram").lower().strip()
            target_platforms: list[str] = []
            if deliv_platform in ("both", "all"):
                target_platforms = ["instagram", "facebook"]
            elif deliv_platform in ("facebook", "fb"):
                target_platforms = ["facebook"]
            elif deliv_platform in ("instagram", "ig"):
                target_platforms = ["instagram"]
            else:
                available = {a.platform for a in social_accounts}
                if "instagram" in available and "facebook" in available:
                    target_platforms = ["instagram", "facebook"]
                elif "instagram" in available:
                    target_platforms = ["instagram"]
                elif "facebook" in available:
                    target_platforms = ["facebook"]
                else:
                    target_platforms = ["instagram"]

            matched_accounts: dict[str, ClientSocialAccount] = {}
            for plat in target_platforms:
                acc = next((a for a in social_accounts if a.platform == plat), None)
                if acc:
                    matched_accounts[plat] = acc

            if matched_accounts:
                sched_at = _resolve_schedule_datetime(deliverable.planned_date, deliverable.scheduled_at)

                # Cancel older pending/scheduled jobs
                await db.execute(
                    update(PublicationJob)
                    .where(
                        PublicationJob.deliverable_id == deliverable.id,
                        PublicationJob.status.in_([
                            JobStatus.scheduled,
                            JobStatus.pending,
                            JobStatus.failed,
                            JobStatus.needs_reconnection,
                        ]),
                    )
                    .values(status=JobStatus.cancelled)
                )

                operation_id = uuid.uuid4()
                for plat, acc in matched_accounts.items():
                    media_url = get_effective_media_url(latest_version.storage_key)
                    job = PublicationJob(
                        deliverable_id=deliverable.id,
                        content_version_id=latest_version.id,
                        client_social_account_id=acc.id,
                        platform=plat,
                        publication_operation_id=operation_id,
                        status=JobStatus.scheduled,
                        scheduled_at=sched_at,
                        scheduled_timezone="UTC",
                        next_attempt_at=sched_at,
                        caption_snapshot=latest_version.caption or deliverable.title,
                        media_url_snapshot=media_url,
                        share_to_feed=True,
                        max_attempts=3,
                    )
                    db.add(job)

                deliverable.status = DeliverableStatus.scheduled
                deliverable.scheduled_at = sched_at
                is_auto_scheduled = True
                global_wakeup_signal.trigger()

        if not is_auto_scheduled:
            deliverable.status = DeliverableStatus.approved

        # 2. Update Tasks
        for t in deliverable.tasks or []:
            t.status = TaskStatus.approved

        # 3. Record Approval record
        if latest_version:
            approval = Approval(
                id=uuid.uuid4(),
                content_version_id=latest_version.id,
                reviewer_id=None,
                guest_reviewer_name=reviewer_name,
                decision=ApprovalDecision.approved,
                comment=payload.feedback_notes or "Approved via Magic Review Link",
            )
            db.add(approval)

        # 4. Add system log comment
        audit_comment = DeliverableComment(
            id=uuid.uuid4(),
            deliverable_id=deliverable.id,
            content_version_id=latest_version.id if latest_version else None,
            author_id=None,
            guest_author_name=reviewer_name,
            message=f"✓ Deliverable Approved by Client ({reviewer_name}) via Magic Review Link." + (f" Note: {payload.feedback_notes}" if payload.feedback_notes else ""),
            is_internal=False,
        )
        db.add(audit_comment)

    else:
        # Changes requested
        deliverable.status = DeliverableStatus.changes_requested
        for t in deliverable.tasks or []:
            t.status = TaskStatus.changes_requested

        if latest_version:
            approval = Approval(
                id=uuid.uuid4(),
                content_version_id=latest_version.id,
                reviewer_id=None,
                guest_reviewer_name=reviewer_name,
                decision=ApprovalDecision.changes_requested,
                comment=payload.feedback_notes or "Changes requested via Magic Review Link",
            )
            db.add(approval)

        audit_comment = DeliverableComment(
            id=uuid.uuid4(),
            deliverable_id=deliverable.id,
            content_version_id=latest_version.id if latest_version else None,
            author_id=None,
            guest_author_name=reviewer_name,
            message=f"↺ Revisions Requested by Client ({reviewer_name}): {payload.feedback_notes or 'Please revise and resubmit.'}",
            is_internal=False,
        )
        db.add(audit_comment)

    await db.commit()

    return await get_public_review_room(token, db)
