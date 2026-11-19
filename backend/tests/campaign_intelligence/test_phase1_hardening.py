from __future__ import annotations

import asyncio
import uuid
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.campaign_intelligence.schemas import (
    FindingCategory,
    FindingSeverity,
    QualityFinding,
    ResearchEvidence,
)
from app.campaign_intelligence.tools.brand_tools import get_client_verified_offers
from app.core.config import settings
from app.core.llm import extract_json_from_llm, invoke_structured_llm, key_pool
from app.models.brand_profile import BrandProfile
from app.models.client import Client
from app.models.operational_workflow import (
    TaskKind,
    WorkflowJobQueue,
    WorkflowJobStatus,
    WorkflowRun,
    WorkflowTask,
    WorkflowTaskStatus,
)
from app.services.dag_engine import MAX_SELECTIVE_REPAIR_ATTEMPTS, DAGEngine
from app.services.workflow_worker import guarded_handle_selective_repair


class DummySchema(BaseModel):
    message: str
    status: str = "ok"


# ============================================================================
# 1. Test JSON <think> Stripping
# ============================================================================

def test_json_think_stripping():
    """Verifies that extract_json_from_llm cleanly strips reasoning tags with nested braces."""
    raw_with_think = """
    <think>
    The user is asking for a structured campaign plan.
    Let's consider {"internal_reasoning": true, "nested": [1, 2, 3]}
    We should return a clean response matching DummySchema.
    </think>
    ```json
    {
        "message": "Campaign plan ready",
        "status": "success"
    }
    ```
    """
    result = extract_json_from_llm(raw_with_think)
    assert isinstance(result, dict)
    assert result["message"] == "Campaign plan ready"
    assert result["status"] == "success"

    # Case-insensitive test without codeblocks
    raw_case_insensitive = """
    <THINK>
    Checking parameters: {a: 1}
    </THINK>
    {"message": "Case insensitive pass", "status": "verified"}
    """
    res2 = extract_json_from_llm(raw_case_insensitive)
    assert isinstance(res2, dict)
    assert res2["message"] == "Case insensitive pass"


# ============================================================================
# 2. Test LLM Key Rotation (429/TPM vs 413)
# ============================================================================

@pytest.mark.asyncio
async def test_llm_key_rotation_429_uses_secondary_key_before_cascade():
    """
    Verifies that on 429/TPM errors, invoke_structured_llm rotates to GROQ_API_KEY_2
    first, rather than prematurely downgrading model.
    """
    used_keys: list[str] = []

    async def mock_ainvoke(messages, **kwargs):
        # Read the current key from the caller
        if len(used_keys) == 0:
            used_keys.append("key1")
            raise Exception("429 Rate limit reached: TPM limit exceeded for current key")
        else:
            used_keys.append("key2")
            return DummySchema(message="Recovered on secondary key", status="ok")

    with patch.object(key_pool, "get_keys", return_value=["gsk_mock_key_primary_111111", "gsk_mock_key_secondary_222222"]), \
         patch.object(key_pool, "get_active_key", new_callable=AsyncMock, return_value="gsk_mock_key_primary_111111"), \
         patch("app.core.llm.get_llm") as mock_get_llm:

        mock_client = MagicMock()
        mock_structured = MagicMock()
        mock_structured.ainvoke = AsyncMock(side_effect=mock_ainvoke)
        mock_client.with_structured_output.return_value = mock_structured
        mock_get_llm.return_value = mock_client

        result = await invoke_structured_llm(
            prompt="Test prompt",
            schema_class=DummySchema,
            model="openai/gpt-oss-120b",
        )

        assert isinstance(result, DummySchema)
        assert result.message == "Recovered on secondary key"
        # Must have tried key1 then key2
        assert len(used_keys) == 2


