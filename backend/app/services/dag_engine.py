from __future__ import annotations

import collections
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.operational_workflow import (
    AssigneeType,
    JobErrorCategory,
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

logger = logging.getLogger(__name__)

MAX_SELECTIVE_REPAIR_ATTEMPTS = 2


class CyclicDependencyError(Exception):
    """Raised when Kahn's algorithm detects a cycle in the task graph."""
    pass


class DAGValidationError(Exception):
    """Raised when task definitions or dependency edges are malformed."""
    pass


class DAGEngine:
    """
    Core graph orchestrator:
    - Graph validation via Kahn's algorithm (Topological sort & cycle detection)
    - Atomic workflow initialization
    - Concurrency-safe dependency resolution with row locking
    - Failure invalidation propagation
    - Bounded selective repair orchestration
    """

    @staticmethod
    def validate_and_sort_dag(
        tasks: list[dict[str, Any]], 
        dependencies: list[tuple[str, str]]
    ) -> list[str]:
        """
        Validates graph acyclicity and returns valid topological execution order.
        Raises CyclicDependencyError if circular dependency exists.
        Raises DAGValidationError if edges reference unknown task keys.
        """
        task_keys = [t["task_key"] for t in tasks]
        if len(task_keys) != len(set(task_keys)):
            raise DAGValidationError("Duplicate task keys found in workflow definition.")

        task_set = set(task_keys)
        in_degree = {k: 0 for k in task_keys}
        adj = collections.defaultdict(list)

        for task_key, depends_on_key in dependencies:
            if task_key not in task_set:
                raise DAGValidationError(f"Dependency edge targets unknown task_key: '{task_key}'")
            if depends_on_key not in task_set:
                raise DAGValidationError(f"Dependency edge depends on unknown task_key: '{depends_on_key}'")
            if task_key == depends_on_key:
                raise CyclicDependencyError(f"Self-dependency detected on task: '{task_key}'")
            
            adj[depends_on_key].append(task_key)
            in_degree[task_key] += 1

        queue = collections.deque([k for k, deg in in_degree.items() if deg == 0])
        topological_order = []

        while queue:
            node = queue.popleft()
            topological_order.append(node)
            for neighbor in adj[node]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

        if len(topological_order) != len(tasks):
            raise CyclicDependencyError(
                f"Cyclic dependency detected. Only {len(topological_order)} of {len(tasks)} tasks could be ordered."
            )

        return topological_order

    @staticmethod
    async def create_workflow_run(
        db: AsyncSession,
        agency_id: uuid.UUID,
        client_id: uuid.UUID,
        title: str,
        tasks_def: list[dict[str, Any]],
        dependencies_def: list[tuple[str, str]],
        campaign_id: uuid.UUID | None = None,
        created_by_id: uuid.UUID | None = None,
        objective_text: str | None = None,
        shared_contract: dict[str, Any] | None = None,
    ) -> WorkflowRun:
        """
        Atomically creates a WorkflowRun, its WorkflowTasks, WorkflowDependencies,
        and enqueues initial zero-in-degree tasks in a single database transaction.
        """
        # 1. Validate graph topology before touching the database
        topological_order = DAGEngine.validate_and_sort_dag(tasks_def, dependencies_def)

        # 2. Create WorkflowRun
        run = WorkflowRun(
            agency_id=agency_id,
            client_id=client_id,
            campaign_id=campaign_id,
            title=title,
            objective_text=objective_text,
            plan_version=1,
            status=WorkflowRunStatus.running,
            total_tasks=len(tasks_def),
            completed_tasks=0,
            failed_tasks=0,
            shared_contract=shared_contract,
            created_by_id=created_by_id,
            started_at=datetime.now(timezone.utc),
        )
        db.add(run)
        await db.flush()

        # 3. Instantiate WorkflowTask rows
        task_map: dict[str, WorkflowTask] = {}
        for t_def in tasks_def:
            w_task = WorkflowTask(
                workflow_run_id=run.id,
                agency_id=agency_id,
                client_id=client_id,
                task_key=t_def["task_key"],
                title=t_def["title"],
                description=t_def.get("description"),
                task_kind=t_def["task_kind"],
                assignee_type=t_def["assignee_type"],
                human_assignee_id=t_def.get("human_assignee_id"),
                agent_identifier=t_def.get("agent_identifier"),
                status=WorkflowTaskStatus.pending,
                current_version=1,
                selective_repair_count=0,
                input_payload=t_def.get("input_payload"),
            )
            db.add(w_task)
            task_map[t_def["task_key"]] = w_task

        await db.flush()

        # 4. Instantiate WorkflowDependency rows
        for task_key, depends_on_key in dependencies_def:
            dep = WorkflowDependency(
                workflow_run_id=run.id,
                task_id=task_map[task_key].id,
                depends_on_task_id=task_map[depends_on_key].id,
            )
            db.add(dep)

        await db.flush()

        # 5. Resolve and dispatch root tasks (0 in-degree)
        parent_task_keys_with_incoming = {t_key for t_key, _ in dependencies_def}
        root_keys = [k for k in topological_order if k not in parent_task_keys_with_incoming]

        for r_key in root_keys:
            root_task = task_map[r_key]
            if root_task.task_kind == TaskKind.ai_agent:
                root_task.status = WorkflowTaskStatus.ready
                job = WorkflowJobQueue(
                    task_id=root_task.id,
                    workflow_run_id=run.id,
                    agency_id=agency_id,
                    execution_generation=1,
                    status=WorkflowJobStatus.queued,
                )
                db.add(job)
            elif root_task.task_kind == TaskKind.human_approval:
                root_task.status = WorkflowTaskStatus.waiting_for_human
            elif root_task.task_kind == TaskKind.human_production:
                root_task.status = WorkflowTaskStatus.ready
            elif root_task.task_kind == TaskKind.system_deterministic:
                root_task.status = WorkflowTaskStatus.ready
                job = WorkflowJobQueue(
                    task_id=root_task.id,
                    workflow_run_id=run.id,
                    agency_id=agency_id,
                    execution_generation=1,
                    status=WorkflowJobStatus.queued,
                )
                db.add(job)

        await db.commit()
        await db.refresh(run)
        return run

    @staticmethod
    async def on_task_completed(
        db: AsyncSession,
        completed_task_id: uuid.UUID,
        output_payload: dict[str, Any],
        author_type: str = "agent",
        author_id: str | None = None,
        change_summary: str | None = None,
    ) -> list[uuid.UUID]:
        """
        Atomic transition executed in a single transaction:
        1. Verifies and updates completed task to COMPLETED.
        2. Creates TaskOutputVersion snapshot.
        3. Identifies downstream dependent tasks.
        4. Row-locks candidate downstream tasks (SELECT ... FOR UPDATE) to eliminate race conditions.
        5. Dispatches unblocked tasks by task_kind (AI -> job_queue, Human Approval -> waiting_for_human).
        6. Updates WorkflowRun completed counters.
        """
        # 1. Fetch & lock completed task
        task = await db.get(WorkflowTask, completed_task_id, with_for_update=True)
        if not task:
            logger.warning(f"on_task_completed called for non-existent task: {completed_task_id}")
            return []

        if task.status == WorkflowTaskStatus.completed:
            logger.info(f"Task {completed_task_id} already marked completed. Idempotent return.")
            return []

        # 2. Record immutable output version
        output_ver = TaskOutputVersion(
            task_id=task.id,
            version_number=task.current_version,
            output_payload=output_payload,
            created_by_type=author_type,
            created_by_id=author_id,
            change_summary=change_summary,
            is_active=True,
        )
        db.add(output_ver)
        task.status = WorkflowTaskStatus.completed
        task.completed_at = datetime.now(timezone.utc)
        await db.flush()

        # 3. Query downstream candidate task IDs
        dep_stmt = select(WorkflowDependency.task_id).where(
            WorkflowDependency.depends_on_task_id == completed_task_id
        )
        downstream_ids = (await db.execute(dep_stmt)).scalars().all()

        unblocked_task_ids: list[uuid.UUID] = []

        # 4. Inspect each downstream candidate with ROW LOCK
        for downstream_id in downstream_ids:
            downstream_task = await db.get(WorkflowTask, downstream_id, with_for_update=True)
            if not downstream_task or downstream_task.status != WorkflowTaskStatus.pending:
                continue

            # Check if ALL parent dependencies are completed
            parent_statuses_stmt = (
                select(WorkflowTask.status)
                .join(WorkflowDependency, WorkflowDependency.depends_on_task_id == WorkflowTask.id)
                .where(WorkflowDependency.task_id == downstream_id)
            )
            parent_statuses = (await db.execute(parent_statuses_stmt)).scalars().all()

            if all(s == WorkflowTaskStatus.completed for s in parent_statuses):
                # 5. Type-Specific Dispatch Handling
                if downstream_task.task_kind == TaskKind.ai_agent:
                    downstream_task.status = WorkflowTaskStatus.ready
                    job = WorkflowJobQueue(
                        task_id=downstream_id,
                        workflow_run_id=downstream_task.workflow_run_id,
                        agency_id=downstream_task.agency_id,
                        execution_generation=downstream_task.current_version,
                        status=WorkflowJobStatus.queued,
                    )
                    db.add(job)
                elif downstream_task.task_kind == TaskKind.human_approval:
                    downstream_task.status = WorkflowTaskStatus.waiting_for_human
                elif downstream_task.task_kind == TaskKind.human_production:
                    downstream_task.status = WorkflowTaskStatus.ready
                elif downstream_task.task_kind == TaskKind.system_deterministic:
                    downstream_task.status = WorkflowTaskStatus.ready
                    job = WorkflowJobQueue(
                        task_id=downstream_id,
                        workflow_run_id=downstream_task.workflow_run_id,
                        agency_id=downstream_task.agency_id,
                        execution_generation=downstream_task.current_version,
                        status=WorkflowJobStatus.queued,
                    )
                    db.add(job)

                unblocked_task_ids.append(downstream_id)

        # 6. Update parent WorkflowRun completion counter
        run = await db.get(WorkflowRun, task.workflow_run_id, with_for_update=True)
        if run:
            completed_stmt = select(func.count(WorkflowTask.id)).where(
                WorkflowTask.workflow_run_id == run.id,
                WorkflowTask.status == WorkflowTaskStatus.completed,
            )
            run.completed_tasks = (await db.execute(completed_stmt)).scalar() or 0

            # Check if any tasks are in waiting_for_human
            waiting_stmt = select(func.count(WorkflowTask.id)).where(
                WorkflowTask.workflow_run_id == run.id,
                WorkflowTask.status == WorkflowTaskStatus.waiting_for_human,
            )
            waiting_count = (await db.execute(waiting_stmt)).scalar() or 0

            if run.completed_tasks >= run.total_tasks:
                run.status = WorkflowRunStatus.completed
                run.completed_at = datetime.now(timezone.utc)
            elif waiting_count > 0:
                run.status = WorkflowRunStatus.waiting_for_human
            else:
                run.status = WorkflowRunStatus.running

        await db.commit()
        return unblocked_task_ids

    @staticmethod
    async def on_task_failed(
        db: AsyncSession, 
        failed_task_id: uuid.UUID, 
        error_message: str
    ) -> None:
        """
        Permanent task failure propagation:
        1. Marks failed task as FAILED.
        2. Traverses all reachable downstream tasks and transitions them to BLOCKED_BY_FAILURE.
        3. Updates WorkflowRun status to FAILED.
        """
        task = await db.get(WorkflowTask, failed_task_id, with_for_update=True)
        if not task:
            return

        task.status = WorkflowTaskStatus.failed

        # Downstream BFS traversal
        visited = set()
        queue = collections.deque([failed_task_id])

        while queue:
            curr_id = queue.popleft()
            dep_stmt = select(WorkflowDependency.task_id).where(
                WorkflowDependency.depends_on_task_id == curr_id
            )
            child_ids = (await db.execute(dep_stmt)).scalars().all()
            for child_id in child_ids:
                if child_id not in visited:
                    visited.add(child_id)
                    queue.append(child_id)
                    child = await db.get(WorkflowTask, child_id, with_for_update=True)
                    if child and child.status in [WorkflowTaskStatus.pending, WorkflowTaskStatus.ready]:
                        child.status = WorkflowTaskStatus.blocked_by_failure

        # Update WorkflowRun status
        run = await db.get(WorkflowRun, task.workflow_run_id, with_for_update=True)
        if run:
            run.status = WorkflowRunStatus.failed
            failed_stmt = select(func.count(WorkflowTask.id)).where(
                WorkflowTask.workflow_run_id == run.id,
                WorkflowTask.status == WorkflowTaskStatus.failed,
            )
            run.failed_tasks = (await db.execute(failed_stmt)).scalar() or 0

        await db.commit()

    @staticmethod
    async def initiate_selective_repair(
        db: AsyncSession,
        task_id: uuid.UUID,
        repair_instructions: str,
        actor_id: str = "quality_evaluator",
    ) -> bool:
        """
        Initiates a selective repair attempt for a task that produced flawed output.
        Bounded at MAX_SELECTIVE_REPAIR_ATTEMPTS (2 attempts).
        If attempts exceed limit, escalates to human review (waiting_for_human).
        Increments current_version and execution_generation, creating a new queue entry.
        Returns True if repair queued, False if escalated to human.
        """
        task = await db.get(WorkflowTask, task_id, with_for_update=True)
        if not task:
            return False

        if task.selective_repair_count >= MAX_SELECTIVE_REPAIR_ATTEMPTS:
            logger.warning(
                f"Task {task_id} reached max repair attempts ({MAX_SELECTIVE_REPAIR_ATTEMPTS}). Escalating to human."
            )
            task.status = WorkflowTaskStatus.waiting_for_human
            await db.commit()
            return False

        task.selective_repair_count += 1
        task.current_version += 1
        task.status = WorkflowTaskStatus.ready
        
        # Merge repair instructions into input_payload
        payload = dict(task.input_payload or {})
        payload["repair_instruction"] = repair_instructions
        payload["repair_attempt_number"] = task.selective_repair_count
        task.input_payload = payload

        # Enqueue new job under the new execution_generation
        new_job = WorkflowJobQueue(
            task_id=task.id,
            workflow_run_id=task.workflow_run_id,
            agency_id=task.agency_id,
            execution_generation=task.current_version,
            status=WorkflowJobStatus.queued,
        )
        db.add(new_job)
        await db.commit()
        return True
