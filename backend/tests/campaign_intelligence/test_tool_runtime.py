from __future__ import annotations

import asyncio
import json
import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from pydantic import BaseModel, Field, ValidationError

from app.campaign_intelligence.runtime import (
    BoundedToolRuntime,
    ExecutionStatus,
    SpecialistTool,
    ToolCallStatus,
    ToolExecutionContext,
    ToolRegistry,
    ToolRuntimeConfig,
    structured_truncate_output,
)
from app.campaign_intelligence.schemas.campaign import CampaignBrief
from app.campaign_intelligence.schemas.studio_context import CampaignStudioContext


# ============================================================================
# Helpers & Test Fixtures
# ============================================================================

class SampleSearchInput(BaseModel):
    query: str = Field(description="Search term")
    max_results: int = Field(default=3, ge=1, le=10)


class TenantRestrictedInput(BaseModel):
    record_id: str
    target_agency_id: str | None = None


def _build_test_exec_context(
    specialist_id: str = "market_research",
    agency_id: uuid.UUID | None = None,
    client_id: uuid.UUID | None = None,
    campaign_id: uuid.UUID | None = None,
    include_studio_context: bool = False,
) -> ToolExecutionContext:
    a_id = agency_id or uuid.uuid4()
    c_id = client_id or uuid.uuid4()
    camp_id = campaign_id or uuid.uuid4()

    studio_ctx = None
    if include_studio_context:
        brief = CampaignBrief(
            client_id=c_id,
            agency_id=a_id,
            period_month=11,
            period_year=2026,
            objective="Test",
        )
        studio_ctx = CampaignStudioContext(
            agency_id=a_id,
            client_id=c_id,
            campaign_id=camp_id,
            client_name="Test Brand",
            campaign_brief=brief,
        )

    return ToolExecutionContext(
        agency_id=a_id,
        client_id=c_id,
        campaign_id=camp_id,
        user_id=uuid.uuid4(),
        specialist_id=specialist_id,
        studio_context=studio_ctx,
    )


# ============================================================================
# 1. Single Tool Execution Success
# ============================================================================
@pytest.mark.asyncio
async def test_successful_single_tool_execution():
    async def sample_search(args: SampleSearchInput, ctx: ToolExecutionContext):
        return {"query": args.query, "results": ["hit1", "hit2"]}

    tool = SpecialistTool(
        name="web_search",
        description="Search the web",
        args_schema=SampleSearchInput,
        handler=sample_search,
        allowed_specialists={"market_research"},
        cost_units=10.0,
    )
    registry = ToolRegistry()
    registry.register_tool(tool)
    runtime = BoundedToolRuntime(registry=registry)
    ctx = _build_test_exec_context(specialist_id="market_research")

    ai_turn1 = AIMessage(
        content="I will search the web.",
        tool_calls=[{"name": "web_search", "args": {"query": "viral hooks"}, "id": "call_1"}],
    )
    ai_turn2 = AIMessage(content="Here are the top viral hooks based on evidence.")

    mock_llm = MagicMock()
    mock_llm.bind_tools.return_value = mock_llm
    mock_llm.ainvoke = AsyncMock(side_effect=[ai_turn1, ai_turn2])

    result = await runtime.run(
        initial_messages=[HumanMessage(content="Find viral hooks")],
        exec_context=ctx,
        llm=mock_llm,
    )

    assert result.status == ExecutionStatus.NORMAL_COMPLETION
    assert result.total_turns == 2
    assert result.total_tool_calls == 1
    assert result.successful_tool_calls == 1
    assert result.failed_tool_calls == 0
    assert result.has_incomplete_execution is False
    assert result.budget_consumed == 10.0
    assert len(result.observations) == 1
    assert result.observations[0].tool_name == "web_search"
    assert result.observations[0].status == ToolCallStatus.SUCCESS
    assert result.observations[0].data["results"] == ["hit1", "hit2"]


