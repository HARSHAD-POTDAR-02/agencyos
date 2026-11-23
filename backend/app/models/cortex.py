from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Index,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector

from app.core.database import Base


class FactTypeEnum(str, enum.Enum):
    guardrail = "guardrail"
    persona = "persona"
    winning_pattern = "winning_pattern"
    taboo = "taboo"


class FactStatusEnum(str, enum.Enum):
    proposed = "proposed"
    active = "active"
    superseded = "superseded"
    archived = "archived"


class MemoryScopeEnum(str, enum.Enum):
    agency = "agency"
    client = "client"
    campaign = "campaign"


class SourceTypeEnum(str, enum.Enum):
    document = "document"
    transcript = "transcript"
    revision_triple = "revision_triple"
    performance_metric = "performance_metric"


class MemorySource(Base):
    """
    Raw ingested source material (brand doc, call transcript, revision triple, or performance metric).
    Acts as the parent provenance container for extracted facts and vectorized knowledge chunks.
    """
    __tablename__ = "memory_sources"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    source_type: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    raw_content: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_json: Mapped[Dict[str, Any]] = mapped_column(
        "metadata", JSONB, nullable=False, default=dict
    )
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=func.now()
    )

    # Relationships
    facts: Mapped[List[BrandFact]] = relationship(
        "BrandFact", back_populates="source", cascade="all, delete-orphan"
    )
    chunks: Mapped[List[KnowledgeChunk]] = relationship(
        "KnowledgeChunk", back_populates="source", cascade="all, delete-orphan"
    )


class BrandFact(Base):
    """
    Atomic institutional memory rule, persona, winning pattern, or taboo.
    Managed via lifecycle status (proposed -> active -> superseded -> archived).
    Negative guardrails and taboos are loaded deterministically via SQL.
    """
    __tablename__ = "brand_facts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    client_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    scope: Mapped[str] = mapped_column(String(16), nullable=False, default="client")
    campaign_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    fact_type: Mapped[str] = mapped_column(String(24), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="proposed")
    statement: Mapped[str] = mapped_column(Text, nullable=False)
    rationale: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    channels: Mapped[List[str]] = mapped_column(
        JSONB, nullable=False, default=lambda: ["all"]
    )
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    source_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("memory_sources.id", ondelete="SET NULL"), nullable=True
    )
    provenance_quote: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    provenance_location: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    supersedes_fact_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("brand_facts.id", ondelete="SET NULL"), nullable=True
    )
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    approved_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=func.now()
    )

    # Relationships
    source: Mapped[Optional[MemorySource]] = relationship("MemorySource", back_populates="facts")
    audit_logs: Mapped[List[FactAuditLog]] = relationship(
        "FactAuditLog", back_populates="fact", cascade="all, delete-orphan"
    )
    chunks: Mapped[List[KnowledgeChunk]] = relationship("KnowledgeChunk", back_populates="fact")


class KnowledgeChunk(Base):
    """
    High-volume unstructured vector chunk indexed using HNSW cosine similarity.
    Used for transcripts, playbook excerpts, and long brand guidelines.
    """
    __tablename__ = "knowledge_chunks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("memory_sources.id", ondelete="CASCADE"), nullable=False
    )
    fact_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("brand_facts.id", ondelete="SET NULL"), nullable=True
    )
    chunk_type: Mapped[str] = mapped_column(
        String(32), nullable=False, default="transcript_segment"
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[Any] = mapped_column(Vector(1536), nullable=False)
    performance_metrics: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )
    channels: Mapped[List[str]] = mapped_column(
        JSONB, nullable=False, default=lambda: ["all"]
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=func.now()
    )

    # Relationships
    source: Mapped[MemorySource] = relationship("MemorySource", back_populates="chunks")
    fact: Mapped[Optional[BrandFact]] = relationship("BrandFact", back_populates="chunks")


class FactAuditLog(Base):
    """
    Immutable audit trail recording every state transition (approved, superseded, rejected, archived).
    """
    __tablename__ = "fact_audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    fact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("brand_facts.id", ondelete="CASCADE"), nullable=False
    )
    actor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    action: Mapped[str] = mapped_column(String(24), nullable=False)
    previous_status: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    new_status: Mapped[str] = mapped_column(String(16), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=func.now()
    )

    # Relationships
    fact: Mapped[BrandFact] = relationship("BrandFact", back_populates="audit_logs")
