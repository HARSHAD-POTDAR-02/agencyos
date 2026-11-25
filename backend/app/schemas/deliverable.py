from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, computed_field

from app.models.deliverable import DeliverableStatus
from app.schemas.campaign import DeliverableOut
from app.schemas.comment import CommentOut
from app.schemas.task import TaskOut


class ContentVersionOut(BaseModel):
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
    carousel_items: list[dict[str, Any]] | None = None
    uploaded_by_id: uuid.UUID
    created_at: datetime

    @computed_field
    @property
    def carousel_slides(self) -> list[dict[str, Any]]:
        if not self.carousel_items:
            return []
        from app.services.tunnel_service import get_effective_media_url
        slides: list[dict[str, Any]] = []
        for idx, it in enumerate(self.carousel_items, start=1):
            skey = it.get("storage_key") or ""
            fname = it.get("file_name") or f"slide_{idx}"
            ftype = it.get("file_type") or ""
            is_vid = bool("video" in ftype.lower() or fname.lower().endswith((".mp4", ".mov", ".m4v")))
            slides.append({
                "index": idx,
                "storage_key": skey,
                "file_name": fname,
                "file_type": ftype,
                "file_size_bytes": it.get("file_size_bytes"),
                "is_video": is_vid,
                "url": get_effective_media_url(skey) if skey else (it.get("url") or ""),
            })
        return slides

    @computed_field
    @property
    def url(self) -> str:
        from app.services.tunnel_service import get_effective_media_url

        return get_effective_media_url(self.storage_key)


class DeliverableDetailOut(DeliverableOut):
    """Deliverable with its full version history, tasks, and comments attached."""
    content_versions: list[ContentVersionOut] = []
    tasks: list[TaskOut] = []
    comments: list[CommentOut] = []
