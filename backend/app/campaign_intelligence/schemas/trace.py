from __future__ import annotations

import uuid
from pydantic import BaseModel, Field


class AgentTelemetry(BaseModel):
    """Execution telemetry captured for each agent in the pipeline."""
    agent_name: str
    start_time: str
    end_time: str
    duration_ms: float = Field(ge=0.0)
    tokens_used: int = Field(default=0, ge=0)
    model_name: str
    success: bool = True
    error_message: str | None = None


class PipelineTrace(BaseModel):
    """End-to-end execution trace for an entire campaign generation run."""
    run_id: str
    agency_id: uuid.UUID
    client_id: uuid.UUID
    campaign_id: uuid.UUID
    agents: list[AgentTelemetry] = Field(default_factory=list)
    total_duration_ms: float = Field(default=0.0, ge=0.0)

