from __future__ import annotations

import asyncio
import inspect
import json
import logging
import math
import re
import time
from typing import Any, Awaitable, Callable
from langchain_core.tools import StructuredTool
from pydantic import BaseModel, ValidationError

from app.campaign_intelligence.runtime.schemas import (
    ToolCallStatus,
    ToolExecutionContext,
)

logger = logging.getLogger(__name__)

TOOL_NAME_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{1,64}$")


def structured_truncate_output(data: Any, max_bytes: int) -> tuple[str, bool]:
    """
    Format tool output into a valid JSON string with a strict mathematical guarantee:
        len(result_str.encode("utf-8")) <= max_bytes
    
    If serialized output exceeds max_bytes, applies structural reduction:
    - Lists: binary search item slice with truncation metadata.
    - Dicts: binary search inner list collections or key pruning.
    - Strings/Unstructured: byte-accurate UTF-8 slicing ignoring partial character boundaries.
    - Ultimate fallback: minimal valid JSON error/truncation envelope.
    """
    if max_bytes < 50:
        max_bytes = 50

    try:
        raw_json = json.dumps(data, default=str, ensure_ascii=False)
    except Exception:
        raw_json = json.dumps({"raw_repr": repr(data)}, default=str, ensure_ascii=False)

    if len(raw_json.encode("utf-8")) <= max_bytes:
        return raw_json, False

    # 1. If it's a list: binary search item count
    if isinstance(data, list):
        low = 0
        high = len(data)
        best_json = None
        while low <= high:
            mid = (low + high) // 2
            candidate = {
                "items": data[:mid],
                "_truncation": {
                    "truncated": True,
                    "retained_items": mid,
                    "total_items": len(data),
                },
            }
            cand_str = json.dumps(candidate, default=str, ensure_ascii=False)
            if len(cand_str.encode("utf-8")) <= max_bytes:
                best_json = cand_str
                low = mid + 1
            else:
                high = mid - 1
        if best_json is not None:
            return best_json, True

    # 2. If it's a dict: check for inner list collections or prune keys
    if isinstance(data, dict):
        list_keys = [k for k, v in data.items() if isinstance(v, list)]
        if list_keys:
            primary_list_key = list_keys[0]
            inner_list = data[primary_list_key]
            low = 0
            high = len(inner_list)
            best_json = None
            while low <= high:
                mid = (low + high) // 2
                cand_dict = {k: v for k, v in data.items() if k != primary_list_key}
                cand_dict[primary_list_key] = inner_list[:mid]
                cand_dict["_truncation"] = {
                    "truncated": True,
                    "truncated_field": primary_list_key,
                    "retained_items": mid,
                    "total_items": len(inner_list),
                }
                cand_str = json.dumps(cand_dict, default=str, ensure_ascii=False)
                if len(cand_str.encode("utf-8")) <= max_bytes:
                    best_json = cand_str
                    low = mid + 1
                else:
                    high = mid - 1
            if best_json is not None:
                return best_json, True

        # Key pruning fallback
        pruned_dict = {}
        for k, v in data.items():
            cand_dict = dict(pruned_dict)
            cand_dict[k] = v
            cand_dict["_truncation"] = {"truncated": True}
            cand_str = json.dumps(cand_dict, default=str, ensure_ascii=False)
            if len(cand_str.encode("utf-8")) <= max_bytes:
                pruned_dict[k] = v
            else:
                break
        if pruned_dict:
            cand_dict = dict(pruned_dict)
            cand_dict["_truncation"] = {
                "truncated": True,
                "retained_keys": len(pruned_dict),
                "total_keys": len(data),
            }
            cand_str = json.dumps(cand_dict, default=str, ensure_ascii=False)
            if len(cand_str.encode("utf-8")) <= max_bytes:
                return cand_str, True

    # 3. String / byte-accurate UTF-8 binary slice
    str_val = raw_json if isinstance(data, (dict, list)) else str(data)
    encoded = str_val.encode("utf-8")
    # Reserve space for wrapper overhead: {"content": "...", "_truncation": {"truncated": true}}
    overhead = 80
    budget_for_bytes = max(0, max_bytes - overhead)
    safe_text = encoded[:budget_for_bytes].decode("utf-8", errors="ignore")

    fallback_obj = {
        "content": safe_text,
        "_truncation": {
            "truncated": True,
            "original_bytes": len(encoded),
            "retained_bytes": len(safe_text.encode("utf-8")),
        },
    }
    result_str = json.dumps(fallback_obj, ensure_ascii=False)
    if len(result_str.encode("utf-8")) <= max_bytes:
        return result_str, True

    # 4. Ultimate irreducible fallback: minimal valid JSON envelope
    minimal = json.dumps({"_truncation": {"truncated": True, "error": "payload exceeds limit"}})
    if len(minimal.encode("utf-8")) <= max_bytes:
        return minimal, True

    return "{}", True


