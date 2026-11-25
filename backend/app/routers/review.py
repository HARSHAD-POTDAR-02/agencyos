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
from app.models.agency import Agency
from app.models.approval import Approval, ApprovalDecision
from app.models.campaign import Campaign
from app.models.client import Client
from app.models.client_reviewer import ClientReviewer
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
    SendReviewEmailOut,
    SendReviewEmailRequest,
)
from app.services.email_service import send_magic_review_email
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
# 1. Agency Authenticated Endpoints: Generate & Email Magic Review Tokens
# ===========================================================================

async def _resolve_client_recipient(
    client: Client,
    db: AsyncSession,
    explicit_email: str | None = None,
) -> tuple[str | None, str]:
    """Resolve recipient email and name from override, Client.contact_email, or ClientReviewer."""
    recipient_name = client.contact_person or client.business_name
    if explicit_email and explicit_email.strip():
        return explicit_email.strip(), recipient_name
    if client.contact_email and client.contact_email.strip():
        return client.contact_email.strip(), recipient_name

    rev_res = await db.execute(
        select(User)
        .join(ClientReviewer, ClientReviewer.user_id == User.id)
        .where(ClientReviewer.client_id == client.id)
    )
    reviewer_user = rev_res.scalars().first()
    if reviewer_user and reviewer_user.email:
        return reviewer_user.email.strip(), (reviewer_user.full_name or recipient_name)
    return None, recipient_name


async def ensure_active_review_token(
    deliverable_id: uuid.UUID,
    created_by_id: uuid.UUID | None,
    db: AsyncSession,
) -> ReviewToken:
    """Return existing active non-expired ReviewToken or create a fresh one."""
    tok_res = await db.execute(
        select(ReviewToken)
        .where(
            ReviewToken.deliverable_id == deliverable_id,
            ReviewToken.is_active == True,
        )
        .order_by(ReviewToken.created_at.desc())
    )
    existing_token = tok_res.scalars().first()
    if existing_token and (existing_token.expires_at is None or existing_token.expires_at > datetime.now(timezone.utc)):
        return existing_token

    new_token = ReviewToken(
        id=uuid.uuid4(),
        deliverable_id=deliverable_id,
        token=generate_review_token(),
        created_by_id=created_by_id,
        is_active=True,
        views_count=0,
    )
    db.add(new_token)
    await db.flush()
    return new_token


async def send_deliverable_review_invite(
    *,
    deliverable: Deliverable,
    client: Client,
    agency_id: uuid.UUID,
    created_by_id: uuid.UUID | None,
    db: AsyncSession,
    recipient_email: str | None = None,
    custom_note: str | None = None,
) -> SendReviewEmailOut:
    """Ensure active ReviewToken exists and email the zero-login portal link to the client."""
    token_obj = await ensure_active_review_token(deliverable.id, created_by_id, db)
    resolved_email, recipient_name = await _resolve_client_recipient(client, db, explicit_email=recipient_email)
    review_url = f"/review/{token_obj.token}"
    full_review_url = f"{settings.FRONTEND_URL.rstrip('/')}{review_url}"

    if not resolved_email:
        return SendReviewEmailOut(
            token=token_obj.token,
            review_url=review_url,
            full_review_url=full_review_url,
            client_name=client.business_name,
            recipient_email=None,
            sent=False,
            configured=True,
            provider="none",
            error=f"No contact_email is set on client '{client.business_name}'. Add an email on the Client profile or enter one above.",
        )

    agency = await db.get(Agency, agency_id)
    agency_name = agency.name if agency else "AgencyOS"

    res = await send_magic_review_email(
        recipient_email=resolved_email,
        recipient_name=recipient_name,
        client_name=client.business_name,
        agency_name=agency_name,
        deliverable_title=deliverable.title,
        platform=deliverable.platform or "instagram",
        deliverable_type=deliverable.deliverable_type or "post",
        review_url=full_review_url,
        custom_note=custom_note,
    )
    return SendReviewEmailOut(
        token=token_obj.token,
        review_url=review_url,
        full_review_url=full_review_url,
        client_name=client.business_name,
        recipient_email=resolved_email,
        sent=res.sent,
        configured=res.configured,
        provider=res.provider,
        error=res.error,
    )


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

    _, _, client = row
    token_obj = await ensure_active_review_token(deliverable_id, current_user.id, db)
    await db.commit()
    await db.refresh(token_obj)
    suggested_email, suggested_name = await _resolve_client_recipient(client, db)

    return ReviewTokenOut(
        token=token_obj.token,
        review_url=f"/review/{token_obj.token}",
        is_active=token_obj.is_active,
        views_count=token_obj.views_count,
        last_accessed_at=token_obj.last_accessed_at,
        created_at=token_obj.created_at,
        expires_at=token_obj.expires_at,
        suggested_recipient_email=suggested_email,
        suggested_recipient_name=suggested_name,
    )