# ============================================================================
# 2. Multiple Tool Calls in One Assistant Response
# ============================================================================
@pytest.mark.asyncio
async def test_multiple_tool_calls_in_one_assistant_response():
    call_log = []

    async def tool_a(args: SampleSearchInput, ctx: ToolExecutionContext):
        call_log.append("tool_a")
        return {"source": "a", "data": "alpha"}

    async def tool_b(args: SampleSearchInput, ctx: ToolExecutionContext):
        call_log.append("tool_b")
        return {"source": "b", "data": "beta"}

    registry = ToolRegistry()
    registry.register_tool(SpecialistTool("tool_a", "Tool A", SampleSearchInput, tool_a, {"market_research"}))
    registry.register_tool(SpecialistTool("tool_b", "Tool B", SampleSearchInput, tool_b, {"market_research"}))
    runtime = BoundedToolRuntime(registry)
    ctx = _build_test_exec_context()

    ai_turn1 = AIMessage(
        content="",
        tool_calls=[
            {"name": "tool_a", "args": {"query": "q1"}, "id": "call_a"},
            {"name": "tool_b", "args": {"query": "q2"}, "id": "call_b"},
        ],
    )
    ai_turn2 = AIMessage(content="Combined both insights.")

    mock_llm = MagicMock()
    mock_llm.bind_tools.return_value = mock_llm
    mock_llm.ainvoke = AsyncMock(side_effect=[ai_turn1, ai_turn2])

    result = await runtime.run([HumanMessage(content="Run both")], ctx, llm=mock_llm)

    assert result.status == ExecutionStatus.NORMAL_COMPLETION
    assert result.total_tool_calls == 2
    assert result.successful_tool_calls == 2
    assert call_log == ["tool_a", "tool_b"]
    assert len(result.observations) == 2

    tool_messages = [m for m in result.all_messages if isinstance(m, ToolMessage)]
    assert len(tool_messages) == 2
    assert tool_messages[0].tool_call_id == "call_a"
    assert tool_messages[1].tool_call_id == "call_b"


# ============================================================================
# 3. Unknown Tool Request
# ============================================================================
@pytest.mark.asyncio
async def test_unknown_tool_request():
    registry = ToolRegistry()
    runtime = BoundedToolRuntime(registry)
    ctx = _build_test_exec_context()

    ai_turn1 = AIMessage(
        content="",
        tool_calls=[{"name": "non_existent_tool", "args": {"foo": "bar"}, "id": "call_err"}],
    )
    ai_turn2 = AIMessage(content="Tool was unknown, continuing conversation.")

    mock_llm = MagicMock()
    mock_llm.bind_tools.return_value = mock_llm
    mock_llm.ainvoke = AsyncMock(side_effect=[ai_turn1, ai_turn2])

    result = await runtime.run([HumanMessage(content="Test unknown")], ctx, llm=mock_llm)

    assert result.status == ExecutionStatus.TOOL_EXECUTION_FAILURE
    assert result.failed_tool_calls == 1
    assert result.successful_tool_calls == 0
    assert result.has_incomplete_execution is True
    assert result.telemetry[0].status == ToolCallStatus.UNKNOWN_TOOL


# ============================================================================
# 4. Invalid Tool Arguments (Pydantic & Non-Dict)
# ============================================================================
@pytest.mark.asyncio
async def test_invalid_tool_arguments():
    async def sample_handler(args: SampleSearchInput, ctx: ToolExecutionContext):
        return {"ok": True}

    tool = SpecialistTool("validated_tool", "Desc", SampleSearchInput, sample_handler, {"market_research"})
    registry = ToolRegistry()
    registry.register_tool(tool)
    runtime = BoundedToolRuntime(registry)
    ctx = _build_test_exec_context()

    # Case A: args out of Pydantic bounds (max_results > 10)
    ai_turn1 = AIMessage(
        content="",
        tool_calls=[{"name": "validated_tool", "args": {"query": "test", "max_results": 999}, "id": "call_inv"}],
    )
    # Case B: non-dict raw args via invalid_tool_calls parser simulation
    ai_turn2 = AIMessage(
        content="",
        invalid_tool_calls=[{"name": "validated_tool", "args": "invalid-string-not-dict", "id": "call_nondict", "error": "JSONDecodeError"}],
    )

    mock_llm = MagicMock()
    mock_llm.bind_tools.return_value = mock_llm
    mock_llm.ainvoke = AsyncMock(side_effect=[ai_turn1, ai_turn2])

    result = await runtime.run([HumanMessage(content="Trigger validation")], ctx, llm=mock_llm)

    assert result.telemetry[0].status == ToolCallStatus.INVALID_ARGUMENTS
    assert "validation_errors" in json.loads(result.all_messages[2].content)
    assert result.telemetry[1].status == ToolCallStatus.INVALID_ARGUMENTS


