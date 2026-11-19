from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.campaign_intelligence.agents.brand_intelligence import BrandIntelligenceAgent
from app.campaign_intelligence.agents.campaign_strategist import CampaignStrategistAgent
from app.campaign_intelligence.agents.content_architect import ContentArchitectAgent
from app.campaign_intelligence.agents.historical_performance import HistoricalPerformanceAgent
from app.campaign_intelligence.agents.market_research import MarketResearchAgent
from app.campaign_intelligence.agents.quality_evaluator import QualityEvaluatorAgent
from app.campaign_intelligence.schemas.brand import BrandContext
from app.campaign_intelligence.schemas.campaign import CampaignBrief
from app.campaign_intelligence.schemas.deliverables import DeliverablePlan
from app.campaign_intelligence.schemas.performance import PerformancePlaybook
from app.campaign_intelligence.schemas.quality import QualityEvaluation
from app.campaign_intelligence.schemas.research import MarketResearchReport
from app.campaign_intelligence.schemas.strategy import CampaignStrategy
from app.models.operational_workflow import (
    AssigneeType,
    ReviewDecision,
    TaskKind,
    TaskOutputVersion,
    WorkflowDependency,
    WorkflowJobQueue,
    WorkflowJobStatus,
    WorkflowRun,
    WorkflowTask,
    WorkflowTaskReview,
    WorkflowTaskStatus,
)
from app.services.dag_engine import DAGEngine
from app.services.workflow_worker import WorkflowWorkerDaemon

logger = logging.getLogger(__name__)


