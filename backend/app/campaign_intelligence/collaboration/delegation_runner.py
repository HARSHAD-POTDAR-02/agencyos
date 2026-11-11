from __future__ import annotations

import logging
from typing import Any
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.campaign_intelligence.schemas.studio_context import CampaignStudioContext
from app.campaign_intelligence.specialists import get_specialist_adapter

logger = logging.getLogger(__name__)

MAX_DELEGATION_DEPTH = 1
MAX_CALLS_PER_TURN = 2


class DelegationRequest(BaseModel):
    caller_agent_id: str
    target_agent_id: str
    sub_query: str
    current_depth: int = 0


class DelegationResponse(BaseModel):
    target_agent_id: str
    target_name: str
    findings_summary: str
    artifact_payload: dict[str, Any] | None = None
    activity_log: str
    evidence_citations: list[dict[str, Any]] = Field(default_factory=list)


class BoundedDelegationRunner:
    """
    Enforces strict architectural boundaries on multi-agent collaboration:
    1. Maximum delegation depth = 1 (no recursive chains: A -> B allowed; B -> C blocked).
    2. Maximum calls per turn = 2.
    3. Observable, non-leaking activity logging (transparent operational cards, no internal chain-of-thought dumps).
    """

    def __init__(self, max_depth: int = MAX_DELEGATION_DEPTH, max_calls_per_turn: int = MAX_CALLS_PER_TURN):
        self.max_depth = max_depth
        self.max_calls_per_turn = max_calls_per_turn
        self.call_count = 0

    async def delegate(
        self,
        request: DelegationRequest,
        context: CampaignStudioContext,
        db: AsyncSession,
    ) -> DelegationResponse | None:
        # 1. Enforce depth boundary
        if request.current_depth >= self.max_depth:
            logger.warning(
                f"[Delegation Guard] Blocked call from '{request.caller_agent_id}' to '{request.target_agent_id}': "
                f"depth {request.current_depth} >= max {self.max_depth}"
            )
            return None

        # 2. Enforce calls-per-turn budget
        if self.call_count >= self.max_calls_per_turn:
            logger.warning(
                f"[Delegation Guard] Blocked call from '{request.caller_agent_id}': "
                f"call count {self.call_count} reached turn budget {self.max_calls_per_turn}"
            )
            return None

        self.call_count += 1

        try:
            adapter = get_specialist_adapter(request.target_agent_id)
            logger.info(
                f"[Delegation Exec] Agent '{request.caller_agent_id}' consulting specialist '{adapter.specialist_name}' "
                f"for sub-task: '{request.sub_query[:80]}...'"
            )

            # Execute targeted sub-task using shared studio context
            result = await adapter.execute(
                query=request.sub_query,
                context=context,
                db=db,
            )

            citations: list[dict[str, Any]] = []
            if result.artifact_payload:
                opps = result.artifact_payload.get("inferred_opportunities", [])
                for opp in opps:
                    for cite in opp.get("supporting_citations", []):
                        citations.append(cite)

            op_log = (
                f"[{request.caller_agent_id.replace('_', ' ').title()}] Consulted {adapter.specialist_name}: "
                f"{result.reply[:120].strip()}..."
            )

            return DelegationResponse(
                target_agent_id=request.target_agent_id,
                target_name=adapter.specialist_name,
                findings_summary=result.reply,
                artifact_payload=result.artifact_payload,
                activity_log=op_log,
                evidence_citations=citations,
            )
        except Exception as ex:
            logger.error(f"[Delegation Error] Delegation to '{request.target_agent_id}' failed: {ex}")
            return None
