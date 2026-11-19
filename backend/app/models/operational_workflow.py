from __future__ import annotations

import enum
import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    """Compiles PostgreSQL JSONB to SQLite JSON type during SQLite test suites."""
    return "JSON"


def enum_values(enum_cls: type[enum.Enum]) -> list[str]:
    """Ensure Enum values are stored using their string values (lowercase), matching DB check constraints."""
    return [e.value for e in enum_cls]


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class WorkflowRunStatus(str, enum.Enum):
    planning = "planning"
    running = "running"
    waiting_for_human = "waiting_for_human"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"


class WorkflowTaskStatus(str, enum.Enum):
    pending = "pending"               # Blocked waiting on parent dependencies
    ready = "ready"                   # All dependencies met, unblocked
    running = "running"               # Claimed by worker / actively in progress
    waiting_for_human = "waiting_for_human" # Blocked on manual human approval/input
    in_review = "in_review"           # Output produced, waiting for client/manager sign-off
    completed = "completed"           # Accepted, output version marked active
    failed = "failed"                 # Max retries exhausted or non-retryable error
    cancelled = "cancelled"           # Cancelled or invalidated by upstream change
    blocked_by_failure = "blocked_by_failure" # Upstream parent failed


class TaskKind(str, enum.Enum):
    ai_agent = "ai_agent"
    human_production = "human_production"
    human_approval = "human_approval"
    system_deterministic = "system_deterministic"


class AssigneeType(str, enum.Enum):
    human = "human"
    agent = "agent"
    system = "system"


class WorkflowJobStatus(str, enum.Enum):
    queued = "queued"
    running = "running"
    retrying = "retrying"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"


class JobErrorCategory(str, enum.Enum):
    rate_limit_429 = "rate_limit_429"
    network_timeout = "network_timeout"
    schema_validation = "schema_validation"
    auth_error = "auth_error"
    lease_expired = "lease_expired"
    unexpected = "unexpected"


class ReviewDecision(str, enum.Enum):
    approved = "approved"
    changes_requested = "changes_requested"
    rejected = "rejected"


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class WorkflowRun(Base):
    """
    An execution run of an agency campaign objective.
    Orchestrates the entire multi-agent and human production DAG.
    """
    __tablename__ = "workflow_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agency_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("agencies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    campaign_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="SET NULL"), nullable=True, index=True
    )
    
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    objective_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    plan_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    status: Mapped[WorkflowRunStatus] = mapped_column(
        Enum(WorkflowRunStatus, values_callable=enum_values, native_enum=True),
        default=WorkflowRunStatus.planning,
        nullable=False,
        index=True,
    )
    
    total_tasks: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    completed_tasks: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    failed_tasks: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    shared_contract: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_workflow_runs_agency_client", "agency_id", "client_id"),
        UniqueConstraint("id", "agency_id", name="uq_workflow_runs_id_agency"),
    )

    agency: Mapped["Agency"] = relationship("Agency")  # noqa: F821
    client: Mapped["Client"] = relationship("Client")  # noqa: F821
    campaign: Mapped["Campaign | None"] = relationship("Campaign")  # noqa: F821
    created_by: Mapped["User | None"] = relationship("User")  # noqa: F821
    tasks: Mapped[list["WorkflowTask"]] = relationship(
        "WorkflowTask", back_populates="workflow_run", cascade="all, delete-orphan"
    )