# ============================================================================
# 5. Malformed Tool Calls (Missing ID, Duplicate IDs, Non-Dict Call)
# ============================================================================
@pytest.mark.asyncio
async def test_malformed_tool_call_structures():
    async def dummy(args: SampleSearchInput, ctx: ToolExecutionContext):
        return {"ok": True}

    tool = SpecialistTool("dummy", "Desc", SampleSearchInput, dummy, {"market_research"})
    registry = ToolRegistry()
    registry.register_tool(tool)
    runtime = BoundedToolRuntime(registry)
    ctx = _build_test_exec_context()

    # Call 1 has no id, Call 2 & 3 share duplicate ID, Call 4 is a non-dict object
    mock_ai = MagicMock(spec=AIMessage)
    mock_ai.content = ""
    mock_ai.tool_calls = [
        {"name": "dummy", "args": {"query": "test"}, "id": ""},
        {"name": "dummy", "args": {"query": "dupe1"}, "id": "shared_id"},
        {"name": "dummy", "args": {"query": "dupe2"}, "id": "shared_id"},
        "malformed_string_call",  # non-dict call
    ]
    mock_ai.invalid_tool_calls = []

    ai_turn2 = AIMessage(content="Done")

    mock_llm = MagicMock()
    mock_llm.bind_tools.return_value = mock_llm
    mock_llm.ainvoke = AsyncMock(side_effect=[mock_ai, ai_turn2])

    result = await runtime.run([HumanMessage(content="Malformed calls")], ctx, llm=mock_llm)

    assert result.failed_tool_calls == 3
    assert result.successful_tool_calls == 1
    malformed_tele = [t for t in result.telemetry if t.status == ToolCallStatus.MALFORMED_TOOL_CALL]
    assert len(malformed_tele) == 3


# ============================================================================
# 6. Specialist Allowlist Authorization Failure
# ============================================================================
@pytest.mark.asyncio
async def test_specialist_allowlist_authorization_failure():
    async def secret_brand_tool(args: SampleSearchInput, ctx: ToolExecutionContext):
        return {"brand_secret": "authorized"}

    tool = SpecialistTool("brand_only_tool", "Desc", SampleSearchInput, secret_brand_tool, {"brand_intelligence"})
    registry = ToolRegistry()
    registry.register_tool(tool)
    runtime = BoundedToolRuntime(registry)

    # Caller is market_research
    ctx = _build_test_exec_context(specialist_id="market_research")

    ai_turn1 = AIMessage(
        content="",
        tool_calls=[{"name": "brand_only_tool", "args": {"query": "secret"}, "id": "call_unauth"}],
    )
    ai_turn2 = AIMessage(content="Acknowledged.")

    mock_llm = MagicMock()
    mock_llm.bind_tools.return_value = mock_llm
    mock_llm.ainvoke = AsyncMock(side_effect=[ai_turn1, ai_turn2])

    result = await runtime.run([HumanMessage(content="Access brand secrets")], ctx, llm=mock_llm)

    assert result.telemetry[0].status == ToolCallStatus.UNAUTHORIZED_SPECIALIST
    assert "not authorized to invoke tool 'brand_only_tool'" in result.telemetry[0].error_message


# ============================================================================
# 7. Tenant Authorization & Cross-Tenant Access Isolation
# ============================================================================
@pytest.mark.asyncio
async def test_tenant_authorization_isolation():
    async def db_handler(args: TenantRestrictedInput, ctx: ToolExecutionContext):
        if args.target_agency_id and str(ctx.agency_id) != args.target_agency_id:
            raise PermissionError(
                f"Cross-tenant access forbidden: user agency {ctx.agency_id} cannot query agency {args.target_agency_id}"
            )
        return {"record_id": args.record_id, "agency": str(ctx.agency_id)}

    tool = SpecialistTool("db_query", "Query DB", TenantRestrictedInput, db_handler, {"market_research"})
    registry = ToolRegistry()
    registry.register_tool(tool)
    runtime = BoundedToolRuntime(registry)

    real_agency = uuid.uuid4()
    foreign_agency = uuid.uuid4()
    ctx = _build_test_exec_context(agency_id=real_agency)

    ai_turn1 = AIMessage(
        content="",
        tool_calls=[
            {
                "name": "db_query",
                "args": {"record_id": "rec_123", "target_agency_id": str(foreign_agency)},
                "id": "call_hack",
            }
        ],
    )
    ai_turn2 = AIMessage(content="Cross-tenant access was blocked.")

    mock_llm = MagicMock()
    mock_llm.bind_tools.return_value = mock_llm
    mock_llm.ainvoke = AsyncMock(side_effect=[ai_turn1, ai_turn2])

    result = await runtime.run([HumanMessage(content="Steal tenant data")], ctx, llm=mock_llm)

    assert result.telemetry[0].status == ToolCallStatus.UNAUTHORIZED_TENANT
    assert "Cross-tenant access forbidden" in result.telemetry[0].error_message


