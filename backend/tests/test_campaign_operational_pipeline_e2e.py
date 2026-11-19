from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal

logger = logging.getLogger(__name__)

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.campaign_intelligence.schemas.campaign import CampaignBrief
from app.core.config import settings
from app.core.database import Base
from app.models.agency import Agency
from app.models.brand_profile import BrandProfile
from app.models.client import Client
from app.models.contract import Contract, ContractStatus, ScopeItem
from app.models.operational_workflow import (
    AssigneeType,
    ModelInvocation,
    ReviewDecision,
    TaskKind,
    TaskOutputVersion,
    WorkflowJobQueue,
    WorkflowJobStatus,
    WorkflowRun,
    WorkflowRunStatus,
    WorkflowTask,
    WorkflowTaskReview,
    WorkflowTaskStatus,
)
from app.models.user import User
from app.services.campaign_workflow_bridge import (
    build_campaign_dag_definition,
    record_human_approval,
    register_all_campaign_executors,
)
from app.services.dag_engine import DAGEngine
from app.services.workflow_worker import (
    WorkflowWorkerDaemon,
    claim_workflow_jobs,
)


@pytest.fixture
async def pg_session():
    """PostgreSQL session connected to live Supabase DB for end-to-end integration."""
    engine = create_async_engine(settings.DATABASE_URL, echo=False, poolclass=NullPool)
    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    
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

    await engine.dispose()


async def _seed_vertex_cloud_technologies(db: AsyncSession) -> tuple[Agency, Client, User, BrandProfile]:
    """
    Seeds Vertex Cloud Technologies (High-ticket B2B Tech & Cloud Infrastructure):
    - Multi-persona targeting: VP of Engineering, Cloud Architect, DevOps Lead
    - Strict prohibited terms to test quality evaluator
    - Contract quotas: 2 carousels, 1 reel, 1 static post
    """
    suffix = uuid.uuid4().hex[:8]
    
    # 1. Lead Operator User
    user = User(
        email=f"account_director_{suffix}@agencyos.test",
        hashed_password="pw_hash_test_123",
        full_name=f"Director Sarah Lin ({suffix})",
    )
    db.add(user)
    await db.flush()

    # 2. Agency
    agency = Agency(
        name=f"Apex Technical Agency {suffix}",
        slug=f"apex-agency-{suffix}",
    )
    db.add(agency)
    await db.flush()

    # 3. Client: Vertex Cloud Technologies
    client = Client(
        agency_id=agency.id,
        business_name="Vertex Cloud Technologies",
        industry="Enterprise Cloud Infrastructure & Distributed Systems",
        website="https://vertexcloud.tech",
    )
    db.add(client)
    await db.flush()

    # 4. Brand Profile with Confirmed Guidelines & Prohibited Terms
    brand_profile = BrandProfile(
        client_id=client.id,
        version=1,
        is_confirmed=True,
        confirmed_by_id=user.id,
        confirmed_at=datetime.now(timezone.utc),
        brand_voice="Authoritative, rigorous, and systems-oriented. Zero consumer marketing fluff or hype.",
        tone_examples={
            "prescribed": [
                "Detailed architectural breakdowns of distributed systems failure modes",
                "Explicit latency benchmarks (p95/p99) and infrastructure trade-offs",
                "Pragmatic engineering insights directly addressing developer cognitive load",
            ],
            "proscribed": [
                "Vague business buzzwords like 'Unlock next-gen synergies'",
                "Unsubstantiated superlative claims without verifiable benchmark data",
                "Generic stock photos of corporate teams high-fiving",
            ],
        },
        approved_phrases={
            "phrases": [
                "Zero-downtime distributed failover",
                "eBPF-powered real-time telemetry",
                "Deterministic Kubernetes multi-tenant isolation",
            ]
        },
        prohibited_claims={
            "claims": [
                "guaranteed 100% uptime",
                "cheapest cloud infrastructure on the market",
                "eliminate 100% of cloud security bugs",
            ]
        },
        target_audience={
            "personas": [
                {
                    "title": "VP of Engineering",
                    "focus": "Reliability, cloud spend efficiency, engineering velocity",
                },
                {
                    "title": "Cloud Architect",
                    "focus": "Fault tolerance, network topologies, multi-region failover",
                },
                {
                    "title": "DevOps / SRE Lead",
                    "focus": "CI/CD blast radius, observability, zero-alert fatigue",
                },
            ]
        },
        content_pillars={
            "pillars": [
                "Kubernetes Multi-Cluster Resilience",
                "Cloud Financial Operations (FinOps) & Idle Waste Elimination",
                "eBPF Deep Observability vs Legacy Agent Overhead",
            ]
        },
    )
    db.add(brand_profile)
    await db.flush()

    # 5. Active Scope / Contract Quotas
    contract = Contract(
        client_id=client.id,
        name="Vertex Q4 Enterprise Retainer",
        status=ContractStatus.active,
        start_date=datetime.now(timezone.utc).date(),
    )
    db.add(contract)
    await db.flush()

    scope_carousel = ScopeItem(
        contract_id=contract.id,
        deliverable_type="carousel",
        platform="linkedin",
        monthly_quantity=2,
    )
    scope_reel = ScopeItem(
        contract_id=contract.id,
        deliverable_type="reel",
        platform="instagram",
        monthly_quantity=1,
    )
    scope_static = ScopeItem(
        contract_id=contract.id,
        deliverable_type="static",
        platform="linkedin",
        monthly_quantity=1,
    )
    db.add_all([scope_carousel, scope_reel, scope_static])
    await db.flush()
    await db.commit()

    if hasattr(db, "_test_agency_ids"):
        db._test_agency_ids.append(agency.id)

    return agency, client, user, brand_profile


