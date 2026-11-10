from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ClientSocialAccount(Base):
    __tablename__ = "client_social_accounts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    platform: Mapped[str] = mapped_column(String(50), nullable=False)  # "instagram", "facebook"
    account_name: Mapped[str | None] = mapped_column(String(255), nullable=True)  # e.g. "Hotel Shauryawada Official"
    account_handle: Mapped[str | None] = mapped_column(String(100), nullable=True)  # e.g. "@hotelshauryawada"
    instagram_business_id: Mapped[str | None] = mapped_column(String(100), nullable=True)  # e.g. "178414000..."
    facebook_page_id: Mapped[str | None] = mapped_column(String(100), nullable=True)  # e.g. "10523000..."
    access_token: Mapped[str] = mapped_column(Text, nullable=False)
    token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
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
    client: Mapped["Client"] = relationship("Client", back_populates="social_accounts")  # noqa: F821
    publication_jobs: Mapped[list["PublicationJob"]] = relationship(  # noqa: F821
        "PublicationJob", back_populates="social_account"
    )
