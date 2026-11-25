from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.campaign_intelligence.schemas.campaign import CampaignBrief
from app.campaign_intelligence.tools.date_utils import (
    extract_date_range_from_text,
    extract_format_and_count_from_text,
    extract_format_breakdown_from_text,
    extract_platforms_from_text,
)
from app.core.database import AsyncSessionLocal, get_db
from app.dependencies import get_current_user, require_agency_member
from app.models.brand_profile import BrandProfile
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
    target_audience: str | list[str] | None = None
    platforms: list[str] | None = None
    formats: list[str] | None = None
    deliverable_count: int | None = None
    key_offer: str | None = None
    additional_context: str | None = None
    pinned_entities: list[str] = Field(default_factory=list)
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

    # Parse explicit start/end dates when provided from Studio chat
    start_dt: date | None = None
    end_dt: date | None = None
    if payload.start_date:
        try:
            start_dt = datetime.strptime(payload.start_date.strip()[:10], "%Y-%m-%d").date()
        except Exception:
            start_dt = None
    if payload.end_date:
        try:
            end_dt = datetime.strptime(payload.end_date.strip()[:10], "%Y-%m-%d").date()
        except Exception:
            end_dt = None

    scan_text = " ".join(
        p for p in [payload.additional_context or "", payload.theme or "", payload.primary_goal or ""] if p
    ).strip()

    # Extract explicit user-requested platforms/counts without double-counting assistant plan sections
    user_req_text = ""
    if payload.additional_context:
        if "User Requirements from Chat:" in payload.additional_context:
            after_user = payload.additional_context.split("User Requirements from Chat:", 1)[1]
            user_req_text = after_user.split("Proposed Plan & Concepts Discussed in Chat", 1)[0].strip()
        else:
            user_req_text = payload.additional_context.split("Proposed Plan & Concepts Discussed in Chat", 1)[0].strip()
    intent_scan_text = " ".join(
        p for p in [user_req_text, payload.theme or "", payload.primary_goal or ""] if p
    ).strip() or scan_text

    if not start_dt and scan_text:
        extracted_dates = extract_date_range_from_text(
            scan_text,
            default_year=payload.period_year or now.year,
            reference_start_date=payload.start_date,
        )
        if extracted_dates:
            start_dt = extracted_dates.start_date
            end_dt = end_dt or extracted_dates.end_date

    resolved_duration = payload.duration_days
    if start_dt and end_dt and not resolved_duration:
        resolved_duration = max(1, (end_dt - start_dt).days + 1)
    if not resolved_duration:
        resolved_duration = 1
    if not start_dt:
        start_dt = now.date()
    if not end_dt:
        end_dt = start_dt + timedelta(days=max(0, resolved_duration - 1))

    target_month = payload.period_month or start_dt.month
    target_year = payload.period_year or start_dt.year

    # Normalize target_audience; fall back to the client's actual BrandProfile audience instead of hardcoded jargon
    audience_list: list[str] = []
    if isinstance(payload.target_audience, list):
        audience_list = [str(a).strip() for a in payload.target_audience if str(a).strip()]
    elif isinstance(payload.target_audience, str) and payload.target_audience.strip():
        audience_list = [a.strip() for a in payload.target_audience.split(",") if a.strip()]

    if not audience_list:
        bp_res = await db.execute(select(BrandProfile).where(BrandProfile.client_id == payload.client_id))
        bp = bp_res.scalars().first()
        if bp and bp.target_audience:
            if isinstance(bp.target_audience, list):
                audience_list = [str(a).strip() for a in bp.target_audience if str(a).strip()]
            elif isinstance(bp.target_audience, dict):
                audience_list = [str(v).strip() for v in bp.target_audience.values() if str(v).strip()]
            else:
                audience_list = [str(bp.target_audience).strip()]
    if not audience_list:
        audience_list = ["Target Customers & Decision Makers"]

    objective_str = (payload.primary_goal or payload.theme or payload.campaign_name or "Drive qualified engagement and conversions").strip()
    if len(objective_str) < 3:
        objective_str = "Drive qualified engagement and conversions"

    # Separate real social platforms from format names and extract explicit format breakdowns from brief/chat
    valid_platforms = {"instagram", "linkedin", "facebook", "youtube", "twitter", "tiktok"}
    raw_platforms = [p.lower().strip() for p in (payload.platforms or []) if p and p.strip()]
    explicit_platforms = [p for p in raw_platforms if p in valid_platforms]
    leaked_formats = [p for p in raw_platforms if p not in valid_platforms]

    extracted_platforms = extract_platforms_from_text(intent_scan_text)
    resolved_platforms = explicit_platforms or extracted_platforms or ["linkedin", "instagram"]

    extracted_fmts, extracted_cnt = extract_format_and_count_from_text(intent_scan_text)
    format_breakdown = extract_format_breakdown_from_text(intent_scan_text)
    if payload.deliverable_count and format_breakdown and sum(format_breakdown.values()) > payload.deliverable_count:
        # Avoid inflated breakdown if user prompt echoed counts across multiple lines
        last_line = [ln.strip() for ln in user_req_text.splitlines() if ln.strip()]
        if last_line:
            single_bd = extract_format_breakdown_from_text(last_line[-1])
            if single_bd:
                format_breakdown = single_bd
    resolved_formats = (
        [f.lower().strip() for f in (payload.formats or []) if f and f.strip()]
        or leaked_formats
        or extracted_fmts
        or ["carousel", "reel"]
    )
    resolved_count = (
        payload.deliverable_count
        or (sum(format_breakdown.values()) if format_breakdown else None)
        or extracted_cnt
    )

    pinned_note = f"\nPinned Hero Entities: {', '.join(payload.pinned_entities)}" if payload.pinned_entities else ""
    key_offer_note = f"\nKey Offer: {payload.key_offer}" if payload.key_offer else ""
    custom_brief_parts = [
        f"Campaign: {payload.campaign_name} | Theme: {payload.theme or payload.campaign_name} | Goal: {objective_str}",
        payload.additional_context.strip() if payload.additional_context and payload.additional_context.strip() else "",
    ]
    custom_brief_str = "\n\n".join(p for p in custom_brief_parts if p) + key_offer_note + pinned_note

    brief = CampaignBrief(
        client_id=payload.client_id,
        agency_id=agency_id,
        period_month=target_month,
        period_year=target_year,
        start_date=start_dt,
        end_date=end_dt,
        duration_days=resolved_duration,
        target_deliverables_count=resolved_count,
        objective=objective_str,
        custom_brief=custom_brief_str,
        target_audience=audience_list,
        platforms=resolved_platforms,
        deliverable_preferences=resolved_formats,
        deliverable_requests=format_breakdown,
        pinned_entities=payload.pinned_entities,
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
            workflow_run_id=run.id,
        )
        if not claims:
            tasks_check_stmt = select(WorkflowTask).where(WorkflowTask.workflow_run_id == run.id)
            tasks_check = (await db.execute(tasks_check_stmt)).scalars().all()
            has_waiting_human = any(t.status == WorkflowTaskStatus.waiting_for_human for t in tasks_check)
            all_done = all(t.status in (WorkflowTaskStatus.completed, WorkflowTaskStatus.failed, WorkflowTaskStatus.cancelled) for t in tasks_check)
            if has_waiting_human or all_done:
                break

            await asyncio.sleep(0.25)
            claims = await claim_workflow_jobs(
                db,
                worker_id=worker.worker_id,
                batch_size=5,
                agency_id=agency_id,
                workflow_run_id=run.id,
            )
            if not claims:
                break

        if len(claims) == 1:
            success = await worker.execute_job(db, claims[0])
            if success:
                total_completed += 1
        else:
            async def _run_single_claim(claim_data: dict[str, Any]) -> bool:
                async with AsyncSessionLocal() as sub_db:
                    return await worker.execute_job(sub_db, claim_data)

            results = await asyncio.gather(*[_run_single_claim(c) for c in claims], return_exceptions=True)
            for res in results:
                if res is True:
                    total_completed += 1
                elif isinstance(res, Exception):
                    logger.error(f"Error executing parallel job in workflow run {run.id}: {res}", exc_info=True)

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
        "unblocked_tasks": [str(t.id) if hasattr(t, "id") else str(t) for t in unblocked_tasks],
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
