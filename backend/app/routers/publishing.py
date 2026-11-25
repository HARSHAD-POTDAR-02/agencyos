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
from app.models.operational_workflow import ModelInvocation
from app.models.task import Task, TaskStatus
from app.models.user import Membership
from app.models.publication_job import JobStatus, PublicationJob, PublicationAttempt
from app.schemas.publishing import (
    AgencyRoiMetrics,
    ContentFormatDistribution,
    DeliverableMetricsUpdate,
    EngagementRateMetrics,
    FacebookProfileTelemetry,
    InstagramProfileTelemetry,
    LiveMetaPostItem,
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
    fetch_live_meta_telemetry,
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
from app.services.tunnel_service import get_effective_media_url, get_effective_public_base_url

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

    # 1. Guardrail: Deliverable must be approved (or already published / partially published being completed)
    if deliverable.status not in (
        DeliverableStatus.approved,
        DeliverableStatus.published,
        DeliverableStatus.partially_published,
    ):
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
        media_url = payload.media_url_override or get_effective_media_url(latest_version.storage_key)
        caption = payload.caption_override or latest_version.caption or deliverable.title

        # Check if local file exists on disk (avoids relying on external public URL fetch)
        local_path = Path(settings.UPLOAD_DIR) / latest_version.storage_key
        if not local_path.is_file():
            project_root = Path(__file__).resolve().parent.parent.parent.parent
            root_candidate = project_root / settings.UPLOAD_DIR / latest_version.storage_key
            if root_candidate.is_file():
                local_path = root_candidate
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
                        ig_media_url = payload.media_url_override or (
                            get_effective_media_url(ig_storage_key) if ig_storage_key else media_url
                        )

                        result = await publish_instagram_photo(
                            access_token=social_account.access_token,
                            instagram_business_id=social_account.instagram_business_id,
                            image_url=ig_media_url,
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

                existing_external_id = deliverable.external_post_id or ""
                already_has_ig = "ig:" in existing_external_id
                already_has_fb = "fb:" in existing_external_id

                if payload.platform == "instagram" and already_has_fb:
                    fb_id = existing_external_id.split("fb:")[-1].split(",")[0]
                    external_post_id = f"ig:{external_post_id},fb:{fb_id}"
                    target_status = DeliverableStatus.published
                    effective_platform = "both"
                elif payload.platform == "facebook" and already_has_ig:
                    ig_id = existing_external_id.split("ig:")[-1].split(",")[0]
                    external_post_id = f"ig:{ig_id},fb:{external_post_id}"
                    target_status = DeliverableStatus.published
                    effective_platform = "both"
                else:
                    target_status = DeliverableStatus.published
                    effective_platform = payload.platform

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

            existing_external_id = deliverable.external_post_id or ""
            already_has_ig = "ig:" in existing_external_id or (
                deliverable.publishing_platform == "instagram"
                and deliverable.status in (DeliverableStatus.published, DeliverableStatus.partially_published)
            )
            already_has_fb = "fb:" in existing_external_id or (
                deliverable.publishing_platform == "facebook"
                and deliverable.status in (DeliverableStatus.published, DeliverableStatus.partially_published)
            )

            # 1. Instagram (only if not already published)
            if already_has_ig:
                existing_ig_id = (
                    existing_external_id.split("ig:")[-1].split(",")[0]
                    if "ig:" in existing_external_id
                    else existing_external_id
                )
                platform_results["instagram"] = {
                    "success": True,
                    "post_id": existing_ig_id,
                    "permalink": deliverable.live_post_url,
                }
            elif ig_account and ig_account.instagram_business_id:
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
                        ig_local_path, ig_storage_key = ensure_instagram_compatible_image(
                            local_file_str, latest_version.storage_key
                        )
                        ig_media_url = payload.media_url_override or (
                            get_effective_media_url(ig_storage_key) if ig_storage_key else media_url
                        )
                        ig_result = await publish_instagram_photo(
                            access_token=ig_account.access_token,
                            instagram_business_id=ig_account.instagram_business_id,
                            image_url=ig_media_url,
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

            # 2. Facebook (only if not already published)
            if already_has_fb:
                existing_fb_id = (
                    existing_external_id.split("fb:")[-1].split(",")[0]
                    if "fb:" in existing_external_id
                    else existing_external_id
                )
                platform_results["facebook"] = {
                    "success": True,
                    "post_id": existing_fb_id,
                    "permalink": deliverable.live_post_url,
                }
            elif fb_account and fb_account.facebook_page_id:
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
                target_status = DeliverableStatus.published
                effective_platform = "both"
            elif fb_ok and not ig_ok:
                live_url = platform_results["facebook"].get("permalink")
                external_post_id = f"fb:{platform_results['facebook']['post_id']}"
                success_message = f"Published to Facebook Page successfully. (Instagram failed: {platform_results['instagram'].get('error')})"
                target_status = DeliverableStatus.partially_published
                effective_platform = "both"
            elif ig_ok and not fb_ok:
                live_url = platform_results["instagram"].get("permalink")
                external_post_id = f"ig:{platform_results['instagram']['post_id']}"
                success_message = f"Published to Instagram successfully. (Facebook failed: {platform_results['facebook'].get('error')})"
                target_status = DeliverableStatus.partially_published
                effective_platform = "both"
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
    deliverable.status = target_status if payload.mode == "automated" else DeliverableStatus.published
    deliverable.published_at = deliverable.published_at or now
    deliverable.live_post_url = live_url
    deliverable.external_post_id = external_post_id
    deliverable.publishing_platform = effective_platform if payload.mode == "automated" else payload.platform

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
    Generate Phase 5 & 6 Monthly Delivery, Performance & Agency ROI Report.
    Audits contract quota fulfillment, queries live Meta Graph API telemetry (Instagram & Facebook),
    calculates real Earned Media Value (EMV), and models financial return on retainer.
    """
    client = await get_client_for_agency(client_id, agency_id, db)
    now = datetime.now(timezone.utc)
    target_month = month or now.month
    target_year = year or now.year

    # 1. Total Scope Quota & Retainer Fee from Active Contracts (with consistent fallback)
    contract_query = (
        select(Contract)
        .where(Contract.client_id == client.id, Contract.status == ContractStatus.active)
    )
    target_contracts = (await db.execute(contract_query)).scalars().all()
    if not target_contracts:
        target_contracts = (
            await db.execute(select(Contract).where(Contract.client_id == client.id))
        ).scalars().all()

    monthly_retainer_fee = sum(float(c.monthly_fee_inr or 0) for c in target_contracts)
    contract_ids = [c.id for c in target_contracts]
    if contract_ids:
        scope_query = (
            select(func.coalesce(func.sum(ScopeItem.monthly_quantity), 0))
            .where(ScopeItem.contract_id.in_(contract_ids))
        )
        total_scope_quota = int((await db.execute(scope_query)).scalar() or 0)
    else:
        total_scope_quota = 0

    # 2. Query Deliverables for this client along with their campaign
    deliv_query = (
        select(Deliverable, Campaign)
        .join(Campaign, Deliverable.campaign_id == Campaign.id)
        .where(Campaign.client_id == client.id)
    )
    rows = (await db.execute(deliv_query)).all()

    def _belongs_to_period(d: Deliverable, c: Campaign | None, y: int, m: int) -> bool:
        if d.published_at:
            return d.published_at.year == y and d.published_at.month == m
        if d.planned_date:
            return d.planned_date.year == y and d.planned_date.month == m
        if c and c.period_year and c.period_month:
            return c.period_year == y and c.period_month == m
        if d.created_at:
            return d.created_at.year == y and d.created_at.month == m
        return False

    prev_month = 12 if target_month == 1 else target_month - 1
    prev_year = target_year - 1 if target_month == 1 else target_year

    deliverables: list[Deliverable] = []
    prev_deliverables: list[Deliverable] = []
    for d, c in rows:
        if _belongs_to_period(d, c, target_year, target_month):
            deliverables.append(d)
        elif _belongs_to_period(d, c, prev_year, prev_month):
            prev_deliverables.append(d)

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

    # 3. Live Meta Graph API Telemetry Collection (filtered to target_month / target_year)
    social_query = select(ClientSocialAccount).where(
        ClientSocialAccount.client_id == client.id,
        ClientSocialAccount.is_active.is_(True),
    )
    social_accounts = (await db.execute(social_query)).scalars().all()
    ig_account = next((a for a in social_accounts if a.platform == "instagram"), None)
    fb_account = next((a for a in social_accounts if a.platform == "facebook"), None)

    meta_telemetry: dict[str, Any] | None = None
    if ig_account or fb_account:
        token = ig_account.access_token if ig_account else (fb_account.access_token if fb_account else "")
        ig_id = ig_account.instagram_business_id if ig_account else None
        fb_id = fb_account.facebook_page_id if fb_account else None
        try:
            meta_telemetry = await fetch_live_meta_telemetry(
                access_token=token,
                instagram_business_id=ig_id,
                facebook_page_id=fb_id,
            )
        except Exception as e:
            logger.warning(f"Error fetching live meta telemetry for client {client.id}: {e}")

    # Build Pydantic profile telemetry objects
    ig_profile_out: InstagramProfileTelemetry | None = None
    fb_profile_out: FacebookProfileTelemetry | None = None
    live_meta_posts_out: list[LiveMetaPostItem] = []
    connected_account_labels: list[str] = []

    if meta_telemetry:
        if meta_telemetry.get("instagram"):
            ig_p = meta_telemetry["instagram"]
            if ig_p.get("username"):
                connected_account_labels.append(f"@{ig_p['username']}")
            ig_profile_out = InstagramProfileTelemetry(
                connected=True,
                id=ig_p.get("id"),
                username=ig_p.get("username"),
                name=ig_p.get("name"),
                profile_picture_url=ig_p.get("profile_picture_url"),
                followers_count=ig_p.get("followers_count", 0),
                follows_count=ig_p.get("follows_count", 0),
                media_count=ig_p.get("media_count", 0),
                biography=ig_p.get("biography"),
                website=ig_p.get("website"),
            )
        if meta_telemetry.get("facebook"):
            fb_p = meta_telemetry["facebook"]
            if fb_p.get("page_name"):
                connected_account_labels.append(str(fb_p["page_name"]))
            fb_profile_out = FacebookProfileTelemetry(
                connected=True,
                id=fb_p.get("id"),
                page_name=fb_p.get("page_name"),
                fan_count=fb_p.get("fan_count", 0),
                followers_count=fb_p.get("followers_count", 0),
                talking_about_count=fb_p.get("talking_about_count", 0),
                link=fb_p.get("link"),
                avatar_url=fb_p.get("avatar_url"),
            )

        # Match live posts with DB deliverables and sync metrics (strictly filtered to target month/year)
        raw_posts = meta_telemetry.get("posts", [])
        deliverables_modified = False

        def _post_in_period(ts_raw: str | None) -> bool:
            if not ts_raw:
                return target_year == now.year and target_month == now.month
            try:
                norm = ts_raw.replace("Z", "+00:00")
                if len(norm) >= 5 and (norm[-5] in ("+", "-")) and norm[-3] != ":":
                    norm = f"{norm[:-2]}:{norm[-2:]}"
                dt = datetime.fromisoformat(norm)
                return dt.year == target_year and dt.month == target_month
            except Exception:
                return target_year == now.year and target_month == now.month

        for p in raw_posts:
            if not _post_in_period(p.get("timestamp")):
                continue

            post_id = str(p.get("id") or "")
            permalink = str(p.get("permalink") or "")
            matched_deliverable: Deliverable | None = None

            for d in deliverables:
                ext_id = str(d.external_post_id or "")
                live_url = str(d.live_post_url or "")
                if (post_id and post_id in ext_id) or (permalink and permalink in live_url) or (live_url and live_url in permalink):
                    matched_deliverable = d
                    break

            is_match = matched_deliverable is not None
            deliv_title = matched_deliverable.title if matched_deliverable else None

            if matched_deliverable:
                # Sync real-time metrics back into Deliverable DB record
                p_likes = p.get("likes_count", 0)
                p_comments = p.get("comments_count", 0)
                if p_likes > (matched_deliverable.likes_count or 0):
                    matched_deliverable.likes_count = p_likes
                    deliverables_modified = True
                if p_comments > (matched_deliverable.comments_count or 0):
                    matched_deliverable.comments_count = p_comments
                    deliverables_modified = True
                if p.get("views_count", 0) > 0 or p.get("reach_count", 0) > 0:
                    matched_deliverable.views_count = p.get("views_count") or p.get("reach_count")
                    deliverables_modified = True

            live_meta_posts_out.append(
                LiveMetaPostItem(
                    id=post_id,
                    platform=p.get("platform") or "instagram",
                    caption=p.get("caption"),
                    media_type=p.get("media_type"),
                    media_url=p.get("media_url"),
                    permalink=permalink,
                    timestamp=p.get("timestamp"),
                    likes_count=p.get("likes_count", 0),
                    comments_count=p.get("comments_count", 0),
                    shares_count=p.get("shares_count", 0),
                    reach_count=p.get("reach_count", 0),
                    views_count=p.get("views_count", 0),
                    saved_count=p.get("saved_count", 0),
                    is_deliverable_match=is_match,
                    deliverable_title=deliv_title,
                )
            )

        if deliverables_modified:
            await db.commit()

    # 4. Totals & Engagement Aggregation (Period-filtered, honest reach)
    db_views = sum(d.views_count or 0 for d in deliverables)
    db_likes = sum(d.likes_count or 0 for d in deliverables)
    db_comments = sum(d.comments_count or 0 for d in deliverables)

    live_meta_likes = sum(p.likes_count for p in live_meta_posts_out)
    live_meta_comments = sum(p.comments_count for p in live_meta_posts_out)
    live_meta_shares = sum(p.shares_count for p in live_meta_posts_out)
    live_meta_reach = sum(p.reach_count for p in live_meta_posts_out)
    live_meta_views = sum(p.views_count for p in live_meta_posts_out)
    live_meta_saves = sum(p.saved_count for p in live_meta_posts_out)
    total_audience = meta_telemetry.get("total_audience", 0) if meta_telemetry else 0
    num_meta_posts = len(live_meta_posts_out)

    blended_likes = max(db_likes, live_meta_likes)
    blended_comments = max(db_comments, live_meta_comments)
    total_social_interactions = blended_likes + blended_comments + live_meta_shares + live_meta_saves

    # Honest Organic Reach: verified Meta Insights reach first, then DB views, else 0 (no synthetic numbers)
    is_live_insights = live_meta_reach > 0
    if is_live_insights:
        total_reach = live_meta_reach
        total_views = max(live_meta_views, live_meta_reach, db_views)
    elif live_meta_views > 0 or db_views > 0:
        total_views = max(live_meta_views, db_views)
        total_reach = total_views
    else:
        total_reach = 0
        total_views = 0

    # ERR (Engagement Rate by Reach): (Total Engagements / Reach) * 100
    err_rate = round((total_social_interactions / total_reach) * 100, 2) if total_reach > 0 else 0.0

    # ERF (Engagement Rate by Followers): (Avg Engagements Per Post / Followers) * 100
    post_denominator = max(num_meta_posts, deliverables_published, 1)
    avg_engagements_per_post = round(total_social_interactions / post_denominator, 2) if total_social_interactions > 0 else 0.0
    erf_rate = (
        round((avg_engagements_per_post / total_audience) * 100, 2)
        if total_audience > 0 and avg_engagements_per_post > 0
        else 0.0
    )

    engagement_rate = err_rate

    benchmark_status = (
        "Elite Performance (> 5.0%)"
        if err_rate >= 5.0
        else (
            "Strong Organic Performance (1.5% - 5.0%)"
            if err_rate >= 1.5
            else ("Standard Engagement (< 1.5%)" if total_reach > 0 else "Awaiting Live Reach Data")
        )
    )

    engagement_metrics = EngagementRateMetrics(
        err_rate=err_rate,
        erf_rate=erf_rate,
        total_engagements=total_social_interactions,
        total_reach=total_reach,
        total_views=total_views,
        total_saves=live_meta_saves,
        avg_engagements_per_post=avg_engagements_per_post,
        formula_used="(Total Engagements / Reach) × 100",
        benchmark_status=benchmark_status,
        is_live_insights_verified=is_live_insights,
    )

    # 5. Format Distribution (DB deliverables + unmatched Meta posts only — no double-counting)
    videos = sum(1 for d in deliverables if any(k in (d.deliverable_type or "").lower() for k in ("video", "reel")))
    images = sum(1 for d in deliverables if any(k in (d.deliverable_type or "").lower() for k in ("graphic", "photo", "image", "single", "static")))
    carousels = sum(1 for d in deliverables if "carousel" in (d.deliverable_type or "").lower())
    other = max(0, len(deliverables) - videos - images - carousels)

    unmatched_meta = [p for p in live_meta_posts_out if not p.is_deliverable_match]
    extra_videos = sum(1 for p in unmatched_meta if "VIDEO" in (p.media_type or "").upper() or "REEL" in (p.media_type or "").upper())
    extra_carousels = sum(1 for p in unmatched_meta if "CAROUSEL" in (p.media_type or "").upper())
    extra_images = max(0, len(unmatched_meta) - extra_videos - extra_carousels)

    format_distribution = ContentFormatDistribution(
        videos_count=videos + extra_videos,
        images_count=images + extra_images,
        carousels_count=carousels + extra_carousels,
        other_count=other,
    )

    # 6. Agency Financial ROI, EMV & Cost-to-Serve Engine
    # Standard creative asset production benchmark values:
    # Video/Reel: ₹15,000, Carousel: ₹10,000, Graphic/Photo: ₹6,000, Other: ₹4,000
    estimated_production_value = float(
        (videos * 15000) + (carousels * 10000) + (images * 6000) + (other * 4000)
    )
    if estimated_production_value == 0 and deliverables_delivered > 0:
        estimated_production_value = float(deliverables_delivered * 7500)

    # Organic Earned Media Value (EMV):
    # Likes @ ₹40, Comments @ ₹125, Saves @ ₹80, Shares @ ₹250, Audience Reach @ ₹15 per follower
    saves_valuation = float(live_meta_saves * 80.0)
    earned_engagement_val = float(
        (blended_likes * 40.0) + (blended_comments * 125.0) + (live_meta_shares * 250.0) + saves_valuation
    )
    earned_reach_val = float(total_audience * 15.0)
    total_earned_media_value = round(estimated_production_value + earned_engagement_val + earned_reach_val, 2)

    cost_per_asset = (
        round(monthly_retainer_fee / deliverables_delivered, 2)
        if deliverables_delivered > 0 and monthly_retainer_fee > 0
        else (round(monthly_retainer_fee / max(total_scope_quota, 1), 2) if monthly_retainer_fee > 0 else 0.0)
    )

    is_retainer_configured = monthly_retainer_fee > 0
    roi_multiplier = (
        round(total_earned_media_value / monthly_retainer_fee, 2)
        if is_retainer_configured
        else 0.0
    )

    # Query actual AI production cost-to-serve from ModelInvocation telemetry for this client in this period
    period_start = datetime(target_year, target_month, 1, tzinfo=timezone.utc)
    if target_month == 12:
        period_end = datetime(target_year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        period_end = datetime(target_year, target_month + 1, 1, tzinfo=timezone.utc)

    ai_cost_stmt = (
        select(
            func.coalesce(func.sum(ModelInvocation.cost_usd), 0),
            func.coalesce(func.sum(ModelInvocation.total_tokens), 0),
        )
        .where(
            ModelInvocation.client_id == client.id,
            ModelInvocation.created_at >= period_start,
            ModelInvocation.created_at < period_end,
        )
    )
    ai_cost_row = (await db.execute(ai_cost_stmt)).first()
    ai_production_cost_usd = round(float(ai_cost_row[0] or 0), 4) if ai_cost_row else 0.0
    ai_tokens_used = int(ai_cost_row[1] or 0) if ai_cost_row else 0
    ai_production_cost_inr = round(ai_production_cost_usd * 85.0, 2)
    net_agency_margin_inr = round(monthly_retainer_fee - ai_production_cost_inr, 2) if is_retainer_configured else 0.0

    roi_metrics = AgencyRoiMetrics(
        monthly_retainer_fee=monthly_retainer_fee,
        currency="INR",
        total_audience=total_audience,
        total_social_interactions=total_social_interactions,
        live_engagement_rate=engagement_rate,
        cost_per_approved_asset=cost_per_asset,
        estimated_production_value=estimated_production_value,
        estimated_earned_media_value=total_earned_media_value,
        roi_multiplier=roi_multiplier,
        breakdown_text="Calculated via Earned Media Value (EMV): creative asset production value + organic social engagement (₹40/like, ₹125/comment, ₹80/save, ₹250/share) + audience reach over monthly retainer.",
        videos_count=videos,
        carousels_count=carousels,
        images_count=images,
        other_count=other,
        total_saves=live_meta_saves,
        saves_valuation=saves_valuation,
        ai_production_cost_usd=ai_production_cost_usd,
        ai_production_cost_inr=ai_production_cost_inr,
        ai_tokens_used=ai_tokens_used,
        net_agency_margin_inr=net_agency_margin_inr,
        connected_account_labels=connected_account_labels,
        is_retainer_configured=is_retainer_configured,
    )

    # Month-over-Month (MoM) comparison deltas
    prev_delivered = sum(1 for d in prev_deliverables if d.status in (DeliverableStatus.approved, DeliverableStatus.published))
    prev_views = sum(d.views_count or 0 for d in prev_deliverables)
    prev_engagements = sum((d.likes_count or 0) + (d.comments_count or 0) for d in prev_deliverables)

    def _calc_delta_pct(curr: int | float, prev: int | float) -> float | None:
        if prev <= 0:
            return None
        return round(((curr - prev) / prev) * 100, 1)

    views_delta_pct = _calc_delta_pct(total_views, prev_views)
    engagements_delta_pct = _calc_delta_pct(total_social_interactions, prev_engagements)
    delivered_delta_pct = _calc_delta_pct(deliverables_delivered, prev_delivered)

    # 7. Top deliverables sorted by views and likes
    top_items = sorted(
        deliverables,
        key=lambda d: ((d.views_count or 0) * 2 + (d.likes_count or 0)),
        reverse=True,
    )[:10]

    def get_actual_platform(d: Deliverable) -> str:
        if d.publishing_platform:
            return d.publishing_platform.lower()
        if d.live_post_url:
            if "facebook.com" in d.live_post_url:
                return "facebook"
            if "instagram.com" in d.live_post_url:
                return "instagram"
            if "linkedin.com" in d.live_post_url:
                return "linkedin"
        return (d.platform or "instagram").lower()

    def _deliverable_timestamp(d: Deliverable) -> str | None:
        dt = d.published_at or (datetime.combine(d.planned_date, datetime.min.time()) if d.planned_date else None) or d.created_at
        return dt.isoformat() if dt else None

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
            timestamp=_deliverable_timestamp(d),
        )
        for d in top_items
    ]

    # 8. Executive Summary Generation
    month_name = datetime(target_year, target_month, 1).strftime("%B %Y")
    audience_str = f" across an audience of {total_audience} verified followers" if total_audience > 0 else ""
    interactions_str = f", generating {total_social_interactions:,} audience interactions" if total_social_interactions > 0 else ""
    roi_str = f" yielding a {roi_multiplier}x Return on Investment (₹{total_earned_media_value:,.0f} EMV vs ₹{monthly_retainer_fee:,.0f} retainer)" if is_retainer_configured else ""

    if deliverables_delivered == 0:
        executive_summary = (
            f"For {month_name}, retainer deliverables for {client.business_name} are currently in creative development. "
            f"Target monthly scope is {total_scope_quota} assets{audience_str}."
        )
    else:
        executive_summary = (
            f"For {month_name}, the agency delivered {deliverables_delivered} approved assets for {client.business_name} "
            f"({deliverables_published} published live), achieving a {quota_rate}% contract scope fulfillment rate. "
            f"Tracked {total_views:,} impressions{audience_str}{interactions_str}{roi_str}."
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
        total_likes=blended_likes,
        total_comments=blended_comments,
        avg_engagement_rate=engagement_rate,
        top_deliverables=top_deliverables,
        executive_summary=executive_summary,
        instagram_profile=ig_profile_out,
        facebook_profile=fb_profile_out,
        live_meta_posts=live_meta_posts_out,
        roi_metrics=roi_metrics,
        format_distribution=format_distribution,
        engagement_rate_metrics=engagement_metrics,
        previous_month_views=prev_views,
        previous_month_engagements=prev_engagements,
        previous_month_delivered=prev_delivered,
        views_delta_pct=views_delta_pct,
        engagements_delta_pct=engagements_delta_pct,
        delivered_delta_pct=delivered_delta_pct,
        is_retainer_configured=is_retainer_configured,
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
            media_url_snapshot=get_effective_media_url(latest_version.storage_key),
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

