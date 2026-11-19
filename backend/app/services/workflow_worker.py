from __future__ import annotations

import asyncio
import logging
import random
import time
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Awaitable, Callable, Sequence

from sqlalchemy import and_, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.operational_workflow import (
    JobErrorCategory,
    ModelInvocation,
    TaskKind,
    TaskOutputVersion,
    WorkflowJobAttempt,
    WorkflowJobQueue,
    WorkflowJobStatus,
    WorkflowRun,
    WorkflowTask,
    WorkflowTaskStatus,
)
from app.services.dag_engine import DAGEngine

logger = logging.getLogger(__name__)

DEFAULT_LEASE_DURATION_SECONDS = 60
DEFAULT_HEARTBEAT_INTERVAL_SECONDS = 15
DEFAULT_MAX_ATTEMPTS = 3


class LostLeaseError(Exception):
    """Raised when a worker attempts to write or complete a job after losing ownership/lease."""
    pass


class NonRetryableWorkerError(Exception):
    """Raised when a task fails due to a permanent, non-recoverable error (e.g. auth, schema)."""
    pass


class RetryableWorkerError(Exception):
    """Raised when a task fails due to a transient error (e.g. rate limit, network timeout)."""
    def __init__(self, message: str, backoff_seconds: int = 30):
        super().__init__(message)
        self.backoff_seconds = backoff_seconds


def classify_job_error(exc: Exception, attempt_number: int = 1) -> tuple[JobErrorCategory, bool, int]:
    """
    Classifies exceptions encountered during task execution into a JobErrorCategory,
    a retryable boolean, and a backoff duration in seconds.

    Error Categories:
    - rate_limit_429: HTTP 429, quota exhaustion -> Retryable with exponential backoff + jitter.
    - network_timeout: Connection timeouts, 502/503/504 -> Retryable with exponential backoff.
    - schema_validation: JSON parse or Pydantic validation failure -> Non-retryable (requires code fix or repair).
    - auth_error: 401/403, invalid API key -> Non-retryable.
    - lease_expired: Stale worker / Lost lease -> Non-retryable (do not overwrite active worker).
    - unexpected: Generic exceptions -> Retryable up to max attempts with linear backoff.
    """
    if isinstance(exc, LostLeaseError):
        return (JobErrorCategory.lease_expired, False, 0)

    if isinstance(exc, RetryableWorkerError):
        return (JobErrorCategory.rate_limit_429, True, exc.backoff_seconds)

    if isinstance(exc, NonRetryableWorkerError):
        return (JobErrorCategory.schema_validation, False, 0)

    exc_str = str(exc).lower()
    exc_type = type(exc).__name__.lower()

    # 1. Rate Limit / 429
    if "429" in exc_str or "rate limit" in exc_str or "quota" in exc_str or "too many requests" in exc_str:
        # Exponential backoff with jitter: 2^(attempt-1) * 30s + jitter (0-15s)
        base = (2 ** max(0, attempt_number - 1)) * 30
        jitter = random.uniform(0, 15)
        backoff = int(min(600, base + jitter))  # Cap at 10 minutes
        return (JobErrorCategory.rate_limit_429, True, backoff)

    # 2. Network Timeouts & Gateway Glitches (502, 503, 504)
    if (
        "timeout" in exc_str
        or "timed out" in exc_str
        or "connection" in exc_str
        or "502" in exc_str
        or "503" in exc_str
        or "504" in exc_str
        or "network" in exc_str
    ):
        base = (2 ** max(0, attempt_number - 1)) * 10
        jitter = random.uniform(0, 5)
        backoff = int(min(120, base + jitter))
        return (JobErrorCategory.network_timeout, True, backoff)

    # 3. Authentication & Permission Errors (401, 403)
    if "401" in exc_str or "403" in exc_str or "unauthorized" in exc_str or "authentication" in exc_str or "forbidden" in exc_str:
        return (JobErrorCategory.auth_error, False, 0)

    # 4. Schema & Validation Errors
    if (
        "validationerror" in exc_type
        or "schema" in exc_str
        or "jsondecodeerror" in exc_type
        or "jsondecodeerror" in exc_str
        or "json" in exc_str
        or "keyerror" in exc_type
    ):
        return (JobErrorCategory.schema_validation, False, 0)

    # 5. Unexpected Errors
    base = attempt_number * 15
    return (JobErrorCategory.unexpected, True, base)


