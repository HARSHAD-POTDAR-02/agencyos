from __future__ import annotations

import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class CommentCreate(BaseModel):
    message: str
    content_version_id: uuid.UUID | None = None
    task_id: uuid.UUID | None = None
    is_internal: bool = False


class CommentOut(BaseModel):
    id: uuid.UUID
    deliverable_id: uuid.UUID | None = None
    task_id: uuid.UUID | None = None
    content_version_id: uuid.UUID | None = None
    author_id: uuid.UUID | None = None
    author_name: str | None = None
    author_role: str | None = None
    guest_author_name: str | None = None
    timestamp_seconds: float | None = None
    message: str
    is_internal: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
