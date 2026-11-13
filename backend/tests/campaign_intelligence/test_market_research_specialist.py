"""
Market Research Specialist — Focused Reliability Test Suite.

Covers the 12 required test areas:
  1. Zero search results (deterministic sufficiency gate Case A).
  2. Search results with failed extraction (preliminary search snippets only Case B).
  3. Successfully extracted evidence (evidence-grounded synthesis Case C).
  4. Fabricated citation URLs (rejected and marked [UNVERIFIED HYPOTHESIS]).
  5. Retrieved but unrelated citation URLs (rejected and marked [UNVERIFIED HYPOTHESIS]).
  6. Valid citation normalization (harmless normalization differences accepted).
  7. Unsafe URLs and unsafe redirects (localhost, private IP, loopback, internal hostname,
     DNS resolving to private IP, and unsafe redirect destination).
  8. Runtime timeout (honestly disclosed in banner and limitations).
  9. Runtime budget exhaustion (honestly disclosed).
  10. Runtime provider / tool failure (honestly disclosed as failed execution).
  11. Partial research response (discloses issues and tool limits).
  12. Successful research response (clean presentation with inline citations).

All tests use deterministic mocks; zero live network requests.
"""
from __future__ import annotations

import socket
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from app.campaign_intelligence.collaboration.schemas import (
    ArtifactType,
    CompetitorActivity,
    EvidenceCitation,
    InferredOpportunity,
    MarketResearchArtifactPayload,
    SocialPlatform,
)
from app.campaign_intelligence.runtime import ToolExecutionContext
from app.campaign_intelligence.runtime.schemas import (
    ExecutionStatus,
    ToolCallStatus,
    ToolCallTelemetry,
    ToolExecutionResult,
)
from app.campaign_intelligence.schemas.brand import BrandContext
from app.campaign_intelligence.schemas.campaign import CampaignBrief
from app.campaign_intelligence.schemas.research import ResearchEvidence
from app.campaign_intelligence.schemas.studio_context import CampaignStudioContext
from app.campaign_intelligence.specialists.market_research_adapter import (
    CitedKeyFinding,
    CompetitorFindingItem,
    InferredOpportunityItem,
    MarketResearchSpecialistAdapter,
    MarketResearchSynthesisOutput,
)
from app.campaign_intelligence.tools.market_research_tools import (
    BrandContextToolInput,
    ExtractWebpagesInput,
    PlatformDocumentationInput,
    WebSearchInput,
    brand_context_handler,
    extract_webpages_handler,
    get_market_research_tool_registry,
    platform_documentation_handler,
    web_search_handler,
)
from app.campaign_intelligence.tools.research_tools import (
    _is_safe_url,
    _normalize_url,
    extract_tavily,
    get_platform_format_evidence,
)


# ===========================================================================
# Fixtures & Helpers
# ===========================================================================

def _build_test_context(
    location: str | None = "Pune, Maharashtra",
    industry: str = "Healthcare & Aesthetic Dentistry",
    client_name: str = "SmileCraft Dental Studio",
    active_artifact_type: str | None = None,
    active_artifact_payload: dict | None = None,
    mode: str | None = "fast",
) -> CampaignStudioContext:
    agency_id = uuid.uuid4()
    client_id = uuid.uuid4()
    campaign_id = uuid.uuid4()

    brief = CampaignBrief(
        client_id=client_id,
        agency_id=agency_id,
        period_month=11,
        period_year=2026,
        objective="Drive high-ticket Invisalign and veneer consultations",
        platforms=["instagram", "youtube"],
        target_audience=["Working professionals aged 25-45 in Pune"],
    )

    brand_ctx = BrandContext(
        client_id=client_id,
        agency_id=agency_id,
        business_name=client_name,
        industry=industry,
        brand_voice=["Clinical Authority", "Empathetic", "Premium"],
        content_pillars=["Cosmetic Transformations", "Dental Mythbusting", "Patient Stories"],
        confirmed_facts=["Painless laser dentistry clinic in Koregaon Park, Pune"],
    )

    return CampaignStudioContext(
        agency_id=agency_id,
        client_id=client_id,
        campaign_id=campaign_id,
        client_name=client_name,
        client_industry=industry,
        client_location=location,
        campaign_brief=brief,
        brand_context=brand_ctx,
        active_artifact_type=active_artifact_type,
        active_artifact_payload=active_artifact_payload,
        mode=mode,
    )


def _make_ctx() -> ToolExecutionContext:
    return ToolExecutionContext(
        agency_id=uuid.uuid4(),
        client_id=uuid.uuid4(),
        campaign_id=uuid.uuid4(),
        specialist_id="market_research",
    )


def _mock_synthesis(
    *,
    competitors: list[CompetitorFindingItem] | None = None,
    opportunities: list[InferredOpportunityItem] | None = None,
    limitations: str | None = None,
    findings: list[CitedKeyFinding] | None = None,
) -> MarketResearchSynthesisOutput:
    return MarketResearchSynthesisOutput(
        executive_summary="Test synthesis executive summary.",
        key_findings=findings or [CitedKeyFinding(finding="Test finding statement.", source_url=None)],
        verified_observations=[],
        source_reported_claims=[],
        observed_competitors=competitors or [],
        inferred_opportunities=opportunities or [],
        search_limitations=limitations,
        recommendations=[],
        suggested_followups=[],
    )


# ===========================================================================
# 1. Zero Search Results (Evidence Sufficiency Gate Case A)
# ===========================================================================

@pytest.mark.asyncio
async def test_empty_search_results_handled_honestly():
    """When search returns zero results, synthesis LLM is not invoked and insufficient evidence is reported."""
    context = _build_test_context(location="Remote Island X")
    adapter = MarketResearchSpecialistAdapter()

    ai_turn1 = AIMessage(
        content="Searching for competitors.",
        tool_calls=[{"name": "web_search", "args": {"query": "Remote Island X dental rivals"}, "id": "call_1"}],
    )
    ai_turn2 = AIMessage(content="No results found.")

    with patch("app.campaign_intelligence.tools.market_research_tools.execute_query_with_fallbacks", return_value=[]), \
         patch("app.campaign_intelligence.specialists.market_research_adapter.get_llm") as mock_get_llm, \
         patch("app.campaign_intelligence.specialists.market_research_adapter.invoke_structured_llm") as mock_synthesis_llm:

        mock_llm = MagicMock()
        mock_llm.bind_tools.return_value = mock_llm
        mock_llm.ainvoke = AsyncMock(side_effect=[ai_turn1, ai_turn2])
        mock_get_llm.return_value = mock_llm

        result = await adapter.execute("Find competitors in Remote Island X", context, AsyncMock())

    # The synthesis LLM must NOT be called when zero sources were retrieved
    mock_synthesis_llm.assert_not_called()

    payload = result.artifact_payload
    assert len(payload["observed_competitors"]) == 0
    assert len(payload["inferred_opportunities"]) == 0
    assert len(payload["verified_sources"]) == 0
    assert payload["search_limitations"] is not None
    assert "0 indexable sources" in payload["search_limitations"]
    assert "Insufficient research evidence" in result.reply or "zero usable search results" in result.reply