# ============================================================================
# 8. Tool Execution Context & Studio Context ID Mismatch Validation
# ============================================================================
def test_tool_execution_context_id_mismatch_rejected():
    agency_1 = uuid.uuid4()
    agency_2 = uuid.uuid4()
    client_id = uuid.uuid4()
    campaign_id = uuid.uuid4()

    brief = CampaignBrief(client_id=client_id, agency_id=agency_1, period_month=11, period_year=2026, objective="Test")
    studio_ctx = CampaignStudioContext(
        agency_id=agency_1,
        client_id=client_id,
        campaign_id=campaign_id,
        client_name="Test Brand",
        campaign_brief=brief,
    )

    # ToolExecutionContext agency_id differs from studio_context.agency_id
    with pytest.raises(ValueError, match="Agency ID mismatch"):
        ToolExecutionContext(
            agency_id=agency_2,
            client_id=client_id,
            campaign_id=campaign_id,
            specialist_id="market_research",
            studio_context=studio_ctx,
        )


# ============================================================================
# 9. Tool Exception Handling
# ============================================================================
@pytest.mark.asyncio
async def test_tool_exception_handling():
    async def failing_tool(args: SampleSearchInput, ctx: ToolExecutionContext):
        raise RuntimeError("External database connection reset unexpectedly.")

    tool = SpecialistTool("failing_tool", "Desc", SampleSearchInput, failing_tool, {"market_research"})
    registry = ToolRegistry()
    registry.register_tool(tool)
    runtime = BoundedToolRuntime(registry)
    ctx = _build_test_exec_context()

    ai_turn1 = AIMessage(
        content="",
        tool_calls=[{"name": "failing_tool", "args": {"query": "fail"}, "id": "call_crash"}],
    )
    ai_turn2 = AIMessage(content="Handled error.")

    mock_llm = MagicMock()
    mock_llm.bind_tools.return_value = mock_llm
    mock_llm.ainvoke = AsyncMock(side_effect=[ai_turn1, ai_turn2])

    result = await runtime.run([HumanMessage(content="Trigger fail")], ctx, llm=mock_llm)

    assert result.telemetry[0].status == ToolCallStatus.TOOL_ERROR
    assert "External database connection reset" in result.telemetry[0].error_message


# ============================================================================
# 10. Tool Timeout & Immediate Wall-Clock Deadline Exhaustion
# ============================================================================
@pytest.mark.asyncio
async def test_tool_timeout_and_deadline_exhaustion():
    async def slow_tool(args: SampleSearchInput, ctx: ToolExecutionContext):
        await asyncio.sleep(2.0)
        return {"done": True}

    tool = SpecialistTool("slow_tool", "Desc", SampleSearchInput, slow_tool, {"market_research"})
    registry = ToolRegistry()
    registry.register_tool(tool)

    # Per-tool timeout of 0.1s inside 5s execution budget
    config = ToolRuntimeConfig(per_tool_timeout_seconds=0.1, execution_timeout_seconds=5.0)
    runtime = BoundedToolRuntime(registry, config=config)
    ctx = _build_test_exec_context()

    ai_turn1 = AIMessage(
        content="",
        tool_calls=[{"name": "slow_tool", "args": {"query": "slow"}, "id": "call_timeout"}],
    )
    ai_turn2 = AIMessage(content="Noticed timeout.")

    mock_llm = MagicMock()
    mock_llm.bind_tools.return_value = mock_llm
    mock_llm.ainvoke = AsyncMock(side_effect=[ai_turn1, ai_turn2])

    result = await runtime.run([HumanMessage(content="Timeout test")], ctx, llm=mock_llm)

    assert result.telemetry[0].status == ToolCallStatus.TIMEOUT
    assert "timed out after" in result.telemetry[0].error_message


