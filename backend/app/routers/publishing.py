from __future__ import annotations

import logging
from pathlib import Path
from typing import Any
import uuid
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, update
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
from app.models.publication_job import JobStatus, PublicationJob, PublicationAttempt
from app.schemas.publishing import (
    DeliverableMetricsUpdate,
    MonthlyReportOut,
    PublishDeliverableRequest,
    PublishDeliverableResponse,
    TopDeliverableItem,
    ScheduleDeliverableRequest,
    RescheduleDeliverableRequest,
    ScheduleDeliverableResponse,
    ScheduledJobOut,
    ScheduledDeliverableItem,
)
from app.services.lease_manager import reconcile_deliverable_status
from app.services.scheduler_coordinator import global_wakeup_signal
from app.services.meta_publisher import (
    MetaPublishingError,
    MetaPostNotFoundError,
    publish_facebook_page_post,
    publish_instagram_photo,
    publish_instagram_reel,
    sync_facebook_metrics,
    sync_instagram_metrics,
    ensure_instagram_compatible_image,
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
    platform_results: dict[str, Any] = {}
    if payload.mode == "automated":
        if latest_version is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No content version/media asset exists for this deliverable to publish.",
            )

        # Build public media URL (supports direct public URL or tunnel base URL)
        media_url = payload.media_url_override or f"{settings.PUBLIC_BASE_URL}/uploads/{latest_version.storage_key}"
        caption = payload.caption_override or latest_version.caption or deliverable.title

        # Check if local file exists on disk (avoids relying on external public URL fetch)
        local_path = Path(settings.UPLOAD_DIR) / latest_version.storage_key
        local_file_str = str(local_path) if local_path.is_file() and not payload.media_url_override else None
        is_video = (latest_version.file_type or "").startswith("video/") or latest_version.storage_key.endswith(
            (".mp4", ".mov")
        )

        if payload.platform in ("instagram", "facebook"):
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

            try:
                if payload.platform == "instagram":
                    if not social_account.instagram_business_id:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Instagram Business ID is missing from the connected social account.",
                        )

                    if is_video:
                        result = await publish_instagram_reel(
                            access_token=social_account.access_token,
                            instagram_business_id=social_account.instagram_business_id,
                            video_url=media_url,
                            caption=caption,
                            share_to_feed=payload.share_to_feed,
                            local_file_path=local_file_str,
                            file_type=latest_version.file_type,
                        )
                    else:
                        # Ensure photo is converted to Instagram-compliant JPEG in sRGB
                        ig_local_path, ig_storage_key = ensure_instagram_compatible_image(
                            local_file_str, latest_version.storage_key
                        )
                        if ig_storage_key and not payload.media_url_override:
                            media_url = f"{settings.PUBLIC_BASE_URL.rstrip('/')}/uploads/{ig_storage_key.lstrip('/')}"

                        result = await publish_instagram_photo(
                            access_token=social_account.access_token,
                            instagram_business_id=social_account.instagram_business_id,
                            image_url=media_url,
                            caption=caption,
                        )

                    live_url = result.get("permalink")
                    external_post_id = str(result.get("media_id"))
                    success_message = f"Successfully published to Instagram profile {social_account.account_handle or ''}!"
                    platform_results["instagram"] = {
                        "success": True,
                        "post_id": external_post_id,
                        "permalink": live_url,
                    }

                elif payload.platform == "facebook":
                    if not social_account.facebook_page_id:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Facebook Page ID is missing from the connected social account.",
                        )

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
                    platform_results["facebook"] = {
                        "success": True,
                        "post_id": external_post_id,
                        "permalink": live_url,
                    }

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

        elif payload.platform == "both":
            # Dual-platform publishing: Instagram & Facebook
            accounts_res = await db.execute(
                select(ClientSocialAccount).where(
                    ClientSocialAccount.client_id == client.id,
                    ClientSocialAccount.is_active.is_(True),
                )
            )
            all_accounts = accounts_res.scalars().all()
            ig_account = next((a for a in all_accounts if a.platform == "instagram" or a.instagram_business_id), None)
            fb_account = next((a for a in all_accounts if a.platform == "facebook" or a.facebook_page_id), None)

            if not ig_account and not fb_account:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"No connected social accounts found for client '{client.business_name}'.",
                )

            # 1. Instagram
            if ig_account and ig_account.instagram_business_id:
                try:
                    if is_video:
                        ig_result = await publish_instagram_reel(
                            access_token=ig_account.access_token,
                            instagram_business_id=ig_account.instagram_business_id,
                            video_url=media_url,
                            caption=caption,
                            share_to_feed=payload.share_to_feed,
                            local_file_path=local_file_str,
                            file_type=latest_version.file_type,
                        )
                    else:
                        ig_result = await publish_instagram_photo(
                            access_token=ig_account.access_token,
                            instagram_business_id=ig_account.instagram_business_id,
                            image_url=media_url,
                            caption=caption,
                        )
                    platform_results["instagram"] = {
                        "success": True,
                        "post_id": str(ig_result.get("media_id")),
                        "permalink": ig_result.get("permalink"),
                    }
                except Exception as e:
                    platform_results["instagram"] = {
                        "success": False,
                        "error": str(e),
                    }
            else:
                platform_results["instagram"] = {
                    "success": False,
                    "error": "No connected Instagram Business account.",
                }

            # 2. Facebook
            if fb_account and fb_account.facebook_page_id:
                try:
                    fb_result = await publish_facebook_page_post(
                        access_token=fb_account.access_token,
                        page_id=fb_account.facebook_page_id,
                        media_url=media_url,
                        caption=caption,
                        is_video=is_video,
                        local_file_path=local_file_str,
                        file_name=latest_version.file_name,
                        file_type=latest_version.file_type,
                    )
                    platform_results["facebook"] = {
                        "success": True,
                        "post_id": str(fb_result.get("post_id")),
                        "permalink": fb_result.get("permalink"),
                    }
                except Exception as e:
                    platform_results["facebook"] = {
                        "success": False,
                        "error": str(e),
                    }
            else:
                platform_results["facebook"] = {
                    "success": False,
                    "error": "No connected Facebook Page.",
                }

            ig_ok = platform_results.get("instagram", {}).get("success", False)
            fb_ok = platform_results.get("facebook", {}).get("success", False)

            if ig_ok and fb_ok:
                live_url = platform_results["instagram"].get("permalink") or platform_results["facebook"].get("permalink")
                external_post_id = f"ig:{platform_results['instagram']['post_id']},fb:{platform_results['facebook']['post_id']}"
                success_message = "Successfully published to both Instagram and Facebook Page!"
            elif fb_ok and not ig_ok:
                live_url = platform_results["facebook"].get("permalink")
                external_post_id = str(platform_results["facebook"]["post_id"])
                success_message = f"Published to Facebook Page successfully. (Instagram failed: {platform_results['instagram'].get('error')})"
            elif ig_ok and not fb_ok:
                live_url = platform_results["instagram"].get("permalink")
                external_post_id = str(platform_results["instagram"]["post_id"])
                success_message = f"Published to Instagram successfully. (Facebook failed: {platform_results['facebook'].get('error')})"
            else:
                # Both failed
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Publishing failed on both platforms. "
                        f"Instagram: {platform_results['instagram'].get('error')}. "
                        f"Facebook: {platform_results['facebook'].get('error')}."
                    ),
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
        platform_results=platform_results or None,
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

    if deliverable.status not in (DeliverableStatus.published, DeliverableStatus.partially_published) or not deliverable.external_post_id:
        return {
            "deliverable_id": deliverable.id,
            "views_count": deliverable.views_count or 0,
            "likes_count": deliverable.likes_count or 0,
            "comments_count": deliverable.comments_count or 0,
            "shares_count": deliverable.shares_count or 0,
            "message": "Deliverable has no external Meta post ID to sync.",
        }

    # Find client's active social accounts (Instagram and/or Facebook)
    campaign_res = await db.execute(select(Campaign).where(Campaign.id == deliverable.campaign_id))
    campaign = campaign_res.scalar_one()

    accounts_res = await db.execute(
        select(ClientSocialAccount).where(
            ClientSocialAccount.client_id == campaign.client_id,
            ClientSocialAccount.is_active.is_(True),
        )
    )
    all_accounts = list(accounts_res.scalars().all())
    if not all_accounts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No connected social account found to fetch live metrics from Meta.",
        )

    ig_account = next((a for a in all_accounts if a.platform == "instagram"), None)
    fb_account = next((a for a in all_accounts if a.platform == "facebook"), None)

    # Parse external post ID(s)
    raw_ext_id = (deliverable.external_post_id or "").strip()
    ig_post_id: str | None = None
    fb_post_id: str | None = None

    if "ig:" in raw_ext_id or "fb:" in raw_ext_id:
        for part in raw_ext_id.split(","):
            part = part.strip()
            if part.startswith("ig:"):
                ig_post_id = part.replace("ig:", "").strip()
            elif part.startswith("fb:"):
                fb_post_id = part.replace("fb:", "").strip()
    elif (deliverable.publishing_platform or "").lower() == "facebook":
        fb_post_id = raw_ext_id
    elif (deliverable.publishing_platform or "").lower() == "instagram":
        ig_post_id = raw_ext_id
    else:
        # If unspecified platform, attempt matching against available connected accounts
        if ig_account:
            ig_post_id = raw_ext_id
        elif fb_account:
            fb_post_id = raw_ext_id

    tot_likes = 0
    tot_comments = 0
    tot_views = 0
    tot_shares = 0
    synced_any = False
    ig_deleted = False
    fb_deleted = False

    # Sync Instagram metrics if present
    if ig_post_id:
        if ig_account:
            try:
                ig_metrics = await sync_instagram_metrics(
                    access_token=ig_account.access_token,
                    media_id=ig_post_id,
                )
                tot_likes += ig_metrics.get("likes_count", 0)
                tot_comments += ig_metrics.get("comments_count", 0)
                tot_views += ig_metrics.get("views_count", 0)
                tot_shares += ig_metrics.get("shares_count", 0)
                synced_any = True
            except MetaPostNotFoundError:
                ig_deleted = True
            except Exception as e:
                logger.warning(f"Error fetching Instagram live metrics for {ig_post_id}: {e}")
        else:
            logger.warning(f"No active Instagram account connected to sync post {ig_post_id}")

    # Sync Facebook metrics if present
    if fb_post_id:
        if fb_account:
            try:
                fb_metrics = await sync_facebook_metrics(
                    access_token=fb_account.access_token,
                    post_id=fb_post_id,
                    page_id=fb_account.facebook_page_id,
                )
                tot_likes += fb_metrics.get("likes_count", 0)
                tot_comments += fb_metrics.get("comments_count", 0)
                tot_views += fb_metrics.get("views_count", 0)
                tot_shares += fb_metrics.get("shares_count", 0)
                synced_any = True
            except MetaPostNotFoundError:
                fb_deleted = True
            except Exception as e:
                logger.warning(f"Error fetching Facebook live metrics for {fb_post_id}: {e}")
        else:
            logger.warning(f"No active Facebook account connected to sync post {fb_post_id}")

    # Determine if post was deleted on all target platforms
    is_deleted = False
    if ig_post_id and fb_post_id:
        is_deleted = ig_deleted and fb_deleted
    elif ig_post_id:
        is_deleted = ig_deleted
    elif fb_post_id:
        is_deleted = fb_deleted

    if is_deleted:
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

    if synced_any:
        deliverable.likes_count = tot_likes
        deliverable.comments_count = tot_comments
        deliverable.views_count = tot_views
        deliverable.shares_count = tot_shares

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

    # If neither call succeeded (e.g. invalid test IDs or temporary network issues), return latest cached without error
    return {
        "deliverable_id": deliverable.id,
        "views_count": deliverable.views_count or 0,
        "likes_count": deliverable.likes_count or 0,
        "comments_count": deliverable.comments_count or 0,
        "shares_count": deliverable.shares_count or 0,
        "synced": False,
        "post_deleted": False,
        "message": "Could not reach Meta Graph API right now; showing latest recorded numbers.",
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

    # Cancel any associated publication jobs
    await db.execute(
        update(PublicationJob)
        .where(PublicationJob.deliverable_id == deliverable.id)
        .values(status=JobStatus.cancelled)
    )

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


# ---------------------------------------------------------------------------
# Content Scheduling Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/deliverables/{deliverable_id}/schedule",
    response_model=ScheduleDeliverableResponse,
)
async def schedule_deliverable(
    agency_id: uuid.UUID,
    deliverable_id: uuid.UUID,
    payload: ScheduleDeliverableRequest,
    membership: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> ScheduleDeliverableResponse:
    """
    Schedules an approved deliverable for automated publication at a future UTC timestamp.
    Enforces content version snapshot integrity and platform-specific publication jobs.
    """
    deliverable = await assert_deliverable_belongs_to_agency(deliverable_id, agency_id, db)

    # 1. Guardrail: Deliverable must be approved or already scheduled
    allowed_statuses = (
        DeliverableStatus.approved,
        DeliverableStatus.scheduled,
        DeliverableStatus.partially_published,
        DeliverableStatus.changes_requested,
    )
    if deliverable.status not in allowed_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot schedule deliverable with status '{deliverable.status.value}'. "
                "Only client-approved deliverables can be scheduled for publication."
            ),
        )

    # 2. Time validation: Target scheduled_at must be in the future
    now = datetime.now(timezone.utc)
    sched_at = payload.scheduled_at
    if sched_at.tzinfo is None:
        sched_at = sched_at.replace(tzinfo=timezone.utc)

    if sched_at <= now + timedelta(seconds=10):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Scheduled publication time must be in the future (at least 15 seconds ahead).",
        )

    # 3. Find Campaign, Client, and Latest Content Version
    campaign_res = await db.execute(select(Campaign).where(Campaign.id == deliverable.campaign_id))
    campaign = campaign_res.scalar_one()
    client_res = await db.execute(select(Client).where(Client.id == campaign.client_id))
    client = client_res.scalar_one()

    versions_res = await db.execute(
        select(ContentVersion)
        .where(ContentVersion.deliverable_id == deliverable.id)
        .order_by(ContentVersion.version_number.desc())
    )
    latest_version = versions_res.scalars().first()
    if latest_version is None or not latest_version.storage_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot schedule deliverable without an uploaded and approved media asset.",
        )

    # 4. Resolve Target Social Accounts
    accounts_res = await db.execute(
        select(ClientSocialAccount)
        .where(ClientSocialAccount.client_id == client.id, ClientSocialAccount.is_active == True)
    )
    social_accounts = list(accounts_res.scalars().all())

    target_platforms: list[str] = []
    p = payload.platform.lower()
    if p in ("instagram", "ig"):
        target_platforms = ["instagram"]
    elif p in ("facebook", "fb"):
        target_platforms = ["facebook"]
    elif p in ("both", "all"):
        target_platforms = ["instagram", "facebook"]
    else:
        target_platforms = ["instagram"]

    platform_account_map: dict[str, ClientSocialAccount] = {}
    for plat in target_platforms:
        matched = next((a for a in social_accounts if a.platform == plat), None)
        if not matched:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Client '{client.business_name}' does not have an active connected {plat.title()} account.",
            )
        platform_account_map[plat] = matched

    # 5. Cancel any prior scheduled/pending/failed jobs for this deliverable
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

    # 6. Create PublicationJob for each target platform with stable operation identity
    operation_id = uuid.uuid4()
    created_jobs: list[PublicationJob] = []

    for plat in target_platforms:
        acc = platform_account_map[plat]
        job = PublicationJob(
            deliverable_id=deliverable.id,
            content_version_id=latest_version.id,
            client_social_account_id=acc.id,
            platform=plat,
            publication_operation_id=operation_id,
            status=JobStatus.scheduled,
            scheduled_at=sched_at,
            scheduled_timezone=payload.scheduled_timezone or "UTC",
            next_attempt_at=sched_at,
            caption_snapshot=payload.caption_override or latest_version.caption or deliverable.title,
            media_url_snapshot=f"{settings.PUBLIC_BASE_URL.rstrip('/')}/uploads/{latest_version.storage_key.lstrip('/')}",
            share_to_feed=payload.share_to_feed,
            max_attempts=3,
        )
        db.add(job)
        created_jobs.append(job)

    # 7. Update parent Deliverable
    deliverable.status = DeliverableStatus.scheduled
    deliverable.scheduled_at = sched_at
    deliverable.scheduled_timezone = payload.scheduled_timezone or "UTC"

    await db.commit()

    # 8. Notify scheduler advisory signal (after transaction commits)
    try:
        await global_wakeup_signal.notify(deliverable.id)
    except Exception as e:
        logger.warning(f"Failed to dispatch scheduler wakeup signal: {e}")

    job_outs = [
        ScheduledJobOut(
            id=j.id,
            platform=j.platform,
            status=j.status.value,
            scheduled_at=j.scheduled_at,
            scheduled_timezone=j.scheduled_timezone,
            next_attempt_at=j.next_attempt_at,
            attempts_count=j.attempts_count or 0,
            last_error_message=j.last_error_message,
        )
        for j in created_jobs
    ]

    return ScheduleDeliverableResponse(
        success=True,
        deliverable_id=deliverable.id,
        status=deliverable.status.value,
        scheduled_at=deliverable.scheduled_at,
        scheduled_timezone=deliverable.scheduled_timezone or "UTC",
        jobs=job_outs,
        message=f"Deliverable scheduled successfully for {len(created_jobs)} platform(s).",
    )