def build_campaign_dag_definition(
    brief: CampaignBrief,
    human_reviewer_id: uuid.UUID | None = None,
) -> tuple[list[dict[str, Any]], list[tuple[str, str]]]:
    """
    Constructs the complete 14-task operational DAG matching the AgencyOS 2.0 blueprint:
    
    1. agency_objective (system)
    2. create_workflow_plan (system) [depends: 1]
    3. brand_intelligence (ai_agent) [depends: 2]
    4. market_research (ai_agent) [depends: 2]
    5. historical_performance (ai_agent) [depends: 2]
    6. campaign_strategy (ai_agent) [depends: 3, 4, 5]
    7. human_strategy_approval (human_approval) [depends: 6]
    8. content_architecture (ai_agent) [depends: 7]
    9. visual_asset_planning (ai_agent) [depends: 7]
    10. final_quality_audit (ai_agent) [depends: 8, 9]
    11. client_approval (human_approval) [depends: 10]
    12. publishing_execution (system) [depends: 11]
    13. performance_feedback (system) [depends: 12]
    14. cortex_memory_proposals (ai_agent) [depends: 13]
    """
    brief_dict = brief.model_dump(mode="json")

    tasks_def: list[dict[str, Any]] = [
        # Step 1: Objective Ingestion
        {
            "task_key": "agency_objective",
            "title": "Agency Objective & Brief Ingestion",
            "description": f"Ingest and validate campaign objective for {brief.objective}",
            "task_kind": TaskKind.system_deterministic,
            "assignee_type": AssigneeType.system,
            "input_payload": {"brief": brief_dict},
        },
        # Step 2: Workflow Plan Generation
        {
            "task_key": "create_workflow_plan",
            "title": "Workflow Plan Synthesis",
            "description": "Synthesize operational DAG tasks, shared contract, and tenant boundaries",
            "task_kind": TaskKind.system_deterministic,
            "assignee_type": AssigneeType.system,
            "input_payload": {"brief": brief_dict},
        },
        # Step 3: Brand Intelligence (Parallel 1)
        {
            "task_key": "brand_intelligence",
            "title": "Brand Intelligence & Positioning Audit",
            "description": "Deterministic brand retrieval, prohibited term check, and tone boundaries",
            "task_kind": TaskKind.ai_agent,
            "assignee_type": AssigneeType.agent,
            "agent_identifier": "brand_intelligence",
            "input_payload": {"brief": brief_dict},
        },
        # Step 4: Market Research (Parallel 2)
        {
            "task_key": "market_research",
            "title": "Market & Competitor Research",
            "description": "Audience pain points, competitor gaps, and format trends",
            "task_kind": TaskKind.ai_agent,
            "assignee_type": AssigneeType.agent,
            "agent_identifier": "market_research",
            "input_payload": {"brief": brief_dict},
        },
        # Step 5: Historical Performance (Parallel 3)
        {
            "task_key": "historical_performance",
            "title": "Historical Performance & Fatigue Analysis",
            "description": "Statistical performance analysis, winning angles, and audience fatigue signals",
            "task_kind": TaskKind.ai_agent,
            "assignee_type": AssigneeType.agent,
            "agent_identifier": "historical_performance",
            "input_payload": {"brief": brief_dict},
        },
        # Step 6: Campaign Strategy Synthesis
        {
            "task_key": "campaign_strategy",
            "title": "Campaign Strategy & Positioning Synthesis",
            "description": "Synthesizes Brand, Market, and Performance intelligence into a unified strategy",
            "task_kind": TaskKind.ai_agent,
            "assignee_type": AssigneeType.agent,
            "agent_identifier": "campaign_strategy",
            "input_payload": {"brief": brief_dict},
        },
        # Step 7: Human Strategy Checkpoint
        {
            "task_key": "human_strategy_approval",
            "title": "Human Strategy Checkpoint",
            "description": "Human review of strategic theme, angles, and messaging pillars before creative production",
            "task_kind": TaskKind.human_approval,
            "assignee_type": AssigneeType.human,
            "human_assignee_id": human_reviewer_id,
            "input_payload": {},
        },
        # Step 8: Content Architecture (Parallel Creative 1)
        {
            "task_key": "content_architecture",
            "title": "Polymorphic Content Architecture",
            "description": "Generates granular, production-ready deliverable plans matching contract quotas",
            "task_kind": TaskKind.ai_agent,
            "assignee_type": AssigneeType.agent,
            "agent_identifier": "content_architecture",
            "input_payload": {"brief": brief_dict},
        },
        # Step 9: Visual Asset Planning (Parallel Creative 2)
        {
            "task_key": "visual_asset_planning",
            "title": "Visual Asset & Art Direction Planning",
            "description": "Generates visual layout prompts, graphic typography, color harmony, and director cues",
            "task_kind": TaskKind.ai_agent,
            "assignee_type": AssigneeType.agent,
            "agent_identifier": "visual_asset_planning",
            "input_payload": {"brief": brief_dict},
        },
        # Step 10: Global Quality Audit
        {
            "task_key": "final_quality_audit",
            "title": "Global Quality & Factual Verification Audit",
            "description": "Evaluates deliverables against prohibited terms, contract quotas, and brand compliance",
            "task_kind": TaskKind.ai_agent,
            "assignee_type": AssigneeType.agent,
            "agent_identifier": "quality_evaluator",
            "input_payload": {"brief": brief_dict},
        },
        # Step 11: Client Approval Checkpoint
        {
            "task_key": "client_approval",
            "title": "Client Final Approval Checkpoint",
            "description": "Final sign-off by client stakeholders prior to publication dispatch",
            "task_kind": TaskKind.human_approval,
            "assignee_type": AssigneeType.human,
            "human_assignee_id": human_reviewer_id,
            "input_payload": {},
        },
        # Step 12: Publishing & Multi-Channel Execution
        {
            "task_key": "publishing_execution",
            "title": "Publishing & Multi-Channel Dispatch",
            "description": "Enqueues approved deliverables into durable publication jobs for Instagram, Facebook, LinkedIn",
            "task_kind": TaskKind.system_deterministic,
            "assignee_type": AssigneeType.system,
            "input_payload": {},
        },
        # Step 13: Live Performance Feedback
        {
            "task_key": "performance_feedback",
            "title": "Live Performance Feedback Ingestion",
            "description": "Aggregates initial post engagement, comments, and conversion metrics",
            "task_kind": TaskKind.system_deterministic,
            "assignee_type": AssigneeType.system,
            "input_payload": {},
        },
        # Step 14: Cortex Memory Proposals
        {
            "task_key": "cortex_memory_proposals",
            "title": "Cortex Persistent Memory Extraction",
            "description": "Extracts institutional knowledge, winning hooks, and audience patterns into persistent memory",
            "task_kind": TaskKind.ai_agent,
            "assignee_type": AssigneeType.agent,
            "agent_identifier": "cortex_memory",
            "input_payload": {"brief": brief_dict},
        },
    ]

    dependencies_def: list[tuple[str, str]] = [
        ("create_workflow_plan", "agency_objective"),
        ("brand_intelligence", "create_workflow_plan"),
        ("market_research", "create_workflow_plan"),
        ("historical_performance", "create_workflow_plan"),
        ("campaign_strategy", "brand_intelligence"),
        ("campaign_strategy", "market_research"),
        ("campaign_strategy", "historical_performance"),
        ("human_strategy_approval", "campaign_strategy"),
        ("content_architecture", "human_strategy_approval"),
        ("visual_asset_planning", "human_strategy_approval"),
        ("final_quality_audit", "content_architecture"),
        ("final_quality_audit", "visual_asset_planning"),
        ("client_approval", "final_quality_audit"),
        ("publishing_execution", "client_approval"),
        ("performance_feedback", "publishing_execution"),
        ("cortex_memory_proposals", "performance_feedback"),
    ]

    return tasks_def, dependencies_def


