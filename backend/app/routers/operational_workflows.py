from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.campaign_intelligence.schemas.campaign import CampaignBrief
from app.core.database import get_db
from app.dependencies import get_current_user, require_agency_member
from app.models.campaign import Campaign, CampaignStatus
from app.models.operational_workflow import (
    AssigneeType,
    ModelInvocation,
    ReviewDecision,
    TaskKind,
    TaskOutputVersion,
    WorkflowDependency,
    WorkflowJobQueue,
    WorkflowJobStatus,
    WorkflowRun,
    WorkflowRunStatus,
    WorkflowTask,
    WorkflowTaskReview,
    WorkflowTaskStatus,
)
from app.models.user import Membership, User
from app.services.campaign_workflow_bridge import (
    build_campaign_dag_definition,
    record_human_approval,
    register_all_campaign_executors,
)
from app.services.dag_engine import DAGEngine
from app.services.workflow_worker import WorkflowWorkerDaemon, claim_workflow_jobs

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agencies/{agency_id}/operational-workflows", tags=["operational-workflows"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class LaunchWorkflowRequest(BaseModel):
    client_id: uuid.UUID
    campaign_name: str
    theme: str | None = None
    primary_goal: str | None = None
    target_audience: str | list[str] = Field(default_factory=lambda: ["Enterprise Decision Makers & Technical Leads"])
    platforms: list[str] = Field(default_factory=lambda: ["linkedin"])
    formats: list[str] = Field(default_factory=lambda: ["carousel", "video_script"])
    deliverable_count: int = 2
    key_offer: str | None = None
    additional_context: str | None = None
    brand_id: str | None = None
    period_month: int | None = None
    period_year: int | None = None
    start_date: str | None = None
    end_date: str | None = None
    duration_days: int | None = None


class WorkflowTaskSummary(BaseModel):
    id: uuid.UUID
    task_key: str
    title: str
    task_kind: str
    assignee_type: str
    status: str
    current_version: int = 1
    created_at: datetime
    completed_at: datetime | None = None


class WorkflowRunDetailOut(BaseModel):
    id: uuid.UUID
    agency_id: uuid.UUID
    client_id: uuid.UUID | None
    campaign_id: uuid.UUID | None = None
    name: str
    status: str
    total_tasks: int
    completed_tasks: int
    failed_tasks: int
    created_at: datetime
    completed_at: datetime | None
    tasks: list[WorkflowTaskSummary]
    dependencies: list[dict[str, str]]


class ReviewTaskRequest(BaseModel):
    decision: ReviewDecision
    feedback_notes: str | None = None


class StepRunResponse(BaseModel):
    run_id: uuid.UUID
    completed_tasks_count: int
    run_status: str
    waiting_for_human_tasks: list[str]


class TelemetrySummaryOut(BaseModel):
    run_id: uuid.UUID
    total_cost_usd: Decimal
    total_tokens: int
    invocations_count: int
    invocations: list[dict[str, Any]]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/runs", response_model=list[WorkflowRunDetailOut])
