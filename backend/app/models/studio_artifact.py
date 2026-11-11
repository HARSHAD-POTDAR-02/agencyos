from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class StudioArtifactType(str, enum.Enum):
    storyboard = "storyboard"
    carousel_deck = "carousel_deck"
    static_post = "static_post"
    hook_comparison = "hook_comparison"
    research_evidence = "research_evidence"
    compliance_review = "compliance_review"
    campaign_blueprint = "campaign_blueprint"
    brand_positioning = "brand_positioning"
    performance_playbook = "performance_playbook"


class StudioArtifactStatus(str, enum.Enum):
    draft = "draft"
    reviewed = "reviewed"
    approved = "approved"
    exported = "exported"
    superseded = "superseded"


class CampaignStudioSession(Base):
    """
    Interactive workspace session associated with a specific campaign and client.
    Guarantees strict multi-tenant ownership at the root of the studio hierarchy.
    """
    __tablename__ = "campaign_studio_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("campaigns.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    agency_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("agencies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    title: Mapped[str] = mapped_column(String(255), default="Creative Sprint Session", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    campaign: Mapped["Campaign"] = relationship("Campaign")  # noqa: F821
    agency: Mapped["Agency"] = relationship("Agency")  # noqa: F821
    client: Mapped["Client"] = relationship("Client")  # noqa: F821
    created_by: Mapped["User | None"] = relationship("User")  # noqa: F821
    artifacts: Mapped[list["StudioArtifact"]] = relationship(
        "StudioArtifact", back_populates="session", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_studio_session_tenant", "agency_id", "campaign_id"),
    )


class StudioArtifact(Base):
    """
    Top-level container for a creative asset (e.g. Storyboard Reel #1, Research Report).
    Carries explicit agency_id, client_id, and campaign_id for immediate tenant security.
    """
    __tablename__ = "studio_artifacts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("campaign_studio_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    agency_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("agencies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("campaigns.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    artifact_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="draft", nullable=False)
    current_version_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    session: Mapped["CampaignStudioSession"] = relationship("CampaignStudioSession", back_populates="artifacts")
    versions: Mapped[list["StudioArtifactVersion"]] = relationship(
        "StudioArtifactVersion",
        back_populates="artifact",
        cascade="all, delete-orphan",
        order_by="StudioArtifactVersion.version_number.desc()",
    )

    __table_args__ = (
        Index("ix_studio_artifacts_agency_campaign", "agency_id", "campaign_id"),
        Index("ix_studio_artifacts_tenant_lookup", "agency_id", "client_id", "campaign_id"),
    )


class StudioArtifactVersion(Base):
    """
    Immutable version snapshot of an artifact at a specific revision point.
    Strict unique constraint on (artifact_id, version_number) prevents race conditions.
    """
    __tablename__ = "studio_artifact_versions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    artifact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("studio_artifacts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    parent_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("studio_artifact_versions.id", ondelete="SET NULL"),
        nullable=True,
    )
    actor_type: Mapped[str] = mapped_column(String(50), default="specialist", nullable=False)  # "specialist" | "user"
    actor_id: Mapped[str] = mapped_column(String(255), nullable=False)  # specialist_id or user UUID
    schema_version: Mapped[str] = mapped_column(String(20), default="1.0", nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    supporting_evidence_refs: Mapped[list | None] = mapped_column(JSON, nullable=True)
    change_summary: Mapped[str | None] = mapped_column(String(500), nullable=True)
    
    # Explicit Version-Level Approval Gate
    is_approved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    approved_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    artifact: Mapped["StudioArtifact"] = relationship("StudioArtifact", back_populates="versions")
    approved_by: Mapped["User | None"] = relationship("User")  # noqa: F821
    exports: Mapped[list["StudioExport"]] = relationship("StudioExport", back_populates="artifact_version")

    __table_args__ = (
        UniqueConstraint("artifact_id", "version_number", name="uq_studio_artifact_version"),
        CheckConstraint("version_number >= 1", name="ck_artifact_version_num_positive"),
        Index("ix_studio_artifact_versions_lookup", "artifact_id", "version_number"),
    )


class StudioExport(Base):
    """
    Audit record documenting an approved export of a specific artifact version to production.
    Concurrency-protected via unique (agency_id, idempotency_key).
    """
    __tablename__ = "studio_exports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    artifact_version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("studio_artifact_versions.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    agency_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("agencies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("campaigns.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    exported_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    idempotency_key: Mapped[str] = mapped_column(String(255), nullable=False)
    request_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)  # SHA-256
    production_mapping: Mapped[dict] = mapped_column(JSON, nullable=False)  # {"deliverable_ids": [...], "task_ids": [...]}
    export_status: Mapped[str] = mapped_column(String(50), default="completed", nullable=False)
    exported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    artifact_version: Mapped["StudioArtifactVersion"] = relationship("StudioArtifactVersion", back_populates="exports")
    exported_by: Mapped["User | None"] = relationship("User")  # noqa: F821

    __table_args__ = (
        UniqueConstraint("agency_id", "idempotency_key", name="uq_studio_export_agency_idempotency"),
        Index("ix_studio_exports_agency_campaign", "agency_id", "campaign_id"),
    )
