from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ContentVersion(Base):
    __tablename__ = "content_versions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    deliverable_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("deliverables.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    task_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    storage_key: Mapped[str] = mapped_column(String(1024), nullable=False)
    file_name: Mapped[str] = mapped_column(String(512), nullable=False)
    file_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    file_size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    checksum_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    caption: Mapped[str | None] = mapped_column(String(5000), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    uploaded_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    deliverable: Mapped["Deliverable"] = relationship(  # noqa: F821
        "Deliverable", back_populates="content_versions"
    )
    task: Mapped["Task | None"] = relationship(  # noqa: F821
        "Task", back_populates="content_versions"
    )
    uploaded_by: Mapped["User"] = relationship("User")  # noqa: F821
    approval: Mapped["Approval | None"] = relationship(  # noqa: F821
        "Approval", back_populates="content_version", uselist=False, cascade="all, delete-orphan"
    )
    publication_jobs: Mapped[list["PublicationJob"]] = relationship(  # noqa: F821
        "PublicationJob", back_populates="content_version", cascade="all, delete-orphan"
    )
