from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict

from app.models.task import TaskPriority, TaskStatus
from app.schemas.comment import CommentOut


class TaskCreate(BaseModel):
    title: str
    deliverable_id: uuid.UUID | None = None
    task_type: str | None = None
    assignee_id: uuid.UUID | None = None
    status: TaskStatus = TaskStatus.todo
    priority: TaskPriority = TaskPriority.medium
    due_date: date | None = None
    notes: str | None = None


class TaskUpdate(BaseModel):
    title: str | None = None
    task_type: str | None = None
    assignee_id: uuid.UUID | None = None
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    due_date: date | None = None
    blocked_reason: str | None = None
    notes: str | None = None


class TaskContentVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    deliverable_id: uuid.UUID
    task_id: uuid.UUID | None = None
    version_number: int
    storage_key: str
    file_name: str
    file_type: str | None
    file_size_bytes: int | None
    checksum_sha256: str
    caption: str | None
    notes: str | None
    uploaded_by_id: uuid.UUID
    created_at: datetime
    url: str | None = None
    approval_status: str | None = None
    approval_notes: str | None = None


class TaskSubmissionCreate(BaseModel):
    submission_type: Literal["script", "file", "media"] = "file"
    script_title: str | None = None
    hook: str | None = None
    script_body: str | None = None  # Full dialogue / scene text
    caption: str | None = None
    notes: str | None = None


class TaskReviewDecision(BaseModel):
    decision: Literal["approved", "changes_requested"]
    feedback_notes: str | None = None


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    deliverable_id: uuid.UUID
    title: str
    task_type: str | None
    assignee_id: uuid.UUID | None
    status: TaskStatus
    priority: TaskPriority
    due_date: date | None
    blocked_reason: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    # Enriched Context (optional, backwards compatible)
    client_id: uuid.UUID | None = None
    client_name: str | None = None
    campaign_id: uuid.UUID | None = None
    campaign_title: str | None = None
    deliverable_title: str | None = None
    deliverable_type: str | None = None
    assignee_name: str | None = None
    assignee_role: str | None = None
    is_locked: bool = False
    locked_reason: str | None = None


class TaskDetailOut(TaskOut):
    campaign_objective: str | None = None
    platform: str | None = None
    brand_voice: str | None = None
    target_audience: list[str] = []

    # Reference Assets & Storyboard Brief
    storyboard_text: str | None = None
    reference_assets: list[dict[str, Any]] = []

    # Submissions & Approvals History
    submissions: list[TaskContentVersionOut] = []
    review_comments: list[CommentOut] = []


class TaskAIAssistRequest(BaseModel):
    instruction: str
    current_hook: str | None = None
    current_script: str | None = None
    task_type: str | None = None


class TaskAIAssistResponse(BaseModel):
    agent_name: str
    critique: str
    recommended_hook: str | None = None
    recommended_script: str | None = None
    hook_variations: list[str] = []