class SpecialistTool:
    """
    Defines a typed, authorized specialist tool.
    Enforces specialist allowlists, Pydantic argument validation,
    per-tool execution timeout, and strictly bounded JSON output.
    """

    def __init__(
        self,
        name: str,
        description: str,
        args_schema: type[BaseModel],
        handler: Callable[[BaseModel, ToolExecutionContext], Awaitable[Any]],
        allowed_specialists: set[str] | list[str],
        cost_units: float = 10.0,
    ):
        if not name or not isinstance(name, str) or not TOOL_NAME_PATTERN.match(name.strip()):
            raise ValueError(
                f"Tool name '{name}' must be a non-empty string matching pattern '^[a-zA-Z0-9_-]{{1,64}}$'."
            )
        if not description or not isinstance(description, str) or not description.strip():
            raise ValueError("Tool description must be a non-empty string.")
        if not args_schema or not isinstance(args_schema, type) or not issubclass(args_schema, BaseModel):
            raise ValueError(f"args_schema for tool '{name}' must be a subclass of pydantic.BaseModel.")
        if not callable(handler):
            raise ValueError(f"handler for tool '{name}' must be a callable.")
        if not inspect.iscoroutinefunction(handler):
            raise ValueError(f"handler for tool '{name}' must be an asynchronous coroutine function (async def).")

        if not allowed_specialists:
            raise ValueError(f"allowed_specialists for tool '{name}' cannot be empty.")
        for spec_id in allowed_specialists:
            if not isinstance(spec_id, str) or not spec_id.strip():
                raise ValueError(f"Specialist ID '{spec_id}' in tool '{name}' must be a non-empty string.")

        if not math.isfinite(cost_units) or cost_units < 0.0:
            raise ValueError(f"cost_units for tool '{name}' must be a finite, non-negative number (got {cost_units}).")

        self.name = name.strip()
        self.description = description.strip()
        self.args_schema = args_schema
        self.handler = handler
        self.allowed_specialists = set(allowed_specialists)
        self.cost_units = float(cost_units)

    def to_langchain_tool(self) -> StructuredTool:
        """Expose as LangChain StructuredTool for native model binding."""
        async def _dummy_exec(**kwargs: Any) -> Any:
            return kwargs

        return StructuredTool.from_function(
            func=None,
            coroutine=_dummy_exec,
            name=self.name,
            description=self.description,
            args_schema=self.args_schema,
        )

    async def execute(
        self,
        raw_args: dict[str, Any],
        context: ToolExecutionContext,
        timeout_seconds: float,
        max_output_bytes: int,
    ) -> tuple[str, ToolCallStatus, float, str | None, bool, Any]:
        """
        Execute tool within authorization, timeout, and output bounds.
        Returns:
            (formatted_output_json, status, duration_ms, error_message, is_truncated, bounded_data)
        """
        start_time = time.perf_counter()

        # 1. Specialist Allowlist Authorization
        if context.specialist_id not in self.allowed_specialists:
            dur_ms = (time.perf_counter() - start_time) * 1000.0
            err_msg = (
                f"Specialist '{context.specialist_id}' is not authorized to invoke tool '{self.name}'. "
                f"Allowed specialists: {sorted(list(self.allowed_specialists))}"
            )
            logger.warning(f"[Tool Auth Guard] {err_msg}")
            res_json = json.dumps({"error": err_msg, "error_type": "unauthorized_specialist"})
            return res_json, ToolCallStatus.UNAUTHORIZED_SPECIALIST, dur_ms, err_msg, False, None

        # 2. Argument Validation (Safely handles non-dict raw_args and validation errors)
        if not isinstance(raw_args, dict):
            dur_ms = (time.perf_counter() - start_time) * 1000.0
            err_msg = f"Malformed tool call: arguments for tool '{self.name}' must be a JSON dictionary, got {type(raw_args).__name__}"
            logger.warning(f"[Tool Args Guard] {err_msg}")
            res_json = json.dumps({"error": err_msg, "error_type": "invalid_arguments"})
            return res_json, ToolCallStatus.INVALID_ARGUMENTS, dur_ms, err_msg, False, None

        try:
            validated_args = self.args_schema.model_validate(raw_args)
        except ValidationError as ve:
            dur_ms = (time.perf_counter() - start_time) * 1000.0
            err_msg = f"Invalid arguments for tool '{self.name}': {ve.errors()}"
            logger.info(f"[Tool Args Validation] {err_msg}")
            res_json = json.dumps({
                "error": err_msg,
                "error_type": "invalid_arguments",
                "validation_errors": ve.errors(),
            }, default=str)
            return res_json, ToolCallStatus.INVALID_ARGUMENTS, dur_ms, err_msg, False, None
        except Exception as ve_other:
            dur_ms = (time.perf_counter() - start_time) * 1000.0
            err_msg = f"Argument validation failure for tool '{self.name}': {ve_other}"
            res_json = json.dumps({"error": err_msg, "error_type": "invalid_arguments"})
            return res_json, ToolCallStatus.INVALID_ARGUMENTS, dur_ms, err_msg, False, None

        # 3. Execution with Timeout & Security Handling
        try:
            raw_output = await asyncio.wait_for(
                self.handler(validated_args, context),
                timeout=timeout_seconds,
            )
            dur_ms = (time.perf_counter() - start_time) * 1000.0
            formatted_json, is_truncated = structured_truncate_output(raw_output, max_output_bytes)
            
            # Capped observation data: avoid unbounded memory retention
            if is_truncated:
                bounded_data = json.loads(formatted_json)
            else:
                bounded_data = raw_output

            return formatted_json, ToolCallStatus.SUCCESS, dur_ms, None, is_truncated, bounded_data

        except asyncio.TimeoutError:
            dur_ms = (time.perf_counter() - start_time) * 1000.0
            err_msg = f"Tool '{self.name}' timed out after {timeout_seconds:.2f}s."
            logger.warning(f"[Tool Timeout] {err_msg}")
            res_json = json.dumps({"error": err_msg, "error_type": "timeout"})
            return res_json, ToolCallStatus.TIMEOUT, dur_ms, err_msg, False, None

        except PermissionError as pe:
            # Explicit tenant or capability violation raised inside handler
            dur_ms = (time.perf_counter() - start_time) * 1000.0
            err_msg = f"Tenant authorization violation in tool '{self.name}': {pe}"
            logger.error(f"[Tool Tenant Auth] {err_msg}")
            res_json = json.dumps({"error": str(pe), "error_type": "unauthorized_tenant"})
            return res_json, ToolCallStatus.UNAUTHORIZED_TENANT, dur_ms, err_msg, False, None

        except Exception as ex:
            dur_ms = (time.perf_counter() - start_time) * 1000.0
            err_msg = f"Unhandled exception in tool '{self.name}': {type(ex).__name__}: {ex}"
            logger.error(f"[Tool Exception] {err_msg}", exc_info=True)
            res_json = json.dumps({
                "error": str(ex),
                "error_type": "tool_error",
                "exception_class": type(ex).__name__,
            })
            return res_json, ToolCallStatus.TOOL_ERROR, dur_ms, err_msg, False, None


