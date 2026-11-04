from __future__ import annotations

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ContractStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    paused = "paused"
    ended = "ended"


class Contract(Base):
    __tablename__ = "contracts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    monthly_fee_inr: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    status: Mapped[ContractStatus] = mapped_column(
        Enum(ContractStatus, name="contract_status_enum"),
        default=ContractStatus.draft,
        nullable=False,
    )
    revision_allowance: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    notes: Mapped[str | None] = mapped_column(String(2000), nullable=True)
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
    client: Mapped["Client"] = relationship("Client", back_populates="contracts")  # noqa: F821
    scope_items: Mapped[list["ScopeItem"]] = relationship(
        "ScopeItem", back_populates="contract", lazy="selectin"
    )


class ScopeItem(Base):
    __tablename__ = "scope_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    contract_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contracts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    deliverable_type: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g. "reel"
    platform: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g. "instagram"
    monthly_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    contract: Mapped["Contract"] = relationship("Contract", back_populates="scope_items")