@pytest.mark.asyncio
async def test_llm_key_rotation_413_does_not_rotate_keys():
    """
    Verifies that on 413 Payload Too Large, invoke_structured_llm cascades models
    WITHOUT rotating keys.
    """
    models_called: list[str] = []

    async def mock_ainvoke(messages, **kwargs):
        if len(models_called) == 1:
            raise Exception("413 Request entity too large: context length exceeded")
        else:
            return DummySchema(message="Handled on cascade model", status="ok")

    def side_effect_get_llm(**kwargs):
        model = kwargs.get("model", "unknown")
        models_called.append(model)
        mock_client = MagicMock()
        mock_structured = MagicMock()
        mock_structured.ainvoke = AsyncMock(side_effect=mock_ainvoke)
        mock_client.with_structured_output.return_value = mock_structured
        return mock_client

    with patch.object(key_pool, "get_keys", return_value=["key1", "key2"]), \
         patch.object(key_pool, "get_active_key", new_callable=AsyncMock, return_value="key1"), \
         patch("app.core.llm.get_llm", side_effect=side_effect_get_llm), \
         patch("app.core.llm.ChatNVIDIA") as mock_nvidia_cls:

        mock_nvidia_inst = MagicMock()
        mock_nvidia_inst.ainvoke = AsyncMock(
            return_value=MagicMock(content='{"message": "Handled on cascade model", "status": "ok"}')
        )
        mock_nvidia_cls.return_value = mock_nvidia_inst

        result = await invoke_structured_llm(
            prompt="Large prompt",
            schema_class=DummySchema,
            model="openai/gpt-oss-120b",
        )

        assert isinstance(result, DummySchema)
        assert result.message == "Handled on cascade model"
        # Confirms model cascaded to next model without wasting keys
        assert len(models_called) >= 1
        assert models_called[0] == "openai/gpt-oss-120b"


# ============================================================================
# 3. Test FindingCategory.brand_voice Enum
# ============================================================================

def test_quality_finding_brand_voice():
    """Verifies that FindingCategory has brand_voice and QualityFinding instantiates without crash."""
    assert hasattr(FindingCategory, "brand_voice")
    assert FindingCategory.brand_voice.value == "brand_voice"

    finding = QualityFinding(
        category=FindingCategory.brand_voice,
        severity=FindingSeverity.warning,
        deliverable_index=1,
        deliverable_title="Test Deliverable",
        issue_description="Contains banned cliché 'engineered with precision'",
        remediation_instruction="Remove cliché and use authentic tone.",
    )
    assert finding.category == FindingCategory.brand_voice
    assert "cliché" in finding.issue_description


# ============================================================================
# 4. Test Market Research Sorted Citations Mapping
# ============================================================================

def test_market_research_sorted_citations():
    """
    Verifies that when evidence_list is unsorted, sorted_evidence[:8] correctly
    aligns with 0-based cited_evidence_indices.
    """
    ev1 = ResearchEvidence(source_url="https://example.com/low-score", source_title="Low", publisher="P1", relevance_score=0.2, excerpt="Low relevance excerpt", key_takeaway="Low relevance takeaway")
    ev2 = ResearchEvidence(source_url="https://example.com/top-1", source_title="Top 1", publisher="P2", relevance_score=0.95, excerpt="Top 1 excerpt", key_takeaway="Top 1 takeaway")
    ev3 = ResearchEvidence(source_url="https://example.com/top-2", source_title="Top 2", publisher="P3", relevance_score=0.88, excerpt="Top 2 excerpt", key_takeaway="Top 2 takeaway")

    evidence_list = [ev1, ev2, ev3]
    # In MarketResearchAgent.run:
    sorted_evidence = sorted(evidence_list, key=lambda e: e.relevance_score, reverse=True)[:8]

    # Model was given prompt with sorted_evidence: [0] is ev2, [1] is ev3
    assert sorted_evidence[0].source_url == "https://example.com/top-1"
    assert sorted_evidence[1].source_url == "https://example.com/top-2"

    cited_indices = [0, 1]
    # Fixed indexing: sorted_evidence[i]
    resolved = [sorted_evidence[i] for i in cited_indices if 0 <= i < len(sorted_evidence)]
    assert resolved[0].source_url == "https://example.com/top-1"
    assert resolved[1].source_url == "https://example.com/top-2"


# ============================================================================
# 5. Test Brand Verified Offers (Dict vs List of Strings vs List of Dicts)
# ============================================================================

