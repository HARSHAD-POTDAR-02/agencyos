from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.database import Base
from app.models.agency import Agency
from app.models.client import Client
from app.models.operational_workflow import (
    AssigneeType,
    JobErrorCategory,
    ModelInvocation,
    TaskKind,
    TaskOutputVersion,
    WorkflowDependency,
    WorkflowJobAttempt,
    WorkflowJobQueue,
    WorkflowJobStatus,
    WorkflowRun,
    WorkflowRunStatus,
    WorkflowTask,
    WorkflowTaskStatus,
)
from app.models.user import User
from app.services.dag_engine import CyclicDependencyError, DAGEngine, DAGValidationError
from app.services.workflow_worker import (
    LostLeaseError,
    WorkflowWorkerDaemon,
    claim_workflow_jobs,
    classify_job_error,
    guarded_complete_job,
    guarded_fail_job,
    renew_job_lease,
)

from sqlalchemy.pool import NullPool

SQLITE_TEST_DB = "sqlite+aiosqlite:///:memory:"


@pytest.fixture
async def sqlite_session():
    """In-memory SQLite session for fast unit isolation."""
    engine = create_async_engine(SQLITE_TEST_DB, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session

    await engine.dispose()


@pytest.fixture
async def pg_session():
    """Live PostgreSQL session connected to Supabase for testing FOR UPDATE SKIP LOCKED & DB constraints."""
    engine = create_async_engine(settings.DATABASE_URL, echo=False, poolclass=NullPool)
    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    
    # Track test agencies for teardown
    created_agency_ids = []
    
    async with session_factory() as session:
        session._test_agency_ids = created_agency_ids
        try:
            yield session
        finally:
            try:
                await session.rollback()
                if created_agency_ids:
                    for aid in created_agency_ids:
                        ag = await session.get(Agency, aid)
                        if ag:
                            await session.delete(ag)
                    await session.commit()
            except Exception:
                await session.rollback()

    await engine.dispose()


async def _seed_test_org(db: AsyncSession) -> tuple[Agency, Client, User]:
    """Helper to seed an isolated Agency, Client, and User."""
    unique_suffix = uuid.uuid4().hex[:8]
    user = User(
        email=f"tester_{unique_suffix}@agencyos.test",
        hashed_password="pw_hash_test",
        full_name=f"Test Operator {unique_suffix}",
    )
    db.add(user)
    await db.flush()

    agency = Agency(
        name=f"Resilience Agency {unique_suffix}",
        slug=f"resilience-{unique_suffix}",
    )
    db.add(agency)
    await db.flush()

    client = Client(
        agency_id=agency.id,
        business_name=f"Enterprise Tech Client {unique_suffix}",
    )
    db.add(client)
    await db.flush()
    await db.commit()

    if hasattr(db, "_test_agency_ids"):
        db._test_agency_ids.append(agency.id)

    return agency, client, user


# ===========================================================================
# 1. Topological Sort & Cycle Detection Tests
# ===========================================================================

def test_dag_topological_sort_linear():
    """Verify linear dependency chain topological sorting."""
    tasks = [
        {"task_key": "step_1"},
        {"task_key": "step_2"},
        {"task_key": "step_3"},
    ]
    deps = [
        ("step_2", "step_1"),
        ("step_3", "step_2"),
    ]
    order = DAGEngine.validate_and_sort_dag(tasks, deps)
    assert order == ["step_1", "step_2", "step_3"]


def test_dag_topological_sort_diamond():
    """Verify diamond parallelism DAG topological ordering."""
    tasks = [
        {"task_key": "root"},
        {"task_key": "branch_a"},
        {"task_key": "branch_b"},
        {"task_key": "merge"},
    ]
    deps = [
        ("branch_a", "root"),
        ("branch_b", "root"),
        ("merge", "branch_a"),
        ("merge", "branch_b"),
    ]
    order = DAGEngine.validate_and_sort_dag(tasks, deps)
    assert order[0] == "root"
    assert order[-1] == "merge"
    assert set(order[1:3]) == {"branch_a", "branch_b"}


def test_dag_cycle_detection():
    """Kahn's algorithm must raise CyclicDependencyError on circular references."""
    tasks = [
        {"task_key": "a"},
        {"task_key": "b"},
        {"task_key": "c"},
    ]
    deps = [
        ("b", "a"),
        ("c", "b"),
        ("a", "c"),  # Cycle: a -> b -> c -> a
    ]
    with pytest.raises(CyclicDependencyError):
        DAGEngine.validate_and_sort_dag(tasks, deps)


def test_dag_self_dependency():
    """Self-referencing dependency must raise CyclicDependencyError."""
    tasks = [{"task_key": "self_loop"}]
    deps = [("self_loop", "self_loop")]
    with pytest.raises(CyclicDependencyError):
        DAGEngine.validate_and_sort_dag(tasks, deps)


def test_dag_unknown_task_reference():
    """Edges referencing non-existent tasks must raise DAGValidationError."""
    tasks = [{"task_key": "task_1"}]
    deps = [("task_1", "ghost_task")]
    with pytest.raises(DAGValidationError):
        DAGEngine.validate_and_sort_dag(tasks, deps)


# ===========================================================================
# 2. Strict Human Separation Tests (PostgreSQL & SQLite)
# ===========================================================================

@pytest.mark.asyncio
async def test_human_tasks_never_enqueued_in_ai_queue(sqlite_session: AsyncSession):
    """
    CRITICAL ARCHITECTURAL SAFEGUARD:
    Human approval tasks must enter 'waiting_for_human' and NEVER be enqueued in WorkflowJobQueue.
    """
    db = sqlite_session
    agency, client, user = await _seed_test_org(db)

    tasks_def = [
        {
            "task_key": "market_research",
            "title": "Market Research",
            "task_kind": TaskKind.ai_agent,
            "assignee_type": AssigneeType.agent,
            "agent_identifier": "market_researcher",
        },
        {
            "task_key": "human_strategy_approval",
            "title": "Human Strategy Approval",
            "task_kind": TaskKind.human_approval,
            "assignee_type": AssigneeType.human,
            "human_assignee_id": user.id,
        },
        {
            "task_key": "content_production",
            "title": "Content Production",
            "task_kind": TaskKind.ai_agent,
            "assignee_type": AssigneeType.agent,
            "agent_identifier": "content_architect",
        },
    ]
    dependencies_def = [
        ("human_strategy_approval", "market_research"),
        ("content_production", "human_strategy_approval"),
    ]

    run = await DAGEngine.create_workflow_run(
        db=db,
        agency_id=agency.id,
        client_id=client.id,
        title="Human Safeguard Test Run",
        tasks_def=tasks_def,
        dependencies_def=dependencies_def,
    )

    # 1. Initial state: AI task 'market_research' is queued in WorkflowJobQueue
    queued_jobs = (await db.execute(select(WorkflowJobQueue))).scalars().all()
    assert len(queued_jobs) == 1
    assert queued_jobs[0].workflow_run_id == run.id

    # Complete the AI task
    unblocked = await DAGEngine.on_task_completed(
        db=db,
        completed_task_id=queued_jobs[0].task_id,
        output_payload={"findings": "Audience prefers deep technical architecture content."},
    )
    assert len(unblocked) == 1

    # Fetch the human approval task
    human_task_stmt = select(WorkflowTask).where(
        WorkflowTask.workflow_run_id == run.id,
        WorkflowTask.task_key == "human_strategy_approval",
    )
    human_task = (await db.execute(human_task_stmt)).scalar_one()

    # Verify status is waiting_for_human
    assert human_task.status == WorkflowTaskStatus.waiting_for_human

    # Verify WorkflowJobQueue STILL only has the original 1 job; human task was NEVER enqueued
    all_jobs = (await db.execute(select(WorkflowJobQueue))).scalars().all()
    assert len(all_jobs) == 1
    assert all_jobs[0].task_id != human_task.id


# ===========================================================================
# 3. Crashed Worker Lease Recovery Tests (PostgreSQL)
# ===========================================================================

@pytest.mark.asyncio
async def test_crashed_worker_lease_recovery_postgresql(pg_session: AsyncSession):
    """
    Simulates a crashed worker whose lease expired.
    A new worker must claim the expired job, update claim_token, and increment attempts_count.
    Runs against live PostgreSQL with FOR UPDATE SKIP LOCKED.
    """
    db = pg_session
    agency, client, _ = await _seed_test_org(db)

    tasks_def = [
        {
            "task_key": "ai_task_crash_test",
            "title": "Crashed Worker Task",
            "task_kind": TaskKind.ai_agent,
            "assignee_type": AssigneeType.agent,
            "agent_identifier": "market_researcher",
        }
    ]
    run = await DAGEngine.create_workflow_run(
        db=db,
        agency_id=agency.id,
        client_id=client.id,
        title="PostgreSQL Crash Recovery Test",
        tasks_def=tasks_def,
        dependencies_def=[],
    )

    # Worker 1 claims the job
    worker_1_claims = await claim_workflow_jobs(
        db=db, worker_id="crashed-worker-1", batch_size=1, lease_duration_seconds=30, agency_id=agency.id
    )
    assert len(worker_1_claims) == 1
    w1_claim = worker_1_claims[0]
    assert w1_claim["attempts_count"] == 1

    # Simulate worker crash and passage of time by artificially setting lease_expires_at in the past
    job_id = w1_claim["job_id"]
    past_time = datetime.now(timezone.utc) - timedelta(minutes=5)
    job = await db.get(WorkflowJobQueue, job_id)
    assert job is not None
    job.lease_expires_at = past_time
    await db.commit()

    # Worker 2 attempts to claim jobs: should recover the expired job
    worker_2_claims = await claim_workflow_jobs(
        db=db, worker_id="healthy-worker-2", batch_size=1, lease_duration_seconds=60, agency_id=agency.id
    )
    assert len(worker_2_claims) == 1
    w2_claim = worker_2_claims[0]

    assert w2_claim["job_id"] == job_id
    assert w2_claim["claim_token"] != w1_claim["claim_token"]  # Fresh fencing token
    assert w2_claim["attempts_count"] == 2                     # Incremented attempt


# ===========================================================================
# 4. Claim-Token Fencing (Preventing Stale Worker Output Commits)
# ===========================================================================

@pytest.mark.asyncio
async def test_claim_token_fencing_prevents_stale_commit(pg_session: AsyncSession):
    """
    CRITICAL FENCING GUARANTEE:
    When Worker 1 loses its lease to Worker 2, Worker 1's subsequent attempt
    to call guarded_complete_job must raise LostLeaseError and ROLLBACK.
    No output version must be saved and no downstream tasks unblocked.
    """
    db = pg_session
    agency, client, _ = await _seed_test_org(db)

    tasks_def = [
        {
            "task_key": "step_a",
            "title": "Step A",
            "task_kind": TaskKind.ai_agent,
            "assignee_type": AssigneeType.agent,
            "agent_identifier": "market_researcher",
        },
        {
            "task_key": "step_b",
            "title": "Step B",
            "task_kind": TaskKind.ai_agent,
            "assignee_type": AssigneeType.agent,
            "agent_identifier": "content_architect",
        },
    ]
    deps_def = [("step_b", "step_a")]

    run = await DAGEngine.create_workflow_run(
        db=db,
        agency_id=agency.id,
        client_id=client.id,
        title="Fencing Token Test",
        tasks_def=tasks_def,
        dependencies_def=deps_def,
    )
    run_id = run.id

    # Worker 1 claims Step A
    w1_claims = await claim_workflow_jobs(db, worker_id="slow-worker-1", batch_size=1, agency_id=agency.id)
    w1_claim = w1_claims[0]

    # Simulate timeout: lease expires
    job = await db.get(WorkflowJobQueue, w1_claim["job_id"])
    assert job is not None
    job.lease_expires_at = datetime.now(timezone.utc) - timedelta(seconds=10)
    await db.commit()

    # Worker 2 reclaims Step A
    w2_claims = await claim_workflow_jobs(db, worker_id="fast-worker-2", batch_size=1, agency_id=agency.id)
    w2_claim = w2_claims[0]

    # Stale Worker 1 wakes up and attempts to complete with stale token
    with pytest.raises(LostLeaseError):
        await guarded_complete_job(
            db=db,
            job_id=w1_claim["job_id"],
            task_id=w1_claim["task_id"],
            claim_token=w1_claim["claim_token"],  # STALE TOKEN!
            worker_id="slow-worker-1",
            execution_generation=w1_claim["execution_generation"],
            attempt_number=w1_claim["attempts_count"],
            latency_ms=1000,
            output_payload={"content": "stale unauthorized output"},
        )

    # Verify that NO task output version was written by stale worker 1
    versions = (
        await db.execute(
            select(TaskOutputVersion).where(TaskOutputVersion.task_id == w1_claim["task_id"])
        )
    ).scalars().all()
    assert len(versions) == 0

    # Verify step_b is STILL pending
    step_b = (
        await db.execute(
            select(WorkflowTask).where(
                WorkflowTask.workflow_run_id == run_id,
                WorkflowTask.task_key == "step_b",
            )
        )
    ).scalar_one()
    assert step_b.status == WorkflowTaskStatus.pending

    # Legitimate Worker 2 now completes with its valid token
    await guarded_complete_job(
        db=db,
        job_id=w2_claim["job_id"],
        task_id=w2_claim["task_id"],
        claim_token=w2_claim["claim_token"],  # VALID TOKEN!
        worker_id="fast-worker-2",
        execution_generation=w2_claim["execution_generation"],
        attempt_number=w2_claim["attempts_count"],
        latency_ms=850,
        output_payload={"content": "verified valid output"},
    )

    # Verify output version is now saved and Step B is unblocked
    versions_after = (
        await db.execute(
            select(TaskOutputVersion).where(TaskOutputVersion.task_id == w2_claim["task_id"])
        )
    ).scalars().all()
    assert len(versions_after) == 1
    assert versions_after[0].output_payload["content"] == "verified valid output"

    await db.refresh(step_b)
    assert step_b.status == WorkflowTaskStatus.ready


# ===========================================================================
# 5. Concurrency Race Protection on Simultaneous Parent Completions
# ===========================================================================

@pytest.mark.asyncio
async def test_concurrency_dual_parent_dependencies(pg_session: AsyncSession):
    """
    Diamond graph: Task C depends on both Task A and Task B.
    When Task A completes, Task C must remain pending.
    When Task B completes, Task C is atomically unblocked and enqueued exactly once.
    """
    db = pg_session
    agency, client, _ = await _seed_test_org(db)

    tasks_def = [
        {
            "task_key": "parent_a",
            "title": "Parent A",
            "task_kind": TaskKind.ai_agent,
            "assignee_type": AssigneeType.agent,
            "agent_identifier": "brand_intelligence",
        },
        {
            "task_key": "parent_b",
            "title": "Parent B",
            "task_kind": TaskKind.ai_agent,
            "assignee_type": AssigneeType.agent,
            "agent_identifier": "market_researcher",
        },
        {
            "task_key": "child_c",
            "title": "Child C",
            "task_kind": TaskKind.ai_agent,
            "assignee_type": AssigneeType.agent,
            "agent_identifier": "campaign_strategist",
        },
    ]
    deps_def = [
        ("child_c", "parent_a"),
        ("child_c", "parent_b"),
    ]

    run = await DAGEngine.create_workflow_run(
        db=db,
        agency_id=agency.id,
        client_id=client.id,
        title="Dual Parent Dependency Test",
        tasks_def=tasks_def,
        dependencies_def=deps_def,
    )

    # Claim parent_a and parent_b
    claims = await claim_workflow_jobs(db, worker_id="pool-worker", batch_size=2, agency_id=agency.id)
    assert len(claims) == 2

    claim_map = {c["task_id"]: c for c in claims}
    
    tasks = (
        await db.execute(
            select(WorkflowTask).where(WorkflowTask.workflow_run_id == run.id)
        )
    ).scalars().all()
    t_by_key = {t.task_key: t for t in tasks}

    child_c = t_by_key["child_c"]
    assert child_c.status == WorkflowTaskStatus.pending

    # Complete parent_a only
    claim_a = claim_map[t_by_key["parent_a"].id]
    await guarded_complete_job(
        db=db,
        job_id=claim_a["job_id"],
        task_id=claim_a["task_id"],
        claim_token=claim_a["claim_token"],
        worker_id="worker-a",
        execution_generation=claim_a["execution_generation"],
        attempt_number=claim_a["attempts_count"],
        latency_ms=200,
        output_payload={"brand_positioning": "Verified Enterprise positioning"},
    )

    # Verify Child C is STILL pending because parent_b is incomplete
    await db.refresh(child_c)
    assert child_c.status == WorkflowTaskStatus.pending

    # Complete parent_b
    claim_b = claim_map[t_by_key["parent_b"].id]
    await guarded_complete_job(
        db=db,
        job_id=claim_b["job_id"],
        task_id=claim_b["task_id"],
        claim_token=claim_b["claim_token"],
        worker_id="worker-b",
        execution_generation=claim_b["execution_generation"],
        attempt_number=claim_b["attempts_count"],
        latency_ms=250,
        output_payload={"market_analysis": "Multi-persona technical buying groups"},
    )

    # Now Child C must be unblocked into ready and enqueued in WorkflowJobQueue
    await db.refresh(child_c)
    assert child_c.status == WorkflowTaskStatus.ready

    c_jobs = (
        await db.execute(
            select(WorkflowJobQueue).where(WorkflowJobQueue.task_id == child_c.id)
        )
    ).scalars().all()
    assert len(c_jobs) == 1
    assert c_jobs[0].status == WorkflowJobStatus.queued


# ===========================================================================
# 6. Downstream Failure Invalidation Cascade
# ===========================================================================

@pytest.mark.asyncio
async def test_downstream_failure_invalidation_cascade(pg_session: AsyncSession):
    """
    Workflow: Root -> Step 1 -> Step 2.
    When Root fails permanently, Step 1 and Step 2 must transition to 'blocked_by_failure'.
    The parent WorkflowRun status must transition to 'failed'.
    """
    db = pg_session
    agency, client, _ = await _seed_test_org(db)

    tasks_def = [
        {
            "task_key": "root",
            "title": "Root Task",
            "task_kind": TaskKind.ai_agent,
            "assignee_type": AssigneeType.agent,
            "agent_identifier": "market_researcher",
        },
        {
            "task_key": "step_1",
            "title": "Step 1",
            "task_kind": TaskKind.ai_agent,
            "assignee_type": AssigneeType.agent,
            "agent_identifier": "content_architect",
        },
        {
            "task_key": "step_2",
            "title": "Step 2",
            "task_kind": TaskKind.ai_agent,
            "assignee_type": AssigneeType.agent,
            "agent_identifier": "quality_evaluator",
        },
    ]
    deps_def = [
        ("step_1", "root"),
        ("step_2", "step_1"),
    ]

    run = await DAGEngine.create_workflow_run(
        db=db,
        agency_id=agency.id,
        client_id=client.id,
        title="Cascade Failure Test",
        tasks_def=tasks_def,
        dependencies_def=deps_def,
    )

    claims = await claim_workflow_jobs(db, worker_id="faulty-worker", batch_size=1, agency_id=agency.id)
    claim = claims[0]

    # Guarded fail with non-retryable error (max attempts = 1)
    await guarded_fail_job(
        db=db,
        job_id=claim["job_id"],
        task_id=claim["task_id"],
        claim_token=claim["claim_token"],
        worker_id="faulty-worker",
        execution_generation=claim["execution_generation"],
        attempt_number=claim["attempts_count"],
        latency_ms=150,
        error_exc=Exception("Fatal upstream data corruption"),
        max_attempts=1,
    )

    # Check tasks statuses
    tasks = (
        await db.execute(
            select(WorkflowTask).where(WorkflowTask.workflow_run_id == run.id)
        )
    ).scalars().all()
    t_map = {t.task_key: t.status for t in tasks}

    assert t_map["root"] == WorkflowTaskStatus.failed
    assert t_map["step_1"] == WorkflowTaskStatus.blocked_by_failure
    assert t_map["step_2"] == WorkflowTaskStatus.blocked_by_failure

    # Check WorkflowRun status
    await db.refresh(run)
    assert run.status == WorkflowRunStatus.failed
    assert run.failed_tasks == 1


# ===========================================================================
# 7. Bounded Selective Repair with Execution Generations
# ===========================================================================

@pytest.mark.asyncio
async def test_bounded_selective_repair_generations(pg_session: AsyncSession):
    """
    Verifies selective repair creates new execution generations without PK or unique constraint collisions.
    Verifies bounded escalation to human after 2 attempts.
    """
    db = pg_session
    agency, client, _ = await _seed_test_org(db)

    tasks_def = [
        {
            "task_key": "draft_content",
            "title": "Draft Content",
            "task_kind": TaskKind.ai_agent,
            "assignee_type": AssigneeType.agent,
            "agent_identifier": "content_architect",
        }
    ]
    run = await DAGEngine.create_workflow_run(
        db=db,
        agency_id=agency.id,
        client_id=client.id,
        title="Selective Repair Generation Test",
        tasks_def=tasks_def,
        dependencies_def=[],
    )

    # 1. First execution
    claim_1 = (await claim_workflow_jobs(db, worker_id="w1", batch_size=1, agency_id=agency.id))[0]
    await guarded_complete_job(
        db=db,
        job_id=claim_1["job_id"],
        task_id=claim_1["task_id"],
        claim_token=claim_1["claim_token"],
        worker_id="w1",
        execution_generation=claim_1["execution_generation"],
        attempt_number=claim_1["attempts_count"],
        latency_ms=300,
        output_payload={"text": "Initial draft with unsubstantiated metric."},
    )

    task_id = claim_1["task_id"]

    # 2. QA Evaluator triggers Repair Attempt 1
    repaired_1 = await DAGEngine.initiate_selective_repair(
        db=db,
        task_id=task_id,
        repair_instructions="Remove unsubstantiated 99.999% claim and ground in case study.",
    )
    assert repaired_1 is True

    # Check job queue: second job row exists with execution_generation = 2
    jobs = (
        await db.execute(
            select(WorkflowJobQueue).where(WorkflowJobQueue.task_id == task_id)
        )
    ).scalars().all()
    assert len(jobs) == 2
    assert {j.execution_generation for j in jobs} == {1, 2}

    # Worker executes Repair 1
    claim_2 = (await claim_workflow_jobs(db, worker_id="w2", batch_size=1, agency_id=agency.id))[0]
    assert claim_2["execution_generation"] == 2
    await guarded_complete_job(
        db=db,
        job_id=claim_2["job_id"],
        task_id=claim_2["task_id"],
        claim_token=claim_2["claim_token"],
        worker_id="w2",
        execution_generation=claim_2["execution_generation"],
        attempt_number=claim_2["attempts_count"],
        latency_ms=320,
        output_payload={"text": "Second draft, still slightly off-brand."},
    )

    # 3. QA Evaluator triggers Repair Attempt 2
    repaired_2 = await DAGEngine.initiate_selective_repair(
        db=db,
        task_id=task_id,
        repair_instructions="Tone is too casual for enterprise DevOps audience.",
    )
    assert repaired_2 is True

    # Check job queue: third job row exists with execution_generation = 3
    jobs_after_2 = (
        await db.execute(
            select(WorkflowJobQueue).where(WorkflowJobQueue.task_id == task_id)
        )
    ).scalars().all()
    assert len(jobs_after_2) == 3
    assert {j.execution_generation for j in jobs_after_2} == {1, 2, 3}

    # Worker executes Repair 2
    claim_3 = (await claim_workflow_jobs(db, worker_id="w3", batch_size=1, agency_id=agency.id))[0]
    assert claim_3["execution_generation"] == 3
    await guarded_complete_job(
        db=db,
        job_id=claim_3["job_id"],
        task_id=claim_3["task_id"],
        claim_token=claim_3["claim_token"],
        worker_id="w3",
        execution_generation=claim_3["execution_generation"],
        attempt_number=claim_3["attempts_count"],
        latency_ms=290,
        output_payload={"text": "Third draft, still has minor issues."},
    )

    # 4. QA Evaluator attempts Repair Attempt 3 (EXCEEDS MAX_SELECTIVE_REPAIR_ATTEMPTS = 2)
    repaired_3 = await DAGEngine.initiate_selective_repair(
        db=db,
        task_id=task_id,
        repair_instructions="Still flawed.",
    )
    assert repaired_3 is False  # Must return False (rejected)

    # Task status must escalate to waiting_for_human
    task = await db.get(WorkflowTask, task_id)
    assert task is not None
    assert task.status == WorkflowTaskStatus.waiting_for_human

    # No new 4th job must be added
    jobs_final = (
        await db.execute(
            select(WorkflowJobQueue).where(WorkflowJobQueue.task_id == task_id)
        )
    ).scalars().all()
    assert len(jobs_final) == 3


# ===========================================================================
# 8. Model Invocation Financial Telemetry
# ===========================================================================

@pytest.mark.asyncio
async def test_model_invocation_financial_telemetry(pg_session: AsyncSession):
    """
    Validates authoritative financial and token tracking per model execution.
    Verifies exact Numeric(14, 6) precision without floating point inaccuracies.
    """
    db = pg_session
    agency, client, _ = await _seed_test_org(db)

    tasks_def = [
        {
            "task_key": "ai_telemetry_task",
            "title": "Telemetry Task",
            "task_kind": TaskKind.ai_agent,
            "assignee_type": AssigneeType.agent,
            "agent_identifier": "market_researcher",
        }
    ]
    run = await DAGEngine.create_workflow_run(
        db=db,
        agency_id=agency.id,
        client_id=client.id,
        title="Telemetry Test Run",
        tasks_def=tasks_def,
        dependencies_def=[],
    )

    claim = (await claim_workflow_jobs(db, worker_id="telemetry-worker", batch_size=1, agency_id=agency.id))[0]

    # Recorded invocations with exact USD micros
    telemetry_data = [
        {
            "provider": "nvidia_nim",
            "model_identifier": "nvidia/nemotron-3.5-lightning-30b-a3b",
            "provider_request_id": "req-nim-987654",
            "prompt_tokens": 1250,
            "completion_tokens": 480,
            "total_tokens": 1730,
            "cost_usd": Decimal("0.003460"),
            "latency_ms": 1150,
            "invocation_status": "success",
            "is_estimated": False,
        },
        {
            "provider": "groq",
            "model_identifier": "openai/gpt-oss-120b",
            "provider_request_id": "req-groq-123456",
            "prompt_tokens": 800,
            "completion_tokens": 200,
            "total_tokens": 1000,
            "cost_usd": Decimal("0.000600"),
            "latency_ms": 420,
            "invocation_status": "success",
            "is_estimated": False,
        },
    ]

    await guarded_complete_job(
        db=db,
        job_id=claim["job_id"],
        task_id=claim["task_id"],
        claim_token=claim["claim_token"],
        worker_id="telemetry-worker",
        execution_generation=claim["execution_generation"],
        attempt_number=claim["attempts_count"],
        latency_ms=1570,
        output_payload={"market_report": "Completed research with model telemetry."},
        invocations=telemetry_data,
    )

    # Query ModelInvocation records
    inv_stmt = select(ModelInvocation).where(ModelInvocation.task_id == claim["task_id"])
    invocations = (await db.execute(inv_stmt)).scalars().all()

    assert len(invocations) == 2
    providers = {inv.provider: inv for inv in invocations}

    nim_inv = providers["nvidia_nim"]
    assert nim_inv.model_identifier == "nvidia/nemotron-3.5-lightning-30b-a3b"
    assert nim_inv.total_tokens == 1730
    assert nim_inv.cost_usd == Decimal("0.003460")
    assert nim_inv.agency_id == agency.id
    assert nim_inv.client_id == client.id

    groq_inv = providers["groq"]
    assert groq_inv.model_identifier == "openai/gpt-oss-120b"
    assert groq_inv.total_tokens == 1000
    assert groq_inv.cost_usd == Decimal("0.000600")


# ===========================================================================
# 9. Error Classification & Differentiated Backoff Tests
# ===========================================================================

def test_error_classification():
    """Verify error categorization and backoff calculation."""
    # 429 Rate limit
    cat, retry, backoff = classify_job_error(Exception("429 Too Many Requests: TPM limit exceeded"), attempt_number=1)
    assert cat == JobErrorCategory.rate_limit_429
    assert retry is True
    assert 30 <= backoff <= 45

    # Network timeout
    cat, retry, backoff = classify_job_error(Exception("Connection timeout to API gateway"), attempt_number=2)
    assert cat == JobErrorCategory.network_timeout
    assert retry is True
    assert 20 <= backoff <= 30

    # Auth error (non-retryable)
    cat, retry, backoff = classify_job_error(Exception("401 Unauthorized: Invalid API key"), attempt_number=1)
    assert cat == JobErrorCategory.auth_error
    assert retry is False
    assert backoff == 0

    # Schema validation error (non-retryable)
    cat, retry, backoff = classify_job_error(ValueError("JSONDecodeError: invalid format"), attempt_number=1)
    assert cat == JobErrorCategory.schema_validation
    assert retry is False
    assert backoff == 0
