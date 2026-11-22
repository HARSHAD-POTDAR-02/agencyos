from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ClientHistoricalPost(Base):
    __tablename__ = "client_historical_posts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    social_account_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("client_social_accounts.id", ondelete="SET NULL"),
        nullable=True,
    )
    platform: Mapped[str] = mapped_column(String(50), nullable=False)  # "instagram", "facebook"
    external_post_id: Mapped[str] = mapped_column(String(255), nullable=False)
    media_type: Mapped[str] = mapped_column(String(50), default="IMAGE", nullable=False)
    deliverable_format: Mapped[str] = mapped_column(String(50), default="single_image", nullable=False)
    caption: Mapped[str | None] = mapped_column(Text, nullable=True)
    permalink: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    media_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    likes_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    comments_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    shares_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    saves_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    views_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reach_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    impressions_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    engagement_rate: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    is_outlier: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    outlier_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    extracted_hook: Mapped[str | None] = mapped_column(Text, nullable=True)
    hook_archetype: Mapped[str | None] = mapped_column(String(100), nullable=True)
    content_pillar: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("client_id", "external_post_id", name="uq_client_external_post"),
    )

    # Relationships
    client: Mapped["Client"] = relationship("Client", back_populates="historical_posts")  # noqa: F821
