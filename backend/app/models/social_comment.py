from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class CommentSentiment(str, enum.Enum):
    positive = "positive"
    inquiry = "inquiry"
    complaint = "complaint"
    neutral = "neutral"
    spam = "spam"


class EngagementStatus(str, enum.Enum):
    pending = "pending"
    replied = "replied"
    resolved = "resolved"
    hidden = "hidden"
    ignored = "ignored"


class SocialComment(Base):
    __tablename__ = "social_comments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    agency_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("agencies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    social_account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("client_social_accounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    deliverable_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("deliverables.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    platform: Mapped[str] = mapped_column(String(50), default="instagram", nullable=False)
    external_comment_id: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    external_media_id: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    external_parent_id: Mapped[str | None] = mapped_column(String(512), nullable=True)

    media_permalink: Mapped[str | None] = mapped_column(String(512), nullable=True)
    media_thumbnail_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    media_caption: Mapped[str | None] = mapped_column(Text, nullable=True)

    author_username: Mapped[str] = mapped_column(String(255), nullable=False)
    author_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    author_profile_pic: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    comment_text: Mapped[str] = mapped_column(Text, nullable=False)
    like_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_liked_by_brand: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    commented_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)

    # AI Triage & Classification
    sentiment: Mapped[CommentSentiment] = mapped_column(
        Enum(CommentSentiment, name="comment_sentiment_enum"),
        default=CommentSentiment.neutral,
        nullable=False,
        index=True,
    )
    intent_category: Mapped[str | None] = mapped_column(String(50), nullable=True)  # "pricing", "delivery", "praise"
    urgency: Mapped[str] = mapped_column(String(20), default="normal", nullable=False)  # "urgent", "high", "normal"
    ai_suggested_reply: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_suggested_reply_options: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON-encoded array

    # Reply tracking
    status: Mapped[EngagementStatus] = mapped_column(
        Enum(EngagementStatus, name="engagement_status_enum"),
        default=EngagementStatus.pending,
        nullable=False,
        index=True,
    )
    reply_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    replied_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    replied_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    external_reply_id: Mapped[str | None] = mapped_column(String(512), nullable=True)

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
    client: Mapped["Client"] = relationship("Client", lazy="selectin")  # noqa: F821
    social_account: Mapped["ClientSocialAccount"] = relationship("ClientSocialAccount", lazy="selectin")  # noqa: F821
    deliverable: Mapped["Deliverable | None"] = relationship("Deliverable", lazy="selectin")  # noqa: F821
    replied_by_user: Mapped["User | None"] = relationship("User", lazy="selectin")  # noqa: F821


class SocialConversation(Base):
    __tablename__ = "social_conversations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    agency_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("agencies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    social_account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("client_social_accounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    platform: Mapped[str] = mapped_column(String(50), default="instagram", nullable=False)
    external_thread_id: Mapped[str] = mapped_column(String(512), unique=True, index=True, nullable=False)
    participant_username: Mapped[str] = mapped_column(String(255), nullable=False)
    participant_id: Mapped[str] = mapped_column(String(255), nullable=False)
    participant_avatar: Mapped[str | None] = mapped_column(String(1024), nullable=True)

    last_message_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_message_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    unread_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    sentiment: Mapped[CommentSentiment] = mapped_column(
        Enum(CommentSentiment, name="conversation_sentiment_enum"),
        default=CommentSentiment.neutral,
        nullable=False,
    )
    urgency: Mapped[str] = mapped_column(String(20), default="normal", nullable=False)
    status: Mapped[EngagementStatus] = mapped_column(
        Enum(EngagementStatus, name="conversation_status_enum"),
        default=EngagementStatus.pending,
        nullable=False,
        index=True,
    )
    ai_suggested_reply: Mapped[str | None] = mapped_column(Text, nullable=True)

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
    client: Mapped["Client"] = relationship("Client", lazy="selectin")  # noqa: F821
    social_account: Mapped["ClientSocialAccount"] = relationship("ClientSocialAccount", lazy="selectin")  # noqa: F821
    messages: Mapped[list["SocialMessage"]] = relationship(
        "SocialMessage",
        back_populates="conversation",
        lazy="selectin",
        order_by="SocialMessage.sent_at.asc()",
        cascade="all, delete-orphan",
    )


class SocialMessage(Base):
    __tablename__ = "social_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("social_conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    external_message_id: Mapped[str] = mapped_column(String(512), unique=True, index=True, nullable=False)
    sender_username: Mapped[str] = mapped_column(String(255), nullable=False)
    sender_id: Mapped[str] = mapped_column(String(255), nullable=False)
    is_from_brand: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    message_text: Mapped[str] = mapped_column(Text, nullable=False)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    conversation: Mapped["SocialConversation"] = relationship("SocialConversation", back_populates="messages")
