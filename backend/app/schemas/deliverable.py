from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.deliverable import DeliverableStatus
from app.schemas.campaign import DeliverableOut
from app.schemas.comment import CommentOut


class ContentVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    deliverable_id: uuid.UUID
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

    @property
    def url(self) -> str:
        return f"/uploads/{self.storage_key}"


class DeliverableDetailOut(DeliverableOut):
    """Deliverable with its full version history and comments attached."""
    content_versions: list[ContentVersionOut] = []
    comments: list[CommentOut] = []