# ===========================================================================
# 2. Search Results with Failed Extraction (Preliminary Snippets Only Case B)
# ===========================================================================

@pytest.mark.asyncio
async def test_search_results_with_failed_extraction():
    """When search succeeds but extraction fails, observations are preliminary and pages not labeled inspected."""
    context = _build_test_context()
    adapter = MarketResearchSpecialistAdapter()

    search_hits = [
        ResearchEvidence(
            source_title="Dental Snippet Hit",
            source_url="https://dental.example.com/snippet",
            publisher="Dental Directory",
            excerpt="SmilePro offers weekend dental checkups in Pune.",
            key_takeaway="Weekend checkups",
            relevance_score=0.9,
        )
    ]

    failed_extract = [
        {
            "url": "https://dental.example.com/snippet",
            "title": "Failed page",
            "raw_content": "",
            "status": "http_error_403",
        }
    ]

    synthesis = _mock_synthesis(
        competitors=[
            CompetitorFindingItem(
                competitor_name="SmilePro",
                platform="instagram",
                observed_creative_angle="Weekend checkups promotion",
                observed_format="Post",
                supporting_source_url="https://dental.example.com/snippet",
            )
        ],
        findings=[
            CitedKeyFinding(
                finding="SmilePro promotes weekend appointments.",
                source_url="https://dental.example.com/snippet",
            )
        ],
    )

    with patch("app.campaign_intelligence.tools.market_research_tools.execute_query_with_fallbacks", return_value=search_hits), \
         patch("app.campaign_intelligence.tools.market_research_tools.extract_tavily", return_value=failed_extract), \
         patch("app.campaign_intelligence.specialists.market_research_adapter.get_llm") as mock_get_llm, \
         patch("app.campaign_intelligence.specialists.market_research_adapter.invoke_structured_llm", return_value=synthesis):

        mock_llm = MagicMock()
        mock_llm.bind_tools.return_value = mock_llm
        mock_llm.ainvoke = AsyncMock(side_effect=[
            AIMessage(content="", tool_calls=[{"name": "web_search", "args": {"query": "clinics"}, "id": "c1"}]),
            AIMessage(content="", tool_calls=[{"name": "extract_webpages", "args": {"urls": ["https://dental.example.com/snippet"]}, "id": "c2"}]),
            AIMessage(content="Done"),
        ])
        mock_get_llm.return_value = mock_llm

        result = await adapter.execute("Find Pune clinic competitors", context, AsyncMock())

    payload = result.artifact_payload
    comp = payload["observed_competitors"][0]
    # Competitor based only on search snippet must disclose preliminary nature
    assert "Preliminary" in comp["observed_creative_angle"]
    # Sources consulted must show 0 deeply inspected pages
    assert "0 deeply inspected pages" in result.reply
    assert "1 search snippets only" in result.reply


# ===========================================================================
# 3. Successfully Extracted Evidence (Evidence-Grounded Synthesis Case C)
# ===========================================================================

@pytest.mark.asyncio
async def test_successfully_extracted_evidence():
    """Deeply inspected webpage provides primary evidence for verified competitor observation."""
    context = _build_test_context()
    adapter = MarketResearchSpecialistAdapter()

    search_hits = [
        ResearchEvidence(
            source_title="Leading Clinics",
            source_url="https://punedentistry.example.com/competitors",
            publisher="Healthline",
            excerpt="Dentcraft Clinic leads Instagram Reels.",
            key_takeaway="Reels leader",
            relevance_score=0.95,
        )
    ]

    extracted_pages = [
        {
            "url": "https://punedentistry.example.com/competitors",
            "title": "Leading Clinics",
            "raw_content": "Dentcraft Clinic posts daily Before/After smile makeovers using POV macro camera angles.",
            "status": "extracted_tavily",
        }
    ]

    synthesis = _mock_synthesis(
        competitors=[
            CompetitorFindingItem(
                competitor_name="Dentcraft Clinic",
                platform="instagram",
                observed_creative_angle="POV Before/After makeovers",
                observed_format="Reel",
                supporting_source_url="https://punedentistry.example.com/competitors",
            )
        ],
        findings=[
            CitedKeyFinding(
                finding="Dentcraft Clinic posts daily Before/After makeovers on Instagram.",
                source_url="https://punedentistry.example.com/competitors",
            )
        ],
    )

    with patch("app.campaign_intelligence.tools.market_research_tools.execute_query_with_fallbacks", return_value=search_hits), \
         patch("app.campaign_intelligence.tools.market_research_tools.extract_tavily", return_value=extracted_pages), \
         patch("app.campaign_intelligence.specialists.market_research_adapter.get_llm") as mock_get_llm, \
         patch("app.campaign_intelligence.specialists.market_research_adapter.invoke_structured_llm", return_value=synthesis):

        mock_llm = MagicMock()
        mock_llm.bind_tools.return_value = mock_llm
        mock_llm.ainvoke = AsyncMock(side_effect=[
            AIMessage(content="", tool_calls=[{"name": "web_search", "args": {"query": "q"}, "id": "c1"}]),
            AIMessage(content="", tool_calls=[{"name": "extract_webpages", "args": {"urls": ["https://punedentistry.example.com/competitors"]}, "id": "c2"}]),
            AIMessage(content="Done"),
        ])
        mock_get_llm.return_value = mock_llm

        result = await adapter.execute("Analyze competitors", context, AsyncMock())

    comp = result.artifact_payload["observed_competitors"][0]
    assert comp["competitor_name"] == "Dentcraft Clinic"
    assert "1 deeply inspected pages" in result.reply
    assert "[source](https://punedentistry.example.com/competitors)" in result.reply


# ===========================================================================
# 4. Fabricated Citation URLs
# ===========================================================================