class WorkflowTask(Base):
    """
    A single node in the workflow DAG.
    Represents an atomic piece of work (AI intelligence, human approval, batch production).
    """
    __tablename__ = "workflow_tasks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workflow_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workflow_runs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    agency_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("agencies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    deliverable_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("deliverables.id", ondelete="SET NULL"), nullable=True, index=True
    )
    
    task_key: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g. "market_research", "batch_1"
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    task_kind: Mapped[TaskKind] = mapped_column(
        Enum(TaskKind, values_callable=enum_values, native_enum=True), nullable=False
    )
    assignee_type: Mapped[AssigneeType] = mapped_column(
        Enum(AssigneeType, values_callable=enum_values, native_enum=True), nullable=False
    )
    human_assignee_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    agent_identifier: Mapped[str | None] = mapped_column(String(100), nullable=True) # e.g. "market_researcher", "content_architect"
    
    status: Mapped[WorkflowTaskStatus] = mapped_column(
        Enum(WorkflowTaskStatus, values_callable=enum_values, native_enum=True),
        default=WorkflowTaskStatus.pending,
        nullable=False,
        index=True,
    )
    current_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    selective_repair_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    input_payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("workflow_run_id", "task_key", name="uq_workflow_tasks_run_key"),
        UniqueConstraint("id", "workflow_run_id", name="uq_workflow_tasks_id_run"),
        CheckConstraint(
            """
            (assignee_type = 'human' AND human_assignee_id IS NOT NULL AND agent_identifier IS NULL)
            OR
            (assignee_type = 'agent' AND agent_identifier IS NOT NULL AND human_assignee_id IS NULL)
            OR
            (assignee_type = 'system' AND human_assignee_id IS NULL AND agent_identifier IS NULL)
            """,
            name="chk_task_assignee_integrity",
        ),
        Index("ix_workflow_tasks_run_status", "workflow_run_id", "status"),
    )

    workflow_run: Mapped["WorkflowRun"] = relationship("WorkflowRun", back_populates="tasks")
    deliverable: Mapped["Deliverable | None"] = relationship("Deliverable")  # noqa: F821
    human_assignee: Mapped["User | None"] = relationship("User")  # noqa: F821
    
    output_versions: Mapped[list["TaskOutputVersion"]] = relationship(
        "TaskOutputVersion",
        back_populates="task",
        cascade="all, delete-orphan",
        order_by="TaskOutputVersion.version_number.desc()",
    )
    job_attempts: Mapped[list["WorkflowJobAttempt"]] = relationship(
        "WorkflowJobAttempt",
        back_populates="task",
        cascade="all, delete-orphan",
        order_by="WorkflowJobAttempt.attempt_number",
    )
    reviews: Mapped[list["WorkflowTaskReview"]] = relationship(
        "WorkflowTaskReview",
        back_populates="task",
        cascade="all, delete-orphan",
        order_by="WorkflowTaskReview.reviewed_at.desc()",
    )


class WorkflowDependency(Base):
    """
    Directed dependency edge between tasks in the workflow.
    Composite foreign keys mathematically enforce that both tasks belong to the same workflow_run.
    """
    __tablename__ = "workflow_dependencies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workflow_run_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    task_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    depends_on_task_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)

    __table_args__ = (
        UniqueConstraint("task_id", "depends_on_task_id", name="uq_workflow_dep_pair"),
        CheckConstraint("task_id != depends_on_task_id", name="chk_workflow_no_self_dependency"),
        ForeignKeyConstraint(
            ["task_id", "workflow_run_id"],
            ["workflow_tasks.id", "workflow_tasks.workflow_run_id"],
            ondelete="CASCADE",
            name="fk_dep_task_workflow",
        ),
        ForeignKeyConstraint(
            ["depends_on_task_id", "workflow_run_id"],
            ["workflow_tasks.id", "workflow_tasks.workflow_run_id"],
            ondelete="CASCADE",
            name="fk_dep_parent_workflow",
        ),
        Index("ix_workflow_dep_lookup", "workflow_run_id", "depends_on_task_id"),
    )


class WorkflowJobQueue(Base):
    """
    Durable execution queue for AI and system tasks.
    Supports atomic claiming via SELECT ... FOR UPDATE SKIP LOCKED,
    worker lease renewals (heartbeats), and fencing tokens.
    Includes execution_generation so selective repairs create new queued jobs without PK collision.
    """
    __tablename__ = "workflow_job_queue"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workflow_tasks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    workflow_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workflow_runs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    agency_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("agencies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    
    execution_generation: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    status: Mapped[WorkflowJobStatus] = mapped_column(
        Enum(WorkflowJobStatus, values_callable=enum_values, native_enum=True),
        default=WorkflowJobStatus.queued,
        nullable=False,
        index=True,
    )
    execute_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    
    claimed_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    claim_token: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    lease_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    attempts_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_attempts: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("task_id", "execution_generation", name="uq_job_task_generation"),
        Index("ix_job_queue_claimable", "status", "execute_at", "lease_expires_at"),
    )

    task: Mapped["WorkflowTask"] = relationship("WorkflowTask")
    workflow_run: Mapped["WorkflowRun"] = relationship("WorkflowRun")