# ============================================================================
# 11. Maximum Turns Enforced
# ============================================================================
@pytest.mark.asyncio
async def test_maximum_turns_enforced():
    async def infinite_tool(args: SampleSearchInput, ctx: ToolExecutionContext):
        return {"step": 1}

    tool = SpecialistTool("loop_tool", "Desc", SampleSearchInput, infinite_tool, {"market_research"})
    registry = ToolRegistry()
    registry.register_tool(tool)

    config = ToolRuntimeConfig(max_turns=2)
    runtime = BoundedToolRuntime(registry, config=config)
    ctx = _build_test_exec_context()

    def generate_ai_call(turn: int):
        return AIMessage(
            content=f"Turn {turn}",
            tool_calls=[{"name": "loop_tool", "args": {"query": f"turn {turn}"}, "id": f"call_{turn}"}],
        )

    mock_llm = MagicMock()
    mock_llm.bind_tools.return_value = mock_llm
    mock_llm.ainvoke = AsyncMock(side_effect=[generate_ai_call(1), generate_ai_call(2), generate_ai_call(3)])

    result = await runtime.run([HumanMessage(content="Infinite loop")], ctx, llm=mock_llm)

    assert result.status == ExecutionStatus.MAX_TURNS_REACHED
    assert result.total_turns == 2


# ============================================================================
# 12. Maximum Total Tool Calls Enforced
# ============================================================================
@pytest.mark.asyncio
async def test_maximum_total_tool_calls_enforced():
    async def quick_tool(args: SampleSearchInput, ctx: ToolExecutionContext):
        return {"data": "ok"}

    tool = SpecialistTool("quick_tool", "Desc", SampleSearchInput, quick_tool, {"market_research"})
    registry = ToolRegistry()
    registry.register_tool(tool)

    config = ToolRuntimeConfig(max_total_tool_calls=2)
    runtime = BoundedToolRuntime(registry, config=config)
    ctx = _build_test_exec_context()

    ai_turn1 = AIMessage(
        content="",
        tool_calls=[
            {"name": "quick_tool", "args": {"query": "1"}, "id": "call_1"},
            {"name": "quick_tool", "args": {"query": "2"}, "id": "call_2"},
            {"name": "quick_tool", "args": {"query": "3"}, "id": "call_3"},
        ],
    )

    mock_llm = MagicMock()
    mock_llm.bind_tools.return_value = mock_llm
    mock_llm.ainvoke = AsyncMock(return_value=ai_turn1)

    result = await runtime.run([HumanMessage(content="Exceed calls")], ctx, llm=mock_llm)

    assert result.status == ExecutionStatus.MAX_TOOL_CALLS_REACHED
    assert result.total_tool_calls == 2
    assert result.telemetry[2].status == ToolCallStatus.CALL_LIMIT_REACHED


# ============================================================================
# 13. Provider Failure & Tool Binding Error Boundaries
# ============================================================================
@pytest.mark.asyncio
async def test_provider_failure_and_binding_error_handling():
    async def useful_tool(args: SampleSearchInput, ctx: ToolExecutionContext):
        return {"vital_finding": "High audience retention on visual hooks"}

    tool = SpecialistTool("useful_tool", "Desc", SampleSearchInput, useful_tool, {"market_research"})
    registry = ToolRegistry()
    registry.register_tool(tool)
    runtime = BoundedToolRuntime(registry)
    ctx = _build_test_exec_context()

    ai_turn1 = AIMessage(
        content="",
        tool_calls=[{"name": "useful_tool", "args": {"query": "retention"}, "id": "call_vital"}],
    )

    mock_llm = MagicMock()
    mock_llm.bind_tools.return_value = mock_llm
    mock_llm.ainvoke = AsyncMock(side_effect=[ai_turn1, RuntimeError("Groq 503 Service Unavailable")])

    result = await runtime.run([HumanMessage(content="Do research")], ctx, llm=mock_llm)

    assert result.status == ExecutionStatus.PROVIDER_FAILURE
    assert "Groq 503 Service Unavailable" in result.failure_reason
    assert len(result.observations) == 1
    assert result.observations[0].data["vital_finding"] == "High audience retention on visual hooks"

    # Test tool binding failure handling
    bad_llm = MagicMock()
    bad_llm.bind_tools.side_effect = RuntimeError("Invalid tool schema binding rejection")
    bind_result = await runtime.run([HumanMessage(content="Bind fail")], ctx, llm=bad_llm)
    assert bind_result.status == ExecutionStatus.TOOL_EXECUTION_FAILURE
    assert "Failed to bind tools" in bind_result.failure_reason


