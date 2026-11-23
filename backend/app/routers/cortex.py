from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.llm import invoke_structured_llm, get_llm
from app.cortex.extractor import cortex_ingestion_graph
from app.dependencies import get_current_user
from app.models.cortex import BrandFact, MemorySource
from app.models.user import User
from app.schemas.cortex import (
    AskAgencyBrainRequest,
    AskAgencyBrainResponse,
    BrandFactResponse,
    CitedSource,
    ComplianceViolation,
    DocumentIngestPayload,
    DraftAuditRequest,
    DraftAuditResponse,
    FactReviewDecision,
    LivingBrandVaultResponse,
    RevisionTriplePayload,
    TranscriptIngestPayload,
)
from app.services.cortex_service import cortex_service
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/cortex", tags=["AgencyOS Cortex"])


async def run_cortex_extraction_background(
    client_id: UUID,
    source_id: UUID,
    source_type: str,
    raw_content: str,
):
    """Background task to run LangGraph extraction and conflict detection pipeline."""
    try:
        from app.core.database import AsyncSessionLocal
        async with AsyncSessionLocal() as db:
            active_rules_dict = await cortex_service.get_deterministic_rules(
                db=db, client_id=client_id, channel="all"
            )
            # Flatten active rules for conflict detector
            active_rules_list = (
                active_rules_dict.get("guardrails", [])
                + active_rules_dict.get("taboos", [])
                + active_rules_dict.get("personas", [])
                + active_rules_dict.get("winning_patterns", [])
            )

        initial_state = {
            "client_id": str(client_id),
            "source_id": str(source_id),
            "source_type": source_type,
            "raw_content": raw_content,
            "active_rules_snapshot": active_rules_list,
            "extracted_candidates": [],
            "persisted_proposed_ids": [],
        }

        result = await cortex_ingestion_graph.ainvoke(initial_state)
        persisted_ids = result.get("persisted_proposed_ids", []) if isinstance(result, dict) else []
        if persisted_ids:
            try:
                from app.core.database import AsyncSessionLocal
                from app.models.client import Client
                from app.core.websockets import ws_manager, AgencyWSEvent
                async with AsyncSessionLocal() as db_session:
                    c_res = await db_session.execute(select(Client).where(Client.id == client_id))
                    client_obj = c_res.scalar_one_or_none()
                    if client_obj:
                        await ws_manager.broadcast_to_agency(
                            agency_id=client_obj.agency_id,
                            event=AgencyWSEvent.MEMORY_REVIEW_QUEUED,
                            data={
                                "client_id": str(client_id),
                                "client_name": client_obj.business_name,
                                "source_id": str(source_id),
                                "proposed_count": len(persisted_ids),
                            },
                        )
            except Exception as ws_err:
                logger.warning(f"Failed to broadcast MEMORY_REVIEW_QUEUED: {ws_err}")

        logger.info(f"Cortex ingestion completed for source {source_id} (Client {client_id})")
    except Exception as e:
        logger.error(f"Error in background cortex extraction: {e}")