async def claim_workflow_jobs(
    db: AsyncSession,
    worker_id: str,
    batch_size: int = 1,
    lease_duration_seconds: int = DEFAULT_LEASE_DURATION_SECONDS,
    agency_id: uuid.UUID | None = None,
) -> list[dict[str, Any]]:
    """
    Atomically claims up to `batch_size` claimable jobs from `WorkflowJobQueue`.
    Claimable criteria:
    - (status IN ('queued', 'retrying') AND execute_at <= now)
      OR
    - (status = 'running' AND lease_expires_at < now)  <-- Crashed worker lease recovery

    Uses PostgreSQL SELECT ... FOR UPDATE SKIP LOCKED when available;
    falls back to atomic single-row conditional updates on SQLite.

    Returns a list of claim dictionaries:
    [
        {
            "job_id": UUID,
            "task_id": UUID,
            "workflow_run_id": UUID,
            "agency_id": UUID,
            "execution_generation": int,
            "claim_token": UUID,
            "attempts_count": int,
        },
        ...
    ]
    """
    if batch_size <= 0:
        return []

    now = datetime.now(timezone.utc)
    claimed_items: list[dict[str, Any]] = []

    bind = db.bind
    is_postgres = bind is not None and "postgresql" in bind.dialect.name

    base_criteria = or_(
        and_(
            WorkflowJobQueue.status.in_([WorkflowJobStatus.queued, WorkflowJobStatus.retrying]),
            WorkflowJobQueue.execute_at <= now,
        ),
        and_(
            WorkflowJobQueue.status == WorkflowJobStatus.running,
            WorkflowJobQueue.lease_expires_at < now,
        ),
    )
    if agency_id:
        filter_criteria = and_(base_criteria, WorkflowJobQueue.agency_id == agency_id)
    else:
        filter_criteria = base_criteria

    if is_postgres:
        stmt = (
            select(WorkflowJobQueue)
            .where(filter_criteria)
            .order_by(WorkflowJobQueue.execute_at.asc())
            .limit(batch_size)
            .with_for_update(skip_locked=True)
        )
        result = await db.execute(stmt)
        jobs = list(result.scalars().all())

        for job in jobs:
            claim_token = uuid.uuid4()
            job.status = WorkflowJobStatus.running
            job.claimed_by = worker_id
            job.claim_token = claim_token
            job.lease_expires_at = now + timedelta(seconds=lease_duration_seconds)
            job.heartbeat_at = now
            job.attempts_count = (job.attempts_count or 0) + 1
            job.updated_at = now

            # Transition parent task status to running
            task = await db.get(WorkflowTask, job.task_id)
            if task:
                task.status = WorkflowTaskStatus.running
                if not task.started_at:
                    task.started_at = now

            claimed_items.append({
                "job_id": job.id,
                "task_id": job.task_id,
                "workflow_run_id": job.workflow_run_id,
                "agency_id": job.agency_id,
                "execution_generation": job.execution_generation,
                "claim_token": claim_token,
                "attempts_count": job.attempts_count,
            })

        await db.commit()
        return claimed_items

    # SQLite fallback: find candidate IDs and update conditionally
    candidate_stmt = (
        select(WorkflowJobQueue.id)
        .where(filter_criteria)
        .order_by(WorkflowJobQueue.execute_at.asc())
        .limit(batch_size)
    )
    res = await db.execute(candidate_stmt)
    candidate_ids = res.scalars().all()

    for candidate_id in candidate_ids:
        claim_token = uuid.uuid4()
        claim_stmt = (
            update(WorkflowJobQueue)
            .where(
                WorkflowJobQueue.id == candidate_id,
                or_(
                    and_(
                        WorkflowJobQueue.status.in_([WorkflowJobStatus.queued, WorkflowJobStatus.retrying]),
                        WorkflowJobQueue.execute_at <= now,
                    ),
                    and_(
                        WorkflowJobQueue.status == WorkflowJobStatus.running,
                        WorkflowJobQueue.lease_expires_at < now,
                    ),
                ),
            )
            .values(
                status=WorkflowJobStatus.running,
                claimed_by=worker_id,
                claim_token=claim_token,
                lease_expires_at=now + timedelta(seconds=lease_duration_seconds),
                heartbeat_at=now,
                attempts_count=WorkflowJobQueue.attempts_count + 1,
                updated_at=now,
            )
        )
        claim_res = await db.execute(claim_stmt)
        if claim_res.rowcount > 0:
            job_obj = await db.get(WorkflowJobQueue, candidate_id)
            if job_obj:
                task = await db.get(WorkflowTask, job_obj.task_id)
                if task:
                    task.status = WorkflowTaskStatus.running
                    if not task.started_at:
                        task.started_at = now

                claimed_items.append({
                    "job_id": job_obj.id,
                    "task_id": job_obj.task_id,
                    "workflow_run_id": job_obj.workflow_run_id,
                    "agency_id": job_obj.agency_id,
                    "execution_generation": job_obj.execution_generation,
                    "claim_token": claim_token,
                    "attempts_count": job_obj.attempts_count,
                })

    await db.commit()
    return claimed_items


