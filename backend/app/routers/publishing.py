from __future__ import annotations

from pathlib import Path
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.dependencies import require_agency_member
from app.models.campaign import Campaign
from app.models.client import Client
from app.models.client_social_account import ClientSocialAccount
from app.models.content_version import ContentVersion
from app.models.contract import Contract, ContractStatus, ScopeItem
from app.models.deliverable import Deliverable, DeliverableStatus
from app.models.task import Task, TaskStatus
from app.models.user import Membership
from app.schemas.publishing import (
    DeliverableMetricsUpdate,
    MonthlyReportOut,
    PublishDeliverableRequest,
    PublishDeliverableResponse,
    TopDeliverableItem,
)
from app.services.meta_publisher import (
    MetaPublishingError,
    MetaPostNotFoundError,
    publish_facebook_page_post,
    publish_instagram_photo,
    publish_instagram_reel,
    sync_facebook_metrics,
    sync_instagram_metrics,
)
from app.services.tenant_service import (
    assert_deliverable_belongs_to_agency,
    get_client_for_agency,
)

router = APIRouter(prefix="/agencies/{agency_id}", tags=["publishing"])


@router.post(
    "/deliverables/{deliverable_id}/publish",
    response_model=PublishDeliverableResponse,
)
async def publish_deliverable(
    agency_id: uuid.UUID,
    deliverable_id: uuid.UUID,
    payload: PublishDeliverableRequest,
    membership: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> PublishDeliverableResponse:
    """
    Publish an approved deliverable to Instagram or Facebook via Meta Graph API,
    or mark it as published with a manual post URL.
    Enforces that unapproved deliverables cannot enter the publishing pipeline.
    """
    deliverable = await assert_deliverable_belongs_to_agency(deliverable_id, agency_id, db)

    # 1. Guardrail: Deliverable must be approved (or already published being updated)
    if deliverable.status not in (DeliverableStatus.approved, DeliverableStatus.published):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot publish deliverable with status '{deliverable.status.value}'. "
                "Only client-approved deliverables can be published."
            ),
        )

    # 2. Get the Campaign and Client
    campaign_res = await db.execute(select(Campaign).where(Campaign.id == deliverable.campaign_id))
    campaign = campaign_res.scalar_one()
    client_res = await db.execute(select(Client).where(Client.id == campaign.client_id))
    client = client_res.scalar_one()

    # Find the latest ContentVersion
    versions_res = await db.execute(
        select(ContentVersion)
        .where(ContentVersion.deliverable_id == deliverable.id)
        .order_by(ContentVersion.version_number.desc())
    )
    latest_version = versions_res.scalars().first()

    now = datetime.now(timezone.utc)
    live_url = payload.live_post_url
    external_post_id: str | None = None
    success_message = "Deliverable marked as published successfully."

    # 3. Handle Automated Publishing via Meta Graph API
    if payload.mode == "automated":
        if latest_version is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No content version/media asset exists for this deliverable to publish.",
            )

        # Lookup client's social account
        account_res = await db.execute(
            select(ClientSocialAccount).where(
                ClientSocialAccount.client_id == client.id,
                ClientSocialAccount.platform == payload.platform,
                ClientSocialAccount.is_active.is_(True),
            )
        )
        social_account = account_res.scalar_one_or_none()

        if social_account is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"No active {payload.platform} account connected for client '{client.business_name}'. "
                    "Please connect social credentials in the client workspace or choose manual publishing."
                ),
            )

        # Build public media URL (supports direct public URL or tunnel base URL)
        media_url = payload.media_url_override or f"{settings.PUBLIC_BASE_URL}/uploads/{latest_version.storage_key}"
        caption = payload.caption_override or latest_version.caption or deliverable.title

        try:
            if payload.platform == "instagram":
                if not social_account.instagram_business_id:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Instagram Business ID is missing from the connected social account.",
                    )

                is_video = (latest_version.file_type or "").startswith("video/") or latest_version.storage_key.endswith(
                    (".mp4", ".mov")
                )

                if is_video:
                    result = await publish_instagram_reel(
                        access_token=social_account.access_token,
                        instagram_business_id=social_account.instagram_business_id,
                        video_url=media_url,
                        caption=caption,
                        share_to_feed=payload.share_to_feed,
                    )
                else:
                    result = await publish_instagram_photo(
                        access_token=social_account.access_token,
                        instagram_business_id=social_account.instagram_business_id,
                        image_url=media_url,
                        caption=caption,
                    )

                live_url = result.get("permalink")
                external_post_id = str(result.get("media_id"))
                success_message = f"Successfully published to Instagram profile {social_account.account_handle or ''}!"

            elif payload.platform == "facebook":
                if not social_account.facebook_page_id:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Facebook Page ID is missing from the connected social account.",
                    )

                is_video = (latest_version.file_type or "").startswith("video/") or latest_version.storage_key.endswith(
                    (".mp4", ".mov")
                )

                # Check if local file exists on disk (avoids relying on external public URL fetch)
                local_path = Path(settings.UPLOAD_DIR) / latest_version.storage_key
                local_file_str = str(local_path) if local_path.is_file() and not payload.media_url_override else None

                result = await publish_facebook_page_post(
                    access_token=social_account.access_token,
                    page_id=social_account.facebook_page_id,
                    media_url=media_url,
                    caption=caption,
                    is_video=is_video,
                    local_file_path=local_file_str,
                    file_name=latest_version.file_name,
                    file_type=latest_version.file_type,
                )
                live_url = result.get("permalink")
                external_post_id = str(result.get("post_id"))
                success_message = "Successfully published to Facebook Page!"

        except MetaPublishingError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Meta Publishing failed: {str(e)}",
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Unexpected error during automated publishing: {str(e)}",
            )

    # 4. Update Deliverable Status and Publishing Metadata
    deliverable.status = DeliverableStatus.published
    deliverable.published_at = now
    deliverable.live_post_url = live_url
    deliverable.external_post_id = external_post_id
    deliverable.publishing_platform = payload.platform

    # 5. Two-way Task Sync: mark any associated tasks as done
    tasks_res = await db.execute(select(Task).where(Task.deliverable_id == deliverable.id))
    for task in tasks_res.scalars().all():
        if task.status != TaskStatus.done:
            task.status = TaskStatus.done

    await db.commit()
    await db.refresh(deliverable)

    return PublishDeliverableResponse(
        success=True,
        deliverable_id=deliverable.id,
        status=deliverable.status.value,
        live_post_url=deliverable.live_post_url,
        external_post_id=deliverable.external_post_id,
        published_at=deliverable.published_at or now,
        platform=payload.platform,
        message=success_message,
    )


