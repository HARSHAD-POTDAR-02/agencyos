from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.social_comment import CommentSentiment, EngagementStatus


class SocialCommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    agency_id: uuid.UUID
    client_id: uuid.UUID
    social_account_id: uuid.UUID
    deliverable_id: uuid.UUID | None = None
    platform: str
    external_comment_id: str
    external_media_id: str
    external_parent_id: str | None = None
    media_permalink: str | None = None
    media_thumbnail_url: str | None = None
    media_caption: str | None = None
    author_username: str
    author_id: str | None = None
    author_profile_pic: str | None = None
    comment_text: str
    like_count: int = 0
    is_liked_by_brand: bool = False
    is_hidden: bool = False
    commented_at: datetime
    sentiment: CommentSentiment
    intent_category: str | None = None
    urgency: str = "normal"
    status: EngagementStatus
    ai_suggested_reply: str | None = None
    ai_suggested_reply_options: list[str] | None = None
    reply_text: str | None = None
    replied_at: datetime | None = None
    replied_by_user_id: uuid.UUID | None = None
    client_name: str | None = None
    deliverable_title: str | None = None
    created_at: datetime

    @field_validator("ai_suggested_reply_options", mode="before")
    @classmethod
    def parse_reply_options(cls, v: Any) -> list[str] | None:
        if v is None:
            return None
        if isinstance(v, list):
            res = []
            for item in v:
                if isinstance(item, dict):
                    res.append(item.get("reply", "") or str(item))
                else:
                    res.append(str(item))
            return res
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    res = []
                    for item in parsed:
                        if isinstance(item, dict):
                            res.append(item.get("reply", "") or str(item))
                        else:
                            res.append(str(item))
                    return res
            except Exception:
                pass
            return [v] if v.strip() else []
        return None


class CommentReplyRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2200)


class CommentAIResponseRequest(BaseModel):
    instruction: str | None = None


class AIReplyOption(BaseModel):
    tone: str
    title: str
    reply: str


class CommentAIResponseResponse(BaseModel):
    suggestions: list[AIReplyOption]
    sentiment: str
    intent_category: str | None = None
    explanation: str | None = None


class SocialMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    conversation_id: uuid.UUID
    external_message_id: str
    sender_username: str
    sender_id: str
    is_from_brand: bool
    message_text: str
    sent_at: datetime


class SocialConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    agency_id: uuid.UUID
    client_id: uuid.UUID
    social_account_id: uuid.UUID
    platform: str
    external_thread_id: str
    participant_username: str
    participant_id: str
    participant_avatar: str | None = None
    last_message_text: str | None = None
    last_message_at: datetime
    unread_count: int = 0
    sentiment: CommentSentiment
    urgency: str = "normal"
    status: EngagementStatus
    ai_suggested_reply: str | None = None
    client_name: str | None = None
    messages: list[SocialMessageOut] = []


class SendMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    use_human_agent_tag: bool = True


class EngagementSyncResponse(BaseModel):
    comments_synced: int
    conversations_synced: int
    status: str = "success"
    synced_at: datetime
    dm_warning: str | None = None


class EngagementStatsOut(BaseModel):
    total_comments: int = 0
    pending_comments: int = 0
    replied_comments: int = 0
    total_conversations: int = 0
    unread_conversations: int = 0
    positive_sentiment_percent: float = 0.0
    leads_count: int = 0
    complaints_count: int = 0
    average_reply_time_minutes: float | None = None


class TokenPermissionsOut(BaseModel):
    has_manage_comments: bool
    has_manage_messages: bool
    has_manage_engagement: bool
    has_manage_insights: bool
    granted_scopes: list[str]
    declined_scopes: list[str] = []