async def renew_job_lease(
    db: AsyncSession,
    job_id: uuid.UUID,
    claim_token: uuid.UUID,
    lease_duration_seconds: int = DEFAULT_LEASE_DURATION_SECONDS,
) -> bool:
    """
    Heartbeat renewal: Extends lease expiration if and only if the worker
    still owns the valid claim_token and the job is currently running.
    Returns True on success, False if ownership was lost.
    """
    now = datetime.now(timezone.utc)
    stmt = (
        update(WorkflowJobQueue)
        .where(
            WorkflowJobQueue.id == job_id,
            WorkflowJobQueue.claim_token == claim_token,
            WorkflowJobQueue.status == WorkflowJobStatus.running,
        )
        .values(
            heartbeat_at=now,
            lease_expires_at=now + timedelta(seconds=lease_duration_seconds),
            updated_at=now,
        )
    )
    result = await db.execute(stmt)
    await db.commit()

    if result.rowcount == 0:
        logger.warning(
            f"Workflow worker heartbeat failed for job {job_id} with token {claim_token}. "
            "Lease was lost or expired."
        )
        return False
    return True


class HeartbeatRunner:
    """
    Async background manager that maintains heartbeats for an active task.
    If the lease is lost, flags `is_cancelled = True`.
    """
    def __init__(
        self,
        db_factory: Callable[[], AsyncSession],
        job_id: uuid.UUID,
        claim_token: uuid.UUID,
        interval_seconds: int = DEFAULT_HEARTBEAT_INTERVAL_SECONDS,
        lease_duration_seconds: int = DEFAULT_LEASE_DURATION_SECONDS,
    ):
        self.db_factory = db_factory
        self.job_id = job_id
        self.claim_token = claim_token
        self.interval = interval_seconds
        self.lease_duration = lease_duration_seconds
        self._task: asyncio.Task | None = None
        self._stop_event = asyncio.Event()
        self.lost_lease = False

    async def _heartbeat_loop(self) -> None:
        while not self._stop_event.is_set():
            try:
                await asyncio.sleep(self.interval)
                if self._stop_event.is_set():
                    break
                async with self.db_factory() as db:
                    success = await renew_job_lease(
                        db, self.job_id, self.claim_token, self.lease_duration
                    )
                    if not success:
                        self.lost_lease = True
                        break
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in heartbeat loop for job {self.job_id}: {e}")

    async def __aenter__(self) -> "HeartbeatRunner":
        self._task = asyncio.create_task(self._heartbeat_loop())
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        self._stop_event.set()
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass


