from __future__ import annotations

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class DeliverableStatus(str, enum.Enum):
    not_started = "not_started"
    in_production = "in_production"
    internal_review = "internal_review"
    client_review = "client_review"
    changes_requested = "changes_requested"
    approved = "approved"
    scheduled = "scheduled"
    publishing = "publishing"
    partially_published = "partially_published"
    published = "published"
    failed = "failed"
    needs_reconnection = "needs_reconnection"
    ambiguous = "ambiguous"
    cancelled = "cancelled"


class Deliverable(Base):
    __tablename__ = "deliverables"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("campaigns.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    scope_item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scope_items.id", ondelete="SET NULL"),
        nullable=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    deliverable_type: Mapped[str] = mapped_column(String(100), nullable=False)
    platform: Mapped[str] = mapped_column(String(100), nullable=False)
    planned_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[DeliverableStatus] = mapped_column(
        Enum(DeliverableStatus, name="deliverable_status_enum"),
        default=DeliverableStatus.not_started,
        nullable=False,
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    scheduled_timezone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    live_post_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    external_post_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    publishing_platform: Mapped[str | None] = mapped_column(String(50), nullable=True)
    views_count: Mapped[int | None] = mapped_column(Integer, default=0, nullable=True)
    likes_count: Mapped[int | None] = mapped_column(Integer, default=0, nullable=True)
    comments_count: Mapped[int | None] = mapped_column(Integer, default=0, nullable=True)
    shares_count: Mapped[int | None] = mapped_column(Integer, default=0, nullable=True)
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
    campaign: Mapped["Campaign"] = relationship(
        "Campaign", back_populates="deliverables", lazy="selectin"
    )  # noqa: F821
    scope_item: Mapped["ScopeItem | None"] = relationship("ScopeItem")  # noqa: F821
    tasks: Mapped[list["Task"]] = relationship(  # noqa: F821
        "Task", back_populates="deliverable", lazy="selectin", cascade="all, delete-orphan"
    )
    content_versions: Mapped[list["ContentVersion"]] = relationship(  # noqa: F821
        "ContentVersion", back_populates="deliverable", lazy="selectin", cascade="all, delete-orphan"
    )
    comments: Mapped[list["DeliverableComment"]] = relationship(  # noqa: F821
        "DeliverableComment", back_populates="deliverable", lazy="selectin", cascade="all, delete-orphan"
    )
    publication_jobs: Mapped[list["PublicationJob"]] = relationship(  # noqa: F821
        "PublicationJob", back_populates="deliverable", lazy="selectin", cascade="all, delete-orphan"
    )

    @property
    def client_id(self) -> uuid.UUID | None:
        return self.campaign.client_id if self.campaign else None

    @property
    def client_name(self) -> str | None:
        if self.campaign and self.campaign.client:
            return self.campaign.client.name
        return None
