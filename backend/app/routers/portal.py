from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.approval import Approval, ApprovalDecision
from app.models.campaign import Campaign
from app.models.client import Client
from app.models.client_reviewer import ClientReviewer
from app.models.comment import DeliverableComment
from app.models.content_version import ContentVersion
from app.models.deliverable import Deliverable, DeliverableStatus
from app.models.task import Task, TaskStatus
from app.models.user import Membership, RoleEnum, User
from app.schemas.comment import CommentCreate, CommentOut
from app.schemas.deliverable import ContentVersionOut
from app.schemas.portal import PortalDecisionRequest, PortalDeliverableOut

router = APIRouter(prefix="/portal", tags=["client-portal"])


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
    List deliverables ready for client review or already approved.
    Strictly isolated to client accounts linked to this reviewer.
    """
    authorized_client_ids = await get_authorized_client_ids(current_user, db)
    if client_id and client_id not in authorized_client_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view deliverables for this client.",
        )

    target_client_ids = [client_id] if client_id else authorized_client_ids

    # Query deliverables belonging to campaigns of target clients
    allowed_statuses = [
        DeliverableStatus.client_review,
        DeliverableStatus.changes_requested,
        DeliverableStatus.approved,
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
        # Load non-internal comments
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
                    author_role="client" if u.id == current_user.id else "agency",
                    message=comm.message,
                    is_internal=comm.is_internal,
                    created_at=comm.created_at,
                )
            )

        # Sort versions ascending
        sorted_versions = sorted(deliv.content_versions, key=lambda v: v.version_number)

        deliverables_out.append(
            PortalDeliverableOut(
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
                created_at=deliv.created_at,
                updated_at=deliv.updated_at,
                content_versions=[ContentVersionOut.model_validate(v) for v in sorted_versions],
                comments=comments,
            )
        )

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

    # Exclude internal comments
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
                author_role="client" if u.id == current_user.id else "agency",
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
        created_at=deliv.created_at,
        updated_at=deliv.updated_at,
        content_versions=[ContentVersionOut.model_validate(v) for v in sorted_versions],
        comments=comments,
    )


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
    approval, and logs feedback comments.
    """
    authorized_client_ids = await get_authorized_client_ids(current_user, db)

    # Verify deliverable and version
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

    # 1. Record or update approval record
    existing_appr = await db.execute(
        select(Approval).where(Approval.content_version_id == version_id)
    )
    approval = existing_appr.scalar_one_or_none()
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

    # 2. State machine transitions
    if payload.decision == ApprovalDecision.approved:
        deliverable.status = DeliverableStatus.approved
        target_task_status = TaskStatus.approved
    elif payload.decision == ApprovalDecision.changes_requested:
        deliverable.status = DeliverableStatus.changes_requested
        target_task_status = TaskStatus.changes_requested
    else:
        deliverable.status = DeliverableStatus.changes_requested
        target_task_status = TaskStatus.changes_requested

    # Update any linked tasks: only update the approval/review task so earlier stages aren't prematurely approved
    tasks_res = await db.execute(
        select(Task).where(Task.deliverable_id == deliverable_id)
    )
    tasks = tasks_res.scalars().all()
    review_tasks = [t for t in tasks if t.task_type in ("approval", "review")]
    if review_tasks:
        for t in review_tasks:
            t.status = target_task_status
    else:
        for t in tasks:
            t.status = target_task_status

    # 3. Log comment if feedback was supplied
    if payload.comment:
        comment = DeliverableComment(
            id=uuid.uuid4(),
            deliverable_id=deliverable_id,
            content_version_id=version_id,
            author_id=current_user.id,
            message=payload.comment,
            is_internal=False,
        )
        db.add(comment)

    await db.commit()
    await db.refresh(deliverable)

    return await get_portal_deliverable(deliverable_id, current_user, db)
