from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Sequence

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.deliverable import Deliverable, DeliverableStatus
from app.models.publication_job import JobStatus, PublicationJob

logger = logging.getLogger(__name__)


class StaleWorkerError(Exception):
    """Raised when a worker attempts to update a job after losing its claim lease."""
    pass


async def claim_due_jobs(
    db: AsyncSession,
    worker_id: str,
    batch_size: int = 10,
    lease_duration_seconds: int = 180,
) -> list[tuple[uuid.UUID, uuid.UUID]]:
    """
    Atomically claim up to `batch_size` scheduled publication jobs that are due.
    Uses PostgreSQL FOR UPDATE SKIP LOCKED if supported by the dialect;
    otherwise uses single-row atomic conditional updates.

    Returns a list of tuples: (job_id, claim_token).
    """
    if batch_size <= 0:
        return []

    now = datetime.now(timezone.utc)
    claimed: list[tuple[uuid.UUID, uuid.UUID]] = []
    bind = db.bind
    is_postgres = bind is not None and "postgresql" in bind.dialect.name

    if is_postgres:
        # PostgreSQL: atomic SELECT ... FOR UPDATE SKIP LOCKED
        stmt = (
            select(PublicationJob)
            .where(
                PublicationJob.status == JobStatus.scheduled,
                PublicationJob.next_attempt_at <= now,
            )
            .order_by(PublicationJob.next_attempt_at.asc())
            .limit(batch_size)
            .with_for_update(skip_locked=True)
        )
        result = await db.execute(stmt)
        jobs = list(result.scalars().all())

        deliverable_ids: set[uuid.UUID] = set()
        for job in jobs:
            claim_token = uuid.uuid4()
            job.status = JobStatus.publishing
            job.claimed_by = worker_id
            job.claim_token = claim_token
            job.lease_expires_at = now + timedelta(seconds=lease_duration_seconds)
            job.heartbeat_at = now
            job.last_attempt_at = now
            job.attempts_count = (job.attempts_count or 0) + 1
            claimed.append((job.id, claim_token))
            deliverable_ids.add(job.deliverable_id)

        if deliverable_ids:
            await db.execute(
                update(Deliverable)
                .where(Deliverable.id.in_(list(deliverable_ids)))
                .values(status=DeliverableStatus.publishing)
            )

        await db.commit()
        return claimed

    # Fallback for SQLite / other dialects:
    # Query candidates and atomically update each one
    candidate_stmt = (
        select(PublicationJob.id, PublicationJob.deliverable_id)
        .where(
            PublicationJob.status == JobStatus.scheduled,
            PublicationJob.next_attempt_at <= now,
        )
        .order_by(PublicationJob.next_attempt_at.asc())
        .limit(batch_size)
    )
    res = await db.execute(candidate_stmt)
    candidates = res.all()

    deliverable_ids = set()
    for job_id, deliv_id in candidates:
        claim_token = uuid.uuid4()
        claim_stmt = (
            update(PublicationJob)
            .where(
                PublicationJob.id == job_id,
                PublicationJob.status == JobStatus.scheduled,
                PublicationJob.next_attempt_at <= now,
            )
            .values(
                status=JobStatus.publishing,
                claimed_by=worker_id,
                claim_token=claim_token,
                lease_expires_at=now + timedelta(seconds=lease_duration_seconds),
                heartbeat_at=now,
                last_attempt_at=now,
                attempts_count=PublicationJob.attempts_count + 1,
            )
        )
        claim_res = await db.execute(claim_stmt)
        if claim_res.rowcount > 0:
            claimed.append((job_id, claim_token))
            deliverable_ids.add(deliv_id)

    if deliverable_ids:
        await db.execute(
            update(Deliverable)
            .where(Deliverable.id.in_(list(deliverable_ids)))
            .values(status=DeliverableStatus.publishing)
        )

    await db.commit()
    return claimed


async def renew_lease(
    db: AsyncSession,
    job_id: uuid.UUID,
    claim_token: uuid.UUID,
    lease_duration_seconds: int = 180,
) -> bool:
    """
    Heartbeat renewal: extends the active lease if and only if the worker
    still owns the valid claim token and the job is currently publishing.

    Returns True if lease was successfully extended; False if lost ownership.
    """
    now = datetime.now(timezone.utc)
    stmt = (
        update(PublicationJob)
        .where(
            PublicationJob.id == job_id,
            PublicationJob.claim_token == claim_token,
            PublicationJob.status == JobStatus.publishing,
        )
        .values(
            heartbeat_at=now,
            lease_expires_at=now + timedelta(seconds=lease_duration_seconds),
        )
    )
    result = await db.execute(stmt)
    await db.commit()

    if result.rowcount == 0:
        logger.warning(
            f"Worker heartbeat failed for job {job_id} with token {claim_token}. "
            "Lease was expired or stolen."
        )
        return False

    return True


async def guarded_update_job(
    db: AsyncSession,
    job_id: uuid.UUID,
    claim_token: uuid.UUID,
    **values,
) -> PublicationJob:
    """
    Fencing mechanism: updates a publication job only if the worker's
    claim token still matches the database record.

    Raises StaleWorkerError if 0 rows were updated.
    Automatically recalculates the parent Deliverable aggregate status.
    """
    now = datetime.now(timezone.utc)
    values["updated_at"] = now

    stmt = (
        update(PublicationJob)
        .where(
            PublicationJob.id == job_id,
            PublicationJob.claim_token == claim_token,
        )
        .values(**values)
    )
    result = await db.execute(stmt)
    if result.rowcount == 0:
        raise StaleWorkerError(
            f"Guarded write rejected for job {job_id}: worker lost claim token {claim_token}."
        )

    # Fetch updated job to synchronize parent deliverable
    job_res = await db.execute(select(PublicationJob).where(PublicationJob.id == job_id))
    job = job_res.scalar_one()

    await reconcile_deliverable_status(db, job.deliverable_id)
    await db.commit()
    return job


