from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ApprovalDecision(str, enum.Enum):
    approved = "approved"
    changes_requested = "changes_requested"
    rejected = "rejected"


class Approval(Base):
    __tablename__ = "approvals"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    content_version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("content_versions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    reviewer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    decision: Mapped[ApprovalDecision] = mapped_column(
        Enum(ApprovalDecision, name="approval_decision_enum"), nullable=False
    )
    comment: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    reviewed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    is_valid: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    content_version: Mapped["ContentVersion"] = relationship(  # noqa: F821
        "ContentVersion", back_populates="approval"
    )
    reviewer: Mapped["User"] = relationship("User")  # noqa: F821