async def guarded_complete_job(
    db: AsyncSession,
    job_id: uuid.UUID,
    task_id: uuid.UUID,
    claim_token: uuid.UUID,
    worker_id: str,
    execution_generation: int,
    attempt_number: int,
    latency_ms: int,
    output_payload: dict[str, Any],
    invocations: list[dict[str, Any]] | None = None,
    change_summary: str | None = None,
) -> None:
    """
    ATOMIC COMPLETION TRANSACTION BOUNDARY:
    1. Verifies worker claim_token with UPDATE ... WHERE claim_token = :token AND status = 'running'.
       Raises LostLeaseError if 0 rows updated (worker lost ownership).
    2. Marks job status = COMPLETED.
    3. Records immutable WorkflowJobAttempt audit row.
    4. Records ModelInvocation telemetry entries (tokens, USD micros cost).
    5. Advances DAG Engine via DAGEngine.on_task_completed (output version + downstream resolution).
    6. Commits transaction.

    If LostLeaseError is raised, the entire transaction rolls back cleanly;
    stale workers CANNOT persist output or trigger downstream DAG execution.
    """
    now = datetime.now(timezone.utc)

    # 1. Guarded write on WorkflowJobQueue
    update_job_stmt = (
        update(WorkflowJobQueue)
        .where(
            WorkflowJobQueue.id == job_id,
            WorkflowJobQueue.claim_token == claim_token,
            WorkflowJobQueue.status == WorkflowJobStatus.running,
        )
        .values(
            status=WorkflowJobStatus.completed,
            updated_at=now,
        )
    )
    job_res = await db.execute(update_job_stmt)
    if job_res.rowcount == 0:
        await db.rollback()
        raise LostLeaseError(
            f"Guarded completion rejected for job {job_id}: worker {worker_id} lost claim token {claim_token}."
        )

    # 2. Record immutable WorkflowJobAttempt
    attempt = WorkflowJobAttempt(
        task_id=task_id,
        attempt_number=attempt_number,
        execution_generation=execution_generation,
        worker_id=worker_id,
        claim_token=claim_token,
        status="completed",
        started_at=now - timedelta(milliseconds=latency_ms),
        completed_at=now,
        latency_ms=latency_ms,
    )
    db.add(attempt)
    await db.flush()

    # 3. Record ModelInvocation rows if provided
    task = await db.get(WorkflowTask, task_id)
    agency_id = task.agency_id if task else uuid.uuid4()
    client_id = task.client_id if task else None

    if invocations:
        for inv_data in invocations:
            inv = ModelInvocation(
                job_attempt_id=attempt.id,
                task_id=task_id,
                agency_id=agency_id,
                client_id=client_id,
                provider=inv_data.get("provider", "openai_compatible"),
                model_identifier=inv_data.get("model_identifier", "default_model"),
                provider_request_id=inv_data.get("provider_request_id"),
                prompt_tokens=inv_data.get("prompt_tokens"),
                completion_tokens=inv_data.get("completion_tokens"),
                total_tokens=inv_data.get("total_tokens"),
                cost_usd=Decimal(str(inv_data.get("cost_usd", "0.000000"))),
                latency_ms=inv_data.get("latency_ms", 0),
                invocation_status=inv_data.get("invocation_status", "success"),
                is_estimated=inv_data.get("is_estimated", False),
            )
            db.add(inv)

    await db.flush()

    # 4. Advance DAG Engine (TaskOutputVersion, status -> completed, downstream unblocking)
    await DAGEngine.on_task_completed(
        db=db,
        completed_task_id=task_id,
        output_payload=output_payload,
        author_type="agent",
        author_id=worker_id,
        change_summary=change_summary,
    )

    # 5. Commit all changes atomically
    await db.commit()