@pytest.mark.asyncio
async def test_fabricated_citation_url_rejected_and_labeled_unverified():
    """A finding citing a fabricated URL not returned by any tool must be marked [UNVERIFIED HYPOTHESIS]."""
    context = _build_test_context()
    adapter = MarketResearchSpecialistAdapter()

    search_hits = [
        ResearchEvidence(
            source_title="Real Source",
            source_url="https://real.example.com/article",
            publisher="Real Pub",
            excerpt="Real dental research excerpt.",
            key_takeaway="real",
            relevance_score=0.9,
        )
    ]

    synthesis = _mock_synthesis(
        findings=[
            CitedKeyFinding(
                finding="Dental veneer costs dropped 50% across Maharashtra.",
                source_url="https://fabricated-hallucination-blog.org/fake-post",  # FABRICATED!
            )
        ]
    )

    with patch("app.campaign_intelligence.tools.market_research_tools.execute_query_with_fallbacks", return_value=search_hits), \
         patch("app.campaign_intelligence.specialists.market_research_adapter.get_llm") as mock_get_llm, \
         patch("app.campaign_intelligence.specialists.market_research_adapter.invoke_structured_llm", return_value=synthesis):

        mock_llm = MagicMock()
        mock_llm.bind_tools.return_value = mock_llm
        mock_llm.ainvoke = AsyncMock(side_effect=[
            AIMessage(content="", tool_calls=[{"name": "web_search", "args": {"query": "q"}, "id": "c1"}]),
            AIMessage(content="Done"),
        ])
        mock_get_llm.return_value = mock_llm

        result = await adapter.execute("Check veneer pricing", context, AsyncMock())

    # In reply, no citation link to fabricated URL must appear
    assert "https://fabricated-hallucination-blog.org" not in result.reply
    # Finding must be labeled unverified hypothesis
    assert "[UNVERIFIED HYPOTHESIS]" in result.reply


# ===========================================================================
# 5. Retrieved but Unrelated Citation URLs
# ===========================================================================

@pytest.mark.asyncio
async def test_retrieved_unrelated_citation_url_rejected_and_labeled_unverified():
    """A finding citing a retrieved URL whose content has zero topical relation to the finding is marked unverified."""
    context = _build_test_context()
    adapter = MarketResearchSpecialistAdapter()

    # Retrieved source is about dental clinics in Pune
    search_hits = [
        ResearchEvidence(
            source_title="Pune Cosmetic Dental Directory",
            source_url="https://dentistry.example.com/pune",
            publisher="Directory",
            excerpt="Laser teeth whitening and veneer consultations in Koregaon Park.",
            key_takeaway="teeth whitening",
            relevance_score=0.9,
        )
    ]

    # Finding asserts aerospace engine fuel efficiency — totally unrelated to the dental source!
    synthesis = _mock_synthesis(
        findings=[
            CitedKeyFinding(
                finding="Commercial aerospace engines show 15% increase in fuel efficiency.",
                source_url="https://dentistry.example.com/pune",  # RETRIEVED BUT COMPLETELY UNRELATED!
            )
        ]
    )

    with patch("app.campaign_intelligence.tools.market_research_tools.execute_query_with_fallbacks", return_value=search_hits), \
         patch("app.campaign_intelligence.specialists.market_research_adapter.get_llm") as mock_get_llm, \
         patch("app.campaign_intelligence.specialists.market_research_adapter.invoke_structured_llm", return_value=synthesis):

        mock_llm = MagicMock()
        mock_llm.bind_tools.return_value = mock_llm
        mock_llm.ainvoke = AsyncMock(side_effect=[
            AIMessage(content="", tool_calls=[{"name": "web_search", "args": {"query": "q"}, "id": "c1"}]),
            AIMessage(content="Done"),
        ])
        mock_get_llm.return_value = mock_llm

        result = await adapter.execute("Research aerospace efficiency", context, AsyncMock())

    # Must NOT attach the unrelated dental citation to the aerospace finding!
    assert "[source](https://dentistry.example.com/pune)" not in result.reply
    # Finding must be labeled unverified hypothesis
    assert "[UNVERIFIED HYPOTHESIS]" in result.reply


# ===========================================================================
# 6. Valid Citation Normalization
# ===========================================================================

@pytest.mark.asyncio
async def test_valid_citation_normalization_accepted():
    """Harmless normalization differences (fragments, trailing slashes) match canonical evidence."""
    context = _build_test_context()
    adapter = MarketResearchSpecialistAdapter()

    search_hits = [
        ResearchEvidence(
            source_title="Pune Dental Veneers Guide",
            source_url="https://dentistry.example.com/veneers",
            publisher="Dental Guide",
            excerpt="Cosmetic dental veneer procedures in Pune average 3 appointments.",
            key_takeaway="3 appointments",
            relevance_score=0.9,
        )
    ]

    # LLM returns URL with fragment and trailing slash
    synthesis = _mock_synthesis(
        findings=[
            CitedKeyFinding(
                finding="Cosmetic dental veneer procedures in Pune typically take three appointments.",
                source_url="https://dentistry.example.com/veneers#cost-section/",  # Harmless fragment/slash
            )
        ]
    )

    with patch("app.campaign_intelligence.tools.market_research_tools.execute_query_with_fallbacks", return_value=search_hits), \
         patch("app.campaign_intelligence.specialists.market_research_adapter.get_llm") as mock_get_llm, \
         patch("app.campaign_intelligence.specialists.market_research_adapter.invoke_structured_llm", return_value=synthesis):

        mock_llm = MagicMock()
        mock_llm.bind_tools.return_value = mock_llm
        mock_llm.ainvoke = AsyncMock(side_effect=[
            AIMessage(content="", tool_calls=[{"name": "web_search", "args": {"query": "q"}, "id": "c1"}]),
            AIMessage(content="Done"),
        ])
        mock_get_llm.return_value = mock_llm

        result = await adapter.execute("Check veneer duration", context, AsyncMock())

    # Canonical URL must be cited cleanly
    assert "[source](https://dentistry.example.com/veneers)" in result.reply
    assert "[UNVERIFIED HYPOTHESIS]" not in result.reply


# ===========================================================================
# 7. Unsafe URLs and Unsafe Redirects
# ===========================================================================

class TestUrlSafetyAndRedirects:
    def test_localhost_rejected(self):
        assert _is_safe_url("http://localhost/admin") is False
        assert _is_safe_url("http://localhost:8080/data") is False

    def test_private_ipv4_addresses_rejected(self):
        assert _is_safe_url("http://192.168.1.1/router") is False
        assert _is_safe_url("http://10.0.0.1/internal") is False
        assert _is_safe_url("http://172.16.0.1/intranet") is False

    def test_loopback_addresses_rejected(self):
        assert _is_safe_url("http://127.0.0.1/secret") is False
        assert _is_safe_url("http://[::1]/secret") is False

    def test_internal_hostnames_rejected(self):
        assert _is_safe_url("http://api.internal/v1") is False
        assert _is_safe_url("http://service.local/data") is False
        assert _is_safe_url("http://server.lan/metrics") is False
        assert _is_safe_url("https://agencyos.internal/research-evidence") is False

    def test_public_hostname_resolving_to_private_address_rejected_via_mock_dns(self):
        """DNS rebinding / SSRF: domain name resolves to private 10.x address."""
        # Mock socket.getaddrinfo to return a private IP for a domain name
        mock_addr_info = [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("10.0.0.5", 80))]
        with patch("socket.getaddrinfo", return_value=mock_addr_info):
            assert _is_safe_url("https://attacker-domain.com/secret") is False

    @pytest.mark.asyncio
    async def test_unsafe_redirect_blocked_before_request(self):
        """When an external URL redirects to an internal/private address, the redirect is blocked before request."""
        # Simulate public URL returning a 302 redirect to localhost
        mock_resp_302 = MagicMock()
        mock_resp_302.is_redirect = True
        mock_resp_302.headers = {"location": "http://127.0.0.1/admin"}

        called_urls: list[str] = []

        async def fake_get(url, **kwargs):
            called_urls.append(url)
            return mock_resp_302

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client.get = AsyncMock(side_effect=fake_get)
            mock_client_cls.return_value = mock_client

            results = await extract_tavily(["https://safe-public.example.com/page"], api_key="")

        # The public URL was attempted, but the redirect destination (127.0.0.1) was NEVER fetched
        assert "http://127.0.0.1/admin" not in called_urls
        # The result records skipped_unsafe_redirect
        skipped = [r for r in results if r["status"] == "skipped_unsafe_redirect"]
        assert len(skipped) == 1
        assert skipped[0]["raw_content"] == ""