@router.post(
    "/deliverables/{deliverable_id}/reschedule",
    response_model=ScheduleDeliverableResponse,
)
async def reschedule_deliverable(
    agency_id: uuid.UUID,
    deliverable_id: uuid.UUID,
    payload: RescheduleDeliverableRequest,
    membership: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> ScheduleDeliverableResponse:
    """
    Reschedules an existing scheduled deliverable to a new target time.
    """
    deliverable = await assert_deliverable_belongs_to_agency(deliverable_id, agency_id, db)
    now = datetime.now(timezone.utc)
    new_sched = payload.new_scheduled_at
    if new_sched.tzinfo is None:
        new_sched = new_sched.replace(tzinfo=timezone.utc)

    if new_sched <= now + timedelta(seconds=10):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New scheduled time must be in the future (at least 1 minute ahead).",
        )

    jobs_res = await db.execute(
        select(PublicationJob).where(
            PublicationJob.deliverable_id == deliverable.id,
            PublicationJob.status.in_([JobStatus.scheduled, JobStatus.needs_reconnection, JobStatus.failed]),
        )
    )
    jobs = list(jobs_res.scalars().all())
    if not jobs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No scheduled publication jobs found to reschedule.",
        )

    for j in jobs:
        j.scheduled_at = new_sched
        j.next_attempt_at = new_sched
        j.status = JobStatus.scheduled
        if payload.scheduled_timezone:
            j.scheduled_timezone = payload.scheduled_timezone
        j.claim_token = None
        j.claimed_by = None

    deliverable.status = DeliverableStatus.scheduled
    deliverable.scheduled_at = new_sched
    if payload.scheduled_timezone:
        deliverable.scheduled_timezone = payload.scheduled_timezone

    await db.commit()

    try:
        await global_wakeup_signal.notify(deliverable.id)
    except Exception as e:
        logger.warning(f"Failed to dispatch scheduler wakeup signal: {e}")

    job_outs = [
        ScheduledJobOut(
            id=j.id,
            platform=j.platform,
            status=j.status.value,
            scheduled_at=j.scheduled_at,
            scheduled_timezone=j.scheduled_timezone,
            next_attempt_at=j.next_attempt_at,
            attempts_count=j.attempts_count or 0,
            last_error_message=j.last_error_message,
        )
        for j in jobs
    ]

    return ScheduleDeliverableResponse(
        success=True,
        deliverable_id=deliverable.id,
        status=deliverable.status.value,
        scheduled_at=deliverable.scheduled_at,
        scheduled_timezone=deliverable.scheduled_timezone or "UTC",
        jobs=job_outs,
        message="Deliverable rescheduled successfully.",
    )