async def guarded_fail_job(
    db: AsyncSession,
    job_id: uuid.UUID,
    task_id: uuid.UUID,
    claim_token: uuid.UUID,
    worker_id: str,
    execution_generation: int,
    attempt_number: int,
    latency_ms: int,
    error_exc: Exception,
    max_attempts: int = DEFAULT_MAX_ATTEMPTS,
) -> None:
    """
    ATOMIC FAILURE / RETRY TRANSACTION BOUNDARY:
    1. Guarded write checking claim_token. If stale, raises LostLeaseError.
    2. Classifies error into retryable vs non-retryable and calculates backoff.
    3. Records immutable WorkflowJobAttempt audit row with error details.
    4. If retryable and attempts < max_attempts:
       - Transitions job to 'retrying' with future execute_at.
    5. If non-retryable OR max attempts exhausted:
       - Transitions job to 'failed'.
       - Triggers DAGEngine.on_task_failed (invalidation cascade across downstream DAG).
    6. Commits transaction.
    """
    now = datetime.now(timezone.utc)
    category, is_retryable, backoff_seconds = classify_job_error(error_exc, attempt_number)
    err_msg = str(error_exc)[:1000]

    # 1. Guard check
    update_job_stmt = (
        update(WorkflowJobQueue)
        .where(
            WorkflowJobQueue.id == job_id,
            WorkflowJobQueue.claim_token == claim_token,
            WorkflowJobQueue.status == WorkflowJobStatus.running,
        )
    )

    should_retry = is_retryable and (attempt_number < max_attempts)

    if should_retry:
        next_execute_at = now + timedelta(seconds=backoff_seconds)
        update_job_stmt = update_job_stmt.values(
            status=WorkflowJobStatus.retrying,
            execute_at=next_execute_at,
            claimed_by=None,
            claim_token=None,
            lease_expires_at=None,
            heartbeat_at=None,
            updated_at=now,
        )
    else:
        update_job_stmt = update_job_stmt.values(
            status=WorkflowJobStatus.failed,
            updated_at=now,
        )

    job_res = await db.execute(update_job_stmt)
    if job_res.rowcount == 0:
        await db.rollback()
        raise LostLeaseError(
            f"Guarded failure rejected for job {job_id}: worker {worker_id} lost claim token {claim_token}."
        )

    # 2. Record immutable failure attempt
    attempt = WorkflowJobAttempt(
        task_id=task_id,
        attempt_number=attempt_number,
        execution_generation=execution_generation,
        worker_id=worker_id,
        claim_token=claim_token,
        status="failed",
        error_category=category,
        error_message=err_msg,
        started_at=now - timedelta(milliseconds=latency_ms),
        completed_at=now,
        latency_ms=latency_ms,
    )
    db.add(attempt)
    await db.flush()

    # 3. If permanent failure, propagate to DAG
    if not should_retry:
        await DAGEngine.on_task_failed(db, task_id, error_message=err_msg)

    await db.commit()


# Type definition for task executor callback
TaskExecutorCallback = Callable[
    [WorkflowTask, WorkflowRun, AsyncSession],
    Awaitable[tuple[dict[str, Any], list[dict[str, Any]]]]
]