@router.post(
    "/agencies/{agency_id}/deliverables/{deliverable_id}/send-review-email",
    response_model=SendReviewEmailOut,
)
async def send_deliverable_review_email_endpoint(
    agency_id: uuid.UUID,
    deliverable_id: uuid.UUID,
    payload: SendReviewEmailRequest,
    current_user: User = Depends(get_current_user),
    membership: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> SendReviewEmailOut:
    """
    Generates/reuses the zero-login magic review link for a deliverable, optionally moves it
    into 'client_review' status, and emails the link directly to the client's email.
    """
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

    deliverable, _, client = row
    if payload.move_to_client_review and deliverable.status not in (
        DeliverableStatus.client_review,
        DeliverableStatus.approved,
        DeliverableStatus.scheduled,
        DeliverableStatus.published,
    ):
        deliverable.status = DeliverableStatus.client_review
        tasks_res = await db.execute(select(Task).where(Task.deliverable_id == deliverable.id))
        tasks = tasks_res.scalars().all()
        review_tasks = [t for t in tasks if t.task_type in ("approval", "review")]
        for t in (review_tasks or tasks):
            t.status = TaskStatus.client_review

    result = await send_deliverable_review_invite(
        deliverable=deliverable,
        client=client,
        agency_id=agency_id,
        created_by_id=current_user.id,
        db=db,
        recipient_email=payload.recipient_email,
        custom_note=payload.custom_note,
    )
    await db.commit()
    return result


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
                await global_wakeup_signal.notify(deliverable.id)

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

        # Cortex Brand Taste Capture from Client Feedback
        if payload.feedback_notes:
            try:
                from app.services.taste_capture_service import capture_cortex_taste_memory
                await capture_cortex_taste_memory(
                    client_id=client.id,
                    feedback_text=payload.feedback_notes,
                    source=f"client_review_room:{reviewer_name}",
                    db=db,
                )
            except Exception as taste_exc:
                logger.warning(f"Client taste capture failed gracefully: {taste_exc}")

    await db.commit()

    # Real-Time WebSocket broadcast to agency team strictly after DB commit
    try:
        from app.core.websockets import ws_manager, AgencyWSEvent
        await ws_manager.broadcast_to_agency(
            agency_id=client.agency_id,
            event=AgencyWSEvent.DELIVERABLE_REVIEW_DECISION,
            data={
                "deliverable_id": str(deliverable.id),
                "title": deliverable.title,
                "status": deliverable.status.value,
                "client_id": str(client.id),
                "client_name": client.business_name,
                "reviewer_name": reviewer_name,
                "feedback_notes": payload.feedback_notes or None,
            },
        )
        await ws_manager.broadcast_to_agency(
            agency_id=client.agency_id,
            event=AgencyWSEvent.NOTIFICATION_CREATED,
            data={
                "id": f"deliv-{deliverable.id}",
                "category": "approval",
                "title": f"{client.business_name}: {'Content Approved' if payload.decision == 'approved' else 'Changes Requested'}",
                "description": f'"{deliverable.title}" decision received from {reviewer_name}.',
                "url": f"/deliverables/{deliverable.id}",
                "is_urgent": payload.decision != "approved",
            },
        )
    except Exception as ws_err:
        logger.warning(f"WebSocket review decision broadcast failed gracefully: {ws_err}")

    return await get_public_review_room(token, db)
