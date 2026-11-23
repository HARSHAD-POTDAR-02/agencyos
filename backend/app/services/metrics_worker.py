from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import settings
from app.core.websockets import AgencyWSEvent, ws_manager
from app.models.client import Client
from app.models.client_social_account import ClientSocialAccount
from app.models.deliverable import Deliverable
from app.services.engagement_service import sync_client_social_engagement
from app.services.meta_publisher import fetch_live_meta_telemetry

logger = logging.getLogger(__name__)


async def sync_account_metrics(account: ClientSocialAccount, db: AsyncSession) -> dict[str, Any]:
    """
    Syncs live metrics (views, reach, likes, shares, comments) from Meta Graph API
    for an individual client social account and updates corresponding deliverables.
    """
    if account.platform != "instagram" or not account.instagram_business_id:
        return {"updated_posts": 0}

    # Fetch client agency_id
    client_res = await db.execute(select(Client).where(Client.id == account.client_id))
    client = client_res.scalar_one_or_none()
    if not client:
        return {"updated_posts": 0}

    agency_id = client.agency_id
    updated_posts = 0

    try:
        telemetry = await fetch_live_meta_telemetry(
            access_token=account.access_token,
            instagram_business_id=account.instagram_business_id,
        )
        posts = telemetry.get("posts", [])

        for post in posts:
            post_id = str(post.get("id") or "")
            if not post_id:
                continue

            deliv_res = await db.execute(
                select(Deliverable).where(Deliverable.external_post_id == post_id)
            )
            deliv = deliv_res.scalar_one_or_none()
            if deliv:
                # Update metrics
                deliv.views_count = int(post.get("views") or post.get("video_views") or deliv.views_count or 0)
                deliv.likes_count = int(post.get("likes_count") or deliv.likes_count or 0)
                deliv.comments_count = int(post.get("comments_count") or deliv.comments_count or 0)
                if post.get("shares_count") is not None:
                    deliv.shares_count = int(post.get("shares_count"))
                elif post.get("shares") is not None:
                    deliv.shares_count = int(post.get("shares"))
                updated_posts += 1

        # Also pull engagement comments as backup sync
        sync_res = await sync_client_social_engagement(agency_id, account.client_id, db)
        comments_synced = sync_res.get("comments_synced", 0)

        await db.commit()

        if updated_posts > 0 or comments_synced > 0:
            await ws_manager.broadcast_to_agency(
                agency_id=agency_id,
                event=AgencyWSEvent.ENGAGEMENT_ACTIVITY,
                data={
                    "type": "metrics_polled",
                    "updated_posts": updated_posts,
                    "comments_synced": comments_synced,
                    "client_id": str(account.client_id),
                    "synced_at": datetime.now(timezone.utc).isoformat(),
                },
            )

        return {"updated_posts": updated_posts, "comments_synced": comments_synced}

    except Exception as err:
        logger.warning(
            "Metrics poller failed for account %s (client %s): %s",
            account.account_handle or account.id,
            account.client_id,
            err,
        )
        return {"updated_posts": 0, "error": str(err)}


async def run_social_metrics_worker(
    session_factory: async_sessionmaker[AsyncSession],
    stop_event: asyncio.Event,
    interval_seconds: int | None = None,
) -> None:
    """
    Background worker that periodically polls Meta Graph API for video views, reach,
    shares, and impressions on all published reels/posts.
    """
    poll_interval = interval_seconds or (settings.METRICS_SYNC_INTERVAL_MINUTES * 60)
    logger.info("Starting Social Metrics Worker (poll interval: %ds)...", poll_interval)

    # Initial brief pause so application startup finishes cleanly
    try:
        await asyncio.sleep(10.0)
    except asyncio.CancelledError:
        return

    while not stop_event.is_set():
        try:
            async with session_factory() as db:
                stmt = select(ClientSocialAccount).where(ClientSocialAccount.is_active == True)
                accounts_res = await db.execute(stmt)
                accounts = accounts_res.scalars().all()

                logger.debug("Social Metrics Worker scanning %d active account(s)...", len(accounts))
                for account in accounts:
                    if stop_event.is_set():
                        break
                    await sync_account_metrics(account, db)

        except asyncio.CancelledError:
            logger.info("Social Metrics Worker received cancellation request.")
            break
        except Exception as e:
            logger.error("Unexpected error in Social Metrics Worker loop: %s", e)

        # Sleep boundedly in 5-second intervals to promptly observe stop_event
        sleep_elapsed = 0
        while sleep_elapsed < poll_interval and not stop_event.is_set():
            try:
                await asyncio.sleep(5.0)
                sleep_elapsed += 5
            except asyncio.CancelledError:
                break

    logger.info("Social Metrics Worker terminated cleanly.")
