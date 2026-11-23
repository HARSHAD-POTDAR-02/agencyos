from __future__ import annotations

import json
import logging
import uuid
from typing import Any, Dict, List, Optional, TypedDict

from langgraph.graph import END, StateGraph
from pydantic import BaseModel, Field

from app.core.database import AsyncSessionLocal
from app.core.llm import invoke_structured_llm
from app.models.cortex import BrandFact
from app.schemas.cortex import ExtractedFactCandidate, FactType, MemoryScope

logger = logging.getLogger(__name__)


class CortexIngestionState(TypedDict):
    client_id: str
    source_id: str
    source_type: str
    raw_content: str
    active_rules_snapshot: List[dict]
    extracted_candidates: List[dict]
    persisted_proposed_ids: List[str]


class FactCandidatesOutput(BaseModel):
    candidates: List[ExtractedFactCandidate] = Field(default_factory=list)


class ConflictCheckItem(BaseModel):
    candidate_index: int
    has_conflict: bool
    conflicting_fact_id: Optional[str] = None
    conflict_explanation: Optional[str] = None


class ConflictCheckOutput(BaseModel):
    results: List[ConflictCheckItem] = Field(default_factory=list)


async def extract_typed_candidates(state: CortexIngestionState) -> CortexIngestionState:
    """
    Extracts structured facts tagged as guardrail, persona, winning_pattern, or taboo
    with exact provenance quotes and locations.
    """
    source_type = state.get("source_type", "document")
    content = state.get("raw_content", "")

    if source_type == "revision_triple":
        system_prompt = (
            "You are AgencyOS Cortex, an institutional memory extractor. "
            "You are given a task revision triple: (rejected_draft_v1, revision_feedback, approved_draft_v2). "
            "Analyze the structural delta between v1 and v2, and the feedback that guided the edit. "
            "Extract concrete, repeatable stylistic guardrails or negative taboos explaining what changed and what to enforce in future tasks. "
            "Assign confidence_score (0.0 to 1.0) and include exact quotes."
        )
    else:
        system_prompt = (
            "You are AgencyOS Cortex, an institutional memory extractor for high-performing creative agencies. "
            "Analyze the ingested brand document, call transcript, or guidelines. "
            "Extract discrete, actionable brand facts categorized strictly as: "
            "1. 'guardrail': positive quality standards, formatting rules, tone boundaries. "
            "2. 'taboo': negative prohibitions (things to NEVER say, claim, or do). "
            "3. 'persona': target audience demographics, pain points, core psychographics. "
            "4. 'winning_pattern': proven content hooks, story structures, viral formulas. "
            "Every fact must include an exact verbatim provenance_quote from the text and location (e.g. 'Paragraph 3' or '04:15'). "
            "Assign confidence_score between 0.0 and 1.0."
        )

    try:
        combined_prompt = f"{system_prompt}\n\nContent to extract institutional memory facts from:\n\n{content}"
        output: FactCandidatesOutput = await invoke_structured_llm(
            prompt=combined_prompt,
            schema_class=FactCandidatesOutput,
            temperature=0.1,
        )
        # Filter out low-confidence noise before human review (>= 0.72)
        valid_candidates = [
            c.model_dump() for c in output.candidates if c.confidence_score >= 0.72
        ]
        state["extracted_candidates"] = valid_candidates
    except Exception as e:
        logger.error(f"Error extracting candidates in Cortex LangGraph: {e}")
        state["extracted_candidates"] = []

    return state


