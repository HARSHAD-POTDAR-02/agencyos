from __future__ import annotations

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class TaskStatus(str, enum.Enum):
    backlog = "backlog"
    todo = "todo"
    in_progress = "in_progress"
    internal_review = "internal_review"
    client_review = "client_review"
    changes_requested = "changes_requested"
    approved = "approved"
    done = "done"
    blocked = "blocked"


class TaskPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    urgent = "urgent"


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    agency_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("agencies.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    deliverable_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("deliverables.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    client_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    is_operational: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    task_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    assignee_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[TaskStatus] = mapped_column(
        Enum(TaskStatus, name="task_status_enum"),
        default=TaskStatus.backlog,
        nullable=False,
    )
    priority: Mapped[TaskPriority] = mapped_column(
        Enum(TaskPriority, name="task_priority_enum"),
        default=TaskPriority.medium,
        nullable=False,
    )
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    blocked_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    script_blocks: Mapped[list[dict] | None] = mapped_column(
        JSONB, nullable=True, default=list
    )
    checklists: Mapped[list[dict] | None] = mapped_column(
        JSONB, nullable=True, default=list
    )
    target_duration_seconds: Mapped[int | None] = mapped_column(
        Integer, nullable=True, default=30
    )
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
    agency: Mapped["Agency"] = relationship("Agency", lazy="selectin")  # noqa: F821
    deliverable: Mapped["Deliverable | None"] = relationship("Deliverable", back_populates="tasks", lazy="selectin")  # noqa: F821
    client: Mapped["Client | None"] = relationship("Client", lazy="selectin")  # noqa: F821
    assignee: Mapped["User | None"] = relationship("User", lazy="selectin")  # noqa: F821
    content_versions: Mapped[list["ContentVersion"]] = relationship(  # noqa: F821
        "ContentVersion", back_populates="task"
    )
    comments: Mapped[list["DeliverableComment"]] = relationship(  # noqa: F821
        "DeliverableComment", back_populates="task", cascade="all, delete-orphan", lazy="selectin"
    )
