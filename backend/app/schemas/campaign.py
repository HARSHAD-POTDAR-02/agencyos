from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.campaign import CampaignStatus
from app.models.deliverable import DeliverableStatus


class CampaignCreate(BaseModel):
    name: str
    period_month: int | None = None
    period_year: int | None = None
    objective: str | None = None
    status: CampaignStatus = CampaignStatus.draft


class CampaignOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_id: uuid.UUID
    name: str
    period_month: int | None
    period_year: int | None
    objective: str | None
    status: CampaignStatus
    ai_plan_draft: dict[str, Any] | None
    approved_by_id: uuid.UUID | None
    approved_at: datetime | None
    created_at: datetime
    updated_at: datetime


class DeliverableCreate(BaseModel):
    title: str
    deliverable_type: str
    platform: str
    planned_date: date | None = None
    scope_item_id: uuid.UUID | None = None
    status: DeliverableStatus = DeliverableStatus.not_started


class DeliverableOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    campaign_id: uuid.UUID
    scope_item_id: uuid.UUID | None
    title: str
    deliverable_type: str
    platform: str
    planned_date: date | None
    status: DeliverableStatus
    published_at: datetime | None = None
    scheduled_at: datetime | None = None
    scheduled_timezone: str | None = None
    live_post_url: str | None = None
    external_post_id: str | None = None
    publishing_platform: str | None = None
    views_count: int | None = 0
    likes_count: int | None = 0
    comments_count: int | None = 0
    shares_count: int | None = 0
    client_id: uuid.UUID | None = None
    client_name: str | None = None
    campaign_title: str | None = None
    latest_caption: str | None = None
    latest_asset_url: str | None = None
    latest_file_type: str | None = None
    tasks_count: int = 0
    tasks_completed_count: int = 0
    created_at: datetime
    updated_at: datetime


class DeliverableUpdate(BaseModel):
    status: DeliverableStatus | None = None
    planned_date: date | None = None
    scheduled_at: datetime | None = None
    scheduled_timezone: str | None = None
    title: str | None = None


class QuotaSummaryOut(BaseModel):
    scope_item_id: uuid.UUID
    deliverable_type: str
    platform: str
    monthly_quantity: int
    contracted: int
    not_started: int
    in_production: int
    approved: int
    published: int
    remaining: int


class GeneratePlanRequest(BaseModel):
    period_month: int = 11
    period_year: int = 2026
    start_date: str | None = None  # Format: YYYY-MM-DD
    end_date: str | None = None    # Format: YYYY-MM-DD
    duration_days: int | None = None
    objective: str | None = None
    custom_brief: str | None = None
    deliverable_preferences: list[str] | None = None
    pinned_entities: list[str] = Field(default_factory=list)


class ConvertToTasksRequest(BaseModel):
    day_numbers: list[int] | None = None


class ConvertToTasksResponse(BaseModel):
    campaign_id: uuid.UUID
    deliverables_created: int
    tasks_created: int
    status: str


class ChatMessage(BaseModel):
    role: str
    content: str
    agent_id: str | None = None
    agent_name: str | None = None


class ChatBriefRequest(BaseModel):
    messages: list[ChatMessage]
    agent_id: str | None = "director"
    period_month: int | None = None
    period_year: int | None = None
    start_date: str | None = None
    end_date: str | None = None
    campaign_id: uuid.UUID | None = None
    active_artifact_id: uuid.UUID | str | None = None
    active_artifact_version: int | None = None
    pinned_entities: list[str] = Field(default_factory=list)
    discovered_entities: list[str] = Field(default_factory=list)
    chat_id: str | None = None
    session_id: uuid.UUID | str | None = None


class ChatBriefResponse(BaseModel):
    reply: str
    agent_id: str = "director"
    agent_name: str = "Campaign Director"
    suggested_objective: str | None = None
    suggested_custom_brief: str | None = None
    suggested_deliverable_preferences: list[str] | None = None
    suggested_period_month: int | None = None
    suggested_period_year: int | None = None
    suggested_start_date: str | None = None
    suggested_end_date: str | None = None
    suggested_duration_days: int | None = None
    suggested_deliverable_count: int | None = None
    is_ready_to_generate: bool = False

    # Collaborative Studio & Draft Artifact additions
    campaign_id: uuid.UUID | None = None
    session_id: uuid.UUID | None = None
    chat_id: str | None = None
    artifact_id: uuid.UUID | str | None = None
    artifact_type: str | None = None
    artifact_title: str | None = None
    artifact_payload: dict[str, Any] | None = None
    artifact_version_number: int | None = None
    artifact_status: str | None = None
    supporting_evidence_refs: list[dict[str, Any]] = Field(default_factory=list)
    activity_logs: list[dict[str, Any]] = Field(default_factory=list)
    pinned_entities: list[str] = Field(default_factory=list)
    discovered_entities: list[str] = Field(default_factory=list)


class StudioArtifactVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    artifact_id: uuid.UUID
    version_number: int
    parent_version_id: uuid.UUID | None = None
    actor_type: str
    actor_id: str
    payload: dict[str, Any]
    supporting_evidence_refs: list[dict[str, Any]] | None = None
    change_summary: str | None = None
    is_approved: bool
    approved_by_id: uuid.UUID | None = None
    approved_at: datetime | None = None
    created_at: datetime


class StudioArtifactOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    session_id: uuid.UUID
    agency_id: uuid.UUID
    client_id: uuid.UUID
    campaign_id: uuid.UUID
    artifact_type: str
    title: str
    status: str
    current_version_number: int
    created_at: datetime
    updated_at: datetime
    latest_version: StudioArtifactVersionOut | None = None
    versions: list[StudioArtifactVersionOut] = []


class StudioApproveVersionRequest(BaseModel):
    version_number: int


class StudioReviseArtifactRequest(BaseModel):
    title: str | None = None
    payload: dict[str, Any]
    change_summary: str | None = None
    parent_version_id: uuid.UUID | None = None
    supporting_evidence_refs: list[dict[str, Any]] | None = None


class StudioExportPipelineRequest(BaseModel):
    artifact_id: str
    expected_version_number: int = 1
    assignee_id: uuid.UUID | None = None
    default_due_date: date | None = None
    target_format: str | None = None
    deliverable_name: str | None = None
    artifact_type: str | None = None
    artifact_payload: dict[str, Any] | None = None


class StudioExportPipelineResponse(BaseModel):
    is_replay: bool
    export_id: uuid.UUID
    deliverable_id: uuid.UUID
    task_id: uuid.UUID
    deliverable_title: str
    task_title: str
    exported_at: datetime


class UpdateDeliverableRequest(BaseModel):
    deliverable: dict[str, Any]


class UpdateDeliverableResponse(BaseModel):
    success: bool = True
    deliverable: dict[str, Any]
    campaign_id: uuid.UUID


class ReviseDeliverableAIRequest(BaseModel):
    instruction: str = Field(min_length=2)
    current_deliverable: dict[str, Any]


class ReviseDeliverableAIResponse(BaseModel):
    revised_deliverable: dict[str, Any]
    explanation: str
    activity_logs: list[str] = Field(default_factory=list)



