from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class DeliverableComment(Base):
    __tablename__ = "deliverable_comments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    deliverable_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("deliverables.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    content_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("content_versions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    author_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
    )
    guest_author_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    timestamp_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    message: Mapped[str] = mapped_column(String(2000), nullable=False)
    is_internal: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, server_default=func.now(), nullable=False
    )

    # Relationships
    deliverable: Mapped["Deliverable"] = relationship("Deliverable", back_populates="comments")  # noqa: F821
    content_version: Mapped["ContentVersion | None"] = relationship("ContentVersion")  # noqa: F821
    author: Mapped["User | None"] = relationship("User", lazy="selectin")  # noqa: F821

    @property
    def author_name(self) -> str | None:
        if self.guest_author_name:
            return self.guest_author_name
        if self.author:
            return self.author.full_name or self.author.email
        return "Client Reviewer"
        return None