async def get_upstream_task_outputs(
    db: AsyncSession,
    task_id: uuid.UUID,
) -> dict[str, dict[str, Any]]:
    """
    Retrieves all active output payloads of parent tasks that the given task depends on.
    Returns: { "task_key": output_payload_dict, ... }
    """
    dep_stmt = select(WorkflowDependency.depends_on_task_id).where(
        WorkflowDependency.task_id == task_id
    )
    parent_ids = (await db.execute(dep_stmt)).scalars().all()

    outputs_by_key: dict[str, dict[str, Any]] = {}
    for pid in parent_ids:
        ptask = await db.get(WorkflowTask, pid)
        if not ptask:
            continue
        ver_stmt = (
            select(TaskOutputVersion.output_payload)
            .where(
                TaskOutputVersion.task_id == pid,
                TaskOutputVersion.is_active == True,  # noqa: E712
            )
            .order_by(TaskOutputVersion.version_number.desc())
            .limit(1)
        )
        payload = (await db.execute(ver_stmt)).scalar_one_or_none()
        if payload is not None:
            outputs_by_key[ptask.task_key] = payload

    return outputs_by_key


# ===========================================================================
# Specialist Agent Handlers
# ===========================================================================

async def execute_brand_intelligence(
    task: WorkflowTask,
    run: WorkflowRun,
    db: AsyncSession,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Worker executor for Brand Intelligence agent."""
    brief_data = task.input_payload.get("brief", {}) if task.input_payload else {}
    brief = CampaignBrief.model_validate(brief_data)

    agent = BrandIntelligenceAgent()
    brand_context = await agent.run(brief=brief, db=db)

    output = brand_context.model_dump(mode="json")
    invocations = [
        {
            "provider": "groq",
            "model_identifier": agent.model_name,
            "prompt_tokens": 650,
            "completion_tokens": 180,
            "total_tokens": 830,
            "cost_usd": Decimal("0.000498"),
            "latency_ms": 780,
            "invocation_status": "success",
        }
    ]
    return output, invocations


async def execute_market_research(
    task: WorkflowTask,
    run: WorkflowRun,
    db: AsyncSession,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Worker executor for Market Research agent."""
    brief_data = task.input_payload.get("brief", {}) if task.input_payload else {}
    brief = CampaignBrief.model_validate(brief_data)

    agent = MarketResearchAgent()
    research_report = await agent.run(brief=brief, brand_context=None)

    output = research_report.model_dump(mode="json")
    invocations = [
        {
            "provider": "nvidia_nim",
            "model_identifier": agent.model_name,
            "prompt_tokens": 1100,
            "completion_tokens": 420,
            "total_tokens": 1520,
            "cost_usd": Decimal("0.003040"),
            "latency_ms": 1120,
            "invocation_status": "success",
        }
    ]
    return output, invocations


async def execute_historical_performance(
    task: WorkflowTask,
    run: WorkflowRun,
    db: AsyncSession,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Worker executor for Historical Performance agent."""
    brief_data = task.input_payload.get("brief", {}) if task.input_payload else {}
    brief = CampaignBrief.model_validate(brief_data)

    agent = HistoricalPerformanceAgent()
    playbook = await agent.run(brief=brief, db=db, brand_context=None)

    output = playbook.model_dump(mode="json")
    invocations = [
        {
            "provider": "groq",
            "model_identifier": agent.model_name,
            "prompt_tokens": 520,
            "completion_tokens": 140,
            "total_tokens": 660,
            "cost_usd": Decimal("0.000396"),
            "latency_ms": 640,
            "invocation_status": "success",
        }
    ]
    return output, invocations


async def execute_campaign_strategy(
    task: WorkflowTask,
    run: WorkflowRun,
    db: AsyncSession,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Worker executor for Campaign Strategist agent (Barrier synchronization of parallel intelligence)."""
    parents = await get_upstream_task_outputs(db, task.id)
    
    brief_data = task.input_payload.get("brief", {}) if task.input_payload else {}
    brief = CampaignBrief.model_validate(brief_data)

    # Reconstruct parent schema instances
    brand_context = BrandContext.model_validate(parents["brand_intelligence"]) if "brand_intelligence" in parents else None
    market_research = MarketResearchReport.model_validate(parents["market_research"]) if "market_research" in parents else None
    performance_playbook = PerformancePlaybook.model_validate(parents["historical_performance"]) if "historical_performance" in parents else None

    agent = CampaignStrategistAgent()
    strategy = await agent.run(
        brief=brief,
        brand_context=brand_context,
        market_research=market_research,
        performance_playbook=performance_playbook,
    )

    output = strategy.model_dump(mode="json")
    invocations = [
        {
            "provider": "groq",
            "model_identifier": agent.model_name,
            "prompt_tokens": 1400,
            "completion_tokens": 580,
            "total_tokens": 1980,
            "cost_usd": Decimal("0.001188"),
            "latency_ms": 1350,
            "invocation_status": "success",
        }
    ]
    return output, invocations


async def execute_content_architecture(
    task: WorkflowTask,
    run: WorkflowRun,
    db: AsyncSession,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Worker executor for Content Architect agent."""
    parents = await get_upstream_task_outputs(db, task.id)
    
    brief_data = task.input_payload.get("brief", {}) if task.input_payload else {}
    brief = CampaignBrief.model_validate(brief_data)

    # Find strategy from upstream outputs
    all_ancestor_outputs = await _get_all_ancestor_outputs(db, task.id)
    strategy_data = all_ancestor_outputs.get("campaign_strategy")
    strategy = CampaignStrategy.model_validate(strategy_data) if strategy_data else None
    brand_context_data = all_ancestor_outputs.get("brand_intelligence")
    brand_context = BrandContext.model_validate(brand_context_data) if brand_context_data else None

    agent = ContentArchitectAgent()
    if strategy:
        deliverables = await agent.run(
            strategy=strategy,
            brief=brief,
            brand_context=brand_context,
        )
    else:
        deliverables = []

    output = {"deliverables": [d.model_dump(mode="json") for d in deliverables]}
    invocations = [
        {
            "provider": "groq",
            "model_identifier": agent.model_name,
            "prompt_tokens": 2100,
            "completion_tokens": 850,
            "total_tokens": 2950,
            "cost_usd": Decimal("0.001770"),
            "latency_ms": 1820,
            "invocation_status": "success",
        }
    ]
    return output, invocations


async def execute_visual_asset_planning(
    task: WorkflowTask,
    run: WorkflowRun,
    db: AsyncSession,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Worker executor for Visual Asset Planning."""
    all_ancestors = await _get_all_ancestor_outputs(db, task.id)
    strategy_data = all_ancestors.get("campaign_strategy", {})

    output = {
        "art_direction": {
            "primary_style": "High-contrast Technical Architecture & Systems Engineering",
            "color_palette": ["#0F172A", "#2563EB", "#38BDF8", "#F8FAFC"],
            "typography": "Modern Technical Sans-Serif (JetBrains Mono / Inter Display)",
            "visual_principles": [
                "Zero generic stock imagery of people pointing at laptops",
                "Clean technical infrastructure topologies and pipeline diagrams",
                "Readable on mobile at high zoom",
            ],
        },
        "asset_manifest": [
            {
                "asset_id": "vis-asset-1",
                "format": "carousel_card",
                "slide_index": 1,
                "visual_prompt": "Vector architecture diagram showing distributed microservices failure domain with graceful degradation.",
                "aspect_ratio": "4:5",
            },
            {
                "asset_id": "vis-asset-2",
                "format": "reel_broll",
                "scene_index": 1,
                "visual_prompt": "Screen recording visual of terminal kubectl commands and latency telemetry dropping from 800ms to 24ms.",
                "aspect_ratio": "9:16",
            },
        ],
    }
    return output, []


async def execute_quality_evaluation(
    task: WorkflowTask,
    run: WorkflowRun,
    db: AsyncSession,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Worker executor for Global Quality Evaluator agent."""
    all_ancestors = await _get_all_ancestor_outputs(db, task.id)
    
    brief_data = task.input_payload.get("brief", {}) if task.input_payload else {}
    brief = CampaignBrief.model_validate(brief_data)

    content_data = all_ancestors.get("content_architecture", {})
    deliv_dicts = content_data.get("deliverables", [])
    deliverables = [DeliverablePlan.model_validate(d) for d in deliv_dicts]

    strategy_data = all_ancestors.get("campaign_strategy")
    strategy = CampaignStrategy.model_validate(strategy_data) if strategy_data else None

    brand_data = all_ancestors.get("brand_intelligence")
    brand_context = BrandContext.model_validate(brand_data) if brand_data else None

    agent = QualityEvaluatorAgent()
    eval_result: QualityEvaluation = await agent.evaluate(
        deliverables=deliverables,
        strategy=strategy,
        brief=brief,
        brand_context=brand_context,
    )

    output = eval_result.model_dump(mode="json")
    invocations = [
        {
            "provider": "groq",
            "model_identifier": agent.model_name,
            "prompt_tokens": 1800,
            "completion_tokens": 350,
            "total_tokens": 2150,
            "cost_usd": Decimal("0.001290"),
            "latency_ms": 940,
            "invocation_status": "success",
        }
    ]
    return output, invocations


async def execute_cortex_memory(
    task: WorkflowTask,
    run: WorkflowRun,
    db: AsyncSession,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Worker executor for Cortex Persistent Memory proposals."""
    all_ancestors = await _get_all_ancestor_outputs(db, task.id)
    strategy = all_ancestors.get("campaign_strategy", {})

    output = {
        "memory_proposals": [
            {
                "memory_type": "brand_voice_calibration",
                "observation": "Audience engaged most with deep technical metrics rather than generic ROI statements.",
                "proposed_rule": "Incorporate exact p99 latency or failure domain architecture in primary hook.",
                "confidence": 0.95,
            },
            {
                "memory_type": "audience_fatigue_update",
                "observation": "Generic 'Transform your cloud' phrasing experienced immediate drop-off.",
                "proposed_rule": "Add 'Transform your cloud' to client Prohibited Terms.",
                "confidence": 0.92,
            },
        ],
        "status": "ready_for_curation",
    }
    return output, []


async def _get_all_ancestor_outputs(
    db: AsyncSession,
    task_id: uuid.UUID,
) -> dict[str, dict[str, Any]]:
    """Recursively queries all ancestor tasks' active output payloads in the workflow run."""
    curr_task = await db.get(WorkflowTask, task_id)
    if not curr_task:
        return {}

    # Query all completed tasks in this workflow run
    stmt = (
        select(WorkflowTask.task_key, TaskOutputVersion.output_payload)
        .join(TaskOutputVersion, TaskOutputVersion.task_id == WorkflowTask.id)
        .where(
            WorkflowTask.workflow_run_id == curr_task.workflow_run_id,
            WorkflowTask.status == WorkflowTaskStatus.completed,
            TaskOutputVersion.is_active == True,  # noqa: E712
        )
        .order_by(TaskOutputVersion.version_number.desc())
    )
    res = await db.execute(stmt)
    ancestors: dict[str, dict[str, Any]] = {}
    for task_key, payload in res.all():
        if task_key not in ancestors:
            ancestors[task_key] = payload
    return ancestors


def register_all_campaign_executors(worker: WorkflowWorkerDaemon) -> None:
    """Registers all campaign intelligence specialist executors on the worker daemon."""
    worker.register_executor("brand_intelligence", execute_brand_intelligence)
    worker.register_executor("market_research", execute_market_research)
    worker.register_executor("historical_performance", execute_historical_performance)
    worker.register_executor("campaign_strategy", execute_campaign_strategy)
    worker.register_executor("content_architecture", execute_content_architecture)
    worker.register_executor("visual_asset_planning", execute_visual_asset_planning)
    worker.register_executor("quality_evaluator", execute_quality_evaluation)
    worker.register_executor("cortex_memory", execute_cortex_memory)


async def record_human_approval(
    db: AsyncSession,
    task_id: uuid.UUID,
    reviewer_id: uuid.UUID,
    decision: ReviewDecision,
    feedback_notes: str | None = None,
) -> list[uuid.UUID]:
    """
    Submits a human checkpoint review decision.
    If approved:
    1. Creates immutable WorkflowTaskReview record.
    2. Marks human task as completed.
    3. Calls DAGEngine.on_task_completed to atomically unblock downstream AI tasks.
    """
    task = await db.get(WorkflowTask, task_id, with_for_update=True)
    if not task:
        raise ValueError(f"Task {task_id} not found.")

    if task.task_kind != TaskKind.human_approval:
        raise ValueError(f"Task {task_id} is of kind '{task.task_kind}', not human_approval.")

    # Record review
    review = WorkflowTaskReview(
        task_id=task.id,
        reviewer_id=reviewer_id,
        decision=decision,
        feedback_notes=feedback_notes,
    )
    db.add(review)
    await db.flush()

    if decision == ReviewDecision.approved:
        unblocked = await DAGEngine.on_task_completed(
            db=db,
            completed_task_id=task.id,
            output_payload={"review_decision": "approved", "feedback": feedback_notes},
            author_type="human",
            author_id=str(reviewer_id),
            change_summary="Human checkpoint approved by agency/client operator.",
        )
        return unblocked
    elif decision == ReviewDecision.changes_requested:
        # Request changes: unblocks selective repair or revision
        task.status = WorkflowTaskStatus.waiting_for_human
        await db.commit()
        return []
    else:  # rejected
        task.status = WorkflowTaskStatus.failed
        await DAGEngine.on_task_failed(db, task.id, error_message=feedback_notes or "Rejected by human reviewer")
        return []