# ===========================================================================
# 8. Runtime Timeout
# ===========================================================================

@pytest.mark.asyncio
async def test_runtime_timeout_handled_honestly():
    """When BoundedToolRuntime hits a timeout, the reply discloses timeout and does not claim success."""
    context = _build_test_context()
    adapter = MarketResearchSpecialistAdapter()

    search_hits = [
        ResearchEvidence(
            source_title="Initial Search",
            source_url="https://initial.example.com/hit",
            publisher="Pub",
            excerpt="Observation gathered before timeout.",
            key_takeaway="kta",
            relevance_score=0.9,
        )
    ]

    mock_timeout_result = ToolExecutionResult(
        status=ExecutionStatus.TIMEOUT,
        total_turns=2,
        total_tool_calls=2,
        successful_tool_calls=1,
        failed_tool_calls=1,
        has_incomplete_execution=True,
        telemetry=[
            ToolCallTelemetry(
                call_id="c1", tool_name="web_search",
                status=ToolCallStatus.SUCCESS,
                duration_ms=500, cost_units_reserved=10, cost_units_consumed=10,
            ),
            ToolCallTelemetry(
                call_id="c2", tool_name="extract_webpages",
                status=ToolCallStatus.TIMEOUT,
                duration_ms=12000, cost_units_reserved=15, cost_units_consumed=0,
                error_message="Per-tool timeout exceeded",
            ),
        ],
        observations=[],
    )

    synthesis = _mock_synthesis(
        findings=[CitedKeyFinding(finding="Observation gathered before timeout.", source_url="https://initial.example.com/hit")]
    )

    from app.campaign_intelligence.runtime.bounded_runtime import BoundedToolRuntime

    with patch.object(BoundedToolRuntime, "run", new_callable=AsyncMock, return_value=mock_timeout_result), \
         patch("app.campaign_intelligence.specialists.market_research_adapter.invoke_structured_llm", return_value=synthesis), \
         patch("app.campaign_intelligence.specialists.market_research_adapter.get_llm", return_value=MagicMock()):

        # Add the observation from the first tool manually to simulate partial gathering
        from app.campaign_intelligence.runtime.schemas import ToolObservation
        mock_timeout_result.observations = [
            ToolObservation(
                tool_call_id="c1",
                tool_name="web_search",
                status=ToolCallStatus.SUCCESS,
                data={"results": [{"title": "Initial", "url": "https://initial.example.com/hit", "snippet": "Observation gathered before timeout."}]},
            )
        ]

        result = await adapter.execute("Research with timeout", context, AsyncMock())

    # Must disclose partial/incomplete execution
    assert "Incomplete research" in result.reply or "Partial execution" in result.reply or "timeout" in result.reply.lower()
    assert result.artifact_payload["search_limitations"] is not None


# ===========================================================================
# 9. Runtime Budget Exhaustion
# ===========================================================================

@pytest.mark.asyncio
async def test_runtime_budget_exhaustion_handled_honestly():
    """When budget is exhausted, partial status is reported honestly."""
    context = _build_test_context()
    adapter = MarketResearchSpecialistAdapter()

    mock_budget_result = ToolExecutionResult(
        status=ExecutionStatus.BUDGET_EXHAUSTED,
        total_turns=3,
        total_tool_calls=3,
        successful_tool_calls=2,
        failed_tool_calls=1,
        has_incomplete_execution=True,
        telemetry=[
            ToolCallTelemetry(call_id="c1", tool_name="web_search", status=ToolCallStatus.SUCCESS, duration_ms=200, cost_units_reserved=10, cost_units_consumed=10),
            ToolCallTelemetry(call_id="c2", tool_name="extract_webpages", status=ToolCallStatus.BUDGET_EXCEEDED, duration_ms=0, cost_units_reserved=0, cost_units_consumed=0),
        ],
        observations=[],
    )

    synthesis = _mock_synthesis()
    from app.campaign_intelligence.runtime.bounded_runtime import BoundedToolRuntime

    with patch.object(BoundedToolRuntime, "run", new_callable=AsyncMock, return_value=mock_budget_result), \
         patch("app.campaign_intelligence.specialists.market_research_adapter.invoke_structured_llm", return_value=synthesis), \
         patch("app.campaign_intelligence.specialists.market_research_adapter.get_llm", return_value=MagicMock()):

        result = await adapter.execute("Research with budget limit", context, AsyncMock())

    assert "Incomplete research" in result.reply or "budget" in result.reply.lower() or "budget_exhausted" in result.reply.lower()


# ===========================================================================
# 10. Runtime Provider / Tool Failure
# ===========================================================================

@pytest.mark.asyncio
async def test_runtime_provider_failure_handled_honestly():
    """When runtime hits a provider failure, it is classified as failed and reported honestly."""
    context = _build_test_context()
    adapter = MarketResearchSpecialistAdapter()

    mock_failed_result = ToolExecutionResult(
        status=ExecutionStatus.PROVIDER_FAILURE,
        total_turns=1,
        total_tool_calls=0,
        successful_tool_calls=0,
        failed_tool_calls=0,
        telemetry=[],
        observations=[],
    )

    synthesis = _mock_synthesis()
    from app.campaign_intelligence.runtime.bounded_runtime import BoundedToolRuntime

    with patch.object(BoundedToolRuntime, "run", new_callable=AsyncMock, return_value=mock_failed_result), \
         patch("app.campaign_intelligence.specialists.market_research_adapter.invoke_structured_llm", return_value=synthesis), \
         patch("app.campaign_intelligence.specialists.market_research_adapter.get_llm", return_value=MagicMock()):

        result = await adapter.execute("Research with provider failure", context, AsyncMock())

    # Must report failed execution
    assert "Research execution failed" in result.reply or "failed" in result.reply.lower()
    assert "provider_failure" in result.reply.lower() or "failed" in result.artifact_payload["search_limitations"].lower()


# ===========================================================================
# 11. Partial Research Response Discloses Issues
# ===========================================================================