class ToolRegistry:
    """
    Registry for managing available specialist tools.
    Validates uniqueness and provides allowlist filtering.
    """

    def __init__(self):
        self._tools: dict[str, SpecialistTool] = {}

    def register_tool(self, tool: SpecialistTool) -> None:
        """Register a SpecialistTool, raising ValueError if name already exists or invalid."""
        if not isinstance(tool, SpecialistTool):
            raise TypeError("Registered item must be an instance of SpecialistTool.")
        if tool.name in self._tools:
            raise ValueError(f"Duplicate tool registration: tool '{tool.name}' is already registered.")
        self._tools[tool.name] = tool
        logger.debug(f"Registered specialist tool '{tool.name}' (allowed: {tool.allowed_specialists})")

    def get_tool(self, name: str) -> SpecialistTool | None:
        """Retrieve tool by exact name."""
        return self._tools.get(name)

    def get_tools_for_specialist(self, specialist_id: str) -> list[SpecialistTool]:
        """Return list of tools permitted for the given specialist ID."""
        return [t for t in self._tools.values() if specialist_id in t.allowed_specialists]

    def to_langchain_tools(self, specialist_id: str) -> list[StructuredTool]:
        """Convert all tools permitted for specialist into LangChain StructuredTools."""
        return [t.to_langchain_tool() for t in self.get_tools_for_specialist(specialist_id)]

    @property
    def registered_tool_names(self) -> list[str]:
        return list(self._tools.keys())
