from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
import logging
from pathlib import Path
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.approval import Approval, ApprovalDecision
from app.models.campaign import Campaign
from app.models.client import Client
from app.models.client_reviewer import ClientReviewer
from app.models.client_social_account import ClientSocialAccount
from app.models.comment import DeliverableComment
from app.models.content_version import ContentVersion
from app.models.deliverable import Deliverable, DeliverableStatus
from app.models.publication_job import JobStatus, PublicationJob
from app.models.task import Task, TaskStatus
from app.models.user import Membership, RoleEnum, User
from app.schemas.comment import CommentCreate, CommentOut
from app.schemas.deliverable import ContentVersionOut
from app.schemas.portal import (
    PortalBatchDecisionOut,
    PortalBatchDecisionRequest,
    PortalDecisionRequest,
    PortalDeliverableOut,
)
from app.services.meta_publisher import ensure_instagram_compatible_image
from app.services.scheduler_coordinator import global_wakeup_signal
from app.services.tunnel_service import get_effective_media_url

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/portal", tags=["client-portal"])


def _resolve_schedule_datetime(
    planned_date: date | None,
    existing_scheduled_at: datetime | None = None,
) -> datetime:
    """
    Computes target execution timestamp for auto-scheduling:
    1. If deliverable already has a future scheduled timestamp, preserve it.
    2. If deliverable has planned_date, default to 10:00:00 UTC on that planned date.
       If planned date is today or in past, schedule 5 minutes from now.
    3. If no planned_date, default to 2 hours from now.
    """
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


async def _build_portal_deliverable_out(
    deliv: Deliverable,
    camp: Campaign,
    cl: Client,
    current_user_id: uuid.UUID,
    db: AsyncSession,
) -> PortalDeliverableOut:
    """Helper to load non-internal comments and build consistent PortalDeliverableOut."""
    comments_res = await db.execute(
        select(DeliverableComment, User)
        .join(User, DeliverableComment.author_id == User.id)
        .where(
            DeliverableComment.deliverable_id == deliv.id,
            DeliverableComment.is_internal.is_(False),
        )
        .order_by(DeliverableComment.created_at.asc())
    )
    comments = []
    for comm, u in comments_res.all():
        comments.append(
            CommentOut(
                id=comm.id,
                deliverable_id=comm.deliverable_id,
                content_version_id=comm.content_version_id,
                author_id=comm.author_id,
                author_name=u.full_name or u.email,
                author_role="client" if u.id == current_user_id else "agency",
                message=comm.message,
                is_internal=comm.is_internal,
                created_at=comm.created_at,
            )
        )

    sorted_versions = sorted(deliv.content_versions, key=lambda v: v.version_number)

    return PortalDeliverableOut(
        id=deliv.id,
        campaign_id=camp.id,
        campaign_name=camp.name,
        client_id=cl.id,
        client_name=cl.business_name,
        title=deliv.title,
        deliverable_type=deliv.deliverable_type,
        platform=deliv.platform,
        planned_date=deliv.planned_date,
        status=deliv.status,
        scheduled_at=deliv.scheduled_at,
        scheduled_timezone=deliv.scheduled_timezone,
        live_post_url=deliv.live_post_url,
        publishing_platform=deliv.publishing_platform,
        is_auto_scheduled=(deliv.status == DeliverableStatus.scheduled),
        created_at=deliv.created_at,
        updated_at=deliv.updated_at,
        content_versions=[ContentVersionOut.model_validate(v) for v in sorted_versions],
        comments=comments,
    )


