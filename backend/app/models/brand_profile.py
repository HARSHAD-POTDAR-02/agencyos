from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class BrandProfile(Base):
    __tablename__ = "brand_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    is_confirmed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    confirmed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    confirmed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    brand_voice: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    tone_examples: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    approved_phrases: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    prohibited_claims: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    target_audience: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    content_pillars: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    goals: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    website_crawl_cache: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    taste_memory: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    client: Mapped["Client"] = relationship("Client", back_populates="brand_profiles")  # noqa: F821
    confirmed_by: Mapped["User | None"] = relationship("User")  # noqa: F821