@pytest.mark.asyncio
async def test_partial_research_response_discloses_issues():
    """Partial research banner discloses which tools failed."""
    context = _build_test_context()
    adapter = MarketResearchSpecialistAdapter()

    mock_partial_result = ToolExecutionResult(
        status=ExecutionStatus.NORMAL_COMPLETION,
        total_turns=2,
        total_tool_calls=2,
        successful_tool_calls=1,
        failed_tool_calls=1,
        has_incomplete_execution=True,
        telemetry=[
            ToolCallTelemetry(call_id="c1", tool_name="web_search", status=ToolCallStatus.SUCCESS, duration_ms=200, cost_units_reserved=10, cost_units_consumed=10),
            ToolCallTelemetry(call_id="c2", tool_name="extract_webpages", status=ToolCallStatus.TOOL_ERROR, duration_ms=100, cost_units_reserved=15, cost_units_consumed=0, error_message="HTTP 500 upstream"),
        ],
        observations=[],
    )

    synthesis = _mock_synthesis()
    from app.campaign_intelligence.runtime.bounded_runtime import BoundedToolRuntime

    with patch.object(BoundedToolRuntime, "run", new_callable=AsyncMock, return_value=mock_partial_result), \
         patch("app.campaign_intelligence.specialists.market_research_adapter.invoke_structured_llm", return_value=synthesis), \
         patch("app.campaign_intelligence.specialists.market_research_adapter.get_llm", return_value=MagicMock()):

        result = await adapter.execute("Partial run", context, AsyncMock())

    assert "Incomplete research" in result.reply
    assert "extract_webpages" in result.reply


# ===========================================================================
# 12. Successful Research Response Clean Presentation
# ===========================================================================

@pytest.mark.asyncio
async def test_successful_research_response_clean_presentation():
    """Successful execution without errors presents findings cleanly without error banners."""
    context = _build_test_context()
    adapter = MarketResearchSpecialistAdapter()

    search_hits = [
        ResearchEvidence(
            source_title="Dental Trends",
            source_url="https://dental-trends.example.com/2026",
            publisher="Dental Review",
            excerpt="Invisalign demand increased among young adults in Pune.",
            key_takeaway="Invisalign demand",
            relevance_score=0.92,
        )
    ]

    mock_clean_result = ToolExecutionResult(
        status=ExecutionStatus.NORMAL_COMPLETION,
        total_turns=2,
        total_tool_calls=1,
        successful_tool_calls=1,
        failed_tool_calls=0,
        has_incomplete_execution=False,
        telemetry=[
            ToolCallTelemetry(call_id="c1", tool_name="web_search", status=ToolCallStatus.SUCCESS, duration_ms=200, cost_units_reserved=10, cost_units_consumed=10)
        ],
        observations=[
            from_obs := __import__("app.campaign_intelligence.runtime.schemas", fromlist=["ToolObservation"]).ToolObservation(
                tool_call_id="c1",
                tool_name="web_search",
                status=ToolCallStatus.SUCCESS,
                data={"results": [{"title": "Dental Trends", "url": "https://dental-trends.example.com/2026", "snippet": "Invisalign demand increased among young adults in Pune."}]},
            )
        ],
    )

    synthesis = _mock_synthesis(
        findings=[
            CitedKeyFinding(
                finding="Invisalign demand increased among young adults in Pune.",
                source_url="https://dental-trends.example.com/2026",
            )
        ]
    )

    from app.campaign_intelligence.runtime.bounded_runtime import BoundedToolRuntime

    with patch.object(BoundedToolRuntime, "run", new_callable=AsyncMock, return_value=mock_clean_result), \
         patch("app.campaign_intelligence.specialists.market_research_adapter.invoke_structured_llm", return_value=synthesis), \
         patch("app.campaign_intelligence.specialists.market_research_adapter.get_llm", return_value=MagicMock()):

        result = await adapter.execute("Trends for Invisalign", context, AsyncMock())

    # No error or warning banners
    assert "⚠️" not in result.reply
    assert "ℹ️" not in result.reply
    assert "Incomplete research" not in result.reply
    # Verified inline citation rendered
    assert "[source](https://dental-trends.example.com/2026)" in result.reply


# ===========================================================================
# Platform Documentation Tool Tests
# ===========================================================================

@pytest.mark.asyncio
async def test_platform_documentation_tool_registered_and_clean():
    """Verify tool is registered as get_platform_documentation with factual documentation only."""
    registry = get_market_research_tool_registry()
    tool = registry.get_tool("get_platform_documentation")
    assert tool is not None
    assert "benchmark" not in tool.name

    ctx = _make_ctx()
    res = await platform_documentation_handler(PlatformDocumentationInput(platforms=["instagram", "linkedin", "youtube"]), ctx)
    assert len(res["benchmarks"]) >= 3

    # Verify zero stale numerical claims
    forbidden_numbers = ["90 seconds", "60 seconds", "15 minutes", "10 photos", "3x more", "40% higher"]
    for b in res["benchmarks"]:
        text = f"{b.get('retention_benchmark', '')} {b.get('key_takeaway', '')}"
        for num in forbidden_numbers:
            assert num not in text


@pytest.mark.asyncio
async def test_brand_context_tool_tenant_isolation():
    studio_ctx = _build_test_context()
    ctx = ToolExecutionContext(
        agency_id=studio_ctx.agency_id,
        client_id=studio_ctx.client_id,
        campaign_id=studio_ctx.campaign_id,
        specialist_id="market_research",
        studio_context=studio_ctx,
    )
    res = await brand_context_handler(BrandContextToolInput(), ctx)
    assert res["client_name"] == "SmileCraft Dental Studio"
    assert res["location"] == "Pune, Maharashtra"
    assert "Clinical Authority" in res["brand_voice"]
    assert "Painless laser dentistry" in res["confirmed_facts"][0]


@pytest.mark.asyncio
async def test_web_search_tool_execution():
    ctx = _make_ctx()
    mock_evidence = [ResearchEvidence(
        source_title="Top Dental Clinics in Pune 2026",
        source_url="https://punebusiness.example.com/dentists",
        publisher="Pune Business Directory",
        excerpt="Elite Dental and The Dental Hub lead cosmetic dentistry in Pune.",
        key_takeaway="Elite Dental commands 40% local social share.",
        relevance_score=0.92,
    )]

    with patch("app.campaign_intelligence.tools.market_research_tools.execute_query_with_fallbacks", return_value=mock_evidence):
        res = await web_search_handler(WebSearchInput(query="Pune dental clinics", search_depth="basic"), ctx)

    assert res["result_count"] == 1
    assert res["results"][0]["url"] == "https://punebusiness.example.com/dentists"


