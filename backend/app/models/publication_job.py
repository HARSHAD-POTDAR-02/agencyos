from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class JobStatus(str, enum.Enum):
    pending = "pending"
    scheduled = "scheduled"
    publishing = "publishing"
    published = "published"
    failed = "failed"
    needs_reconnection = "needs_reconnection"
    ambiguous = "ambiguous"
    cancellation_pending = "cancellation_pending"
    cancelled = "cancelled"


class AttemptStatus(str, enum.Enum):
    started = "started"
    container_created = "container_created"
    polling = "polling"
    publishing = "publishing"
    published = "published"
    failed = "failed"
    ambiguous = "ambiguous"


class PublicationJob(Base):
    __tablename__ = "publication_jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    deliverable_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("deliverables.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    content_version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("content_versions.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    client_social_account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("client_social_accounts.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    platform: Mapped[str] = mapped_column(String(50), nullable=False)  # "instagram" or "facebook"

    # Stable operation identity across retries for this single publication intent
    publication_operation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )

    status: Mapped[JobStatus] = mapped_column(
        Enum(JobStatus, name="job_status_enum"),
        default=JobStatus.scheduled,
        nullable=False,
    )

    # Separate original schedule time from next retry target
    scheduled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    scheduled_timezone: Mapped[str] = mapped_column(
        String(64), nullable=False, default="UTC"
    )
    next_attempt_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    last_attempt_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Worker lease ownership and heartbeating
    claimed_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    claim_token: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    lease_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    heartbeat_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Retry bounds
    attempts_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_attempts: Mapped[int] = mapped_column(Integer, default=3, nullable=False)

    # Content version snapshot guarantees
    caption_snapshot: Mapped[str | None] = mapped_column(Text, nullable=True)
    media_url_snapshot: Mapped[str] = mapped_column(String(1024), nullable=False)
    share_to_feed: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Publication outcome
    external_post_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    live_post_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # Nuanced provider error capture
    last_error_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_error_subcode: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_error_category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    retry_after_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)

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
    deliverable: Mapped["Deliverable"] = relationship(  # noqa: F821
        "Deliverable", back_populates="publication_jobs"
    )
    content_version: Mapped["ContentVersion"] = relationship(  # noqa: F821
        "ContentVersion"
    )
    social_account: Mapped["ClientSocialAccount"] = relationship(  # noqa: F821
        "ClientSocialAccount"
    )
    attempts: Mapped[list["PublicationAttempt"]] = relationship(
        "PublicationAttempt",
        back_populates="job",
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="PublicationAttempt.attempt_number",
    )

    __table_args__ = (
        Index("idx_pub_jobs_due", "status", "next_attempt_at"),
        Index("idx_pub_jobs_lease", "status", "lease_expires_at"),
    )


class PublicationAttempt(Base):
    __tablename__ = "publication_attempts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    publication_job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("publication_jobs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    publication_operation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    attempt_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[AttemptStatus] = mapped_column(
        Enum(AttemptStatus, name="attempt_status_enum"),
        default=AttemptStatus.started,
        nullable=False,
    )
    claim_token: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    # Platform in-flight references
    external_container_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    external_post_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Telemetry and provider error details
    http_status: Mapped[int | None] = mapped_column(Integer, nullable=True)
    meta_error_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    meta_error_subcode: Mapped[int | None] = mapped_column(Integer, nullable=True)
    meta_error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    job: Mapped["PublicationJob"] = relationship("PublicationJob", back_populates="attempts")

    __table_args__ = (
        UniqueConstraint("publication_job_id", "attempt_number", name="uq_pub_attempts_job_num"),
        Index("idx_pub_attempts_container", "external_container_id"),
    )
