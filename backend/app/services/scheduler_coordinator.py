from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Callable, Coroutine, Protocol

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.publication_job import JobStatus, PublicationJob
from app.services.lease_manager import (
    claim_due_jobs,
    find_expired_leases,
)

logger = logging.getLogger(__name__)

MAX_SLEEP_SECONDS = 300  # 5 minutes bounded wait


class WakeupSignal(Protocol):
    """Protocol for advisory wake-up signals."""
    async def notify(self, deliverable_id: uuid.UUID | None = None) -> None: ...
    async def wait(self, timeout: float) -> bool: ...


class AsyncioWakeupSignal:
    """In-process advisory wake-up signal using asyncio.Event."""

    def __init__(self) -> None:
        self._event = asyncio.Event()

    async def notify(self, deliverable_id: uuid.UUID | None = None) -> None:
        self._event.set()

    async def wait(self, timeout: float) -> bool:
        try:
            await asyncio.wait_for(self._event.wait(), timeout=timeout)
            self._event.clear()
            return True
        except asyncio.TimeoutError:
            return False


class SchedulerCoordinator:
    """
    Coordinator responsible for:
    1. Calculating bounded next-due wake-up times (max 300s).
    2. Enforcing bounded worker concurrency (max concurrent tasks).
    3. Atomically claiming due jobs up to available capacity.
    4. Sweeping and reporting expired worker leases.
    """

    def __init__(
        self,
        worker_id: str | None = None,
        max_concurrency: int = 5,
        wakeup_signal: WakeupSignal | None = None,
    ) -> None:
        self.worker_id = worker_id or f"worker-{uuid.uuid4().hex[:8]}"
        self.max_concurrency = max_concurrency
        self.wakeup_signal = wakeup_signal or AsyncioWakeupSignal()
        self.active_tasks: dict[uuid.UUID, asyncio.Task] = {}
        self.is_running = False

    @property
    def available_capacity(self) -> int:
        """Remaining worker execution capacity."""
        # Clean up finished tasks from tracking
        finished = [jid for jid, t in self.active_tasks.items() if t.done()]
        for jid in finished:
            del self.active_tasks[jid]
        return max(0, self.max_concurrency - len(self.active_tasks))

    async def calculate_next_sleep_seconds(
        self,
        db: AsyncSession,
        max_sleep: int = MAX_SLEEP_SECONDS,
    ) -> float:
        """
        Calculates the sleep duration until the next scheduled publication job.
        Always bounded by `max_sleep` (default 300 seconds).
        """
        stmt = (
            select(func.min(PublicationJob.next_attempt_at))
            .where(PublicationJob.status == JobStatus.scheduled)
        )
        result = await db.execute(stmt)
        min_next = result.scalar()

        if min_next is None:
            return float(max_sleep)

        # Ensure timezone-aware UTC comparison
        now = datetime.now(timezone.utc)
        if min_next.tzinfo is None:
            min_next = min_next.replace(tzinfo=timezone.utc)

        delay = (min_next - now).total_seconds()
        return max(0.0, min(delay, float(max_sleep)))

    async def claim_next_batch(
        self,
        db: AsyncSession,
        lease_duration_seconds: int = 180,
    ) -> list[tuple[uuid.UUID, uuid.UUID]]:
        """
        Claims due jobs up to available worker capacity.
        Returns empty list if capacity is 0.
        """
        capacity = self.available_capacity
        if capacity <= 0:
            logger.debug("Scheduler at max capacity; skipping claim this cycle.")
            return []

        return await claim_due_jobs(
            db=db,
            worker_id=self.worker_id,
            batch_size=capacity,
            lease_duration_seconds=lease_duration_seconds,
        )

    def register_task(self, job_id: uuid.UUID, task: asyncio.Task) -> None:
        """Registers an active execution task against worker capacity."""
        self.active_tasks[job_id] = task

    async def check_crashed_workers(self, db: AsyncSession) -> list[uuid.UUID]:
        """
        Identifies publication jobs whose lease has expired.
        Does not automatically requeue; returns IDs for reconciliation.
        """
        expired = await find_expired_leases(db)
        if expired:
            logger.warning(
                f"Found {len(expired)} jobs with expired leases: {[j.id for j in expired]}"
            )
        return [j.id for j in expired]


# Global coordinator instance for the application
global_coordinator = SchedulerCoordinator(max_concurrency=5)
global_wakeup_signal = global_coordinator.wakeup_signal


async def run_scheduler_worker(
    session_factory: Callable[[], AsyncSession],
    coordinator: SchedulerCoordinator | None = None,
    stop_event: asyncio.Event | None = None,
) -> None:
    """
    Main background scheduler loop:
    1. Bounded wait: min(time_to_next_due, MAX_SLEEP_SECONDS) or wake-up signal.
    2. Sweeps and checks expired worker leases.
    3. Claims due jobs up to available capacity.
    4. Spawns bounded execution tasks calling execute_publication_job.
    """
    coord = coordinator or global_coordinator
    coord.is_running = True
    logger.info(f"AgencyOS Scheduler Worker started [{coord.worker_id}] with max concurrency {coord.max_concurrency}.")

    try:
        while coord.is_running and (stop_event is None or not stop_event.is_set()):
            async with session_factory() as db:
                # 1. Sweep expired leases (crashed workers)
                try:
                    await coord.check_crashed_workers(db)
                except Exception as e:
                    logger.error(f"Error checking crashed workers: {e}")

                # 2. Claim due jobs up to available capacity
                try:
                    claimed_jobs = await coord.claim_next_batch(db)
                    for job_id, claim_token in claimed_jobs:
                        from app.services.publisher_executor import execute_publication_job

                        async def _task_wrapper(jid: uuid.UUID, tok: uuid.UUID):
                            async with session_factory() as task_db:
                                try:
                                    await execute_publication_job(task_db, jid, tok)
                                except Exception as exc:
                                    logger.error(f"Error executing publication job {jid}: {exc}")

                        t = asyncio.create_task(_task_wrapper(job_id, claim_token))
                        coord.register_task(job_id, t)
                except Exception as e:
                    logger.error(f"Error claiming due jobs: {e}")

                # 3. Calculate next sleep duration
                try:
                    sleep_secs = await coord.calculate_next_sleep_seconds(db, max_sleep=MAX_SLEEP_SECONDS)
                except Exception as e:
                    logger.error(f"Error calculating next sleep: {e}")
                    sleep_secs = 60.0

            # 4. Bounded wait on wakeup signal or timer
            if sleep_secs > 0:
                await coord.wakeup_signal.wait(timeout=sleep_secs)
            else:
                await asyncio.sleep(0.5)

    except asyncio.CancelledError:
        logger.info("Scheduler worker task was cancelled.")
    finally:
        coord.is_running = False
        logger.info("Scheduler worker stopped.")

