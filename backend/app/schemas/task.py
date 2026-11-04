from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.models.task import TaskPriority, TaskStatus


class TaskCreate(BaseModel):
    title: str
    task_type: str | None = None
    assignee_id: uuid.UUID | None = None
    status: TaskStatus = TaskStatus.backlog
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
