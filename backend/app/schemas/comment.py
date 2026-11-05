from __future__ import annotations

import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class CommentCreate(BaseModel):
    message: str
    content_version_id: uuid.UUID | None = None
    is_internal: bool = False


class CommentOut(BaseModel):
    id: uuid.UUID
    deliverable_id: uuid.UUID
    content_version_id: uuid.UUID | None = None
    author_id: uuid.UUID
    author_name: str | None = None
    author_role: str | None = None
    message: str
    is_internal: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