@router.patch("/deliverables/{deliverable_id}/metrics")
async def update_deliverable_metrics(
    agency_id: uuid.UUID,
    deliverable_id: uuid.UUID,
    payload: DeliverableMetricsUpdate,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Record performance metrics (views, likes, comments, shares) for a published deliverable."""
    deliverable = await assert_deliverable_belongs_to_agency(deliverable_id, agency_id, db)

    if payload.views_count is not None:
        deliverable.views_count = payload.views_count
    if payload.likes_count is not None:
        deliverable.likes_count = payload.likes_count
    if payload.comments_count is not None:
        deliverable.comments_count = payload.comments_count
    if payload.shares_count is not None:
        deliverable.shares_count = payload.shares_count

    await db.commit()
    await db.refresh(deliverable)

    return {
        "deliverable_id": deliverable.id,
        "views_count": deliverable.views_count,
        "likes_count": deliverable.likes_count,
        "comments_count": deliverable.comments_count,
        "shares_count": deliverable.shares_count,
    }


@router.post("/deliverables/{deliverable_id}/sync-metrics")
async def sync_deliverable_metrics(
    agency_id: uuid.UUID,
    deliverable_id: uuid.UUID,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Query Meta Graph API to fetch live likes, comments, views, and shares
    for a published deliverable, and persist them to the database.
    """
    deliverable = await assert_deliverable_belongs_to_agency(deliverable_id, agency_id, db)

    if deliverable.status != DeliverableStatus.published or not deliverable.external_post_id:
        return {
            "deliverable_id": deliverable.id,
            "views_count": deliverable.views_count or 0,
            "likes_count": deliverable.likes_count or 0,
            "comments_count": deliverable.comments_count or 0,
            "shares_count": deliverable.shares_count or 0,
            "message": "Deliverable has no external Meta post ID to sync.",
        }

    # Find client's social account token
    campaign_res = await db.execute(select(Campaign).where(Campaign.id == deliverable.campaign_id))
    campaign = campaign_res.scalar_one()

    account_res = await db.execute(
        select(ClientSocialAccount).where(
            ClientSocialAccount.client_id == campaign.client_id,
            ClientSocialAccount.platform == (deliverable.publishing_platform or "instagram"),
            ClientSocialAccount.is_active.is_(True),
        )
    )
    social_account = account_res.scalar_one_or_none()

    if not social_account:
        fallback_res = await db.execute(
            select(ClientSocialAccount).where(
                ClientSocialAccount.client_id == campaign.client_id,
                ClientSocialAccount.is_active.is_(True),
            )
        )
        social_account = fallback_res.scalar_one_or_none()

    if not social_account:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No connected social account found to fetch live metrics from Meta.",
        )

    # Sync from Meta
    try:
        if (deliverable.publishing_platform or "").lower() == "facebook":
            synced = await sync_facebook_metrics(
                access_token=social_account.access_token,
                post_id=deliverable.external_post_id,
                page_id=social_account.facebook_page_id,
            )
        else:
            synced = await sync_instagram_metrics(
                access_token=social_account.access_token,
                media_id=deliverable.external_post_id,
            )
    except MetaPostNotFoundError:
        # Post was deleted on Meta (Facebook or Instagram)!
        # Revert deliverable back to approved so it is removed from Published Live.
        deliverable.status = DeliverableStatus.approved
        deliverable.published_at = None
        deliverable.live_post_url = None
        deliverable.external_post_id = None
        deliverable.views_count = 0
        deliverable.likes_count = 0
        deliverable.comments_count = 0
        deliverable.shares_count = 0

        await db.commit()
        await db.refresh(deliverable)

        return {
            "deliverable_id": deliverable.id,
            "status": "approved",
            "post_deleted": True,
            "views_count": 0,
            "likes_count": 0,
            "comments_count": 0,
            "shares_count": 0,
            "synced": True,
            "message": "This post was deleted on Facebook/Instagram. It has been removed from Published Live and returned to Ready to Publish.",
        }

    deliverable.likes_count = synced.get("likes_count", deliverable.likes_count or 0)
    deliverable.comments_count = synced.get("comments_count", deliverable.comments_count or 0)
    deliverable.views_count = synced.get("views_count", deliverable.views_count or 0)
    deliverable.shares_count = synced.get("shares_count", deliverable.shares_count or 0)

    await db.commit()
    await db.refresh(deliverable)

    return {
        "deliverable_id": deliverable.id,
        "views_count": deliverable.views_count,
        "likes_count": deliverable.likes_count,
        "comments_count": deliverable.comments_count,
        "shares_count": deliverable.shares_count,
        "synced": True,
        "post_deleted": False,
        "message": f"Successfully synced live metrics from Meta: {deliverable.likes_count} likes, {deliverable.views_count} views, {deliverable.comments_count} comments.",
    }


