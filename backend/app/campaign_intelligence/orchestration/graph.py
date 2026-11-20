from __future__ import annotations

import functools
import logging
import uuid
from typing import Any, Callable, Literal

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph
from sqlalchemy.ext.asyncio import AsyncSession

from app.campaign_intelligence.agents.brand_intelligence import brand_intelligence_node
from app.campaign_intelligence.agents.campaign_strategist import campaign_strategist_node
from app.campaign_intelligence.agents.content_architect import content_architect_node
from app.campaign_intelligence.agents.historical_performance import performance_analysis_node
from app.campaign_intelligence.agents.market_research import market_research_node
from app.campaign_intelligence.agents.quality_evaluator import quality_evaluator_node
from app.campaign_intelligence.orchestration.state import CampaignState
from app.core.database import AsyncSessionLocal

logger = logging.getLogger(__name__)


def route_quality_gate(
    state: CampaignState,
) -> Literal["content_architect", "campaign_strategist", "__end__"]:
    """
    Evaluates Quality Gate findings and determines next routing target.
    
    1. If approved: proceeds directly to END (status: 'awaiting_approval').
    2. If revision limit reached or escalated to human: proceeds to END (status: 'escalated_to_human').
    3. If structural/strategic flaw: loops back to 'campaign_strategist'.
    4. If deliverable/copy/hook issue: loops back to 'content_architect'.
    """
    evaluation = state.get("quality_evaluation")
    if not evaluation:
        logger.warning("Quality evaluation missing at quality gate; routing to END.")
        return END

    if evaluation.is_approved_for_human_review or not evaluation.revision_required:
        logger.info("Quality gate passed. Routing to END (awaiting human approval).")
        return END

    revision_count = state.get("revision_count", 0)
    max_revisions = state.get("max_revisions", 2)
    if revision_count >= max_revisions:
        logger.warning(f"Quality gate reached maximum revisions ({revision_count}/{max_revisions}). Routing to END.")
        return END

    instruction = evaluation.revision_instruction
    if instruction and instruction.target_agent == "human":
        logger.warning(f"Quality gate escalated to human: {instruction.reason}. Routing to END.")
        return END

    if instruction and instruction.target_agent == "campaign_strategist":
        logger.info(f"Quality gate requested strategic revision: {instruction.reason}. Routing to campaign_strategist.")
        return "campaign_strategist"

    logger.info("Quality gate requested content revision. Routing to content_architect for selective repair.")
    return "content_architect"


def create_campaign_graph(
    db_session_factory: Callable[[], AsyncSession] | None = None,
    checkpointer: BaseCheckpointSaver | None = None,
) -> CompiledStateGraph:
    """
    Compile the end-to-end AgencyOS Campaign Intelligence LangGraph workflow.
    
    Topology:
                 [START]
                    |
          +---------+---------+
          |         |         |
        Brand    Market     Perf
        Intel   Research  Analysis
          |         |         |
          +---------+---------+
                    | (Barrier Sync / Fan-in)
           Campaign Strategist
                    |
            Content Architect
                    |
            Quality Evaluator
                    |
             [Conditional]
            /      |      \
        (Strat) (Content) (Approved/Escalated)
           |       |              |
         Agent4  Agent5         [END]
    """
    session_factory = db_session_factory or AsyncSessionLocal

    workflow = StateGraph(CampaignState)

    # 1. Bind database-dependent nodes
    bound_brand_node = functools.partial(brand_intelligence_node, db_session_factory=session_factory)
    bound_perf_node = functools.partial(performance_analysis_node, db_session_factory=session_factory)

    # 2. Add all 6 agents as graph nodes
    workflow.add_node("brand_intelligence", bound_brand_node)
    workflow.add_node("market_research", market_research_node)
    workflow.add_node("performance_analysis", bound_perf_node)
    workflow.add_node("campaign_strategist", campaign_strategist_node)
    workflow.add_node("content_architect", content_architect_node)
    workflow.add_node("quality_evaluator", quality_evaluator_node)

    # 3. Sequential intelligence gathering: Brand first, then fan-out to Market & Performance
    workflow.add_edge(START, "brand_intelligence")
    workflow.add_edge("brand_intelligence", "market_research")
    workflow.add_edge("brand_intelligence", "performance_analysis")

    # 4. Barrier synchronization: Fan-in to Campaign Strategist
    workflow.add_edge("market_research", "campaign_strategist")
    workflow.add_edge("performance_analysis", "campaign_strategist")

    # 5. Downstream planning & quality gating
    workflow.add_edge("campaign_strategist", "content_architect")
    workflow.add_edge("content_architect", "quality_evaluator")

    # 6. Automated revision loop / approval exit
    workflow.add_conditional_edges(
        "quality_evaluator",
        route_quality_gate,
        {
            "content_architect": "content_architect",
            "campaign_strategist": "campaign_strategist",
            END: END,
        },
    )

    # Compile with MemorySaver if no checkpointer provided
    cp = checkpointer or MemorySaver()
    return workflow.compile(checkpointer=cp)


async def run_campaign_pipeline(
    initial_state: CampaignState,
    db_session_factory: Callable[[], AsyncSession] | None = None,
    checkpointer: BaseCheckpointSaver | None = None,
) -> CampaignState:
    """
    Execute the compiled Campaign Intelligence multi-agent workflow to completion.
    
    Guarantees:
    - Sets safe default values for all state fields.
    - Preserves multi-tenant isolation (agency_id, client_id, campaign_id).
    - Runs parallel intelligence gathering asynchronously.
    - Resolves automated quality critique and revisions before returning.
    """
    # Ensure all list reducers and metadata have clean initializations
    state: dict[str, Any] = dict(initial_state)
    state.setdefault("run_id", str(uuid.uuid4()))
    state.setdefault("revision_count", 0)
    state.setdefault("max_revisions", 2)
    state.setdefault("workflow_status", "gathering_intelligence")
    state.setdefault("current_agent", None)
    state.setdefault("human_feedback", None)
    state.setdefault("pipeline_agents_executed", [])
    state.setdefault("agent_traces", [])
    state.setdefault("errors", [])
    state.setdefault("deliverable_plans", None)
    state.setdefault("quality_evaluation", None)

    graph = create_campaign_graph(
        db_session_factory=db_session_factory,
        checkpointer=checkpointer,
    )

    thread_config = {
        "configurable": {
            "thread_id": f"campaign-{state.get('campaign_id', uuid.uuid4())}",
        }
    }

    final_state = await graph.ainvoke(state, config=thread_config)
    return final_state  # type: ignore[return-value]

