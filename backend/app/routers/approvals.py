from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies import get_current_user, require_agency_member
from app.models.approval import Approval, ApprovalDecision
from app.models.campaign import Campaign
from app.models.client import Client
from app.models.comment import DeliverableComment
from app.models.content_version import ContentVersion
from app.models.deliverable import Deliverable, DeliverableStatus
from app.models.task import Task, TaskStatus
from app.models.user import Membership, RoleEnum, User
from app.schemas.approval import ApprovalCreate, ApprovalOut
from app.schemas.portal import ApprovalsQueueItemOut
from app.services.tenant_service import assert_deliverable_belongs_to_agency

router = APIRouter(tags=["approvals"])


@router.post(
    "/agencies/{agency_id}/content-versions/{version_id}/approve",
    response_model=ApprovalOut,
    status_code=status.HTTP_201_CREATED,
)
async def submit_approval(
    agency_id: uuid.UUID,
    version_id: uuid.UUID,
    payload: ApprovalCreate,
    membership: Membership = Depends(require_agency_member),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApprovalOut:
    """
    Submit an approval decision for a content version.
    Reviewer must hold the 'client' role or be an internal agency member.
    Synchronizes Deliverable and Task statuses and records revision comments.
    """
    allowed_roles = {
        RoleEnum.client,
        RoleEnum.owner,
        RoleEnum.account_manager,
        RoleEnum.strategist,
    }
    if membership.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your role is not permitted to submit approvals.",
        )

    # Load the content version
    result = await db.execute(
        select(ContentVersion).where(ContentVersion.id == version_id)
    )
    content_version = result.scalar_one_or_none()
    if content_version is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Content version not found."
        )

    # Verify the content version belongs to this agency via deliverable chain
    deliverable = await assert_deliverable_belongs_to_agency(content_version.deliverable_id, agency_id, db)

    # Check for existing approval for this version
    existing = await db.execute(
        select(Approval).where(Approval.content_version_id == version_id)
    )
    approval = existing.scalar_one_or_none()
    if approval:
        approval.decision = payload.decision
        approval.comment = payload.comment
        approval.reviewer_id = current_user.id
        approval.is_valid = True
    else:
        approval = Approval(
            id=uuid.uuid4(),
            content_version_id=version_id,
            reviewer_id=current_user.id,
            decision=payload.decision,
            comment=payload.comment,
        )
        db.add(approval)

    # State machine sync
    if payload.decision == ApprovalDecision.approved:
        deliverable.status = DeliverableStatus.approved
        target_task_status = TaskStatus.approved
    elif payload.decision == ApprovalDecision.changes_requested:
        deliverable.status = DeliverableStatus.changes_requested
        target_task_status = TaskStatus.changes_requested
    else:
        deliverable.status = DeliverableStatus.changes_requested
        target_task_status = TaskStatus.changes_requested

    # Update tasks
    tasks_res = await db.execute(
        select(Task).where(Task.deliverable_id == deliverable.id)
    )
    for t in tasks_res.scalars().all():
        t.status = target_task_status

    # Record feedback comment if present
    if payload.comment:
        comment = DeliverableComment(
            id=uuid.uuid4(),
            deliverable_id=deliverable.id,
            content_version_id=version_id,
            author_id=current_user.id,
            message=payload.comment,
            is_internal=False,
        )
        db.add(comment)

    await db.commit()
    await db.refresh(approval)
    return ApprovalOut.model_validate(approval)


@router.get("/agencies/{agency_id}/approvals/queue", response_model=list[ApprovalsQueueItemOut])
async def get_approvals_queue(
    agency_id: uuid.UUID,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> list[ApprovalsQueueItemOut]:
    """
    Get all deliverables in review, changes_requested, or recently approved
    across all agency clients for the agency approvals dashboard.
    """
    review_statuses = [
        DeliverableStatus.client_review,
        DeliverableStatus.internal_review,
        DeliverableStatus.changes_requested,
        DeliverableStatus.approved,
        DeliverableStatus.published,
    ]

    result = await db.execute(
        select(Deliverable, Campaign, Client)
        .join(Campaign, Deliverable.campaign_id == Campaign.id)
        .join(Client, Campaign.client_id == Client.id)
        .where(
            Client.agency_id == agency_id,
            Deliverable.status.in_(review_statuses),
        )
        .order_by(Deliverable.updated_at.desc())
    )

    items: list[ApprovalsQueueItemOut] = []
    for deliv, camp, cl in result.all():
        latest_version = None
        if deliv.content_versions:
            sorted_versions = sorted(deliv.content_versions, key=lambda v: v.version_number)
            latest_version = sorted_versions[-1]

        # Get latest comment
        comm_res = await db.execute(
            select(DeliverableComment, User)
            .join(User, DeliverableComment.author_id == User.id)
            .where(DeliverableComment.deliverable_id == deliv.id)
            .order_by(DeliverableComment.created_at.desc(), DeliverableComment.id.desc())
            .limit(1)
        )
        last_comm_row = comm_res.first()
        last_comment_text = last_comm_row[0].message if last_comm_row else None
        last_comment_author = (last_comm_row[1].full_name or last_comm_row[1].email) if last_comm_row else None
        last_comment_time = last_comm_row[0].created_at if last_comm_row else None

        items.append(
            ApprovalsQueueItemOut(
                deliverable_id=deliv.id,
                deliverable_title=deliv.title,
                deliverable_type=deliv.deliverable_type,
                platform=deliv.publishing_platform or deliv.platform,
                publishing_platform=deliv.publishing_platform,
                status=deliv.status,
                client_id=cl.id,
                client_name=cl.business_name,
                campaign_id=camp.id,
                campaign_name=camp.name,
                latest_version_number=latest_version.version_number if latest_version else None,
                latest_version_id=latest_version.id if latest_version else None,
                latest_file_name=latest_version.file_name if latest_version else None,
                latest_checksum=latest_version.checksum_sha256 if latest_version else None,
                planned_date=deliv.planned_date,
                updated_at=deliv.updated_at,
                last_comment=last_comment_text,
                last_comment_author=last_comment_author,
                last_comment_at=last_comment_time,
                live_post_url=deliv.live_post_url,
                views_count=deliv.views_count,
                likes_count=deliv.likes_count,
                comments_count=deliv.comments_count,
                shares_count=deliv.shares_count,
            )
        )

    return items


@router.get("/agencies/{agency_id}/approvals", response_model=list[ApprovalOut])
async def list_pending_approvals(
    agency_id: uuid.UUID,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> list[ApprovalOut]:
    """
    List all approvals for content versions that belong to this agency.
    """
    result = await db.execute(
        select(Approval)
        .join(ContentVersion, Approval.content_version_id == ContentVersion.id)
        .join(Deliverable, ContentVersion.deliverable_id == Deliverable.id)
        .join(Campaign, Deliverable.campaign_id == Campaign.id)
        .join(Client, Campaign.client_id == Client.id)
        .where(Client.agency_id == agency_id, Approval.is_valid.is_(True))
    )
    approvals = result.scalars().all()
    return [ApprovalOut.model_validate(a) for a in approvals]
