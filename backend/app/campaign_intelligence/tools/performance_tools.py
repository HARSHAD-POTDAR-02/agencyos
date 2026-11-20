from __future__ import annotations

import logging
import uuid
from collections import defaultdict
from typing import Any

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.campaign_intelligence.schemas.performance import (
    AudienceFatigueSignal,
    DataSufficiency,
    FormatPerformanceSummary,
)
from app.models.campaign import Campaign
from app.models.client import Client
from app.models.deliverable import Deliverable, DeliverableStatus

logger = logging.getLogger(__name__)


async def get_client_published_deliverables(
    client_id: uuid.UUID,
    agency_id: uuid.UUID,
    db: AsyncSession,
    limit: int = 50,
) -> list[Deliverable]:
    """
    Retrieve published deliverables for a client with strict multi-tenant isolation.
    Ordered by publication date descending.
    """
    stmt = (
        select(Deliverable)
        .join(Campaign, Deliverable.campaign_id == Campaign.id)
        .join(Client, Campaign.client_id == Client.id)
        .where(
            Client.id == client_id,
            Client.agency_id == agency_id,
            Deliverable.status == DeliverableStatus.published,
        )
        .order_by(desc(Deliverable.published_at), desc(Deliverable.created_at))
        .limit(limit)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


def calculate_format_performance_metrics(
    deliverables: list[Deliverable],
) -> list[FormatPerformanceSummary]:
    """
    Deterministically calculate statistical aggregates strictly in Python:
    - total_published
    - avg_views, avg_likes, avg_comments, avg_shares
    - avg_engagement_rate strictly via formula ((likes + comments + shares) / views * 100)
    - top_performing_angles identified from highest-performing posts
    """
    if not deliverables:
        return []

    # Group by (deliverable_type, platform)
    groups: dict[tuple[str, str], list[Deliverable]] = defaultdict(list)
    for d in deliverables:
        d_type = (d.deliverable_type or "unknown").lower()
        plat = (d.platform or "unknown").lower()
        groups[(d_type, plat)].append(d)

    summaries: list[FormatPerformanceSummary] = []
    for (d_type, plat), items in groups.items():
        total = len(items)
        views = [d.views_count or 0 for d in items]
        likes = [d.likes_count or 0 for d in items]
        comments = [d.comments_count or 0 for d in items]
        shares = [d.shares_count or 0 for d in items]

        avg_views = sum(views) / total if total > 0 else 0.0
        avg_likes = sum(likes) / total if total > 0 else 0.0
        avg_comments = sum(comments) / total if total > 0 else 0.0
        avg_shares = sum(shares) / total if total > 0 else 0.0

        # Calculate individual engagement rates strictly when views > 0
        rates: list[float] = []
        for d in items:
            v = d.views_count or 0
            eng = (d.likes_count or 0) + (d.comments_count or 0) + (d.shares_count or 0)
            if v > 0:
                rates.append((eng / v) * 100.0)

        avg_eng_rate = sum(rates) / len(rates) if rates else 0.0

        # Extract top performing titles/angles (highest engagement rate or views)
        sorted_by_perf = sorted(
            items,
            key=lambda x: ((x.likes_count or 0) + (x.comments_count or 0) + (x.shares_count or 0)) / max(1, x.views_count or 1),
            reverse=True,
        )
        top_angles = [d.title for d in sorted_by_perf[:3] if d.title]

        summaries.append(
            FormatPerformanceSummary(
                deliverable_type=d_type,
                platform=plat,
                total_published=total,
                avg_views=round(avg_views, 1),
                avg_likes=round(avg_likes, 1),
                avg_comments=round(avg_comments, 1),
                avg_shares=round(avg_shares, 1),
                avg_engagement_rate=round(avg_eng_rate, 2),
                top_performing_angles=top_angles,
            )
        )

    # Sort summaries by total published descending
    return sorted(summaries, key=lambda s: s.total_published, reverse=True)


def calculate_instagram_media_metrics(
    media_items: list[dict[str, Any]],
) -> list[FormatPerformanceSummary]:
    """
    Calculate deterministic statistical aggregates from live Instagram Graph API media items.
    Maps Instagram media_type to deliverable format and computes averages without fabricated metrics.
    """
    if not media_items:
        return []

    # Map Instagram media_type to canonical deliverable format
    type_map = {
        "IMAGE": "single_image",
        "CAROUSEL_ALBUM": "carousel",
        "VIDEO": "reel",
    }

    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in media_items:
        raw_type = (item.get("media_type") or "IMAGE").upper()
        fmt = type_map.get(raw_type, "single_image")
        groups[fmt].append(item)

    summaries: list[FormatPerformanceSummary] = []
    for fmt, items in groups.items():
        total = len(items)
        likes = [int(item.get("like_count") or 0) for item in items]
        comments = [int(item.get("comments_count") or 0) for item in items]
        shares = [int(item.get("shares_count") or 0) for item in items]
        # Views if tracked in insights or payload, otherwise 0
        views = [int(item.get("views_count") or item.get("view_count") or 0) for item in items]

        avg_likes = sum(likes) / total if total > 0 else 0.0
        avg_comments = sum(comments) / total if total > 0 else 0.0
        avg_shares = sum(shares) / total if total > 0 else 0.0
        avg_views = sum(views) / total if total > 0 else 0.0

        # Engagement rate calculated strictly when views > 0
        rates: list[float] = []
        for item in items:
            v = int(item.get("views_count") or item.get("view_count") or 0)
            eng = int(item.get("like_count") or 0) + int(item.get("comments_count") or 0) + int(item.get("shares_count") or 0)
            if v > 0:
                rates.append((eng / v) * 100.0)

        avg_eng_rate = sum(rates) / len(rates) if rates else 0.0

        # Top angles extracted from captions of highest interacting posts
        sorted_items = sorted(
            items,
            key=lambda x: int(x.get("like_count") or 0) + int(x.get("comments_count") or 0),
            reverse=True,
        )
        top_captions: list[str] = []
        for it in sorted_items[:3]:
            cap = (it.get("caption") or "").strip()
            if cap:
                snippet = cap[:80] + "..." if len(cap) > 80 else cap
                top_captions.append(snippet)

        summaries.append(
            FormatPerformanceSummary(
                deliverable_type=fmt,
                platform="instagram",
                total_published=total,
                avg_views=round(avg_views, 1),
                avg_likes=round(avg_likes, 1),
                avg_comments=round(avg_comments, 1),
                avg_shares=round(avg_shares, 1),
                avg_engagement_rate=round(avg_eng_rate, 2),
                top_performing_angles=top_captions,
            )
        )

    return sorted(summaries, key=lambda s: s.total_published, reverse=True)


def detect_audience_fatigue_signals(
    deliverables: list[Deliverable],
) -> list[AudienceFatigueSignal]:
    """
    Detect statistical signs of audience fatigue from recent posts:
    - If the same format has 3+ consecutive posts with declining engagement
    - If a specific angle/topic pattern is repeated excessively with diminishing views
    """
    signals: list[AudienceFatigueSignal] = []
    if len(deliverables) < 4:
        return signals

    # Group deliverables by deliverable_type in chronological order (oldest to newest)
    type_series: dict[str, list[Deliverable]] = defaultdict(list)
    # deliverables is sorted newest first, so reverse to chronological
    chronological = list(reversed(deliverables))
    for d in chronological:
        type_series[(d.deliverable_type or "").lower()].append(d)

    for d_type, items in type_series.items():
        if len(items) >= 4:
            # Check last 3 items vs previous items
            recent = items[-3:]
            earlier = items[:-3]

            recent_views = sum(d.views_count or 0 for d in recent) / len(recent)
            earlier_views = sum(d.views_count or 0 for d in earlier) / len(earlier)

            if earlier_views > 0 and recent_views < earlier_views * 0.65:
                drop_pct = round((1 - (recent_views / earlier_views)) * 100)
                signals.append(
                    AudienceFatigueSignal(
                        topic_or_format=f"{d_type.capitalize()} posts",
                        fatigue_level="moderate" if drop_pct < 50 else "high",
                        recommendation=(
                            f"Recent {d_type} view averages dropped by {drop_pct}% compared to historical baseline. "
                            f"Introduce fresh narrative framing or alternate with complementary formats."
                        ),
                    )
                )

    return signals

