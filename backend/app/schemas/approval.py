from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.approval import ApprovalDecision


class ApprovalCreate(BaseModel):
    decision: ApprovalDecision
    comment: str | None = None


class ApprovalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    content_version_id: uuid.UUID
    reviewer_id: uuid.UUID
    decision: ApprovalDecision
    comment: str | None
    reviewed_at: datetime
    is_valid: bool