# ============================================================================
# 14. Budget Exhaustion & Accounting Across Failures
# ============================================================================
@pytest.mark.asyncio
async def test_budget_exhaustion_and_accounting_across_failures():
    async def expensive_tool(args: SampleSearchInput, ctx: ToolExecutionContext):
        return {"spent": True}

    async def second_expensive_tool(args: SampleSearchInput, ctx: ToolExecutionContext):
        return {"never": "executed"}

    registry = ToolRegistry()
    registry.register_tool(SpecialistTool("exp_1", "Desc", SampleSearchInput, expensive_tool, {"market_research"}, cost_units=15.0))
    registry.register_tool(SpecialistTool("exp_2", "Desc", SampleSearchInput, second_expensive_tool, {"market_research"}, cost_units=10.0))

    config = ToolRuntimeConfig(budget_units=20.0)
    runtime = BoundedToolRuntime(registry, config=config)
    ctx = _build_test_exec_context()

    ai_turn1 = AIMessage(
        content="",
        tool_calls=[
            {"name": "exp_1", "args": {"query": "first"}, "id": "call_exp1"},
            {"name": "exp_2", "args": {"query": "second"}, "id": "call_exp2"},
        ],
    )

    mock_llm = MagicMock()
    mock_llm.bind_tools.return_value = mock_llm
    mock_llm.ainvoke = AsyncMock(return_value=ai_turn1)

    result = await runtime.run([HumanMessage(content="Spend budget")], ctx, llm=mock_llm)

    assert result.status == ExecutionStatus.BUDGET_EXHAUSTED
    assert result.budget_consumed == 15.0
    assert result.telemetry[0].status == ToolCallStatus.SUCCESS
    assert result.telemetry[1].status == ToolCallStatus.BUDGET_EXCEEDED


# ============================================================================
# 15. Tool-Call Protocol Completeness: All tool_call_ids Receive ToolMessages
# ============================================================================
@pytest.mark.asyncio
async def test_tool_call_protocol_completeness_on_mid_batch_abort():
    async def tool_one(args: SampleSearchInput, ctx: ToolExecutionContext):
        return {"hit": 1}

    registry = ToolRegistry()
    registry.register_tool(SpecialistTool("tool_one", "Desc", SampleSearchInput, tool_one, {"market_research"}, cost_units=10.0))

    config = ToolRuntimeConfig(max_total_tool_calls=1)
    runtime = BoundedToolRuntime(registry, config=config)
    ctx = _build_test_exec_context()

    ai_turn = AIMessage(
        content="",
        tool_calls=[
            {"name": "tool_one", "args": {"query": "1"}, "id": "call_1"},
            {"name": "tool_one", "args": {"query": "2"}, "id": "call_2"},
            {"name": "tool_one", "args": {"query": "3"}, "id": "call_3"},
        ],
    )

    mock_llm = MagicMock()
    mock_llm.bind_tools.return_value = mock_llm
    mock_llm.ainvoke = AsyncMock(return_value=ai_turn)

    result = await runtime.run([HumanMessage(content="Batch calls")], ctx, llm=mock_llm)

    tool_messages = [m for m in result.all_messages if isinstance(m, ToolMessage)]
    assert len(tool_messages) == 3
    assert {m.tool_call_id for m in tool_messages} == {"call_1", "call_2", "call_3"}
    assert json.loads(tool_messages[0].content) == {"hit": 1}
    assert "call_limit_reached" in tool_messages[1].content
    assert "call_limit_reached" in tool_messages[2].content