class WorkflowJobAttempt(Base):
    """
    Immutable audit record for every execution attempt by a worker on a task.
    """
    __tablename__ = "workflow_job_attempts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workflow_tasks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    attempt_number: Mapped[int] = mapped_column(Integer, nullable=False)
    execution_generation: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    worker_id: Mapped[str] = mapped_column(String(255), nullable=False)
    claim_token: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    
    status: Mapped[str] = mapped_column(String(50), nullable=False)  # "completed", "failed", "lease_expired"
    error_category: Mapped[JobErrorCategory | None] = mapped_column(
        Enum(JobErrorCategory, values_callable=enum_values, native_enum=True), nullable=True
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    __table_args__ = (
        UniqueConstraint("task_id", "execution_generation", "attempt_number", name="uq_attempt_task_gen_num"),
    )

    task: Mapped["WorkflowTask"] = relationship("WorkflowTask", back_populates="job_attempts")
    invocations: Mapped[list["ModelInvocation"]] = relationship(
        "ModelInvocation", back_populates="job_attempt", cascade="all, delete-orphan"
    )


class TaskOutputVersion(Base):
    """
    Immutable output payload produced by a task execution version.
    Supports selective repair by creating a new version without losing history.
    """
    __tablename__ = "task_output_versions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workflow_tasks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    output_payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    
    created_by_type: Mapped[str] = mapped_column(String(50), nullable=False)  # "agent", "human", "system"
    created_by_id: Mapped[str | None] = mapped_column(String(255), nullable=True)  # agent ID or user UUID
    change_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("task_id", "version_number", name="uq_task_output_version_num"),
        Index("ix_task_output_active", "task_id", "is_active"),
    )

    task: Mapped["WorkflowTask"] = relationship("WorkflowTask", back_populates="output_versions")


class WorkflowTaskReview(Base):
    """
    Records human checkpoints, approvals, revision requests, or rejections.
    """
    __tablename__ = "workflow_task_reviews"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workflow_tasks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    reviewer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    
    decision: Mapped[ReviewDecision] = mapped_column(
        Enum(ReviewDecision, values_callable=enum_values, native_enum=True), nullable=False
    )
    feedback_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    task: Mapped["WorkflowTask"] = relationship("WorkflowTask", back_populates="reviews")
    reviewer: Mapped["User"] = relationship("User")  # noqa: F821


class ModelInvocation(Base):
    """
    Authoritative financial and token telemetry for every model execution.
    Financial values use exact Decimal with Numeric(14, 6) (USD micros resolution).
    """
    __tablename__ = "model_invocations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_attempt_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workflow_job_attempts.id", ondelete="SET NULL"), nullable=True, index=True
    )
    task_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workflow_tasks.id", ondelete="SET NULL"), nullable=True, index=True
    )
    agency_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("agencies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    client_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="SET NULL"), nullable=True, index=True
    )
    
    provider: Mapped[str] = mapped_column(String(50), nullable=False)  # "nvidia_nim", "groq", "anthropic"
    model_identifier: Mapped[str] = mapped_column(String(100), nullable=False)
    provider_request_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    
    prompt_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    completion_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    
    # Financial precision: Numeric(14,6) = 6 decimal places in USD ($0.000001 = USD micros)
    cost_usd: Mapped[Decimal] = mapped_column(Numeric(14, 6), default=Decimal("0.000000"), nullable=False)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    invocation_status: Mapped[str] = mapped_column(String(50), default="success", nullable=False)  # "success", "error", "rate_limited"
    is_estimated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    job_attempt: Mapped["WorkflowJobAttempt | None"] = relationship("WorkflowJobAttempt", back_populates="invocations")
    task: Mapped["WorkflowTask | None"] = relationship("WorkflowTask")