async def list_operational_runs(
    agency_id: uuid.UUID,
    client_id: uuid.UUID | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    membership: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    List operational workflow runs for the agency.
    """
    stmt = select(WorkflowRun).where(WorkflowRun.agency_id == agency_id)
    if client_id:
        stmt = stmt.where(WorkflowRun.client_id == client_id)
    actual_limit = limit.default if hasattr(limit, "default") else limit
    stmt = stmt.order_by(desc(WorkflowRun.created_at)).limit(int(actual_limit))

    runs = (await db.execute(stmt)).scalars().all()
    results = []
    for r in runs:
        detail = await _fetch_run_detail(db, r.id, agency_id)
        results.append(detail)
    return results


@router.post("/runs/launch", response_model=WorkflowRunDetailOut, status_code=status.HTTP_201_CREATED)
async def launch_operational_campaign(
    agency_id: uuid.UUID,
    payload: LaunchWorkflowRequest,
    current_user: User = Depends(get_current_user),
    membership: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Launch a new 14-task operational campaign run in the AgencyOS DAG engine.
    """
    now = datetime.now(timezone.utc)
    target_month = payload.period_month or now.month
    target_year = payload.period_year or now.year

    # Normalize target_audience to list[str]
    if isinstance(payload.target_audience, list):
        audience_list = payload.target_audience
    elif isinstance(payload.target_audience, str) and payload.target_audience.strip():
        audience_list = [a.strip() for a in payload.target_audience.split(",") if a.strip()]
    else:
        audience_list = ["Enterprise Decision Makers & Technical Leads"]

    objective_str = (payload.primary_goal or payload.theme or payload.campaign_name or "Drive high-intent enterprise pipeline").strip()
    if len(objective_str) < 3:
        objective_str = "Drive high-intent enterprise pipeline"

    custom_brief_str = f"Campaign: {payload.campaign_name}. Theme: {payload.theme or payload.campaign_name}. Goal: {objective_str}. {payload.additional_context or ''}".strip()

    brief = CampaignBrief(
        client_id=payload.client_id,
        agency_id=agency_id,
        period_month=target_month,
        period_year=target_year,
        start_date=now.date(),
        end_date=now.date(),
        duration_days=payload.duration_days or payload.deliverable_count or 4,
        objective=objective_str,
        custom_brief=custom_brief_str,
        target_audience=audience_list,
        platforms=payload.platforms or ["linkedin"],
        deliverable_preferences=payload.formats or ["carousel", "video_script"],
    )

    tasks_def, dep_tuples = build_campaign_dag_definition(
        brief=brief,
        human_reviewer_id=current_user.id,
    )

    # 1. Create a dedicated Campaign record for this sprint
    new_campaign = Campaign(
        id=uuid.uuid4(),
        client_id=payload.client_id,
        name=payload.campaign_name,
        status=CampaignStatus.planning,
        period_month=target_month,
        period_year=target_year,
        objective=objective_str,
        ai_plan_draft={
            "campaign_theme": payload.theme or payload.campaign_name,
            "primary_objective": objective_str,
            "deliverables": [],
            "status": "generating",
        },
    )
    db.add(new_campaign)
    await db.flush()

    run = await DAGEngine.create_workflow_run(
        db=db,
        agency_id=agency_id,
        client_id=payload.client_id,
        title=payload.campaign_name,
        tasks_def=tasks_def,
        dependencies_def=dep_tuples,
        created_by_id=current_user.id,
        objective_text=objective_str,
        shared_contract=brief.model_dump(mode="json"),
    )
    run.campaign_id = new_campaign.id
    await db.commit()

    return await _fetch_run_detail(db, run.id, agency_id)


@router.get("/runs/{run_id}", response_model=WorkflowRunDetailOut)
async def get_workflow_run(
    agency_id: uuid.UUID,
    run_id: uuid.UUID,
    membership: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Inspect the live DAG state, task execution progression, and dependencies for a workflow run.
    """
    return await _fetch_run_detail(db, run_id, agency_id)


@router.post("/runs/{run_id}/step", response_model=StepRunResponse)
async def step_workflow_run(
    agency_id: uuid.UUID,
    run_id: uuid.UUID,
    max_ticks: int = Query(default=10, ge=1, le=50),
    membership: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Execute pending queued jobs in the DAG up to the next human review checkpoint or completion.
    """
    run = await db.get(WorkflowRun, run_id)
    if not run or run.agency_id != agency_id:
        raise HTTPException(status_code=404, detail="Workflow run not found.")

    worker = WorkflowWorkerDaemon(worker_id=f"api-worker-{membership.user_id}", db_factory=None)
    register_all_campaign_executors(worker)

    total_completed = 0
    for _ in range(max_ticks):
        claims = await claim_workflow_jobs(
            db,
            worker_id=worker.worker_id,
            batch_size=5,
            agency_id=agency_id,
        )
        if not claims:
            break
        for claim in claims:
            success = await worker.execute_job(db, claim)
            if success:
                total_completed += 1

    await db.refresh(run)

    tasks_stmt = select(WorkflowTask).where(WorkflowTask.workflow_run_id == run_id)
    tasks = (await db.execute(tasks_stmt)).scalars().all()
    waiting_tasks = [t.task_key for t in tasks if t.status == WorkflowTaskStatus.waiting_for_human]

    return StepRunResponse(
        run_id=run.id,
        completed_tasks_count=total_completed,
        run_status=run.status.value,
        waiting_for_human_tasks=waiting_tasks,
    )


@router.get("/tasks/{task_id}/output")
async def get_task_output(
    agency_id: uuid.UUID,
    task_id: uuid.UUID,
    membership: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Get the latest verified output payload for a task (e.g. strategy, deliverables, QA audit, cortex memory).
    """
    task = await db.get(WorkflowTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    run = await db.get(WorkflowRun, task.workflow_run_id)
    if not run or run.agency_id != agency_id:
        raise HTTPException(status_code=403, detail="Unauthorized access to task.")

    output_stmt = select(TaskOutputVersion).where(
        TaskOutputVersion.task_id == task_id,
        TaskOutputVersion.is_active == True,
    )
    output_version = (await db.execute(output_stmt)).scalar_one_or_none()

    return {
        "task_id": task.id,
        "task_key": task.task_key,
        "title": task.title,
        "status": task.status.value,
        "output": output_version.output_payload if output_version else None,
        "version": output_version.version_number if output_version else None,
    }


@router.post("/tasks/{task_id}/review")
async def review_workflow_task(
    agency_id: uuid.UUID,
    task_id: uuid.UUID,
    payload: ReviewTaskRequest,
    current_user: User = Depends(get_current_user),
    membership: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Submit human review sign-off or revision request for a checkpoint task (Strategy Sign-off, Client Approval).
    """
    task = await db.get(WorkflowTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    run = await db.get(WorkflowRun, task.workflow_run_id)
    if not run or run.agency_id != agency_id:
        raise HTTPException(status_code=403, detail="Unauthorized access.")

    if task.assignee_type != AssigneeType.human and task.status != WorkflowTaskStatus.waiting_for_human:
        raise HTTPException(status_code=400, detail="Task is not waiting for human review.")

    unblocked_tasks = await record_human_approval(
        db=db,
        task_id=task.id,
        reviewer_id=current_user.id,
        decision=payload.decision,
        feedback_notes=payload.feedback_notes,
    )
    await db.commit()

    return {
        "task_id": task.id,
        "decision": payload.decision.value,
        "unblocked_tasks": [str(t.id) for t in unblocked_tasks],
        "message": f"Human review recorded with decision '{payload.decision.value}'. {len(unblocked_tasks)} tasks unblocked.",
    }


@router.get("/runs/{run_id}/telemetry", response_model=TelemetrySummaryOut)
async def get_workflow_telemetry(
    agency_id: uuid.UUID,
    run_id: uuid.UUID,
    membership: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Fetch exact financial token and USD cost telemetry across all LLM invocations in this workflow run.
    """
    run = await db.get(WorkflowRun, run_id)
    if not run or run.agency_id != agency_id:
        raise HTTPException(status_code=404, detail="Workflow run not found.")

    inv_stmt = select(ModelInvocation).where(
        ModelInvocation.agency_id == agency_id,
        ModelInvocation.workflow_run_id == run_id,
    )
    invocations = (await db.execute(inv_stmt)).scalars().all()

    total_cost = sum([inv.cost_usd for inv in invocations], Decimal("0.000000"))
    total_tokens = sum([inv.total_tokens or 0 for inv in invocations])

    inv_list = [
        {
            "id": inv.id,
            "provider": inv.provider,
            "model": inv.model_identifier,
            "prompt_tokens": inv.prompt_tokens,
            "completion_tokens": inv.completion_tokens,
            "total_tokens": inv.total_tokens,
            "cost_usd": str(inv.cost_usd),
            "latency_ms": inv.latency_ms,
            "status": inv.invocation_status,
        }
        for inv in invocations
    ]

    return TelemetrySummaryOut(
        run_id=run.id,
        total_cost_usd=total_cost,
        total_tokens=total_tokens,
        invocations_count=len(invocations),
        invocations=inv_list,
    )


# ---------------------------------------------------------------------------
# Internal Helpers
# ---------------------------------------------------------------------------

async def _fetch_run_detail(db: AsyncSession, run_id: uuid.UUID, agency_id: uuid.UUID) -> WorkflowRunDetailOut:
    run = await db.get(WorkflowRun, run_id)
    if not run or run.agency_id != agency_id:
        raise HTTPException(status_code=404, detail="Workflow run not found.")

    tasks_stmt = select(WorkflowTask).where(WorkflowTask.workflow_run_id == run_id).order_by(WorkflowTask.created_at)
    tasks = (await db.execute(tasks_stmt)).scalars().all()

    deps_stmt = (
        select(WorkflowDependency)
        .where(WorkflowDependency.workflow_run_id == run_id)
    )
    deps = (await db.execute(deps_stmt)).scalars().all()

    t_map = {t.id: t.task_key for t in tasks}
    dep_list = [
        {"parent": t_map.get(d.depends_on_task_id, str(d.depends_on_task_id)), "child": t_map.get(d.task_id, str(d.task_id))}
        for d in deps
        if d.depends_on_task_id in t_map and d.task_id in t_map
    ]

    task_summaries = [
        WorkflowTaskSummary(
            id=t.id,
            task_key=t.task_key,
            title=t.title,
            task_kind=t.task_kind.value,
            assignee_type=t.assignee_type.value,
            status=t.status.value,
            current_version=t.current_version,
            created_at=t.created_at,
            completed_at=t.completed_at,
        )
        for t in tasks
    ]

    return WorkflowRunDetailOut(
        id=run.id,
        agency_id=run.agency_id,
        client_id=run.client_id,
        campaign_id=run.campaign_id,
        name=run.title,
        status=run.status.value,
        total_tasks=run.total_tasks,
        completed_tasks=run.completed_tasks,
        failed_tasks=run.failed_tasks,
        created_at=run.created_at,
        completed_at=run.completed_at,
        tasks=task_summaries,
        dependencies=dep_list,
    )
