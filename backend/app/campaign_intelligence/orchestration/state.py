from __future__ import annotations

import operator
import uuid
from typing import Annotated, Any, Optional
from typing_extensions import TypedDict

from app.campaign_intelligence.schemas.brand import BrandContext
from app.campaign_intelligence.schemas.campaign import CampaignBrief
from app.campaign_intelligence.schemas.deliverables import DeliverablePlan
from app.campaign_intelligence.schemas.performance import PerformancePlaybook
from app.campaign_intelligence.schemas.quality import QualityEvaluation
from app.campaign_intelligence.schemas.research import MarketResearchReport
from app.campaign_intelligence.schemas.strategy import CampaignStrategy
from app.campaign_intelligence.schemas.trace import AgentTelemetry


def _take_latest(a: Any, b: Any) -> Any:
    """Parallel-safe reducer that takes the latest non-null update."""
    return b if b is not None else a


class CampaignState(TypedDict):
    """
    Shared LangGraph state for the Campaign Intelligence multi-agent workflow.
    
    Architectural Rules:
    1. ZERO Database session objects inside state (AsyncSession must remain outside).
    2. Parallel intelligence gathering agents write to separate keys:
       - Brand Intelligence -> brand_context
       - Market Research -> market_research
       - Performance Analysis -> performance_playbook
    3. Shared append-only lists use operator.add reducer to prevent parallel state clobbering.
    4. Concurrently updated scalar fields use _take_latest reducer.
    """
    # Tenant & Execution Identification
    run_id: str
    agency_id: uuid.UUID
    client_id: uuid.UUID
    campaign_id: uuid.UUID

    # Inputs
    brief: CampaignBrief

    # Intelligence & Plan Artifacts (Dedicated keys for deterministic state isolation)
    brand_context: Optional[BrandContext]
    market_research: Optional[MarketResearchReport]
    performance_playbook: Optional[PerformancePlaybook]
    campaign_strategy: Optional[CampaignStrategy]
    deliverable_plans: Optional[list[DeliverablePlan]]
    quality_evaluation: Optional[QualityEvaluation]

    # Workflow Control & Routing
    revision_count: int
    max_revisions: int
    workflow_status: Annotated[str, _take_latest]
    current_agent: Annotated[Optional[str], _take_latest]
    human_feedback: Optional[str]

    # Parallel-Safe Reducers (Annotated with operator.add)
    pipeline_agents_executed: Annotated[list[str], operator.add]
    agent_traces: Annotated[list[AgentTelemetry], operator.add]
    errors: Annotated[list[str], operator.add]