async def _apply_portal_decision_and_auto_schedule(
    deliverable: Deliverable,
    version: ContentVersion,
    client: Client,
    current_user: User,
    decision: ApprovalDecision,
    comment_text: str | None,
    db: AsyncSession,
) -> bool:
    """
    Applies the client decision to the version/deliverable.
    If approved and social credentials + media asset exist, automatically creates
    PublicationJob(s) and advances deliverable status to scheduled.
    Returns True if auto-scheduled, False otherwise.
    """
    # 1. Record or update approval record
    existing_appr = await db.execute(
        select(Approval).where(Approval.content_version_id == version.id)
    )
    approval = existing_appr.scalar_one_or_none()
    if approval:
        approval.decision = decision
        approval.comment = comment_text
        approval.reviewer_id = current_user.id
        approval.is_valid = True
    else:
        approval = Approval(
            id=uuid.uuid4(),
            content_version_id=version.id,
            reviewer_id=current_user.id,
            decision=decision,
            comment=comment_text,
        )
        db.add(approval)

    is_auto_scheduled = False

    # 2. State machine transitions & auto-scheduling
    if decision == ApprovalDecision.approved:
        # Check connected social accounts for this client
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

        # Can auto-schedule only if content version has a media asset and matched social accounts exist
        if version.storage_key and matched_accounts:
            sched_at = _resolve_schedule_datetime(deliverable.planned_date, deliverable.scheduled_at)

            # Cancel any older pending/scheduled jobs
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

            # Prepare media
            local_path = Path(settings.UPLOAD_DIR) / version.storage_key
            if not local_path.is_file():
                project_root = Path(__file__).resolve().parent.parent.parent.parent
                root_cand = project_root / settings.UPLOAD_DIR / version.storage_key
                if root_cand.is_file():
                    local_path = root_cand
            local_file_str = str(local_path) if local_path.is_file() else None

            operation_id = uuid.uuid4()
            for plat, acc in matched_accounts.items():
                media_url = get_effective_media_url(version.storage_key)
                if plat == "instagram" and local_file_str and not version.storage_key.endswith((".mp4", ".mov")):
                    try:
                        _, ig_storage_key = ensure_instagram_compatible_image(local_file_str, version.storage_key)
                        if ig_storage_key:
                            media_url = get_effective_media_url(ig_storage_key)
                    except Exception as exc:
                        logger.warning(f"Error optimizing instagram image for deliverable {deliverable.id}: {exc}")

                job = PublicationJob(
                    deliverable_id=deliverable.id,
                    content_version_id=version.id,
                    client_social_account_id=acc.id,
                    platform=plat,
                    publication_operation_id=operation_id,
                    status=JobStatus.scheduled,
                    scheduled_at=sched_at,
                    scheduled_timezone="UTC",
                    next_attempt_at=sched_at,
                    caption_snapshot=version.caption or deliverable.title,
                    media_url_snapshot=media_url,
                    share_to_feed=True,
                    max_attempts=3,
                )
                db.add(job)

            deliverable.status = DeliverableStatus.scheduled
            deliverable.scheduled_at = sched_at
            deliverable.scheduled_timezone = "UTC"
            if len(matched_accounts) > 1:
                deliverable.publishing_platform = "both"
            else:
                deliverable.publishing_platform = list(matched_accounts.keys())[0]

            is_auto_scheduled = True
        else:
            deliverable.status = DeliverableStatus.approved
            is_auto_scheduled = False

        target_task_status = TaskStatus.approved

    else:
        # Changes requested
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
        deliverable.status = DeliverableStatus.changes_requested
        deliverable.scheduled_at = None
        target_task_status = TaskStatus.changes_requested
        is_auto_scheduled = False

    # 3. Update review tasks
    tasks_res = await db.execute(
        select(Task).where(Task.deliverable_id == deliverable.id)
    )
    tasks = tasks_res.scalars().all()
    review_tasks = [t for t in tasks if t.task_type in ("approval", "review")]
    if review_tasks:
        for t in review_tasks:
            t.status = target_task_status
    else:
        for t in tasks:
            t.status = target_task_status

    # 4. Optional client feedback comment
    if comment_text:
        comment = DeliverableComment(
            id=uuid.uuid4(),
            deliverable_id=deliverable.id,
            content_version_id=version.id,
            author_id=current_user.id,
            message=comment_text,
            is_internal=False,
        )
        db.add(comment)

    return is_auto_scheduled


async def get_authorized_client_ids(current_user: User, db: AsyncSession) -> list[uuid.UUID]:
    """
    Retrieve all client IDs this user is authorized to review.
    1. If the user is assigned as a client reviewer, returns their assigned client IDs.
    2. If the user is an internal agency member (owner/manager/etc), returns their agency's clients (allowing preview).
    """
    result = await db.execute(
        select(ClientReviewer.client_id).where(ClientReviewer.user_id == current_user.id)
    )
    client_ids = list(result.scalars().all())
    if client_ids:
        return client_ids

    # Allow internal agency staff to preview the portal for their agency's clients
    mem_res = await db.execute(
        select(Membership.agency_id).where(
            Membership.user_id == current_user.id,
            Membership.is_active.is_(True),
            Membership.role.in_([RoleEnum.owner, RoleEnum.account_manager, RoleEnum.strategist, RoleEnum.designer]),
        )
    )
    agency_ids = list(mem_res.scalars().all())
    if agency_ids:
        client_res = await db.execute(
            select(Client.id).where(Client.agency_id.in_(agency_ids))
        )
        agency_client_ids = list(client_res.scalars().all())
        if agency_client_ids:
            return agency_client_ids

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have access to any client review portals.",
    )


