from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import and_, or_, select, text, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cortex import BrandFact, FactAuditLog, KnowledgeChunk, MemorySource
from app.models.client import Client
from app.schemas.cortex import (
    AgentCortexContext,
    BrandFactResponse,
    FactReviewDecision,
    FactStatus,
    FactType,
    LivingBrandVaultResponse,
)
from app.services.embedding_service import embedding_service

logger = logging.getLogger(__name__)


class CortexService:
    """
    Deterministic + Semantic Institutional Memory Service for AgencyOS.
    Enforces the split-retrieval architecture:
    - 100% deterministic SQL recall for negative taboos, guardrails, and audience personas.
    - HNSW vector similarity for unstructured playbooks, call transcripts, and long docs.
    """

    async def get_deterministic_rules(
        self,
        db: AsyncSession,
        client_id: UUID,
        channel: str = "all",
        campaign_id: Optional[UUID] = None,
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Executes deterministic SQL lookup for active rules scoped by client, agency, and channel.
        Zero vector hallucination, 100% recall.
        """
        now = datetime.now(timezone.utc)
        
        # Scoping query: strictly client-specific institutional facts
        # Channel filter: channel is in channels JSONB array or contains 'all'
        query = select(BrandFact).where(
            BrandFact.status == "active",
            or_(BrandFact.expires_at.is_(None), BrandFact.expires_at > now),
            BrandFact.client_id == client_id,
        )

        if campaign_id:
            query = query.where(
                or_(BrandFact.campaign_id.is_(None), BrandFact.campaign_id == campaign_id)
            )

        res = await db.execute(query)
        facts = res.scalars().all()

        # In-memory channel filter for precision (channels JSONB array)
        filtered_facts: List[BrandFact] = []
        target_channel = channel.lower().strip()
        for f in facts:
            chans = [c.lower() for c in (f.channels or ["all"])]
            if "all" in chans or target_channel in chans or target_channel == "all":
                filtered_facts.append(f)

        guardrails = []
        taboos = []
        personas = []
        winning_patterns = []

        for f in filtered_facts:
            rule_dict = {
                "id": str(f.id),
                "statement": f.statement,
                "rationale": f.rationale,
                "scope": f.scope,
                "channels": f.channels,
                "confidence_score": f.confidence_score,
                "provenance_quote": f.provenance_quote,
                "provenance_location": f.provenance_location,
                "approved_at": f.approved_at.isoformat() if f.approved_at else None,
            }
            if f.fact_type == "taboo":
                taboos.append(rule_dict)
            elif f.fact_type == "guardrail":
                guardrails.append(rule_dict)
            elif f.fact_type == "persona":
                personas.append(rule_dict)
            elif f.fact_type == "winning_pattern":
                winning_patterns.append(rule_dict)

        return {
            "guardrails": guardrails,
            "taboos": taboos,
            "personas": personas,
            "winning_patterns": winning_patterns,
        }

    async def get_semantic_playbooks(
        self,
        db: AsyncSession,
        client_id: UUID,
        query: str,
        channel: str = "all",
        top_k: int = 3,
    ) -> List[Dict[str, Any]]:
        """
        Queries knowledge_chunks using pgvector cosine distance for high-volume unstructured artifacts.
        """
        if not query.strip():
            return []

        query_vector = await embedding_service.get_query_embedding(query)
        vector_str = "[" + ",".join(str(x) for x in query_vector) + "]"

        # Direct pgvector cosine distance query
        sql = text("""
            SELECT 
                kc.id,
                kc.content,
                kc.chunk_type,
                kc.performance_metrics,
                kc.channels,
                kc.source_id,
                ms.title as source_title,
                1 - (kc.embedding <=> :vec::vector) as similarity
            FROM knowledge_chunks kc
            JOIN memory_sources ms ON ms.id = kc.source_id
            WHERE kc.client_id = :cid
            ORDER BY kc.embedding <=> :vec::vector
            LIMIT :top_k;
        """)

        res = await db.execute(sql, {"vec": vector_str, "cid": str(client_id), "top_k": top_k})
        rows = res.fetchall()

        results = []
        for r in rows:
            results.append({
                "chunk_id": str(r.id),
                "content": r.content,
                "chunk_type": r.chunk_type,
                "source_id": str(r.source_id),
                "source_title": r.source_title,
                "similarity": float(r.similarity),
                "performance_metrics": r.performance_metrics,
                "channels": r.channels,
            })
        return results

    async def build_agent_cortex_context(
        self,
        db: AsyncSession,
        client_id: UUID,
        channel: str = "all",
        query_text: Optional[str] = None,
        campaign_id: Optional[UUID] = None,
    ) -> AgentCortexContext:
        """
        Constructs the complete AgentCortexContext combining 100% deterministic SQL rules
        with top-3 semantic playbooks.
        """
        rules = await self.get_deterministic_rules(db, client_id, channel, campaign_id)
        
        playbooks = []
        if query_text:
            playbooks = await self.get_semantic_playbooks(db, client_id, query_text, channel, top_k=3)

        return AgentCortexContext(
            client_id=client_id,
            channel=channel,
            guardrails=rules["guardrails"],
            taboos=rules["taboos"],
            personas=rules["personas"],
            semantic_playbooks=playbooks,
        )

    def chunk_text(self, text: str, chunk_size: int = 800, chunk_overlap: int = 150) -> List[str]:
        """Simple, deterministic character-level window chunking with overlap."""
        if not text:
            return []
        chunks = []
        start = 0
        text_len = len(text)
        while start < text_len:
            end = min(start + chunk_size, text_len)
            # Try to snap to the nearest newline or whitespace
            if end < text_len:
                last_newline = text.rfind("\n", start + chunk_size // 2, end)
                if last_newline != -1:
                    end = last_newline + 1
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)
            if end >= text_len:
                break
            start = max(start + 1, end - chunk_overlap)
        return chunks

    async def ingest_source_and_create_chunks(
        self,
        db: AsyncSession,
        client_id: UUID,
        source_type: str,
        title: str,
        raw_content: str,
        metadata: Optional[Dict[str, Any]] = None,
        channels: Optional[List[str]] = None,
    ) -> MemorySource:
        """
        Persists MemorySource container, chunks content, generates 1536-dim vector embeddings,
        and saves knowledge_chunks for pgvector retrieval.
        """
        memory_source = MemorySource(
            id=uuid.uuid4(),
            client_id=client_id,
            source_type=source_type,
            title=title,
            raw_content=raw_content,
            metadata_json=metadata or {},
            processed_at=datetime.now(timezone.utc),
        )
        db.add(memory_source)
        await db.flush()

        # Chunk and embed
        text_chunks = self.chunk_text(raw_content)
        if text_chunks:
            embeddings = await embedding_service.get_embeddings(text_chunks)
            chunk_objects = []
            for content, emb in zip(text_chunks, embeddings):
                chunk_obj = KnowledgeChunk(
                    id=uuid.uuid4(),
                    client_id=client_id,
                    source_id=memory_source.id,
                    chunk_type=f"{source_type}_segment",
                    content=content,
                    embedding=emb,
                    performance_metrics={},
                    channels=channels or ["all"],
                )
                chunk_objects.append(chunk_obj)
            db.add_all(chunk_objects)
            await db.flush()

        await db.commit()
        await db.refresh(memory_source)
        return memory_source

    async def review_fact(
        self,
        db: AsyncSession,
        fact_id: UUID,
        decision: FactReviewDecision,
        actor_id: UUID,
    ) -> BrandFact:
        """
        Executes FactReviewDecision:
        - approve: promotes status to 'active'
        - supersede_existing: sets target to 'superseded', sets new rule to 'active' with supersedes_fact_id
        - reject: sets status to 'archived'
        Writes an immutable entry to fact_audit_logs.
        """
        res = await db.execute(select(BrandFact).where(BrandFact.id == fact_id))
        fact = res.scalar_one_or_none()
        if not fact:
            raise ValueError(f"BrandFact with id {fact_id} not found.")

        prev_status = fact.status
        now = datetime.now(timezone.utc)

        if decision.action == "approve":
            fact.status = "active"
            fact.approved_by = actor_id
            fact.approved_at = now
            if decision.override_channels:
                fact.channels = decision.override_channels
            if decision.expires_at:
                fact.expires_at = decision.expires_at
            new_status = "active"

        elif decision.action == "supersede_existing":
            if not decision.target_superseded_fact_id:
                raise ValueError("target_superseded_fact_id is required for supersede_existing action.")
            
            # Supersede the old fact
            target_res = await db.execute(
                select(BrandFact).where(BrandFact.id == decision.target_superseded_fact_id)
            )
            target_fact = target_res.scalar_one_or_none()
            if target_fact:
                target_fact.status = "superseded"
                # Audit log for target
                target_audit = FactAuditLog(
                    id=uuid.uuid4(),
                    fact_id=target_fact.id,
                    actor_id=actor_id,
                    action="superseded",
                    previous_status="active",
                    new_status="superseded",
                    notes=f"Superseded by new fact {fact.id}",
                )
                db.add(target_audit)

            # Activate the new fact
            fact.status = "active"
            fact.supersedes_fact_id = decision.target_superseded_fact_id
            fact.approved_by = actor_id
            fact.approved_at = now
            if decision.override_channels:
                fact.channels = decision.override_channels
            if decision.expires_at:
                fact.expires_at = decision.expires_at
            new_status = "active"

        elif decision.action == "reject":
            fact.status = "archived"
            new_status = "archived"
        else:
            raise ValueError(f"Unsupported action: {decision.action}")

        # Audit log for current fact (action must be in: approved, superseded, rejected, archived)
        audit_action = "approved" if decision.action in ["approve", "supersede_existing"] else (
            "rejected" if decision.action == "reject" else "archived"
        )
        audit = FactAuditLog(
            id=uuid.uuid4(),
            fact_id=fact.id,
            actor_id=actor_id,
            action=audit_action,
            previous_status=prev_status,
            new_status=new_status,
            notes=decision.reviewer_notes,
        )
        db.add(audit)
        await db.commit()
        await db.refresh(fact)
        return fact

    async def compile_living_brand_vault(
        self,
        db: AsyncSession,
        client_id: UUID,
    ) -> LivingBrandVaultResponse:
        """
        Compiles the read-only Living Brand Document dynamically from active brand_facts.
        Zero direct Markdown editing — all changes flow through deterministic facts.
        """
        # Fetch client info
        client_res = await db.execute(select(Client).where(Client.id == client_id))
        client = client_res.scalar_one_or_none()
        client_name = client.business_name if client else "Client Brand"

        now = datetime.now(timezone.utc)
        res = await db.execute(
            select(BrandFact).where(
                BrandFact.client_id == client_id,
                BrandFact.status == "active",
                or_(BrandFact.expires_at.is_(None), BrandFact.expires_at > now),
            ).order_by(BrandFact.fact_type, BrandFact.created_at.desc())
        )
        facts = res.scalars().all()

        taboos = [f for f in facts if f.fact_type == "taboo"]
        guardrails = [f for f in facts if f.fact_type == "guardrail"]
        personas = [f for f in facts if f.fact_type == "persona"]
        winning_patterns = [f for f in facts if f.fact_type == "winning_pattern"]

        # Build Markdown with clean, executive typography (zero tacky emojis)
        md = []
        md.append(f"# {client_name} — Living Brand Vault")
        md.append(f"Last Compiled: {now.strftime('%Y-%m-%d %H:%M:%S UTC')} | Active Institutional Facts: {len(facts)}\n")
        md.append("> Institutional memory rules verified and approved by agency leadership. Loaded deterministically into AgencyOS AI pipelines to guarantee zero brand drift.")
        md.append("\n---\n")

        # 1. Negative Boundaries & Taboos
        md.append("## Negative Boundaries & Hard Taboos")
        if not taboos:
            md.append("No active negative taboos recorded.")
        else:
            for t in taboos:
                chan_str = ", ".join(t.channels or ["all"])
                md.append(f"### Rule [{str(t.id)[:8]}]: {t.statement}")
                if t.rationale:
                    md.append(f"- Rationale: {t.rationale}")
                md.append(f"- Enforced Channels: {chan_str}")
                if t.provenance_quote:
                    md.append(f"- Verified Citation: \"{t.provenance_quote}\" ({t.provenance_location or 'Client Direct'})")
                md.append("")

        # 2. Quality Standards & Guardrails
        md.append("\n## Quality Standards & Brand Guardrails")
        if not guardrails:
            md.append("No active guardrails recorded.")
        else:
            for g in guardrails:
                chan_str = ", ".join(g.channels or ["all"])
                md.append(f"### Rule [{str(g.id)[:8]}]: {g.statement}")
                if g.rationale:
                    md.append(f"- Rationale: {g.rationale}")
                md.append(f"- Applicable Channels: {chan_str}")
                if g.provenance_quote:
                    md.append(f"- Verified Citation: \"{g.provenance_quote}\" ({g.provenance_location or 'Client Direct'})")
                md.append("")

        # 3. Personas
        md.append("\n## Target Audience Personas")
        if not personas:
            md.append("No active personas recorded.")
        else:
            for p in personas:
                md.append(f"### Persona: {p.statement}")
                if p.rationale:
                    md.append(f"- Profile Detail: {p.rationale}")
                md.append("")

        # 4. Winning Patterns
        md.append("\n## Verified Winning Patterns & Playbooks")
        if not winning_patterns:
            md.append("No active winning patterns recorded.")
        else:
            for w in winning_patterns:
                md.append(f"### Playbook: {w.statement}")
                if w.rationale:
                    md.append(f"- Execution Mechanics: {w.rationale}")
                md.append("")

        compiled_text = "\n".join(md)

        return LivingBrandVaultResponse(
            client_id=client_id,
            client_name=client_name,
            compiled_markdown=compiled_text,
            total_active_rules=len(facts),
            guardrails_count=len(guardrails),
            taboos_count=len(taboos),
            personas_count=len(personas),
            winning_patterns_count=len(winning_patterns),
            last_recompiled_at=now,
            active_facts=[BrandFactResponse.model_validate(f) for f in facts],
        )


cortex_service = CortexService()
