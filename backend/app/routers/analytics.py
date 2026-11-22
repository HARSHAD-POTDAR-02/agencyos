from __future__ import annotations

import logging
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies import require_agency_member
from app.models.historical_post import ClientHistoricalPost
from app.models.user import Membership
from app.schemas.analytics import (
    BackfillRequest,
    BackfillResponse,
    ClientAnalyticsBenchmarksOut,
    HistoricalPostOut,
)
from app.services.analytics_engine import (
    compute_client_benchmarks,
    ingest_client_social_history,
)
from app.services.tenant_service import get_client_for_agency

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/agencies/{agency_id}/clients/{client_id}/analytics",
    tags=["analytics"],
)


@router.post("/backfill", response_model=BackfillResponse)
async def trigger_historical_backfill(
    agency_id: uuid.UUID,
    client_id: uuid.UUID,
    payload: BackfillRequest | None = None,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> BackfillResponse:
    """
    Ingests past 90-180 days (up to 100+ posts) from connected Meta accounts
    (Instagram Business Profile & Facebook Page), computes baseline metrics,
    identifies top 10% winning outliers, and feeds patterns to Campaign Studio.
    """
    await get_client_for_agency(client_id, agency_id, db)
    req = payload or BackfillRequest()
    try:
        summary = await ingest_client_social_history(
            db=db,
            client_id=client_id,
            limit=req.limit,
            days=req.days,
        )
        return BackfillResponse(
            success=summary.get("success", True),
            client_id=client_id,
            posts_ingested=summary.get("posts_ingested", 0),
            posts_updated=summary.get("posts_updated", 0),
            total_historical_posts=summary.get("total_historical_posts", 0),
            top_outliers_identified=summary.get("top_outliers_identified", 0),
            dominant_format=summary.get("dominant_format", "UNKNOWN"),
            baseline_engagement_rate=summary.get("baseline_engagement_rate", 0.0),
            message=summary.get("message", "Ingestion completed successfully."),
        )
    except Exception as e:
        logger.exception(f"Error during social backfill for client {client_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to ingest historical posts: {str(e)}",
        )


@router.get("/benchmarks", response_model=ClientAnalyticsBenchmarksOut)
async def get_client_analytics_benchmarks(
    agency_id: uuid.UUID,
    client_id: uuid.UUID,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> ClientAnalyticsBenchmarksOut:
    """
    Returns comprehensive benchmark metrics, format win-rates, top 10% winning outlier
    posts, and extracted creative angles computed from the client's historical posts.
    """
    await get_client_for_agency(client_id, agency_id, db)
    return await compute_client_benchmarks(client_id=client_id, db=db)


@router.get("/historical-posts", response_model=list[HistoricalPostOut])
async def list_client_historical_posts(
    agency_id: uuid.UUID,
    client_id: uuid.UUID,
    format: str | None = Query(None, description="Filter by deliverable format: reel, carousel, single_image, status"),
    platform: str | None = Query(None, description="Filter by platform: instagram, facebook"),
    is_outlier: bool | None = Query(None, description="Filter only top 10% outlier posts"),
    sort_by: str = Query("published_at", description="Sort by: published_at or engagement_rate"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> list[HistoricalPostOut]:
    """
    Lists ingested historical posts for this client with filtering by format,
    platform, outlier status, and sorting.
    """
    await get_client_for_agency(client_id, agency_id, db)
    stmt = select(ClientHistoricalPost).where(ClientHistoricalPost.client_id == client_id)

    if format:
        stmt = stmt.where(ClientHistoricalPost.deliverable_format == format.lower())
    if platform:
        stmt = stmt.where(ClientHistoricalPost.platform == platform.lower())
    if is_outlier is not None:
        stmt = stmt.where(ClientHistoricalPost.is_outlier == is_outlier)

    if sort_by == "engagement_rate":
        stmt = stmt.order_by(desc(ClientHistoricalPost.engagement_rate), desc(ClientHistoricalPost.published_at))
    else:
        stmt = stmt.order_by(desc(ClientHistoricalPost.published_at).nullslast())

    stmt = stmt.offset(offset).limit(limit)
    res = await db.execute(stmt)
    posts = list(res.scalars().all())
    return [HistoricalPostOut.model_validate(p) for p in posts]