@router.get("/clients")
async def list_portal_clients(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List the brands / clients the logged-in reviewer has access to."""
    client_ids = await get_authorized_client_ids(current_user, db)
    result = await db.execute(select(Client).where(Client.id.in_(client_ids)))
    clients = result.scalars().all()
    return [
        {
            "id": c.id,
            "business_name": c.business_name,
            "industry": c.industry,
            "agency_id": c.agency_id,
        }
        for c in clients
    ]


@router.get("/deliverables", response_model=list[PortalDeliverableOut])
async def list_portal_deliverables(
    client_id: uuid.UUID | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[PortalDeliverableOut]:
    """
    List deliverables ready for client review, approved, scheduled, or published.
    Strictly isolated to client accounts linked to this reviewer.
    """
    authorized_client_ids = await get_authorized_client_ids(current_user, db)
    if client_id and client_id not in authorized_client_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view deliverables for this client.",
        )

    target_client_ids = [client_id] if client_id else authorized_client_ids

    allowed_statuses = [
        DeliverableStatus.client_review,
        DeliverableStatus.changes_requested,
        DeliverableStatus.approved,
        DeliverableStatus.scheduled,
        DeliverableStatus.publishing,
        DeliverableStatus.partially_published,
        DeliverableStatus.published,
    ]

    result = await db.execute(
        select(Deliverable, Campaign, Client)
        .join(Campaign, Deliverable.campaign_id == Campaign.id)
        .join(Client, Campaign.client_id == Client.id)
        .where(
            Client.id.in_(target_client_ids),
            Deliverable.status.in_(allowed_statuses),
        )
        .order_by(Deliverable.updated_at.desc())
    )
    rows = result.all()

    deliverables_out: list[PortalDeliverableOut] = []
    for deliv, camp, cl in rows:
        out = await _build_portal_deliverable_out(deliv, camp, cl, current_user.id, db)
        deliverables_out.append(out)

    return deliverables_out


@router.get("/deliverables/{deliverable_id}", response_model=PortalDeliverableOut)
async def get_portal_deliverable(
    deliverable_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PortalDeliverableOut:
    """Return single deliverable detail for client review."""
    authorized_client_ids = await get_authorized_client_ids(current_user, db)

    result = await db.execute(
        select(Deliverable, Campaign, Client)
        .join(Campaign, Deliverable.campaign_id == Campaign.id)
        .join(Client, Campaign.client_id == Client.id)
        .where(
            Deliverable.id == deliverable_id,
            Client.id.in_(authorized_client_ids),
        )
    )
    row = result.first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deliverable not found or you do not have permission to review it.",
        )

    deliv, camp, cl = row
    return await _build_portal_deliverable_out(deliv, camp, cl, current_user.id, db)


@router.post("/deliverables/{deliverable_id}/comments", response_model=CommentOut)
async def post_portal_comment(
    deliverable_id: uuid.UUID,
    payload: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CommentOut:
    """Post feedback from the client reviewer."""
    authorized_client_ids = await get_authorized_client_ids(current_user, db)

    # Verify deliverable belongs to authorized client
    deliv_res = await db.execute(
        select(Deliverable)
        .join(Campaign, Deliverable.campaign_id == Campaign.id)
        .where(
            Deliverable.id == deliverable_id,
            Campaign.client_id.in_(authorized_client_ids),
        )
    )
    deliv = deliv_res.scalar_one_or_none()
    if deliv is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deliverable not found or unauthorized.",
        )

    comment = DeliverableComment(
        id=uuid.uuid4(),
        deliverable_id=deliverable_id,
        content_version_id=payload.content_version_id,
        author_id=current_user.id,
        message=payload.message,
        is_internal=False,  # Client comments are never internal
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)

    return CommentOut(
        id=comment.id,
        deliverable_id=comment.deliverable_id,
        content_version_id=comment.content_version_id,
        author_id=comment.author_id,
        author_name=current_user.full_name or current_user.email,
        author_role="client",
        message=comment.message,
        is_internal=comment.is_internal,
        created_at=comment.created_at,
    )


@router.post(
    "/deliverables/{deliverable_id}/versions/{version_id}/decision",
    response_model=PortalDeliverableOut,
)
async def submit_portal_decision(
    deliverable_id: uuid.UUID,
    version_id: uuid.UUID,
    payload: PortalDecisionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PortalDeliverableOut:
    """
    Client reviewer approves or requests changes for a specific content version.
    Automatically transitions deliverable and task statuses, records the cryptographic
    approval, auto-schedules to connected social accounts when approved, and logs feedback comments.
    """
    authorized_client_ids = await get_authorized_client_ids(current_user, db)

    result = await db.execute(
        select(Deliverable, Campaign, Client)
        .join(Campaign, Deliverable.campaign_id == Campaign.id)
        .join(Client, Campaign.client_id == Client.id)
        .where(
            Deliverable.id == deliverable_id,
            Client.id.in_(authorized_client_ids),
        )
    )
    row = result.first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deliverable not found or unauthorized.",
        )

    deliverable, campaign, client = row

    ver_res = await db.execute(
        select(ContentVersion).where(
            ContentVersion.id == version_id,
            ContentVersion.deliverable_id == deliverable_id,
        )
    )
    version = ver_res.scalar_one_or_none()
    if version is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Content version not found on this deliverable.",
        )

    is_auto_scheduled = await _apply_portal_decision_and_auto_schedule(
        deliverable=deliverable,
        version=version,
        client=client,
        current_user=current_user,
        decision=payload.decision,
        comment_text=payload.comment,
        db=db,
    )

    await db.commit()
    await db.refresh(deliverable)

    if is_auto_scheduled:
        try:
            await global_wakeup_signal.notify(deliverable.id)
        except Exception as exc:
            logger.warning(f"Failed to dispatch scheduler wakeup signal: {exc}")

    return await _build_portal_deliverable_out(deliverable, campaign, client, current_user.id, db)


@router.post(
    "/deliverables/batch-decision",
    response_model=PortalBatchDecisionOut,
)
async def submit_portal_batch_decision(
    payload: PortalBatchDecisionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PortalBatchDecisionOut:
    """
    Batch approve or request changes across multiple deliverables in a sprint.
    Enforces reviewer authorization for every deliverable.
    Auto-schedules approved deliverables if connected social accounts exist.
    """
    if not payload.deliverable_ids:
        return PortalBatchDecisionOut(
            total_processed=0,
            approved_count=0,
            scheduled_count=0,
            changes_requested_count=0,
            deliverables=[],
        )

    authorized_client_ids = await get_authorized_client_ids(current_user, db)

    result = await db.execute(
        select(Deliverable, Campaign, Client)
        .join(Campaign, Deliverable.campaign_id == Campaign.id)
        .join(Client, Campaign.client_id == Client.id)
        .where(
            Deliverable.id.in_(payload.deliverable_ids),
            Client.id.in_(authorized_client_ids),
        )
    )
    rows = result.all()
    if len(rows) != len(payload.deliverable_ids):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="One or more deliverables were not found or you are not authorized to review them.",
        )

    scheduled_ids: list[uuid.UUID] = []
    approved_count = 0
    scheduled_count = 0
    changes_requested_count = 0

    for deliv, camp, cl in rows:
        ver_res = await db.execute(
            select(ContentVersion)
            .where(ContentVersion.deliverable_id == deliv.id)
            .order_by(ContentVersion.version_number.desc())
        )
        latest_version = ver_res.scalars().first()
        if not latest_version:
            continue

        auto_sched = await _apply_portal_decision_and_auto_schedule(
            deliverable=deliv,
            version=latest_version,
            client=cl,
            current_user=current_user,
            decision=payload.decision,
            comment_text=payload.comment,
            db=db,
        )

        if payload.decision == ApprovalDecision.approved:
            if auto_sched:
                scheduled_count += 1
                scheduled_ids.append(deliv.id)
            else:
                approved_count += 1
        else:
            changes_requested_count += 1

    await db.commit()

    for s_id in scheduled_ids:
        try:
            await global_wakeup_signal.notify(s_id)
        except Exception as exc:
            logger.warning(f"Failed to dispatch scheduler wakeup signal for {s_id}: {exc}")

    out_deliverables: list[PortalDeliverableOut] = []
    for deliv, camp, cl in rows:
        await db.refresh(deliv)
        out = await _build_portal_deliverable_out(deliv, camp, cl, current_user.id, db)
        out_deliverables.append(out)

    return PortalBatchDecisionOut(
        total_processed=len(rows),
        approved_count=approved_count,
        scheduled_count=scheduled_count,
        changes_requested_count=changes_requested_count,
        deliverables=out_deliverables,
    )