async def detect_rule_conflicts(state: CortexIngestionState) -> CortexIngestionState:
    """
    Compares candidate facts against active rules snapshot for the same client.
    Detects semantic contradictions and attaches conflicting_fact_id.
    """
    candidates = state.get("extracted_candidates", [])
    active_rules = state.get("active_rules_snapshot", [])

    if not candidates or not active_rules:
        return state

    system_prompt = (
        "You are AgencyOS Cortex Conflict Arbiter. "
        "Compare newly proposed candidate rules against currently active institutional rules. "
        "Identify if any candidate directly contradicts or supersedes an active rule. "
        "For example, if an active rule bans discounting, but the candidate allows a Black Friday discount, that is a conflict. "
        "Return candidate_index and has_conflict=True with the conflicting_fact_id and explanation."
    )

    prompt = (
        f"Active Rules Snapshot:\n{json.dumps(active_rules, indent=2)}\n\n"
        f"Candidate Facts to Check:\n{json.dumps(candidates, indent=2)}"
    )

    try:
        combined_prompt = f"{system_prompt}\n\n{prompt}"
        conflict_output: ConflictCheckOutput = await invoke_structured_llm(
            prompt=combined_prompt,
            schema_class=ConflictCheckOutput,
            temperature=0.0,
        )

        # Merge conflicts back into candidate dictionaries
        for item in conflict_output.results:
            if 0 <= item.candidate_index < len(candidates) and item.has_conflict:
                candidates[item.candidate_index]["conflicting_fact_id"] = item.conflicting_fact_id
                candidates[item.candidate_index]["conflict_explanation"] = item.conflict_explanation

        state["extracted_candidates"] = candidates
    except Exception as e:
        logger.warning(f"Error checking rule conflicts in Cortex: {e}")

    return state


async def enqueue_for_human_review(state: CortexIngestionState) -> CortexIngestionState:
    """
    Persists extracted candidates into brand_facts with status = 'proposed'
    for review in the Memory Review Queue.
    """
    candidates = state.get("extracted_candidates", [])
    client_id_str = state.get("client_id")
    source_id_str = state.get("source_id")

    if not candidates or not client_id_str:
        state["persisted_proposed_ids"] = []
        return state

    client_uuid = uuid.UUID(client_id_str)
    source_uuid = uuid.UUID(source_id_str) if source_id_str else None
    persisted_ids = []

    async with AsyncSessionLocal() as db:
        valid_source_id = None
        if source_uuid:
            from app.models.cortex import MemorySource
            from sqlalchemy import select
            src_check = await db.scalar(select(MemorySource.id).where(MemorySource.id == source_uuid))
            if src_check:
                valid_source_id = source_uuid

        for c in candidates:
            fact_id = uuid.uuid4()
            conflict_id = None
            if c.get("conflicting_fact_id"):
                try:
                    conflict_id = uuid.UUID(str(c["conflicting_fact_id"]))
                except Exception:
                    conflict_id = None

            scope_val = c.get("scope", "client")
            scope_str = scope_val.value if hasattr(scope_val, "value") else str(scope_val)
            if scope_str not in ("agency", "client", "campaign"):
                scope_str = "client"

            fact_type_val = c.get("fact_type", "guardrail")
            fact_type_str = fact_type_val.value if hasattr(fact_type_val, "value") else str(fact_type_val)
            if fact_type_str not in ("guardrail", "persona", "winning_pattern", "taboo"):
                fact_type_str = "guardrail"

            channels_val = c.get("channels", ["all"])
            if isinstance(channels_val, str):
                channels_val = [channels_val]

            fact_obj = BrandFact(
                id=fact_id,
                client_id=client_uuid,
                scope=scope_str,
                fact_type=fact_type_str,
                status="proposed",
                statement=c.get("statement", ""),
                rationale=c.get("rationale", ""),
                channels=channels_val,
                confidence_score=float(c.get("confidence_score", 0.8)),
                source_id=valid_source_id,
                provenance_quote=c.get("provenance_quote"),
                provenance_location=c.get("provenance_location"),
                supersedes_fact_id=conflict_id,
            )
            db.add(fact_obj)
            persisted_ids.append(str(fact_id))

        await db.commit()

    state["persisted_proposed_ids"] = persisted_ids
    return state


# Build the LangGraph StateGraph
workflow = StateGraph(CortexIngestionState)
workflow.add_node("extract", extract_typed_candidates)
workflow.add_node("conflict_check", detect_rule_conflicts)
workflow.add_node("enqueue", enqueue_for_human_review)

workflow.set_entry_point("extract")
workflow.add_edge("extract", "conflict_check")
workflow.add_edge("conflict_check", "enqueue")
workflow.add_edge("enqueue", END)

cortex_ingestion_graph = workflow.compile()