async def reconcile_deliverable_status(
    db: AsyncSession,
    deliverable_id: uuid.UUID,
) -> DeliverableStatus:
    """
    Deterministically computes the parent Deliverable's aggregate status
    and publishing metadata based on the state of its publication jobs.

    Scopes evaluation to the latest publication_operation_id so historical
    failed or cancelled jobs from previous schedules do not contaminate a
    successful re-schedule.
    """
    jobs_res = await db.execute(
        select(PublicationJob)
        .where(PublicationJob.deliverable_id == deliverable_id)
        .order_by(PublicationJob.created_at.desc())
    )
    jobs = list(jobs_res.scalars().all())

    if not jobs:
        return DeliverableStatus.approved

    # 1. Determine active jobs by taking the most recent non-cancelled job for each platform
    non_cancelled = [j for j in jobs if j.status != JobStatus.cancelled]
    if not non_cancelled:
        new_status = DeliverableStatus.approved
        active_jobs = []
    else:
        latest_per_platform: dict[str, PublicationJob] = {}
        for j in non_cancelled:
            if j.platform not in latest_per_platform:
                latest_per_platform[j.platform] = j
        active_jobs = list(latest_per_platform.values())

    if not active_jobs:
        new_status = DeliverableStatus.approved
    else:
        statuses = [j.status for j in active_jobs]

        if any(s in (JobStatus.publishing, JobStatus.cancellation_pending) for s in statuses):
            new_status = DeliverableStatus.publishing
        elif any(s in (JobStatus.scheduled, JobStatus.pending) for s in statuses):
            # If some jobs are published/failed while others are still scheduled/pending,
            # the batch execution is still in progress:
            if any(s in (JobStatus.published, JobStatus.failed, JobStatus.needs_reconnection) for s in statuses):
                new_status = DeliverableStatus.publishing
            else:
                new_status = DeliverableStatus.scheduled
        elif all(s == JobStatus.published for s in statuses):
            new_status = DeliverableStatus.published
        elif any(s == JobStatus.published for s in statuses):
            # Mixed terminal outcome: at least one published, others failed/needs_reconnection
            new_status = DeliverableStatus.partially_published
        elif all(s == JobStatus.failed for s in statuses):
            new_status = DeliverableStatus.failed
        elif any(s == JobStatus.needs_reconnection for s in statuses):
            new_status = DeliverableStatus.needs_reconnection
        elif any(s == JobStatus.ambiguous for s in statuses):
            new_status = DeliverableStatus.ambiguous
        else:
            new_status = DeliverableStatus.failed

    # 2. Extract published metadata from successful jobs in the active operation
    published_jobs = [j for j in active_jobs if j.status == JobStatus.published]
    update_values: dict[str, Any] = {"status": new_status}

    if published_jobs:
        ig_job = next((j for j in published_jobs if j.platform == "instagram"), None)
        fb_job = next((j for j in published_jobs if j.platform == "facebook"), None)

        if ig_job and fb_job:
            update_values["external_post_id"] = f"ig:{ig_job.external_post_id},fb:{fb_job.external_post_id}"
            update_values["live_post_url"] = ig_job.live_post_url or fb_job.live_post_url
            update_values["publishing_platform"] = "both"
        elif ig_job:
            update_values["external_post_id"] = str(ig_job.external_post_id)
            update_values["live_post_url"] = ig_job.live_post_url
            update_values["publishing_platform"] = "instagram"
        elif fb_job:
            update_values["external_post_id"] = str(fb_job.external_post_id)
            update_values["live_post_url"] = fb_job.live_post_url
            update_values["publishing_platform"] = "facebook"
        else:
            update_values["external_post_id"] = str(published_jobs[0].external_post_id or "")
            update_values["live_post_url"] = published_jobs[0].live_post_url
            update_values["publishing_platform"] = published_jobs[0].platform

        # Set published_at timestamp if not already set
        deliv_res = await db.execute(select(Deliverable).where(Deliverable.id == deliverable_id))
        deliv = deliv_res.scalar_one_or_none()
        if deliv and not deliv.published_at:
            update_values["published_at"] = datetime.now(timezone.utc)

    elif new_status == DeliverableStatus.approved:
        update_values["external_post_id"] = None
        update_values["live_post_url"] = None
        update_values["published_at"] = None
        update_values["publishing_platform"] = None

    await db.execute(
        update(Deliverable)
        .where(Deliverable.id == deliverable_id)
        .values(**update_values)
    )
    return new_status


async def find_expired_leases(db: AsyncSession) -> Sequence[PublicationJob]:
    """
    Finds all jobs currently in 'publishing' whose lease_expires_at has passed.
    These represent crashed or unresponsive workers.
    """
    now = datetime.now(timezone.utc)
    stmt = (
        select(PublicationJob)
        .where(
            PublicationJob.status == JobStatus.publishing,
            PublicationJob.lease_expires_at <= now,
        )
        .order_by(PublicationJob.lease_expires_at.asc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()