@pytest.mark.asyncio
async def test_extract_webpages_tool_execution():
    ctx = _make_ctx()
    mock_pages = [{
        "url": "https://punebusiness.example.com/dentists",
        "title": "Pune Cosmetic Clinics Deep Dive",
        "raw_content": "Detailed case study on how local clinics run Before & After video ads.",
        "status": "extracted_tavily",
    }]

    with patch("app.campaign_intelligence.tools.market_research_tools.extract_tavily", return_value=mock_pages):
        res = await extract_webpages_handler(
            ExtractWebpagesInput(urls=["https://punebusiness.example.com/dentists"]), ctx
        )

    assert res["extracted_count"] == 1
    assert res["pages"][0]["title"] == "Pune Cosmetic Clinics Deep Dive"


@pytest.mark.asyncio
async def test_recent_trend_investigation_with_recency_days():
    ctx = _make_ctx()
    with patch("app.campaign_intelligence.tools.market_research_tools.execute_query_with_fallbacks") as mock_exec:
        mock_exec.return_value = [ResearchEvidence(
            source_title="Fitness Trends",
            source_url="https://fitness.example.com",
            publisher="Fitness Mag",
            excerpt="Micro-workouts gaining traction.",
            key_takeaway="trending",
            relevance_score=0.9,
        )]
        res = await web_search_handler(WebSearchInput(query="Indian fitness viral reels", days=30, search_depth="advanced"), ctx)

    mock_exec.assert_called_once_with(query="Indian fitness viral reels", max_results=5, search_depth="advanced", days=30)
    assert res["result_count"] == 1


# ===========================================================================
# 8. Regression Suite: Context Isolation, Tool Quotas & Claim Validation
# ===========================================================================

class TestScopeClassification:
    def test_scope_classification_client_scoped(self):
        adapter = MarketResearchSpecialistAdapter()
        # Queries referencing client explicitly
        assert adapter._classify_research_scope("Find competitors for my client in Pune", "Shorevada") == "CLIENT_SCOPED"
        assert adapter._classify_research_scope("Find competitors around our location", "Shorevada") == "CLIENT_SCOPED"
        assert adapter._classify_research_scope("What are our brand weaknesses?", "Shorevada") == "CLIENT_SCOPED"
        assert adapter._classify_research_scope("Analyze rivals for Hotel Shauryawada", "Hotel Shauryawada") == "CLIENT_SCOPED"

    def test_scope_classification_independent_research(self):
        adapter = MarketResearchSpecialistAdapter()
        # The 3 user test queries
        q1 = "Analyze the competitive landscape for an artisanal specialty coffee brand launching in Pune and Mumbai (competing with Blue Tokai, Subko, and Third Wave Coffee)."
        q2 = "Analyze top-performing Instagram and YouTube content formats for upscale Maharashtrian & coastal dining in Maharashtra over the past 6 months."
        q3 = "Perform a market gap analysis on fast-casual health and fitness meal-prep delivery services in Pune (areas like Koregaon Park, Kalyani Nagar, Baner)."

        assert adapter._classify_research_scope(q1, "Hotel Shauryawada") == "INDEPENDENT_RESEARCH"
        assert adapter._classify_research_scope(q2, "Hotel Shauryawada") == "INDEPENDENT_RESEARCH"
        assert adapter._classify_research_scope(q3, "Hotel Shauryawada") == "INDEPENDENT_RESEARCH"


class TestContextIsolationRegression:
    @pytest.mark.asyncio
    async def test_three_test_queries_isolate_client_context(self):
        """Verify the 3 test queries do not inherit Hotel Shauryawada or Handewadi client context."""
        adapter = MarketResearchSpecialistAdapter()

        # Build context representing Hotel Shauryawada with Handewadi location and a prior thali artifact
        prior_payload = {
            "query_topic": "Maharashtrian thali competitors in Handewadi",
            "observed_competitors": [
                {
                    "competitor_name": "Maratha Samrat",
                    "platform": "instagram",
                    "observed_creative_angle": "Unlimited thali offer",
                    "citation": {"source_url": "https://marathasamrat.example.com"},
                }
            ],
            "verified_sources": [
                {"source_title": "Pune Thali Guide", "source_url": "https://thali.example.com"}
            ],
        }
        context = _build_test_context(
            client_name="Hotel Shauryawada",
            location="Katraj Bypass Road, Handewadi, Pune",
            active_artifact_type="research_evidence",
            active_artifact_payload=prior_payload,
        )

        test_queries = [
            "Analyze the competitive landscape for an artisanal specialty coffee brand launching in Pune and Mumbai (competing with Blue Tokai, Subko, and Third Wave Coffee).",
            "Analyze top-performing Instagram and YouTube content formats for upscale Maharashtrian & coastal dining in Maharashtra over the past 6 months.",
            "Perform a market gap analysis on fast-casual health and fitness meal-prep delivery services in Pune (areas like Koregaon Park, Kalyani Nagar, Baner).",
        ]

        captured_system_prompts: list[str] = []
        captured_synthesis_prompts: list[str] = []

        search_hits = [
            ResearchEvidence(
                source_title="Generic Market Insight",
                source_url="https://market.example.com/insight",
                publisher="Industry Report",
                excerpt="Strong market growth observed across urban centers.",
                key_takeaway="Growth",
                relevance_score=0.9,
            )
        ]

        synthesis = _mock_synthesis(
            findings=[
                CitedKeyFinding(
                    finding="Market shows expanding consumer interest.",
                    source_url="https://market.example.com/insight",
                )
            ]
        )

        for q in test_queries:
            with patch("app.campaign_intelligence.tools.market_research_tools.execute_query_with_fallbacks", return_value=search_hits), \
                 patch("app.campaign_intelligence.specialists.market_research_adapter.get_llm") as mock_get_llm, \
                 patch("app.campaign_intelligence.specialists.market_research_adapter.invoke_structured_llm", return_value=synthesis) as mock_syn:

                mock_llm = MagicMock()
                mock_llm.bind_tools.return_value = mock_llm
                mock_llm.ainvoke = AsyncMock(side_effect=[
                    AIMessage(content="", tool_calls=[{"name": "web_search", "args": {"query": "sample"}, "id": "c1"}]),
                    AIMessage(content="Summary of findings."),
                ])
                mock_get_llm.return_value = mock_llm

                result = await adapter.execute(q, context, AsyncMock())

                # Grab the system prompt passed to BoundedToolRuntime
                call_args = mock_llm.ainvoke.call_args_list[0][0][0]
                sys_prompt = call_args[0].content
                captured_system_prompts.append(sys_prompt)

                # Grab the synthesis prompt passed to invoke_structured_llm
                syn_prompt = mock_syn.call_args.kwargs["prompt"]
                captured_synthesis_prompts.append(syn_prompt)

                # Assert that neither Shauryawada nor Handewadi leaked into the prompts or reply
                assert "Hotel Shauryawada" not in sys_prompt
                assert "Handewadi" not in sys_prompt
                assert "Maratha Samrat" not in sys_prompt  # Prior artifact discarded

                assert "Hotel Shauryawada" not in syn_prompt
                assert "Handewadi" not in syn_prompt
                assert "Maratha Samrat" not in syn_prompt

                assert "Hotel Shauryawada" not in result.reply
                assert "Handewadi" not in result.reply