# ============================================================================
# 16. Structured Output Truncation: Hard UTF-8 Guarantee, Unicode, Nested Dicts
# ============================================================================
def test_structured_output_hard_utf8_guarantee_and_unicode():
    max_bytes = 500

    # Test A: Nested dictionaries without list keys
    deep_dict = {f"nested_key_{i}": {"depth": i, "val": "x" * 50} for i in range(50)}
    res_a, trunc_a = structured_truncate_output(deep_dict, max_bytes=max_bytes)
    assert trunc_a is True
    assert len(res_a.encode("utf-8")) <= max_bytes
    parsed_a = json.loads(res_a)
    assert "_truncation" in parsed_a

    # Test B: Unicode-heavy content (multi-byte characters like emojis, Devanagari, Japanese)
    unicode_str = "🚀 🔥 मुंबई महाराष्ट्र フィルター ✨ 日本語テキスト " * 100
    res_b, trunc_b = structured_truncate_output(unicode_str, max_bytes=max_bytes)
    assert trunc_b is True
    # Mathematical guarantee:
    assert len(res_b.encode("utf-8")) <= max_bytes
    parsed_b = json.loads(res_b)
    assert "_truncation" in parsed_b

    # Test C: Enormous single record string
    enormous_str = "A" * 50_000
    res_c, trunc_c = structured_truncate_output(enormous_str, max_bytes=max_bytes)
    assert trunc_c is True
    assert len(res_c.encode("utf-8")) <= max_bytes
    assert json.loads(res_c)["_truncation"]["truncated"] is True


# ============================================================================
# 17. Configuration Validation: NaN, Inf, Non-Async Handlers, Patterns
# ============================================================================
def test_configuration_validation_rejections():
    # 1. per_tool_timeout > execution_timeout
    with pytest.raises(ValueError, match="cannot exceed execution_timeout_seconds"):
        ToolRuntimeConfig(per_tool_timeout_seconds=40.0, execution_timeout_seconds=30.0)

    # 2. NaN or Inf in ToolRuntimeConfig
    with pytest.raises((ValueError, ValidationError)):
        ToolRuntimeConfig(budget_units=float("nan"))
    with pytest.raises((ValueError, ValidationError)):
        ToolRuntimeConfig(execution_timeout_seconds=float("inf"))

    # 3. max_turns < 1
    with pytest.raises(ValidationError):
        ToolRuntimeConfig(max_turns=0)

    # 4. Negative, NaN, or Inf tool cost in SpecialistTool
    async def dummy_async(args: SampleSearchInput, ctx: ToolExecutionContext): pass

    with pytest.raises(ValueError, match="must be a finite, non-negative number"):
        SpecialistTool("t", "desc", SampleSearchInput, dummy_async, {"market_research"}, cost_units=-1.0)
    with pytest.raises(ValueError, match="must be a finite, non-negative number"):
        SpecialistTool("t", "desc", SampleSearchInput, dummy_async, {"market_research"}, cost_units=float("nan"))
    with pytest.raises(ValueError, match="must be a finite, non-negative number"):
        SpecialistTool("t", "desc", SampleSearchInput, dummy_async, {"market_research"}, cost_units=float("inf"))

    # 5. Non-async handler rejected
    def sync_handler(args: SampleSearchInput, ctx: ToolExecutionContext): pass
    with pytest.raises(ValueError, match="must be an asynchronous coroutine function"):
        SpecialistTool("t", "desc", SampleSearchInput, sync_handler, {"market_research"})  # type: ignore

    # 6. Invalid tool name pattern rejected
    with pytest.raises(ValueError, match="Tool name 'invalid name with spaces' must be a non-empty string"):
        SpecialistTool("invalid name with spaces", "desc", SampleSearchInput, dummy_async, {"market_research"})

    # 7. Invalid specialist IDs
    with pytest.raises(ValueError, match="Specialist ID '' in tool 't' must be a non-empty string"):
        SpecialistTool("t", "desc", SampleSearchInput, dummy_async, {""})

    # 8. Duplicate tool registration in ToolRegistry
    registry = ToolRegistry()
    t1 = SpecialistTool("dupe_name", "desc", SampleSearchInput, dummy_async, {"market_research"})
    t2 = SpecialistTool("dupe_name", "other desc", SampleSearchInput, dummy_async, {"content_architect"})
    registry.register_tool(t1)
    with pytest.raises(ValueError, match="Duplicate tool registration"):
        registry.register_tool(t2)