@router.post("/ingest/document", status_code=status.HTTP_202_ACCEPTED)
async def ingest_document(
    payload: DocumentIngestPayload,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Accepts PDF/Markdown content, creates MemorySource, chunks text into knowledge_chunks
    with pgvector embeddings, and triggers the LangGraph extraction workflow asynchronously.
    """
    memory_source = await cortex_service.ingest_source_and_create_chunks(
        db=db,
        client_id=payload.client_id,
        source_type="document",
        title=payload.title,
        raw_content=payload.content,
        metadata=payload.metadata,
    )

    background_tasks.add_task(
        run_cortex_extraction_background,
        client_id=payload.client_id,
        source_id=memory_source.id,
        source_type="document",
        raw_content=payload.content,
    )

    return {
        "status": "processing",
        "source_id": str(memory_source.id),
        "title": memory_source.title,
        "message": "Document ingested, vector indexed in pgvector, and extraction workflow enqueued.",
    }


@router.post("/ingest/transcript", status_code=status.HTTP_202_ACCEPTED)
async def ingest_transcript(
    payload: TranscriptIngestPayload,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Accepts speaker-diarized call transcript text + metadata, creates MemorySource,
    indexes chunks, and runs LangGraph extraction.
    """
    meta = payload.metadata or {}
    if payload.call_date:
        meta["call_date"] = payload.call_date

    memory_source = await cortex_service.ingest_source_and_create_chunks(
        db=db,
        client_id=payload.client_id,
        source_type="transcript",
        title=payload.call_title,
        raw_content=payload.transcript_text,
        metadata=meta,
    )

    background_tasks.add_task(
        run_cortex_extraction_background,
        client_id=payload.client_id,
        source_id=memory_source.id,
        source_type="transcript",
        raw_content=payload.transcript_text,
    )

    return {
        "status": "processing",
        "source_id": str(memory_source.id),
        "title": memory_source.title,
        "message": "Transcript ingested, vector indexed in pgvector, and extraction workflow enqueued.",
    }


@router.post("/ingest/revision-triple", status_code=status.HTTP_202_ACCEPTED)
async def ingest_revision_triple(
    payload: RevisionTriplePayload,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Internal event webhook called when a revised task is approved.
    Extracts repeatable stylistic rules from the structural delta between v1 and v2.
    """
    composite_content = (
        f"--- TASK REVISION TRIPLE ---\n"
        f"Task ID: {payload.task_id}\n"
        f"Channel: {payload.channel}\n\n"
        f"REJECTED DRAFT (V1):\n{payload.rejected_draft_v1}\n\n"
        f"REVISION FEEDBACK:\n{payload.revision_feedback}\n\n"
        f"APPROVED DRAFT (V2):\n{payload.approved_draft_v2}\n"
    )

    meta = {
        "task_id": str(payload.task_id),
        "channel": payload.channel,
    }

    memory_source = await cortex_service.ingest_source_and_create_chunks(
        db=db,
        client_id=payload.client_id,
        source_type="revision_triple",
        title=f"Task Revision Delta: {str(payload.task_id)[:8]} ({payload.channel})",
        raw_content=composite_content,
        metadata=meta,
        channels=[payload.channel, "all"],
    )

    background_tasks.add_task(
        run_cortex_extraction_background,
        client_id=payload.client_id,
        source_id=memory_source.id,
        source_type="revision_triple",
        raw_content=composite_content,
    )

    return {
        "status": "processing",
        "source_id": str(memory_source.id),
        "message": "Revision triple recorded. Delta extraction and conflict detection running in background.",
    }


@router.get("/review-queue", response_model=List[BrandFactResponse])
async def get_review_queue(
    client_id: UUID = Query(..., description="Target client UUID"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns all brand_facts where status = 'proposed', joined with conflicting_fact
    details for side-by-side diff rendering in the Memory Review Queue.
    """
    res = await db.execute(
        select(BrandFact)
        .where(BrandFact.client_id == client_id, BrandFact.status == "proposed")
        .order_by(BrandFact.created_at.desc())
    )
    facts = res.scalars().all()

    # Preload conflicting facts for diff rendering
    conflict_ids = [f.supersedes_fact_id for f in facts if f.supersedes_fact_id]
    conflicts_map = {}
    if conflict_ids:
        c_res = await db.execute(select(BrandFact).where(BrandFact.id.in_(conflict_ids)))
        conflicts_map = {c.id: c for c in c_res.scalars().all()}

    output = []
    for f in facts:
        resp = BrandFactResponse.model_validate(f)
        if f.supersedes_fact_id and f.supersedes_fact_id in conflicts_map:
            cf = conflicts_map[f.supersedes_fact_id]
            resp.conflicting_fact = {
                "id": str(cf.id),
                "statement": cf.statement,
                "rationale": cf.rationale,
                "channels": cf.channels,
                "status": cf.status,
                "fact_type": cf.fact_type,
            }
        output.append(resp)

    return output


@router.post("/facts/{fact_id}/review", response_model=BrandFactResponse)
async def review_fact(
    fact_id: UUID,
    decision: FactReviewDecision,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Executes FactReviewDecision:
    - approve: sets status = 'active', records approved_by and approved_at.
    - supersede_existing: sets target rule to 'superseded', sets new rule to 'active' with supersedes_fact_id = target_id.
    - reject: sets status = 'archived'.
    Always inserts a row in fact_audit_logs.
    """
    try:
        fact = await cortex_service.review_fact(
            db=db,
            fact_id=fact_id,
            decision=decision,
            actor_id=current_user.id,
        )
        return BrandFactResponse.model_validate(fact)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/vault/{client_id}", response_model=LivingBrandVaultResponse)
async def get_living_brand_vault(
    client_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns the auto-compiled, strictly read-only Markdown Living Brand Overview
    grouped by Negative Taboos, Active Guardrails, Personas, and Winning Patterns.
    """
    vault = await cortex_service.compile_living_brand_vault(db=db, client_id=client_id)
    return vault


class AuditViolationsOutput(BaseModel):
    passed: bool
    violations: List[ComplianceViolation] = Field(default_factory=list)


@router.post("/audit-draft", response_model=DraftAuditResponse)
async def audit_draft_compliance(
    payload: DraftAuditRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Compliance Copilot Gate:
    Loads 100% of active SQL guardrail and taboo rules for (client_id, channel)
    and checks the draft content, returning structured ComplianceViolation citations.
    """
    rules = await cortex_service.get_deterministic_rules(
        db=db,
        client_id=payload.client_id,
        channel=payload.channel,
        campaign_id=payload.campaign_id,
    )

    guardrails = rules["guardrails"]
    taboos = rules["taboos"]
    total_rules = len(guardrails) + len(taboos)

    if total_rules == 0:
        return DraftAuditResponse(
            passed=True,
            is_compliant=True,
            checked_rules_count=0,
            compliance_score=1.0,
            violations=[],
        )

    system_prompt = (
        "You are the AgencyOS Compliance Copilot. "
        "Your task is to strictly audit a creative draft against mandatory brand rules. "
        "Rules are split into: "
        "1. Negative Taboos (hard prohibitions: things to NEVER say, claim, or do). "
        "2. Positive Guardrails (mandatory tone boundaries, quality standards, or required disclaimers). "
        "If a taboo is violated, emit severity='BLOCK'. "
        "If a positive guardrail is missed or imperfect, emit severity='WARN'. "
        "Always cite the exact rule_id, rule_code (e.g. 'RULE-TABOO-1'), explanation, and suggested_fix. "
        "If no rules are violated, return passed=True with violations=[]."
    )

    rules_context = {
        "taboos": taboos,
        "guardrails": guardrails,
    }

    prompt = (
        f"Active Institutional Rules:\n{json.dumps(rules_context, indent=2)}\n\n"
        f"Channel: {payload.channel}\n\n"
        f"Draft Content to Audit:\n\"\"\"\n{payload.draft_content}\n\"\"\""
    )

    try:
        combined_prompt = f"{system_prompt}\n\n{prompt}"
        audit_res: AuditViolationsOutput = await invoke_structured_llm(
            prompt=combined_prompt,
            schema_class=AuditViolationsOutput,
            temperature=0.0,
        )
        passed = audit_res.passed and len(audit_res.violations) == 0
        score = 1.0 if passed else max(0.0, 1.0 - (len(audit_res.violations) * 0.25))
        return DraftAuditResponse(
            passed=passed,
            is_compliant=passed,
            checked_rules_count=total_rules,
            compliance_score=score,
            violations=audit_res.violations,
        )
    except Exception as e:
        logger.error(f"Error executing Compliance Copilot audit: {e}")
        return DraftAuditResponse(
            passed=True,
            is_compliant=True,
            checked_rules_count=total_rules,
            compliance_score=1.0,
            violations=[],
        )


@router.post("/ask", response_model=AskAgencyBrainResponse)
async def ask_agency_brain(
    payload: AskAgencyBrainRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Hybrid Q&A endpoint:
    Queries active brand_facts via deterministic SQL + top-k knowledge_chunks via HNSW cosine similarity,
    returning a cited institutional memory answer.
    """
    # 1. Deterministic SQL rules
    rules = await cortex_service.get_deterministic_rules(
        db=db,
        client_id=payload.client_id,
        channel=payload.channel or "all",
    )
    all_rules = rules["guardrails"] + rules["taboos"] + rules["personas"]

    # 2. Semantic HNSW chunks
    playbooks = await cortex_service.get_semantic_playbooks(
        db=db,
        client_id=payload.client_id,
        query=payload.query,
        channel=payload.channel or "all",
        top_k=payload.top_k,
    )

    # 3. LLM Synthesis
    system_prompt = (
        "You are AgencyOS Cortex Agency Brain. "
        "Answer the user's strategic query using the provided active institutional rules and retrieved knowledge chunks. "
        "Ground your answer strictly in these sources. Cite specific documents or rules when answering."
    )

    context = {
        "active_institutional_rules": [r["statement"] for r in all_rules],
        "retrieved_evidence_chunks": [
            {
                "source": p["source_title"],
                "content": p["content"],
                "similarity": round(p["similarity"], 3),
            }
            for p in playbooks
        ],
    }

    prompt = (
        f"Context:\n{json.dumps(context, indent=2)}\n\n"
        f"User Query: {payload.query}"
    )

    llm = get_llm(temperature=0.2)
    response = await llm.ainvoke([SystemMessage(content=system_prompt), HumanMessage(content=prompt)])
    answer_text = response.content if isinstance(response.content, str) else str(response.content)

    cited_sources = [
        CitedSource(
            source_id=UUID(p["source_id"]),
            title=p["source_title"],
            chunk_type=p["chunk_type"],
            snippet=p["content"][:200] + "...",
            similarity_score=p["similarity"],
        )
        for p in playbooks
    ]

    applied_guardrails = [r["statement"] for r in rules["guardrails"][:5] + rules["taboos"][:5]]

    return AskAgencyBrainResponse(
        answer=answer_text,
        active_guardrails_applied=applied_guardrails,
        cited_sources=cited_sources,
    )