class TestPerToolQuotas:
    @pytest.mark.asyncio
    async def test_per_tool_quota_exhaustion_enforced_in_runtime(self):
        """Verify that BoundedToolRuntime deterministically enforces per_tool_max_calls."""
        from app.campaign_intelligence.runtime.bounded_runtime import BoundedToolRuntime
        from app.campaign_intelligence.runtime.schemas import ToolRuntimeConfig, ToolExecutionContext, ToolCallStatus
        from app.campaign_intelligence.tools.market_research_tools import get_market_research_tool_registry

        registry = get_market_research_tool_registry()
        # Set web_search quota = 2, extract_webpages = 2
        config = ToolRuntimeConfig(
            max_turns=6,
            max_total_tool_calls=6,
            per_tool_max_calls={"web_search": 2, "extract_webpages": 2},
        )
        runtime = BoundedToolRuntime(registry=registry, config=config)

        # Mock LLM requesting 3 web_search calls in a row, then 1 extract_webpages call
        mock_llm = MagicMock()
        mock_llm.bind_tools.return_value = mock_llm
        mock_llm.ainvoke = AsyncMock(side_effect=[
            AIMessage(content="", tool_calls=[
                {"name": "web_search", "args": {"query": "q1"}, "id": "call_1"},
                {"name": "web_search", "args": {"query": "q2"}, "id": "call_2"},
                {"name": "web_search", "args": {"query": "q3"}, "id": "call_3"},
            ]),
            AIMessage(content="", tool_calls=[
                {"name": "extract_webpages", "args": {"urls": ["https://example.com"]}, "id": "call_4"},
            ]),
            AIMessage(content="Final summary after tools."),
        ])

        search_hits = [
            ResearchEvidence(
                source_title="Test", source_url="https://example.com", publisher="Pub",
                excerpt="content", key_takeaway="k", relevance_score=0.9
            )
        ]
        pages = [{"url": "https://example.com", "title": "Page", "raw_content": "Full page text", "status": "ok"}]

        exec_ctx = ToolExecutionContext(
            agency_id=uuid.uuid4(),
            client_id=uuid.uuid4(),
            campaign_id=uuid.uuid4(),
            specialist_id="market_research",
        )

        with patch("app.campaign_intelligence.tools.market_research_tools.execute_query_with_fallbacks", return_value=search_hits), \
             patch("app.campaign_intelligence.tools.market_research_tools.extract_tavily", return_value=pages):
            res = await runtime.run([HumanMessage(content="test")], exec_ctx, llm=mock_llm)

        # Call 1 & 2 succeeded for web_search
        assert res.telemetry[0].status == ToolCallStatus.SUCCESS
        assert res.telemetry[1].status == ToolCallStatus.SUCCESS

        # Call 3 exceeded the per-tool quota of 2 for web_search -> deterministically rejected!
        assert res.telemetry[2].status == ToolCallStatus.TOOL_QUOTA_EXHAUSTED
        assert "quota" in res.telemetry[2].error_message.lower()

        # Call 4 for extract_webpages was allowed because extract_webpages had not exhausted its quota!
        assert res.telemetry[3].status == ToolCallStatus.SUCCESS


class TestClaimToSourceValidation:
    def test_pricing_claim_requires_inspected_page(self):
        """Pricing claims citing search snippets only must be flagged as preliminary."""
        adapter = MarketResearchSpecialistAdapter()

        canonical_url = "https://competitor.example.com/pricing"
        snippet_cite = EvidenceCitation(
            source_title="Competitor Pricing",
            source_url=canonical_url,
            publisher="Snippet Directory",
            excerpt="Plans start from ₹270 per person unlimited.",
            is_direct_quote=False,
        )

        verified_map = {canonical_url: snippet_cite}
        inspected_map = {}  # Empty: page was NOT deeply inspected

        findings = [
            CitedKeyFinding(
                finding="Competitor offers unlimited thali for ₹270 per person.",
                source_url=canonical_url,
            )
        ]

        validated = adapter._validate_key_findings(
            findings=findings,
            all_verified_urls={canonical_url},
            verified_sources_map=verified_map,
            inspected_sources_map=inspected_map,
        )

        assert len(validated) == 1
        # Because pricing was only in a snippet, it must be flagged as preliminary snippet
        assert "[PRELIMINARY SNIPPET - UNVERIFIED PAGE CONTENT]" in validated[0].finding

    def test_pricing_claim_on_inspected_page_is_verified(self):
        """Pricing claims supported by an inspected page are accepted cleanly."""
        adapter = MarketResearchSpecialistAdapter()

        canonical_url = "https://competitor.example.com/pricing"
        page_cite = EvidenceCitation(
            source_title="Competitor Official Menu",
            source_url=canonical_url,
            publisher="competitor.example.com",
            excerpt="Our executive thali package is ₹270 per person with unlimited refills.",
            is_direct_quote=True,
        )

        verified_map = {canonical_url: page_cite}
        inspected_map = {canonical_url: page_cite}  # Page WAS deeply inspected

        findings = [
            CitedKeyFinding(
                finding="Competitor offers executive thali package for ₹270 per person.",
                source_url=canonical_url,
            )
        ]

        validated = adapter._validate_key_findings(
            findings=findings,
            all_verified_urls={canonical_url},
            verified_sources_map=verified_map,
            inspected_sources_map=inspected_map,
        )

        assert len(validated) == 1
        assert "[PRELIMINARY" not in validated[0].finding
        assert "[UNVERIFIED" not in validated[0].finding
        assert validated[0].source_url == canonical_url