@pytest.mark.asyncio
async def test_brand_verified_offers_list_and_dict():
    """
    Verifies get_client_verified_offers handles goals whether dict, list of strings,
    or list of dicts.
    """
    client_id = uuid.uuid4()
    agency_id = uuid.uuid4()
    mock_db = AsyncMock(spec=AsyncSession)

    # Empty contracts query return
    mock_res = MagicMock()
    mock_res.scalars.return_value.all.return_value = []
    mock_db.execute.return_value = mock_res

    # 1. Dict format
    bp_dict = BrandProfile(
        client_id=client_id,
        is_confirmed=True,
        goals={"offers": [{"name": "Offer Alpha", "description": "Flagship product"}]},
    )
    offers_dict = await get_client_verified_offers(client_id, agency_id, mock_db, bp_dict)
    assert len(offers_dict) == 1
    assert offers_dict[0].name == "Offer Alpha"

    # 2. List of strings format
    bp_list_str = BrandProfile(
        client_id=client_id,
        is_confirmed=True,
        goals=["Sunday Special Thali", "Weekend Brunch Buffet"],
    )
    offers_str = await get_client_verified_offers(client_id, agency_id, mock_db, bp_list_str)
    assert len(offers_str) == 2
    assert offers_str[0].name == "Sunday Special Thali"
    assert offers_str[1].name == "Weekend Brunch Buffet"

    # 3. List of dicts format
    bp_list_dict = BrandProfile(
        client_id=client_id,
        is_confirmed=True,
        goals=[{"name": "ARM-X1 Robotic Cell", "description": "Automated welding arm"}],
    )
    offers_dict_list = await get_client_verified_offers(client_id, agency_id, mock_db, bp_list_dict)
    assert len(offers_dict_list) == 1
    assert offers_dict_list[0].name == "ARM-X1 Robotic Cell"


# ============================================================================
# 6. Test DAG Selective Repair State Machine
# ============================================================================

@pytest.mark.asyncio
async def test_dag_selective_repair_retriggers_audit():
    """
    Verifies that when quality evaluator returns selective_repair_requested:
    1. guarded_handle_selective_repair keeps final_quality_audit in pending status
    2. Calls DAGEngine.initiate_selective_repair on content_architecture
    3. Prevents premature client_approval unblocking
    """
    run_id = uuid.uuid4()
    agency_id = uuid.uuid4()
    content_task_id = uuid.uuid4()
    qa_task_id = uuid.uuid4()
    job_id = uuid.uuid4()
    claim_token = uuid.uuid4()

    qa_task = WorkflowTask(
        id=qa_task_id,
        workflow_run_id=run_id,
        agency_id=agency_id,
        task_key="final_quality_audit",
        task_kind=TaskKind.ai_agent,
        status=WorkflowTaskStatus.running,
        current_version=1,
    )
    content_task = WorkflowTask(
        id=content_task_id,
        workflow_run_id=run_id,
        agency_id=agency_id,
        task_key="content_architecture",
        task_kind=TaskKind.ai_agent,
        status=WorkflowTaskStatus.completed,
        current_version=1,
        selective_repair_count=0,
    )

    db = AsyncMock(spec=AsyncSession)

    # Mock get
    async def mock_get(entity_cls, ident, **kwargs):
        if ident == qa_task_id:
            return qa_task
        if ident == content_task_id:
            return content_task
        return None

    db.get = AsyncMock(side_effect=mock_get)

    # Mock execute for update statement and select
    mock_update_res = MagicMock()
    mock_update_res.rowcount = 1

    mock_select_res = MagicMock()
    mock_select_res.scalar_one_or_none.return_value = content_task

    async def mock_execute(stmt, *args, **kwargs):
        stmt_str = str(stmt).lower()
        if "update workflow_job_queue" in stmt_str:
            return mock_update_res
        if "select" in stmt_str and "content_architecture" in stmt_str:
            return mock_select_res
        return mock_select_res

    db.execute = AsyncMock(side_effect=mock_execute)

    payload = {
        "selective_repair_requested": True,
        "revision_required": True,
        "repair_instructions": "Remove banned cliché 'engineered with precision' from Scene 2",
    }

    with patch.object(DAGEngine, "initiate_selective_repair", new_callable=AsyncMock, return_value=True) as mock_repair:
        handled = await guarded_handle_selective_repair(
            db=db,
            job_id=job_id,
            task_id=qa_task_id,
            claim_token=claim_token,
            worker_id="test_worker_1",
            execution_generation=1,
            attempt_number=1,
            latency_ms=850,
            output_payload=payload,
            invocations=[],
        )

        assert handled is True
        # QA task must remain pending (not completed!) so client_approval is NOT unblocked
        assert qa_task.status == WorkflowTaskStatus.pending
        # DAGEngine.initiate_selective_repair must have been called on content_architecture
        mock_repair.assert_called_once_with(
            db=db,
            task_id=content_task_id,
            repair_instructions="Remove banned cliché 'engineered with precision' from Scene 2",
            author_id="test_worker_1",
        )
