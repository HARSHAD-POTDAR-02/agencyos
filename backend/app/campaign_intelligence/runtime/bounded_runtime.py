from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from typing import Any
from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    ToolMessage,
)

from app.campaign_intelligence.runtime.schemas import (
    ExecutionStatus,
    ToolCallStatus,
    ToolCallTelemetry,
    ToolExecutionContext,
    ToolExecutionResult,
    ToolObservation,
    ToolRuntimeConfig,
)
from app.campaign_intelligence.runtime.tool_registry import ToolRegistry
from app.core.config import settings
from app.core.llm import _is_transient_error, get_llm, key_pool

logger = logging.getLogger(__name__)


class BoundedToolRuntime:
    """
    Production-grade bounded tool execution runtime for AgencyOS specialists.
    
    Guarantees:
    1. Native LangChain tool calling (.bind_tools) using existing ChatGroq integration.
    2. Explicit specialist allowlists and independent tenant authorization.
    3. Strict bounding on turns, total calls, wall-clock timeout, tool output bytes, and budget units.
    4. Deterministic budget reservation and accounting across successes and failures.
    5. Tool-call protocol compliance: every tool_call_id receives a matching ToolMessage even on abort.
    6. Preservation of partial observations and failure telemetry for downstream synthesis.
    7. Clear separation of runtime execution status from artifact completion.
    """

    def __init__(
        self,
        registry: ToolRegistry,
        config: ToolRuntimeConfig | None = None,
    ):
        self.registry = registry
        self.config = config or ToolRuntimeConfig()

    async def run(
        self,
        initial_messages: list[BaseMessage],
        exec_context: ToolExecutionContext,
        llm: Any | None = None,
        config_override: ToolRuntimeConfig | None = None,
        on_event: Any | None = None,
    ) -> ToolExecutionResult:
        """
        Execute bounded multi-turn conversation with tool calling.
        """
        cfg = config_override or self.config
        overall_start_time = time.perf_counter()

        messages: list[BaseMessage] = list(initial_messages)
        telemetry: list[ToolCallTelemetry] = []
        observations: list[ToolObservation] = []

        total_tool_calls = 0
        tool_call_counts: dict[str, int] = {}
        successful_tool_calls = 0
        failed_tool_calls = 0
        budget_reserved = 0.0
        budget_consumed = 0.0
        turn_count = 0
        final_ai_message: AIMessage | None = None
        terminal_status: ExecutionStatus = ExecutionStatus.NORMAL_COMPLETION
        terminal_reason: str | None = None
        provider_error_type: str | None = None
        provider_status_code: int | None = None

        # 1. Resolve authorized tools for this specialist and safely bind to LLM
        permitted_tools = self.registry.get_tools_for_specialist(exec_context.specialist_id)
        active_llm = llm or get_llm()
        if hasattr(active_llm, "max_retries"):
            active_llm.max_retries = 0

        try:
            if permitted_tools:
                langchain_tools = [t.to_langchain_tool() for t in permitted_tools]
                bound_llm = active_llm.bind_tools(langchain_tools)
            else:
                bound_llm = active_llm
        except Exception as bind_err:
            logger.error(f"[Bounded Runtime] Tool binding error: {bind_err}", exc_info=True)
            return ToolExecutionResult(
                status=ExecutionStatus.TOOL_EXECUTION_FAILURE,
                failure_reason=f"Failed to bind tools to model: {bind_err}",
                total_turns=0,
                total_tool_calls=0,
                duration_ms=(time.perf_counter() - overall_start_time) * 1000.0,
            )

        # 2. Multi-turn execution loop
        while turn_count < cfg.max_turns:
            elapsed_total = time.perf_counter() - overall_start_time
            remaining_time = cfg.execution_timeout_seconds - elapsed_total

            # Check overall wall-clock timeout
            if remaining_time <= 0:
                terminal_status = ExecutionStatus.TIMEOUT
                terminal_reason = f"Execution exceeded wall-clock timeout of {cfg.execution_timeout_seconds}s."
                logger.warning(f"[Bounded Runtime] {terminal_reason}")
                break

            # Check budget exhaustion
            if budget_consumed >= cfg.budget_units:
                terminal_status = ExecutionStatus.BUDGET_EXHAUSTED
                terminal_reason = f"Budget exhausted: {budget_consumed:.1f} / {cfg.budget_units:.1f} units consumed."
                logger.warning(f"[Bounded Runtime] {terminal_reason}")
                break

            # Invoke LLM with bounded request token history
            turn_count += 1
            if on_event:
                try:
                    await on_event({
                        "type": "turn_start",
                        "turn": turn_count,
                        "message": f"Planning research actions (Turn {turn_count}/{cfg.max_turns})...",
                    })
                except Exception:
                    pass

            active_model_name = str(getattr(active_llm, "model_name", None) or getattr(active_llm, "model", None) or "")
            is_nvidia = active_model_name.startswith("nvidia/") or active_model_name.startswith("mistralai/")
            # Allow up to 50s for large 120B parameter models on NVIDIA NIM, bounded by remaining execution time
            llm_turn_timeout = min(50.0, max(5.0, remaining_time - 3.0)) if is_nvidia else min(25.0, max(2.0, remaining_time))
            invocation_messages = self._compact_message_history(
                messages,
                max_request_tokens=getattr(cfg, "max_request_tokens", 5000),
            )
            try:
                ai_response: AIMessage = await asyncio.wait_for(
                    bound_llm.ainvoke(invocation_messages),
                    timeout=llm_turn_timeout,
                )
            except (asyncio.TimeoutError, Exception) as provider_err:
                recovered = False
                is_chat_groq = type(active_llm).__name__ == "ChatGroq"
                is_retryable = isinstance(provider_err, asyncio.TimeoutError) or _is_transient_error(provider_err)

                if is_retryable:
                    # 1. NVIDIA NIM Retry & High-Capacity Failover Cascade
                    if is_nvidia:
                        # 1a. Attempt in-place retry on NVIDIA NIM if remaining time is ample
                        remaining_budget = cfg.execution_timeout_seconds - (time.perf_counter() - overall_start_time)
                        if remaining_budget >= 20.0 and isinstance(provider_err, asyncio.TimeoutError):
                            try:
                                retry_budget = min(45.0, max(5.0, remaining_budget - 3.0))
                                logger.info(
                                    f"[Bounded Runtime] Transient timeout on NVIDIA NIM. "
                                    f"Retrying invocation on NVIDIA NIM with {retry_budget:.1f}s budget."
                                )
                                ai_response = await asyncio.wait_for(
                                    bound_llm.ainvoke(invocation_messages),
                                    timeout=retry_budget,
                                )
                                recovered = True
                            except Exception as nim_retry_err:
                                logger.warning(f"[Bounded Runtime] NVIDIA NIM retry failed: {nim_retry_err}")
                                provider_err = nim_retry_err

                        # 1b. If still not recovered, cascade to high-throughput Groq fallback (qwen/qwen3.8-27b)
                        if not recovered:
                            try:
                                cascade_target = "qwen/qwen3.8-27b"
                                logger.warning(
                                    f"[Bounded Runtime] NVIDIA NIM hit {type(provider_err).__name__} ({provider_err}). "
                                    f"Cascading turn {turn_count} to Groq model: '{cascade_target}'."
                                )
                                active_llm = get_llm(
                                    model=cascade_target,
                                    temperature=getattr(active_llm, "temperature", 0.1),
                                    api_key=await key_pool.get_active_key(),
                                )
                                if hasattr(active_llm, "max_retries"):
                                    active_llm.max_retries = 0
                                bound_llm = active_llm.bind_tools(langchain_tools) if permitted_tools else active_llm

                                remaining_now = min(15.0, max(1.0, cfg.execution_timeout_seconds - (time.perf_counter() - overall_start_time)))
                                ai_response = await asyncio.wait_for(
                                    bound_llm.ainvoke(invocation_messages),
                                    timeout=remaining_now,
                                )
                                recovered = True
                            except Exception as cascade_err:
                                logger.warning(f"[Bounded Runtime] NVIDIA NIM cascade to Groq failed: {cascade_err}")
                                provider_err = cascade_err

                    # 2. Groq Key Rotation and Fallback Model Cascade
                    elif is_chat_groq:
                        # 2a. Attempt key rotation if multiple keys exist in pool
                        if len(key_pool.get_keys()) > 1:
                            try:
                                current_key_raw = getattr(active_llm, "groq_api_key", None)
                                if current_key_raw and hasattr(current_key_raw, "get_secret_value"):
                                    current_key_val = current_key_raw.get_secret_value()
                                else:
                                    current_key_val = str(current_key_raw or "")

                                rotated_key = await key_pool.rotate_on_rate_limit(current_key_val)
                                if rotated_key != current_key_val:
                                    logger.warning(
                                        f"[Bounded Runtime] Transient stall/rate limit ({type(provider_err).__name__}). "
                                        f"Rotating Groq key pool member to (...{rotated_key[-6:]}) and retrying turn {turn_count}."
                                    )
                                    active_llm = get_llm(
                                        temperature=getattr(active_llm, "temperature", 0.1),
                                        api_key=rotated_key,
                                    )
                                    if hasattr(active_llm, "max_retries"):
                                        active_llm.max_retries = 0
                                    bound_llm = active_llm.bind_tools(langchain_tools) if permitted_tools else active_llm

                                    remaining_now = min(10.0, max(1.0, cfg.execution_timeout_seconds - (time.perf_counter() - overall_start_time)))
                                    ai_response = await asyncio.wait_for(
                                        bound_llm.ainvoke(invocation_messages),
                                        timeout=remaining_now,
                                    )
                                    recovered = True
                            except Exception as retry_err:
                                logger.warning(f"[Bounded Runtime] Key rotation retry failed: {retry_err}")
                                provider_err = retry_err

                        # 2b. Attempt model cascade to FALLBACK_MODEL if key rotation didn't recover
                        if not recovered and getattr(active_llm, "model_name", "") != settings.FALLBACK_MODEL:
                            try:
                                logger.warning(
                                    f"[Bounded Runtime] Cascading turn {turn_count} to fallback model: '{settings.FALLBACK_MODEL}'."
                                )
                                active_llm = get_llm(
                                    model=settings.FALLBACK_MODEL,
                                    temperature=getattr(active_llm, "temperature", 0.1),
                                    api_key=await key_pool.get_active_key(),
                                )
                                if hasattr(active_llm, "max_retries"):
                                    active_llm.max_retries = 0
                                bound_llm = active_llm.bind_tools(langchain_tools) if permitted_tools else active_llm

                                remaining_now = min(10.0, max(1.0, cfg.execution_timeout_seconds - (time.perf_counter() - overall_start_time)))
                                ai_response = await asyncio.wait_for(
                                    bound_llm.ainvoke(invocation_messages),
                                    timeout=remaining_now,
                                )
                                recovered = True
                            except Exception as cascade_err:
                                logger.warning(f"[Bounded Runtime] Cascade retry failed: {cascade_err}")
                                provider_err = cascade_err

                if not recovered:
                    raw_code = getattr(provider_err, "status_code", None) or getattr(provider_err, "code", None)
                    provider_status_code = raw_code if isinstance(raw_code, int) else None
                    provider_error_type = type(provider_err).__name__
                    code_str = f" HTTP {provider_status_code}" if provider_status_code else ""

                    if isinstance(provider_err, asyncio.TimeoutError):
                        terminal_status = ExecutionStatus.TIMEOUT
                        terminal_reason = f"Model call timed out after {remaining_time:.2f}s remaining."
                    else:
                        terminal_status = ExecutionStatus.PROVIDER_FAILURE
                        terminal_reason = f"LLM provider error [{provider_error_type}{code_str}]: {provider_err}"
                    logger.error(f"[Bounded Runtime] {terminal_reason}")
                    break

            final_ai_message = ai_response
            messages.append(ai_response)

            # 3. Check if model requested tool calls (valid or invalid)
            raw_tool_calls = list(getattr(ai_response, "tool_calls", None) or [])
            invalid_tool_calls = list(getattr(ai_response, "invalid_tool_calls", None) or [])

            if not raw_tool_calls and not invalid_tool_calls:
                # Model finished reasoning / gave direct response
                terminal_status = ExecutionStatus.NORMAL_COMPLETION
                break

            # 4. Handle any invalid_tool_calls surfaced by provider parser
            for inv_call in invalid_tool_calls:
                inv_id = str(inv_call.get("id") or f"invalid_{uuid.uuid4().hex[:8]}").strip()
                inv_name = str(inv_call.get("name") or "unknown").strip()
                inv_err = str(inv_call.get("error") or "Malformed tool call arguments from provider")
                failed_tool_calls += 1
                telemetry.append(
                    ToolCallTelemetry(
                        call_id=inv_id,
                        tool_name=inv_name,
                        status=ToolCallStatus.INVALID_ARGUMENTS,
                        duration_ms=0.0,
                        cost_units_reserved=0.0,
                        cost_units_consumed=0.0,
                        error_message=inv_err,
                    )
                )
                messages.append(
                    ToolMessage(
                        content=json.dumps({"error": inv_err, "error_type": "invalid_arguments"}),
                        tool_call_id=inv_id,
                        name=inv_name,
                    )
                )

            # 5. Validate tool call structures and process sequentially
            abort_remaining_calls = False
            abort_reason = ""
            abort_status = ToolCallStatus.CALL_LIMIT_REACHED
            seen_call_ids: set[str] = set()

            for call in raw_tool_calls:
                # Structural validation of provider call object
                if not isinstance(call, dict):
                    call_id = f"malformed_{uuid.uuid4().hex[:8]}"
                    failed_tool_calls += 1
                    err_msg = f"Malformed tool call: expected dictionary, got {type(call).__name__}"
                    telemetry.append(
                        ToolCallTelemetry(
                            call_id=call_id,
                            tool_name="unknown",
                            status=ToolCallStatus.MALFORMED_TOOL_CALL,
                            duration_ms=0.0,
                            cost_units_reserved=0.0,
                            cost_units_consumed=0.0,
                            error_message=err_msg,
                        )
                    )
                    messages.append(
                        ToolMessage(
                            content=json.dumps({"error": err_msg, "error_type": "malformed_tool_call"}),
                            tool_call_id=call_id,
                            name="unknown",
                        )
                    )
                    continue

                call_id = str(call.get("id") or "").strip()
                tool_name = str(call.get("name") or "").strip()
                raw_args = call.get("args")

                # Validate ID presence and uniqueness
                if not call_id:
                    call_id = f"missing_id_{uuid.uuid4().hex[:8]}"
                    failed_tool_calls += 1
                    err_msg = "Malformed tool call: missing required tool_call_id"
                    telemetry.append(
                        ToolCallTelemetry(
                            call_id=call_id,
                            tool_name=tool_name or "unknown",
                            status=ToolCallStatus.MALFORMED_TOOL_CALL,
                            duration_ms=0.0,
                            cost_units_reserved=0.0,
                            cost_units_consumed=0.0,
                            error_message=err_msg,
                        )
                    )
                    messages.append(
                        ToolMessage(
                            content=json.dumps({"error": err_msg, "error_type": "malformed_tool_call"}),
                            tool_call_id=call_id,
                            name=tool_name or "unknown",
                        )
                    )
                    continue

                if call_id in seen_call_ids:
                    failed_tool_calls += 1
                    err_msg = f"Malformed tool call: duplicate tool_call_id '{call_id}' in single turn"
                    telemetry.append(
                        ToolCallTelemetry(
                            call_id=call_id,
                            tool_name=tool_name or "unknown",
                            status=ToolCallStatus.MALFORMED_TOOL_CALL,
                            duration_ms=0.0,
                            cost_units_reserved=0.0,
                            cost_units_consumed=0.0,
                            error_message=err_msg,
                        )
                    )
                    messages.append(
                        ToolMessage(
                            content=json.dumps({"error": err_msg, "error_type": "malformed_tool_call"}),
                            tool_call_id=call_id,
                            name=tool_name or "unknown",
                        )
                    )
                    continue
                seen_call_ids.add(call_id)

                # If a previous call in this turn aborted the sequence, fulfill protocol requirement with clean error
                if abort_remaining_calls:
                    failed_tool_calls += 1
                    telemetry.append(
                        ToolCallTelemetry(
                            call_id=call_id,
                            tool_name=tool_name,
                            status=abort_status,
                            duration_ms=0.0,
                            cost_units_reserved=0.0,
                            cost_units_consumed=0.0,
                            error_message=f"Tool call aborted: {abort_reason}",
                        )
                    )
                    messages.append(
                        ToolMessage(
                            content=json.dumps({
                                "error": f"Tool call skipped: {abort_reason}",
                                "error_type": abort_status.value,
                            }),
                            tool_call_id=call_id,
                            name=tool_name,
                        )
                    )
                    continue

                # Recalculate remaining wall-clock time immediately before tool execution
                elapsed_now = time.perf_counter() - overall_start_time
                remaining_overall = cfg.execution_timeout_seconds - elapsed_now
                min_tool_runway = 2.0
                is_runway_exhausted = (
                    remaining_overall < min_tool_runway 
                    and cfg.per_tool_timeout_seconds > min_tool_runway
                )
                if remaining_overall <= 0 or is_runway_exhausted:
                    abort_remaining_calls = True
                    if remaining_overall <= 0:
                        abort_reason = f"Execution exceeded wall-clock timeout of {cfg.execution_timeout_seconds}s."
                    else:
                        abort_reason = (
                            f"Insufficient wall-clock runway ({remaining_overall:.2f}s < {min_tool_runway}s) "
                            f"to safely execute '{tool_name}'. Concluding research with gathered evidence."
                        )
                    abort_status = ToolCallStatus.TIMEOUT
                    terminal_status = ExecutionStatus.TIMEOUT
                    terminal_reason = abort_reason
                    failed_tool_calls += 1

                    telemetry.append(
                        ToolCallTelemetry(
                            call_id=call_id,
                            tool_name=tool_name,
                            status=ToolCallStatus.TIMEOUT,
                            duration_ms=0.0,
                            cost_units_reserved=0.0,
                            cost_units_consumed=0.0,
                            error_message=abort_reason,
                        )
                    )
                    messages.append(
                        ToolMessage(
                            content=json.dumps({"error": abort_reason, "error_type": "timeout"}),
                            tool_call_id=call_id,
                            name=tool_name,
                        )
                    )
                    continue

                # Enforce total tool call limit
                if total_tool_calls >= cfg.max_total_tool_calls:
                    abort_remaining_calls = True
                    abort_reason = f"Maximum total tool calls reached ({cfg.max_total_tool_calls})."
                    abort_status = ToolCallStatus.CALL_LIMIT_REACHED
                    terminal_status = ExecutionStatus.MAX_TOOL_CALLS_REACHED
                    terminal_reason = abort_reason
                    failed_tool_calls += 1

                    telemetry.append(
                        ToolCallTelemetry(
                            call_id=call_id,
                            tool_name=tool_name,
                            status=ToolCallStatus.CALL_LIMIT_REACHED,
                            duration_ms=0.0,
                            cost_units_reserved=0.0,
                            cost_units_consumed=0.0,
                            error_message=abort_reason,
                        )
                    )
                    messages.append(
                        ToolMessage(
                            content=json.dumps({"error": abort_reason, "error_type": "call_limit_reached"}),
                            tool_call_id=call_id,
                            name=tool_name,
                        )
                    )
                    continue

                # Look up tool in registry
                tool = self.registry.get_tool(tool_name)
                if not tool:
                    failed_tool_calls += 1
                    err_msg = f"Unknown tool '{tool_name}'. Registered tools: {self.registry.registered_tool_names}"
                    telemetry.append(
                        ToolCallTelemetry(
                            call_id=call_id,
                            tool_name=tool_name,
                            status=ToolCallStatus.UNKNOWN_TOOL,
                            duration_ms=0.0,
                            cost_units_reserved=0.0,
                            cost_units_consumed=0.0,
                            error_message=err_msg,
                        )
                    )
                    messages.append(
                        ToolMessage(
                            content=json.dumps({"error": err_msg, "error_type": "unknown_tool"}),
                            tool_call_id=call_id,
                            name=tool_name,
                        )
                    )
                    total_tool_calls += 1
                    continue

                # Enforce per-tool call quotas deterministically
                current_tool_calls = tool_call_counts.get(tool_name, 0)
                per_tool_limit = cfg.per_tool_max_calls.get(tool_name)
                if per_tool_limit is not None and current_tool_calls >= per_tool_limit:
                    quota_reason = (
                        f"Tool '{tool_name}' reached its per-tool quota ({per_tool_limit} calls max). "
                        f"Quota exhausted: please use other tools (e.g. extract_webpages) or provide your summary findings."
                    )
                    failed_tool_calls += 1
                    total_tool_calls += 1
                    telemetry.append(
                        ToolCallTelemetry(
                            call_id=call_id,
                            tool_name=tool_name,
                            status=ToolCallStatus.TOOL_QUOTA_EXHAUSTED,
                            duration_ms=0.0,
                            cost_units_reserved=0.0,
                            cost_units_consumed=0.0,
                            error_message=quota_reason,
                        )
                    )
                    messages.append(
                        ToolMessage(
                            content=json.dumps({
                                "error": quota_reason,
                                "error_type": "tool_quota_exhausted",
                                "tool": tool_name,
                                "quota": per_tool_limit,
                            }),
                            tool_call_id=call_id,
                            name=tool_name,
                        )
                    )
                    continue

                # Check budget availability and reserve units
                cost = tool.cost_units
                if (budget_consumed + cost) > cfg.budget_units:
                    abort_remaining_calls = True
                    abort_reason = f"Tool '{tool_name}' requires {cost} units, but only {cfg.budget_units - budget_consumed:.1f} remain."
                    abort_status = ToolCallStatus.BUDGET_EXCEEDED
                    terminal_status = ExecutionStatus.BUDGET_EXHAUSTED
                    terminal_reason = abort_reason
                    failed_tool_calls += 1

                    telemetry.append(
                        ToolCallTelemetry(
                            call_id=call_id,
                            tool_name=tool_name,
                            status=ToolCallStatus.BUDGET_EXCEEDED,
                            duration_ms=0.0,
                            cost_units_reserved=0.0,
                            cost_units_consumed=0.0,
                            error_message=abort_reason,
                        )
                    )
                    messages.append(
                        ToolMessage(
                            content=json.dumps({"error": abort_reason, "error_type": "budget_exceeded"}),
                            tool_call_id=call_id,
                            name=tool_name,
                        )
                    )
                    continue

                # Reserve cost units before execution
                budget_reserved += cost
                total_tool_calls += 1
                tool_call_counts[tool_name] = tool_call_counts.get(tool_name, 0) + 1

                # Calculate tool timeout strictly bounded by remaining overall time
                tool_timeout = min(cfg.per_tool_timeout_seconds, remaining_overall)

                # Ensure arguments are dictionary
                args_dict = raw_args if isinstance(raw_args, dict) else {}

                if on_event:
                    tool_desc = ""
                    if tool_name == "web_search":
                        query_arg = args_dict.get("query", "")
                        tool_desc = f"Searching web for '{query_arg}'"
                    elif tool_name in ("extract_webpages", "web_extract"):
                        urls = args_dict.get("urls", [])
                        urls_preview = urls[0] if (isinstance(urls, list) and urls) else str(urls)
                        tool_desc = f"Inspecting competitor page ({urls_preview[:60]}...)"
                    else:
                        tool_desc = f"Executing {tool_name}"
                    try:
                        await on_event({
                            "type": "tool_start",
                            "tool": tool_name,
                            "call_id": call_id,
                            "turn": turn_count,
                            "message": tool_desc,
                        })
                    except Exception:
                        pass

                # Execute tool
                formatted_json, call_status, duration_ms, err_msg, is_truncated, bounded_data = await tool.execute(
                    raw_args=args_dict,
                    context=exec_context,
                    timeout_seconds=tool_timeout,
                    max_output_bytes=cfg.max_tool_output_bytes,
                )

                # Commit consumed budget regardless of execution outcome
                budget_consumed += cost

                if call_status == ToolCallStatus.SUCCESS:
                    successful_tool_calls += 1
                    observations.append(
                        ToolObservation(
                            tool_call_id=call_id,
                            tool_name=tool_name,
                            status=call_status,
                            data=bounded_data,
                            is_truncated=is_truncated,
                            duration_ms=duration_ms,
                            cost_units=cost,
                            metadata={"is_truncated": is_truncated},
                        )
                    )
                else:
                    failed_tool_calls += 1

                telemetry.append(
                    ToolCallTelemetry(
                        call_id=call_id,
                        tool_name=tool_name,
                        status=call_status,
                        duration_ms=duration_ms,
                        cost_units_reserved=cost,
                        cost_units_consumed=cost,
                        error_message=err_msg,
                        output_bytes=len(formatted_json.encode("utf-8")),
                        is_truncated=is_truncated,
                    )
                )

                if on_event:
                    res_summary = ""
                    if call_status == ToolCallStatus.SUCCESS:
                        if tool_name == "web_search" and isinstance(bounded_data, dict):
                            cnt = len(bounded_data.get("results", []))
                            res_summary = f"Discovered {cnt} sources ({duration_ms:.0f}ms)"
                        elif tool_name in ("extract_webpages", "web_extract") and isinstance(bounded_data, dict):
                            cnt = len(bounded_data.get("pages", []))
                            res_summary = f"Extracted {cnt} pages ({duration_ms:.0f}ms)"
                        else:
                            res_summary = f"Completed ({duration_ms:.0f}ms)"
                    else:
                        res_summary = f"{call_status.value} ({duration_ms:.0f}ms)"
                    try:
                        await on_event({
                            "type": "tool_end",
                            "tool": tool_name,
                            "status": call_status.value,
                            "duration_ms": duration_ms,
                            "message": f"Tool: {tool_name} → {res_summary}",
                            "summary": res_summary,
                            "call_id": call_id,
                            "turn": turn_count,
                        })
                    except Exception:
                        pass

                messages.append(
                    ToolMessage(
                        content=formatted_json,
                        tool_call_id=call_id,
                        name=tool_name,
                    )
                )

            # If abort occurred, break turn loop
            if abort_remaining_calls and terminal_status in (
                ExecutionStatus.MAX_TOOL_CALLS_REACHED,
                ExecutionStatus.BUDGET_EXHAUSTED,
                ExecutionStatus.TIMEOUT,
            ):
                break

        # Check for turn limit
        if turn_count >= cfg.max_turns and terminal_status == ExecutionStatus.NORMAL_COMPLETION and final_ai_message and getattr(final_ai_message, "tool_calls", None):
            terminal_status = ExecutionStatus.MAX_TURNS_REACHED
            terminal_reason = f"Conversation loop reached maximum allowed turns ({cfg.max_turns})."

        # Check for complete failure of requested tools
        has_incomplete = (failed_tool_calls > 0) or (terminal_status != ExecutionStatus.NORMAL_COMPLETION)
        if total_tool_calls > 0 and successful_tool_calls == 0 and terminal_status == ExecutionStatus.NORMAL_COMPLETION:
            terminal_status = ExecutionStatus.TOOL_EXECUTION_FAILURE
            terminal_reason = f"All {total_tool_calls} requested tool calls failed."

        total_duration_ms = (time.perf_counter() - overall_start_time) * 1000.0

        return ToolExecutionResult(
            status=terminal_status,
            final_message=final_ai_message,
            all_messages=messages,
            telemetry=telemetry,
            total_turns=turn_count,
            total_tool_calls=total_tool_calls,
            successful_tool_calls=successful_tool_calls,
            failed_tool_calls=failed_tool_calls,
            has_incomplete_execution=has_incomplete,
            budget_reserved=budget_reserved,
            budget_consumed=budget_consumed,
            duration_ms=total_duration_ms,
            failure_reason=terminal_reason,
            provider_error_type=provider_error_type,
            provider_status_code=provider_status_code,
            observations=observations,
        )

    @staticmethod
    def _estimate_message_tokens(messages: list[BaseMessage]) -> int:
        """
        Estimate total token count for a message sequence including content,
        tool calls, and per-message framing overhead.
        """
        total_chars = 0
        for m in messages:
            content = getattr(m, "content", "")
            if isinstance(content, str):
                total_chars += len(content)
            elif isinstance(content, list):
                total_chars += len(str(content))
            tool_calls = getattr(m, "tool_calls", None) or []
            for tc in tool_calls:
                if isinstance(tc, dict):
                    total_chars += len(tc.get("name", "")) + len(str(tc.get("args", "")))
                else:
                    total_chars += len(str(tc))
        return int(total_chars / 3.5) + (len(messages) * 10) + 800

    @classmethod
    def _compact_message_history(
        cls,
        messages: list[BaseMessage],
        max_request_tokens: int = 5500,
    ) -> list[BaseMessage]:
        """
        Compact conversation history for LLM invocation while strictly preserving:
        - System instructions (SystemMessage)
        - Current user question (initial HumanMessage)
        - Protocol integrity (every tool_call_id retains its ToolMessage)
        - Recent conversational turn (most recent AIMessage and ToolMessages kept intact)
        - Source URLs and supporting excerpts in older ToolMessages

        Older tool outputs (e.g. large page extractions from previous turns) are structurally
        compacted if total request size exceeds max_request_tokens.
        """
        current_tokens = cls._estimate_message_tokens(messages)
        if current_tokens <= max_request_tokens:
            return messages

        logger.info(
            f"[Bounded Runtime] Request size (~{current_tokens} tokens) exceeds budget "
            f"({max_request_tokens} tokens). Compacting older tool observations."
        )

        last_ai_idx = -1
        for idx, m in enumerate(messages):
            if isinstance(m, AIMessage):
                last_ai_idx = idx

        compacted: list[BaseMessage] = []
        for idx, m in enumerate(messages):
            # 1. SystemMessage and initial HumanMessage: NEVER modify
            if idx in (0, 1) and not isinstance(m, ToolMessage):
                compacted.append(m)
                continue

            # 2. Latest turn: keep intact so the model sees complete results from the turn it just requested
            if last_ai_idx >= 0 and idx >= last_ai_idx:
                compacted.append(m)
                continue

            # 3. Older ToolMessages: compact large payloads while preserving URLs and excerpt anchors
            if isinstance(m, ToolMessage) and isinstance(m.content, str) and len(m.content) > 600:
                compacted_content = cls._compact_tool_message_content(m.content, m.name)
                compacted.append(
                    ToolMessage(
                        content=compacted_content,
                        tool_call_id=m.tool_call_id,
                        name=m.name,
                    )
                )
                continue

            compacted.append(m)

        new_tokens = cls._estimate_message_tokens(compacted)
        # Pass 2: If still exceeding budget, compact recent turn's ToolMessages too so prompt strictly fits
        if new_tokens > max_request_tokens:
            second_pass: list[BaseMessage] = []
            for m in compacted:
                if isinstance(m, ToolMessage) and isinstance(m.content, str) and len(m.content) > 300:
                    compacted_content = cls._compact_tool_message_content(m.content, m.name, max_items=4, max_chars=200)
                    second_pass.append(
                        ToolMessage(
                            content=compacted_content,
                            tool_call_id=m.tool_call_id,
                            name=m.name,
                        )
                    )
                else:
                    second_pass.append(m)
            compacted = second_pass
            new_tokens = cls._estimate_message_tokens(compacted)

        logger.info(f"[Bounded Runtime] Compacted message history: ~{current_tokens} -> ~{new_tokens} tokens.")
        return compacted

    @staticmethod
    def _compact_tool_message_content(
        content: str,
        tool_name: str | None,
        max_items: int = 5,
        max_chars: int = 250,
    ) -> str:
        """
        Compact a ToolMessage JSON string while preserving source URLs, page titles,
        and concise excerpts.
        """
        try:
            data = json.loads(content)
        except Exception:
            if len(content) > max_chars * 2:
                return content[:max_chars] + "... [compacted]"
            return content

        if not isinstance(data, dict):
            return content

        # Case A: extract_webpages / web_extract payload
        if "pages" in data and isinstance(data["pages"], list):
            compacted_pages = []
            for p in data["pages"][:max_items]:
                if not isinstance(p, dict):
                    compacted_pages.append(p)
                    continue
                page_copy = dict(p)
                raw_content = page_copy.get("content", "")
                if isinstance(raw_content, str) and len(raw_content) > max_chars:
                    page_copy["content"] = (
                        raw_content[:max_chars]
                        + f"... [compacted for token budget; full {len(raw_content)} chars preserved in evidence store]"
                    )
                compacted_pages.append(page_copy)
            data["pages"] = compacted_pages
            return json.dumps(data, ensure_ascii=False)

        # Case B: web_search payload
        if "results" in data and isinstance(data["results"], list):
            compacted_results = []
            for r in data["results"][:max_items]:
                if not isinstance(r, dict):
                    compacted_results.append(r)
                    continue
                r_copy = dict(r)
                snippet = r_copy.get("snippet", "")
                if isinstance(snippet, str) and len(snippet) > max_chars:
                    r_copy["snippet"] = snippet[:max_chars] + "..."
                compacted_results.append(r_copy)
            data["results"] = compacted_results
            return json.dumps(data, ensure_ascii=False)

        return content