class TestResearchAccountingAndDimensions:
    """Verifies rigorous 3-metric source accounting and research dimension tracking."""

    def test_research_dimensions_tracking_renders_in_reply(self):
        """Dimensions tracking shows answered (verified), partial, and missing items."""
        from app.campaign_intelligence.collaboration.schemas import (
            ResearchDimensionItem,
            ResearchDimensionStatus,
        )

        synthesis = MarketResearchSynthesisOutput(
            executive_summary="Executive summary on coffee market.",
            key_findings=[
                CitedKeyFinding(
                    finding="Blue Tokai offers subscriptions from ₹250.",
                    source_url="https://bluetokaicoffee.com/subscriptions",
                )
            ],
            research_dimensions=[
                ResearchDimensionItem(
                    dimension="Blue Tokai Pricing & Subscriptions",
                    status=ResearchDimensionStatus.ANSWERED,
                    summary="Inspected subscription catalog with drops at ₹250-₹600",
                ),
                ResearchDimensionItem(
                    dimension="Subko Seasonal Bundles",
                    status=ResearchDimensionStatus.PARTIAL,
                    summary="Reddit snippets mention pricing; bundles uninspected",
                ),
                ResearchDimensionItem(
                    dimension="Third Wave Coffee",
                    status=ResearchDimensionStatus.MISSING,
                    summary="Tool quota exhausted before dedicated Third Wave queries",
                ),
            ],
        )

        reply = MarketResearchSpecialistAdapter._format_reply(
            synthesis=synthesis,
            validated_competitors=[],
            validated_opportunities=[],
            claim_supported_count=1,
            inspected_count=1,
            discovered_count=10,
            health_status="ok",
            health_issues=[],
            all_verified_urls={"https://bluetokaicoffee.com/subscriptions"},
        )

        assert "### Research Scope & Dimension Tracking" in reply
        assert "✅ **Blue Tokai Pricing & Subscriptions**: Verified — Inspected subscription catalog" in reply
        assert "⚠️ **Subko Seasonal Bundles**: Partial — Reddit snippets mention pricing" in reply
        assert "❌ **Third Wave Coffee**: Missing — Tool quota exhausted" in reply
        assert "**Sources Consulted**: 10 discovered search results (1 deeply inspected pages, 9 search snippets only, 1 sources supporting specific claims)." in reply

    def test_rigorous_source_accounting_in_artifact_payload(self):
        """Artifact payload separates discovered, inspected, and claim-supported metrics."""
        from app.campaign_intelligence.collaboration.schemas import MarketResearchArtifactPayload

        payload = MarketResearchArtifactPayload(
            query_topic="Test query",
            discovered_count=22,
            inspected_count=3,
            claim_supported_count=5,
        )
        assert payload.discovered_count == 22
        assert payload.inspected_count == 3
        assert payload.claim_supported_count == 5


class TestCompactWebpageEvidenceAndDossier:
    """Tests for P0 (compact extraction), P2 (clean synthesis dossier), and P3 (runway check)."""

    def test_process_extracted_webpage_preserves_pricing_metrics_and_excerpts(self):
        """Webpage extraction strips boilerplate, extracts verbatim pricing sentences, metrics, and timestamp."""
        from app.campaign_intelligence.tools.market_research_tools import _process_extracted_webpage

        raw_page = """
        Accept all cookies | Skip to content | Cart (0)
        Blue Tokai Coffee Roasters - Attikan Estate Single Origin
        Freshly roasted 100% Arabica coffee from Biligirirangana Hills, Karnataka.
        Retail bean pricing: 250g pack is priced at ₹700 (₹280/100g) with customized roast levels.
        We also offer bi-weekly coffee subscriptions starting at ₹250 per drop with free shipping across India.
        Seasonal gift bundles start at ₹1,200 including custom ceramic mug and 2 micro-lot tasting pouches.
        Over 80+ cafes across Mumbai, Pune, Delhi NCR and Bangalore.
        Privacy policy | Terms of Service | All rights reserved 2026.
        """

        processed = _process_extracted_webpage(
            raw_content=raw_page,
            url="https://bluetokaicoffee.com/coffee/attikan",
            title="Blue Tokai Attikan Estate",
            status="extracted_tavily",
        )

        assert processed["url"] == "https://bluetokaicoffee.com/coffee/attikan"
        assert processed["title"] == "Blue Tokai Attikan Estate"
        assert processed["status"] == "extracted_tavily"
        assert processed["supports_claim"] is True
        assert processed["extracted_at"] is not None

        # Verify boilerplate was removed
        assert "cookie" not in processed["content"].lower()
        assert "skip to content" not in processed["content"].lower()

        # Verify metrics detected
        assert "₹700" in processed["extracted_metrics"]
        assert "₹280/100g" in processed["extracted_metrics"]
        assert "₹250" in processed["extracted_metrics"]

        # Verify verbatim excerpts
        assert any("₹700" in ex and "₹280/100g" in ex for ex in processed["key_excerpts"])
        assert any("₹1,200" in ex for ex in processed["key_excerpts"])

    @pytest.mark.asyncio
    async def test_extract_webpages_handler_returns_structured_evidence(self):
        """extract_webpages_handler returns rich structured evidence dictionaries."""
        from app.campaign_intelligence.tools.market_research_tools import (
            extract_webpages_handler,
            ExtractWebpagesInput,
        )

        ctx = _make_ctx()
        mock_pages = [{
            "url": "https://subko.coffee/products/roast",
            "title": "Subko Speciality Coffee",
            "raw_content": "Subko microlot coffee beans starting at ₹495 with direct estate sourcing.",
            "status": "extracted_tavily",
        }]

        with patch("app.campaign_intelligence.tools.market_research_tools.extract_tavily", return_value=mock_pages):
            res = await extract_webpages_handler(
                ExtractWebpagesInput(urls=["https://subko.coffee/products/roast"]), ctx
            )

        assert res["extracted_count"] == 1
        page = res["pages"][0]
        assert page["url"] == "https://subko.coffee/products/roast"
        assert page["title"] == "Subko Speciality Coffee"
        assert "₹495" in page["extracted_metrics"]
        assert page["supports_claim"] is True
        assert len(page["key_excerpts"]) >= 1

    @pytest.mark.asyncio
    async def test_runway_check_aborts_cleanly_when_remaining_wallclock_too_small(self):
        """Runtime aborts cleanly before launching a doomed tool call with insufficient wall-clock runway."""
        from app.campaign_intelligence.runtime.bounded_runtime import BoundedToolRuntime
        from app.campaign_intelligence.runtime.schemas import ToolRuntimeConfig, ToolCallStatus
        from app.campaign_intelligence.runtime.tool_registry import ToolRegistry, SpecialistTool
        from pydantic import BaseModel

        class DummyInput(BaseModel):
            q: str = "test"

        async def dummy_tool(args: DummyInput, ctx: Any):
            return {"ok": True}

        registry = ToolRegistry()
        registry.register_tool(SpecialistTool("dummy_tool", "desc", DummyInput, dummy_tool, {"market_research"}))

        config = ToolRuntimeConfig(
            execution_timeout_seconds=5.0,
            per_tool_timeout_seconds=4.0,
            max_turns=2,
            max_total_tool_calls=2,
        )
        runtime = BoundedToolRuntime(registry, config=config)
        ctx = _make_ctx()

        mock_llm = MagicMock()
        mock_llm.bind_tools.return_value = mock_llm
        mock_llm.ainvoke = AsyncMock(return_value=AIMessage(
            content="",
            tool_calls=[{"name": "dummy_tool", "args": {"q": "test"}, "id": "call_1"}],
        ))

        # Mock perf_counter so start_time was 3.8s ago, leaving only 1.2s (< 2.0s min_runway)
        with patch("time.perf_counter", side_effect=[0.0, 3.8, 3.8, 3.8, 3.8]):
            result = await runtime.run([HumanMessage(content="test")], ctx, llm=mock_llm)

        assert result.telemetry[0].status == ToolCallStatus.TIMEOUT
        assert "runway" in result.telemetry[0].error_message.lower()

