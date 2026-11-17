from __future__ import annotations

import uuid
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.approval import ApprovalDecision
from app.models.deliverable import DeliverableStatus
from app.schemas.comment import CommentOut
from app.schemas.deliverable import ContentVersionOut


class ClientReviewerCreate(BaseModel):
    email: EmailStr
    full_name: str | None = None
    password: str = "ClientPassword123!"


class ClientReviewerOut(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    user_id: uuid.UUID
    email: str
    full_name: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PortalDeliverableOut(BaseModel):
    id: uuid.UUID
    campaign_id: uuid.UUID
    campaign_name: str | None = None
    client_id: uuid.UUID
    client_name: str | None = None
    title: str
    deliverable_type: str
    platform: str
    planned_date: date | None = None
    status: DeliverableStatus
    scheduled_at: datetime | None = None
    scheduled_timezone: str | None = None
    live_post_url: str | None = None
    publishing_platform: str | None = None
    is_auto_scheduled: bool = False
    created_at: datetime
    updated_at: datetime
    content_versions: list[ContentVersionOut] = []
    comments: list[CommentOut] = []

    model_config = ConfigDict(from_attributes=True)


class PortalDecisionRequest(BaseModel):
    decision: ApprovalDecision
    comment: str | None = None


class PortalBatchDecisionRequest(BaseModel):
    deliverable_ids: list[uuid.UUID]
    decision: ApprovalDecision
    comment: str | None = None


class PortalBatchDecisionOut(BaseModel):
    total_processed: int
    approved_count: int
    scheduled_count: int
    changes_requested_count: int
    deliverables: list[PortalDeliverableOut]


class ApprovalsQueueItemOut(BaseModel):
    deliverable_id: uuid.UUID
    deliverable_title: str
    deliverable_type: str
    platform: str
    publishing_platform: str | None = None
    status: DeliverableStatus
    client_id: uuid.UUID
    client_name: str
    campaign_id: uuid.UUID
    campaign_name: str
    latest_version_number: int | None = None
    latest_version_id: uuid.UUID | None = None
    latest_file_name: str | None = None
    latest_checksum: str | None = None
    planned_date: date | None = None
    updated_at: datetime
    last_comment: str | None = None
    last_comment_author: str | None = None
    last_comment_at: datetime | None = None
    live_post_url: str | None = None
    views_count: int | None = None
    likes_count: int | None = None
    comments_count: int | None = None
    shares_count: int | None = None