# ============================================================================
# 18. web_extract Alias & Token Budgeting Regression Tests
# ============================================================================
def test_web_extract_alias_in_market_research_registry():
    """Verify web_extract is registered as a first-class alias for extract_webpages."""
    from app.campaign_intelligence.tools.market_research_tools import get_market_research_tool_registry, ExtractWebpagesInput
    registry = get_market_research_tool_registry()

    primary_tool = registry.get_tool("extract_webpages")
    alias_tool = registry.get_tool("web_extract")

    assert primary_tool is not None
    assert alias_tool is not None
    assert alias_tool.handler == primary_tool.handler
    assert alias_tool.args_schema == ExtractWebpagesInput
    assert "market_research" in alias_tool.allowed_specialists


def test_message_history_compaction_preserves_context_and_urls():
    """Verify that older tool messages are compacted when over token budget without dropping turns."""
    from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, ToolMessage

    system_msg = SystemMessage(content="You are a market researcher.")
    user_msg = HumanMessage(content="Analyze competitors.")

    # Turn 1: large extraction from an older turn
    large_page_content = "Word " * 2000  # ~8000 characters
    older_extract_json = json.dumps({
        "pages": [{
            "url": "https://example.com/competitor",
            "title": "Competitor Page",
            "status": "extracted",
            "content": large_page_content,
        }]
    })
    ai_turn1 = AIMessage(
        content="",
        tool_calls=[{"name": "extract_webpages", "args": {"urls": ["https://example.com/competitor"]}, "id": "call_1"}],
    )
    tool_turn1 = ToolMessage(content=older_extract_json, tool_call_id="call_1", name="extract_webpages")

    # Turn 2: recent turn
    ai_turn2 = AIMessage(
        content="",
        tool_calls=[{"name": "web_search", "args": {"query": "latest news"}, "id": "call_2"}],
    )
    latest_tool_json = json.dumps({
        "results": [{"title": "Recent News", "url": "https://news.example.com", "snippet": "Fresh snippet"}]
    })
    tool_turn2 = ToolMessage(content=latest_tool_json, tool_call_id="call_2", name="web_search")

    messages = [system_msg, user_msg, ai_turn1, tool_turn1, ai_turn2, tool_turn2]

    # Pre-compaction size should be large
    initial_tokens = BoundedToolRuntime._estimate_message_tokens(messages)
    assert initial_tokens > 2500

    # Compact with tight budget
    compacted = BoundedToolRuntime._compact_message_history(messages, max_request_tokens=1500)

    # 1. Total message count and order must be 100% preserved (no dropped messages)
    assert len(compacted) == len(messages)
    assert compacted[0] == system_msg
    assert compacted[1] == user_msg
    assert compacted[2] == ai_turn1
    assert compacted[4] == ai_turn2
    assert compacted[5] == tool_turn2  # Latest turn preserved intact

    # 2. Older tool message was compacted
    compacted_tool1_data = json.loads(compacted[3].content)
    assert compacted_tool1_data["pages"][0]["url"] == "https://example.com/competitor"
    assert "compacted for token budget" in compacted_tool1_data["pages"][0]["content"]
    assert len(compacted_tool1_data["pages"][0]["content"]) < len(large_page_content)

    # 3. Compacted tokens are significantly lower
    compacted_tokens = BoundedToolRuntime._estimate_message_tokens(compacted)
    assert compacted_tokens < initial_tokens


@pytest.mark.asyncio
async def test_provider_failure_telemetry_preserves_error_type_and_status_code():
    """Verify that provider failures capture error type, HTTP status code, and descriptive reason."""
    class MockGroqError(Exception):
        def __init__(self, message: str, status_code: int = 400):
            super().__init__(message)
            self.status_code = status_code

    registry = ToolRegistry()
    runtime = BoundedToolRuntime(registry)
    ctx = _build_test_exec_context()

    mock_llm = MagicMock()
    mock_llm.bind_tools.return_value = mock_llm
    mock_llm.ainvoke = AsyncMock(side_effect=MockGroqError("Tool call validation failed: attempted to call 'web_extract'", status_code=400))

    result = await runtime.run([HumanMessage(content="Test failure")], ctx, llm=mock_llm)

    assert result.status == ExecutionStatus.PROVIDER_FAILURE
    assert result.provider_error_type == "MockGroqError"
    assert result.provider_status_code == 400
    assert "[MockGroqError HTTP 400]" in result.failure_reason
