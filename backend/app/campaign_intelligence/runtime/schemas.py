from __future__ import annotations

import math
import uuid
from enum import Enum
from typing import Any
from pydantic import BaseModel, Field, model_validator
from langchain_core.messages import BaseMessage, AIMessage

from app.campaign_intelligence.schemas.studio_context import CampaignStudioContext


class ExecutionStatus(str, Enum):
    """Overall terminal status of the bounded tool execution runtime."""
    NORMAL_COMPLETION = "normal_completion"
    MAX_TURNS_REACHED = "max_turns_reached"
    MAX_TOOL_CALLS_REACHED = "max_tool_calls_reached"
    TIMEOUT = "timeout"
    BUDGET_EXHAUSTED = "budget_exhausted"
    TOOL_EXECUTION_FAILURE = "tool_execution_failure"
    PROVIDER_FAILURE = "provider_failure"


class ToolCallStatus(str, Enum):
    """Discrete status of an individual tool call execution."""
    SUCCESS = "success"
    TOOL_ERROR = "tool_error"
    UNAUTHORIZED_SPECIALIST = "unauthorized_specialist"
    UNAUTHORIZED_TENANT = "unauthorized_tenant"
    INVALID_ARGUMENTS = "invalid_arguments"
    MALFORMED_TOOL_CALL = "malformed_tool_call"
    TIMEOUT = "timeout"
    BUDGET_EXCEEDED = "budget_exceeded"
    CALL_LIMIT_REACHED = "call_limit_reached"
    TOOL_QUOTA_EXHAUSTED = "tool_quota_exhausted"
    UNKNOWN_TOOL = "unknown_tool"


class ToolCallTelemetry(BaseModel):
    """Structured telemetry emitted for every attempted tool call."""
    call_id: str
    tool_name: str
    status: ToolCallStatus
    duration_ms: float
    cost_units_reserved: float
    cost_units_consumed: float
    error_message: str | None = None
    output_bytes: int = 0
    is_truncated: bool = False


class ToolRuntimeConfig(BaseModel):
    """
    Strict configuration for bounded tool execution.
    All constraints are validated at initialization.
    """
    max_turns: int = Field(default=5, ge=1, le=20, description="Max conversation turn cycles with model")
    max_total_tool_calls: int = Field(default=8, ge=1, le=50, description="Max cumulative tool executions")
    execution_timeout_seconds: float = Field(default=30.0, gt=0.0, le=300.0, description="Overall wall-clock timeout")
    per_tool_timeout_seconds: float = Field(default=10.0, gt=0.0, le=60.0, description="Per-tool execution timeout")
    max_tool_output_bytes: int = Field(default=20_000, ge=500, le=200_000, description="Max serialized output size")
    budget_units: float = Field(default=100.0, gt=0.0, description="Abstract budget units available for tool calls")
    max_request_tokens: int = Field(default=5_500, ge=1_000, le=32_000, description="Max prompt token budget per LLM turn")
    per_tool_max_calls: dict[str, int] = Field(
        default_factory=dict,
        description="Optional per-tool call limits (e.g. {'web_search': 3, 'extract_webpages': 3})",
    )

    @model_validator(mode="after")
    def validate_constraints(self) -> "ToolRuntimeConfig":
        for field_name in ["execution_timeout_seconds", "per_tool_timeout_seconds", "budget_units"]:
            val = getattr(self, field_name)
            if not math.isfinite(val):
                raise ValueError(f"{field_name} must be a finite number, got {val}")

        if self.per_tool_timeout_seconds > self.execution_timeout_seconds:
            raise ValueError(
                f"per_tool_timeout_seconds ({self.per_tool_timeout_seconds}s) cannot exceed "
                f"execution_timeout_seconds ({self.execution_timeout_seconds}s)"
            )
        return self


class ToolExecutionContext(BaseModel):
    """
    Immutable, trusted authorization and tenant context passed from backend runtime.
    Tool functions MUST consume tenant information from this context rather than
    unverified model arguments.
    Enforces strict consistency with CampaignStudioContext identifiers.
    """
    agency_id: uuid.UUID
    client_id: uuid.UUID
    campaign_id: uuid.UUID
    user_id: uuid.UUID | None = None
    specialist_id: str
    studio_context: CampaignStudioContext | None = None

    model_config = {
        "frozen": True,
        "arbitrary_types_allowed": True,
    }

    @model_validator(mode="after")
    def validate_studio_context_consistency(self) -> "ToolExecutionContext":
        if self.studio_context is not None:
            if self.agency_id != self.studio_context.agency_id:
                raise ValueError(
                    f"Agency ID mismatch: ToolExecutionContext ({self.agency_id}) != "
                    f"CampaignStudioContext ({self.studio_context.agency_id})"
                )
            if self.client_id != self.studio_context.client_id:
                raise ValueError(
                    f"Client ID mismatch: ToolExecutionContext ({self.client_id}) != "
                    f"CampaignStudioContext ({self.studio_context.client_id})"
                )
            if self.campaign_id != self.studio_context.campaign_id:
                raise ValueError(
                    f"Campaign ID mismatch: ToolExecutionContext ({self.campaign_id}) != "
                    f"CampaignStudioContext ({self.studio_context.campaign_id})"
                )
        return self


class ToolObservation(BaseModel):
    """
    Preserved observation record from an executed tool call.
    Contains bounded observation payload to prevent unbounded memory growth.
    """
    tool_call_id: str
    tool_name: str
    status: ToolCallStatus
    data: Any = None
    is_truncated: bool = False
    duration_ms: float = 0.0
    cost_units: float = 0.0
    metadata: dict[str, str | int | float | bool] = Field(default_factory=dict)

    model_config = {
        "arbitrary_types_allowed": True,
    }


class ToolExecutionResult(BaseModel):
    """
    Complete result returned by BoundedToolRuntime.
    Distinguishes runtime execution status from downstream artifact synthesis,
    and explicitly tracks failure counts and execution completeness.
    """
    status: ExecutionStatus
    final_message: AIMessage | None = None
    all_messages: list[BaseMessage] = Field(default_factory=list)
    telemetry: list[ToolCallTelemetry] = Field(default_factory=list)
    total_turns: int = 0
    total_tool_calls: int = 0
    successful_tool_calls: int = 0
    failed_tool_calls: int = 0
    has_incomplete_execution: bool = False
    budget_reserved: float = 0.0
    budget_consumed: float = 0.0
    duration_ms: float = 0.0
    failure_reason: str | None = None
    provider_error_type: str | None = None
    provider_status_code: int | None = None
    observations: list[ToolObservation] = Field(default_factory=list)

    model_config = {
        "arbitrary_types_allowed": True,
    }