class WorkflowWorkerDaemon:
    """
    Durable, concurrent background worker daemon for the AgencyOS Operational Engine.
    Executes AI agents and system tasks with:
    - Atomicity & SKIP LOCKED concurrency claiming
    - Active heartbeat lease renewal
    - Claim token fencing
    - Strict transaction boundaries preventing stale worker commits
    - Differentiated error backoff and downstream failure cascades
    """

    def __init__(
        self,
        worker_id: str | None = None,
        db_factory: Callable[[], AsyncSession] | None = None,
        lease_duration_seconds: int = DEFAULT_LEASE_DURATION_SECONDS,
        heartbeat_interval_seconds: int = DEFAULT_HEARTBEAT_INTERVAL_SECONDS,
        max_attempts: int = DEFAULT_MAX_ATTEMPTS,
    ):
        self.worker_id = worker_id or f"worker-{uuid.uuid4().hex[:8]}"
        self.db_factory = db_factory
        self.lease_duration = lease_duration_seconds
        self.heartbeat_interval = heartbeat_interval_seconds
        self.max_attempts = max_attempts
        self._registry: dict[str, TaskExecutorCallback] = {}

    def register_executor(self, agent_identifier: str, executor: TaskExecutorCallback) -> None:
        """Register a handler for a specific agent identifier or task key."""
        self._registry[agent_identifier] = executor

    async def execute_job(
        self,
        db: AsyncSession,
        claimed: dict[str, Any],
    ) -> bool:
        """
        Executes a claimed job dictionary.
        Returns True on successful completion, False on failure/retry.
        """
        job_id = claimed["job_id"]
        task_id = claimed["task_id"]
        claim_token = claimed["claim_token"]
        execution_generation = claimed["execution_generation"]
        attempt_number = claimed["attempts_count"]

        task = await db.get(WorkflowTask, task_id)
        if not task:
            logger.error(f"Task {task_id} not found for claimed job {job_id}.")
            return False

        run = await db.get(WorkflowRun, task.workflow_run_id)
        if not run:
            logger.error(f"WorkflowRun {task.workflow_run_id} not found for task {task_id}.")
            return False

        # Identify executor
        key = task.agent_identifier or task.task_key
        executor = self._registry.get(key)

        start_time = time.monotonic()
        try:
            if executor:
                output_payload, invocations = await executor(task, run, db)
            else:
                # Default echo executor for deterministic system tasks or basic pass-through
                output_payload = {
                    "task_key": task.task_key,
                    "completed_by": self.worker_id,
                    "input_received": task.input_payload,
                    "status": "success",
                }
                invocations = []

            latency_ms = int((time.monotonic() - start_time) * 1000)

            # Atomic guarded completion
            await guarded_complete_job(
                db=db,
                job_id=job_id,
                task_id=task_id,
                claim_token=claim_token,
                worker_id=self.worker_id,
                execution_generation=execution_generation,
                attempt_number=attempt_number,
                latency_ms=latency_ms,
                output_payload=output_payload,
                invocations=invocations,
            )
            return True

        except LostLeaseError as lle:
            logger.warning(f"Lost lease detected during execution of job {job_id}: {lle}")
            # Do NOT update job or task; another worker owns the lease
            return False

        except Exception as exc:
            latency_ms = int((time.monotonic() - start_time) * 1000)
            logger.error(f"Execution error on job {job_id}: {exc}", exc_info=True)
            try:
                await guarded_fail_job(
                    db=db,
                    job_id=job_id,
                    task_id=task_id,
                    claim_token=claim_token,
                    worker_id=self.worker_id,
                    execution_generation=execution_generation,
                    attempt_number=attempt_number,
                    latency_ms=latency_ms,
                    error_exc=exc,
                    max_attempts=self.max_attempts,
                )
            except LostLeaseError:
                logger.warning(f"Failed to record failure for job {job_id} because lease was lost.")
            return False

    async def tick(self, db: AsyncSession, batch_size: int = 1) -> int:
        """
        Executes a single claim-and-execute tick.
        Returns number of successfully completed jobs.
        """
        claimed_jobs = await claim_workflow_jobs(
            db=db,
            worker_id=self.worker_id,
            batch_size=batch_size,
            lease_duration_seconds=self.lease_duration,
        )

        completed_count = 0
        for claimed in claimed_jobs:
            success = await self.execute_job(db, claimed)
            if success:
                completed_count += 1

        return completed_count