# ===========================================================================
# End-to-End Campaign Operational Pipeline Execution
# ===========================================================================

@pytest.mark.asyncio
async def test_vertex_cloud_end_to_end_operational_pipeline(pg_session: AsyncSession):
    """
    EXECUTES A COMPLETE 14-STEP CAMPAIGN THROUGH THE OPERATIONAL ENGINE:
    
    1. Seed Vertex Cloud Technologies with confirmed technical brand profile.
    2. Atomically create 14-task operational DAG run.
    3. Worker daemon executes Phase 1: Objective & Plan Ingestion.
    4. Worker daemon executes Phase 2: Parallel Intelligence (Brand, Market, Historical).
    5. Barrier Sync: Worker executes Strategy Synthesis combining all 3 intelligence inputs.
    6. Human Strategy Approval: Workflow pauses at waiting_for_human; AI worker queue holds 0 tasks.
    7. Agency Director reviews and approves Strategy checkpoint -> DAG unblocks Phase 3.
    8. Worker daemon executes Phase 3: Parallel Content Architecture & Visual Asset Planning.
    9. Worker daemon executes Phase 4: Global Quality Audit.
    10. Client Approval: Workflow pauses at waiting_for_human; client lead approves.
    11. Worker daemon executes Phase 5: Publishing dispatch, feedback & Cortex Memory Extraction.
    12. Verify WorkflowRun reaches 'completed' (14/14 tasks) and all ModelInvocations recorded.
    """
    db = pg_session
    agency, client, user, brand_profile = await _seed_vertex_cloud_technologies(db)

    # 1. Prepare Campaign Brief
    brief = CampaignBrief(
        client_id=client.id,
        agency_id=agency.id,
        period_month=11,
        period_year=2026,
        objective="Drive high-intent enterprise pipeline for Vertex Cloud's eBPF telemetry mesh among VP of Engineering and Cloud Architects",
        custom_brief=(
            "Position Vertex Cloud against legacy monolithic monitoring tools (Datadog/NewRelic). "
            "Highlight 85% reduced CPU overhead and instant failover detection. "
            "Deliverables: 2 technical carousels, 1 architecture reel, 1 static benchmark card."
        ),
        target_audience=["VP of Engineering", "Cloud Architect", "DevOps / SRE Lead"],
        platforms=["linkedin", "instagram"],
        deliverable_preferences=["carousel", "reel", "static"],
        pinned_entities=["Vertex eBPF Telemetry Mesh", "Multi-Cluster Failover Engine"],
    )

    # 2. Build 14-task operational DAG definition
    tasks_def, deps_def = build_campaign_dag_definition(brief=brief, human_reviewer_id=user.id)
    assert len(tasks_def) == 14
    assert len(deps_def) == 16

    # 3. Atomically create WorkflowRun
    run = await DAGEngine.create_workflow_run(
        db=db,
        agency_id=agency.id,
        client_id=client.id,
        title="Vertex Cloud Q4 Enterprise Pipeline Sprint",
        tasks_def=tasks_def,
        dependencies_def=deps_def,
        objective_text=brief.objective,
        created_by_id=user.id,
    )
    run_id = run.id
    assert run.status == WorkflowRunStatus.running
    assert run.total_tasks == 14
    assert run.completed_tasks == 0

    # Initialize worker daemon and register all specialist executors
    worker = WorkflowWorkerDaemon(worker_id="ops-worker-lead", db_factory=None)
    register_all_campaign_executors(worker)

    # Helper: execute pending AI/system jobs in worker queue for this agency
    async def drain_worker_queue(max_ticks: int = 10) -> int:
        total_completed = 0
        for _ in range(max_ticks):
            claims = await claim_workflow_jobs(db, worker_id=worker.worker_id, batch_size=5, agency_id=agency.id)
            if not claims:
                break
            for claim in claims:
                success = await worker.execute_job(db, claim)
                if success:
                    total_completed += 1
        return total_completed

    # -----------------------------------------------------------------------
    # Step 4: Execute Phase 1 & 2 (Automated tasks up to Human Strategy Checkpoint)
    #
    # The DAG engine unblocks:
    # 1. agency_objective -> completes -> unblocks create_workflow_plan
    # 2. create_workflow_plan -> completes -> unblocks brand_intelligence, market_research, historical_performance (parallel)
    # 3. parallel intelligence tasks -> complete -> unblocks campaign_strategy
    # 4. campaign_strategy -> completes -> unblocks human_strategy_approval (HUMAN checkpoint)
    # -----------------------------------------------------------------------
    done_pre_human = await drain_worker_queue(max_ticks=10)
    assert done_pre_human >= 6

    # Refresh task statuses
    tasks_stmt = select(WorkflowTask).where(WorkflowTask.workflow_run_id == run_id)
    tasks = (await db.execute(tasks_stmt)).scalars().all()
    t_map = {t.task_key: t for t in tasks}

    assert t_map["agency_objective"].status == WorkflowTaskStatus.completed
    assert t_map["create_workflow_plan"].status == WorkflowTaskStatus.completed
    assert t_map["brand_intelligence"].status == WorkflowTaskStatus.completed
    assert t_map["market_research"].status == WorkflowTaskStatus.completed
    assert t_map["historical_performance"].status == WorkflowTaskStatus.completed
    assert t_map["campaign_strategy"].status == WorkflowTaskStatus.completed

    # Verify Brand Intelligence output verified Vertex Cloud's business name
    brand_out = (
        await db.execute(
            select(TaskOutputVersion.output_payload).where(
                TaskOutputVersion.task_id == t_map["brand_intelligence"].id,
                TaskOutputVersion.is_active == True,
            )
        )
    ).scalar_one()
    assert brand_out["business_name"] == "Vertex Cloud Technologies"

    # Verify Campaign Strategy output
    strat_out = (
        await db.execute(
            select(TaskOutputVersion.output_payload).where(
                TaskOutputVersion.task_id == t_map["campaign_strategy"].id,
                TaskOutputVersion.is_active == True,
            )
        )
    ).scalar_one()
    assert "campaign_theme" in strat_out
    assert len(strat_out.get("strategic_angles", [])) >= 1

    # -----------------------------------------------------------------------
    # Step 5: Human Strategy Checkpoint
    # -----------------------------------------------------------------------
    # Human task MUST be in waiting_for_human and NOT queued for AI workers
    assert t_map["human_strategy_approval"].status == WorkflowTaskStatus.waiting_for_human

    # Verify worker queue has 0 claimable tasks
    remaining_claims = await claim_workflow_jobs(db, worker_id="test", batch_size=1, agency_id=agency.id)
    assert len(remaining_claims) == 0

    # Human Director reviews strategy and submits sign-off
    unblocked_by_human = await record_human_approval(
        db=db,
        task_id=t_map["human_strategy_approval"].id,
        reviewer_id=user.id,
        decision=ReviewDecision.approved,
        feedback_notes="Strategic angles strongly grounded in distributed system latency benchmarks. Approved for production.",
    )
    assert len(unblocked_by_human) == 2  # Unblocks content_architecture and visual_asset_planning

    # Verify review row recorded
    reviews = (
        await db.execute(
            select(WorkflowTaskReview).where(
                WorkflowTaskReview.task_id == t_map["human_strategy_approval"].id
            )
        )
    ).scalars().all()
    assert len(reviews) == 1
    assert reviews[0].decision == ReviewDecision.approved

    # -----------------------------------------------------------------------
    # Step 6: Execute Phase 3 & QA (content_architecture, visual_asset_planning, final_quality_audit)
    #
    # Unblocked by human strategy approval:
    # 1. content_architecture & visual_asset_planning execute in parallel
    # 2. Both complete -> unblocks final_quality_audit
    # 3. final_quality_audit completes -> unblocks client_approval (HUMAN checkpoint)
    # -----------------------------------------------------------------------
    done_phase3_and_qa = await drain_worker_queue(max_ticks=10)
    assert done_phase3_and_qa >= 3

    tasks = (await db.execute(tasks_stmt)).scalars().all()
    t_map = {t.task_key: t for t in tasks}

    assert t_map["content_architecture"].status == WorkflowTaskStatus.completed
    assert t_map["visual_asset_planning"].status == WorkflowTaskStatus.completed
    assert t_map["final_quality_audit"].status == WorkflowTaskStatus.completed

    content_out = (
        await db.execute(
            select(TaskOutputVersion.output_payload).where(
                TaskOutputVersion.task_id == t_map["content_architecture"].id,
                TaskOutputVersion.is_active == True,
            )
        )
    ).scalar_one()
    assert len(content_out.get("deliverables", [])) >= 1

    qa_out = (
        await db.execute(
            select(TaskOutputVersion.output_payload).where(
                TaskOutputVersion.task_id == t_map["final_quality_audit"].id,
                TaskOutputVersion.is_active == True,
            )
        )
    ).scalar_one()
    assert "compliance_score" in qa_out

    # -----------------------------------------------------------------------
    # Step 7: Client Approval Checkpoint
    # -----------------------------------------------------------------------
    assert t_map["client_approval"].status == WorkflowTaskStatus.waiting_for_human

    # Client Lead signs off on finalized deliverables
    await record_human_approval(
        db=db,
        task_id=t_map["client_approval"].id,
        reviewer_id=user.id,
        decision=ReviewDecision.approved,
        feedback_notes="All technical architectures and benchmarks verified against client Kubernetes cluster logs. Approved.",
    )

    # -----------------------------------------------------------------------
    # Step 8: Execute Final Phase (publishing, feedback, cortex memory)
    # -----------------------------------------------------------------------
    done_final = await drain_worker_queue(max_ticks=10)
    assert done_final >= 3

    # Refresh entire workflow run
    run_final = await db.get(WorkflowRun, run_id)
    assert run_final is not None

    tasks = (await db.execute(tasks_stmt)).scalars().all()
    t_map = {t.task_key: t for t in tasks}

    # Verify all 14 tasks completed cleanly
    for task_key, task_obj in t_map.items():
        assert task_obj.status == WorkflowTaskStatus.completed, f"Task {task_key} ended with status: {task_obj.status}"

    assert run_final.completed_tasks == 14
    assert run_final.total_tasks == 14
    assert run_final.status == WorkflowRunStatus.completed
    assert run_final.completed_at is not None

    # -----------------------------------------------------------------------
    # Step 12: Verify Cortex Persistent Memory Proposals
    # -----------------------------------------------------------------------
    cortex_out = (
        await db.execute(
            select(TaskOutputVersion.output_payload).where(
                TaskOutputVersion.task_id == t_map["cortex_memory_proposals"].id,
                TaskOutputVersion.is_active == True,
            )
        )
    ).scalar_one()
    assert "memory_proposals" in cortex_out
    assert len(cortex_out["memory_proposals"]) >= 1

    # -----------------------------------------------------------------------
    # Step 13: Verify Financial Model Telemetry Records
    # -----------------------------------------------------------------------
    invocations_stmt = select(ModelInvocation).where(ModelInvocation.agency_id == agency.id)
    invocations = (await db.execute(invocations_stmt)).scalars().all()

    assert len(invocations) >= 5  # Telemetry recorded for brand, market, strategy, content, qa
    total_cost = sum([inv.cost_usd for inv in invocations], Decimal("0.000000"))
    assert total_cost > Decimal("0.000000")
    total_tokens = sum([inv.total_tokens or 0 for inv in invocations])
    assert total_tokens > 1000

    logger.info(
        f"VERTEX CLOUD CAMPAIGN COMPLETED SUCCESSFULLY!\n"
        f"Tasks Completed: {run_final.completed_tasks}/{run_final.total_tasks}\n"
        f"Total Invocations: {len(invocations)}\n"
        f"Total Tokens: {total_tokens}\n"
        f"Authoritative Cost: ${total_cost:.6f} USD"
    )