@router.post("/deliverables/{deliverable_id}/unpublish")
@router.delete("/deliverables/{deliverable_id}/publish")
async def unpublish_deliverable(
    agency_id: uuid.UUID,
    deliverable_id: uuid.UUID,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Unpublish a deliverable, removing it from Published Live and returning it
    to Ready to Publish (approved).
    """
    deliverable = await assert_deliverable_belongs_to_agency(deliverable_id, agency_id, db)
    deliverable.status = DeliverableStatus.approved
    deliverable.published_at = None
    deliverable.live_post_url = None
    deliverable.external_post_id = None
    deliverable.views_count = 0
    deliverable.likes_count = 0
    deliverable.comments_count = 0
    deliverable.shares_count = 0

    await db.commit()
    await db.refresh(deliverable)

    return {
        "deliverable_id": deliverable.id,
        "status": "approved",
        "unpublish": True,
        "message": "Deliverable has been removed from Published Live and moved back to Ready to Publish.",
    }


@router.get("/clients/{client_id}/reports/monthly", response_model=MonthlyReportOut)
async def get_client_monthly_delivery_report(
    agency_id: uuid.UUID,
    client_id: uuid.UUID,
    month: int = Query(default=None),
    year: int = Query(default=None),
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> MonthlyReportOut:
    """
    Generate Phase 5 Monthly Delivery & Performance Report.
    Audits contract quota fulfillment and summarizes all completed and published work.
    """
    client = await get_client_for_agency(client_id, agency_id, db)
    now = datetime.now(timezone.utc)
    target_month = month or now.month
    target_year = year or now.year

    # 1. Total Scope Quota from Active Contracts
    scope_query = (
        select(func.coalesce(func.sum(ScopeItem.monthly_quantity), 0))
        .join(Contract, ScopeItem.contract_id == Contract.id)
        .where(Contract.client_id == client.id, Contract.status == ContractStatus.active)
    )
    total_scope_quota = (await db.execute(scope_query)).scalar() or 0

    # 2. Query Deliverables for this client along with their campaign
    deliv_query = (
        select(Deliverable, Campaign)
        .join(Campaign, Deliverable.campaign_id == Campaign.id)
        .where(Campaign.client_id == client.id)
    )
    rows = (await db.execute(deliv_query)).all()

    # Filter deliverables that belong to target_month and target_year
    deliverables: list[Deliverable] = []
    for d, c in rows:
        belongs_to_month = False
        if d.published_at:
            # Published deliverables belong to the month they were published
            belongs_to_month = (d.published_at.year == target_year and d.published_at.month == target_month)
        elif d.planned_date:
            belongs_to_month = (d.planned_date.year == target_year and d.planned_date.month == target_month)
        elif c and c.period_year and c.period_month:
            belongs_to_month = (c.period_year == target_year and c.period_month == target_month)
        elif d.created_at:
            belongs_to_month = (d.created_at.year == target_year and d.created_at.month == target_month)

        if belongs_to_month:
            deliverables.append(d)

    deliverables_delivered = sum(
        1 for d in deliverables if d.status in (DeliverableStatus.approved, DeliverableStatus.published)
    )
    deliverables_published = sum(
        1 for d in deliverables if d.status == DeliverableStatus.published or d.live_post_url
    )

    quota_rate = (
        round((deliverables_delivered / total_scope_quota) * 100, 1)
        if total_scope_quota > 0
        else (100.0 if deliverables_delivered > 0 else 0.0)
    )

    total_views = sum(d.views_count or 0 for d in deliverables)
    total_likes = sum(d.likes_count or 0 for d in deliverables)
    total_comments = sum(d.comments_count or 0 for d in deliverables)

    engagement_rate = (
        round(((total_likes + total_comments) / total_views) * 100, 2)
        if total_views > 0
        else 0.0
    )

    # Top deliverables sorted by views and likes
    top_items = sorted(
        deliverables,
        key=lambda d: ((d.views_count or 0) * 2 + (d.likes_count or 0)),
        reverse=True,
    )[:5]

    def get_actual_platform(d: Deliverable) -> str:
        if d.publishing_platform:
            return d.publishing_platform.lower()
        if d.live_post_url:
            if "facebook.com" in d.live_post_url:
                return "facebook"
            if "instagram.com" in d.live_post_url:
                return "instagram"
        return (d.platform or "instagram").lower()

    top_deliverables = [
        TopDeliverableItem(
            id=d.id,
            title=d.title,
            deliverable_type=d.deliverable_type,
            platform=get_actual_platform(d),
            live_post_url=d.live_post_url,
            views_count=d.views_count or 0,
            likes_count=d.likes_count or 0,
            comments_count=d.comments_count or 0,
        )
        for d in top_items
    ]

    # Generate an executive summary
    month_name = datetime(target_year, target_month, 1).strftime("%B %Y")
    if deliverables_delivered == 0:
        executive_summary = (
            f"For {month_name}, no deliverables have been approved or published yet for {client.business_name}. "
            f"Monthly retainer scope target is {total_scope_quota} deliverables."
        )
    else:
        executive_summary = (
            f"For {month_name}, the agency delivered {deliverables_delivered} approved content assets "
            f"for {client.business_name} ({deliverables_published} published live), achieving a "
            f"{quota_rate}% contract scope fulfillment rate. "
            + (
                f"Published content generated {total_views:,} impressions with an average engagement rate of {engagement_rate}%."
                if total_views > 0
                else "Content is currently in production and client review."
            )
        )

    return MonthlyReportOut(
        client_id=client.id,
        client_name=client.business_name,
        month=target_month,
        year=target_year,
        total_scope_quota=total_scope_quota,
        deliverables_delivered=deliverables_delivered,
        deliverables_published=deliverables_published,
        quota_fulfillment_rate=quota_rate,
        total_views=total_views,
        total_likes=total_likes,
        total_comments=total_comments,
        avg_engagement_rate=engagement_rate,
        top_deliverables=top_deliverables,
        executive_summary=executive_summary,
    )