@router.post(
    "/deliverables/{deliverable_id}/cancel-schedule",
)
async def cancel_schedule_deliverable(
    agency_id: uuid.UUID,
    deliverable_id: uuid.UUID,
    membership: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Cancels scheduled publication jobs.
    If a job is actively publishing, flags cancellation_pending.
    Otherwise sets cancelled and returns deliverable to approved.
    """
    deliverable = await assert_deliverable_belongs_to_agency(deliverable_id, agency_id, db)

    jobs_res = await db.execute(
        select(PublicationJob).where(
            PublicationJob.deliverable_id == deliverable.id,
            PublicationJob.status.in_([JobStatus.scheduled, JobStatus.publishing, JobStatus.needs_reconnection]),
        )
    )
    jobs = list(jobs_res.scalars().all())
    if not jobs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active scheduled jobs to cancel for this deliverable.",
        )

    has_publishing = False
    for j in jobs:
        if j.status == JobStatus.publishing:
            has_publishing = True
            j.status = JobStatus.cancellation_pending
        else:
            j.status = JobStatus.cancelled

    if not has_publishing:
        deliverable.status = DeliverableStatus.approved
        deliverable.scheduled_at = None

    await db.commit()

    if has_publishing:
        return {
            "success": True,
            "status": "cancellation_pending",
            "message": "Cancellation requested: waiting for in-flight publishing worker to acknowledge.",
        }

    return {
        "success": True,
        "status": "approved",
        "message": "Scheduled publication cancelled. Deliverable returned to approved state.",
    }


@router.get(
    "/scheduled-deliverables",
    response_model=list[ScheduledDeliverableItem],
)
async def list_scheduled_deliverables(
    agency_id: uuid.UUID,
    client_id: uuid.UUID | None = Query(None),
    membership: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> list[ScheduledDeliverableItem]:
    """
    Lists all scheduled deliverables across the agency (or filtered by client),
    sorted by target scheduled time ascending.
    """
    now = datetime.now(timezone.utc)
    query = (
        select(Deliverable, Client.id, Client.business_name, ContentVersion.storage_key)
        .join(Campaign, Deliverable.campaign_id == Campaign.id)
        .join(Client, Campaign.client_id == Client.id)
        .outerjoin(ContentVersion, ContentVersion.deliverable_id == Deliverable.id)
        .where(
            Client.agency_id == agency_id,
            Deliverable.status.in_([
                DeliverableStatus.scheduled,
                DeliverableStatus.publishing,
                DeliverableStatus.needs_reconnection,
                DeliverableStatus.ambiguous,
            ]),
        )
    )
    if client_id:
        query = query.where(Client.id == client_id)

    query = query.order_by(Deliverable.scheduled_at.asc().nullslast())
    rows = (await db.execute(query)).all()

    seen: set[uuid.UUID] = set()
    items: list[ScheduledDeliverableItem] = []

    for deliv, c_id, c_name, thumb in rows:
        if deliv.id in seen:
            continue
        seen.add(deliv.id)

        jobs_res = await db.execute(
            select(PublicationJob).where(PublicationJob.deliverable_id == deliv.id)
        )
        jobs = list(jobs_res.scalars().all())

        sched_at = deliv.scheduled_at or now
        if sched_at.tzinfo is None:
            sched_at = sched_at.replace(tzinfo=timezone.utc)

        secs = max(0.0, (sched_at - now).total_seconds())

        job_outs = [
            ScheduledJobOut(
                id=j.id,
                platform=j.platform,
                status=j.status.value,
                scheduled_at=j.scheduled_at,
                scheduled_timezone=j.scheduled_timezone,
                next_attempt_at=j.next_attempt_at,
                attempts_count=j.attempts_count or 0,
                last_error_message=j.last_error_message,
            )
            for j in jobs
        ]

        items.append(
            ScheduledDeliverableItem(
                deliverable_id=deliv.id,
                campaign_id=deliv.campaign_id,
                client_id=c_id,
                client_name=c_name,
                title=deliv.title,
                deliverable_type=deliv.deliverable_type,
                platform=deliv.platform,
                status=deliv.status.value,
                scheduled_at=sched_at,
                scheduled_timezone=deliv.scheduled_timezone or "UTC",
                seconds_remaining=secs,
                jobs=job_outs,
                thumbnail_url=thumb,
            )
        )

    return items

