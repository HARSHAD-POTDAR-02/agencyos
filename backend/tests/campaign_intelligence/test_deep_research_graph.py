import pytest
from unittest.mock import AsyncMock, patch
import uuid

from app.campaign_intelligence.research.deep_research_graph import (
    DeepResearchPlan,
    DeepResearchState,
    ResearchSubTopic,
    TopicEvidence,
    build_deep_research_graph,
    route_topics,
)
from app.campaign_intelligence.specialists import SPECIALIST_REGISTRY, get_specialist_adapter
from app.campaign_intelligence.specialists.deep_research_adapter import DeepResearchSpecialistAdapter
from app.campaign_intelligence.schemas.studio_context import CampaignStudioContext
from app.campaign_intelligence.schemas.campaign import CampaignBrief
from app.campaign_intelligence.specialists.market_research_adapter import MarketResearchSpecialistAdapter


def test_deep_research_plan_schema():
    """Verify DeepResearchPlan schema properly enforces sub-topic constraints."""
    sub_topics = [
        ResearchSubTopic(
            topic_id="topic_1",
            title="Competitor Pricing",
            target_entity="Brand A",
            research_questions=["What is the pricing tier?"],
            suggested_queries=["Brand A pricing"],
            max_tool_budget=2,
        ),
        ResearchSubTopic(
            topic_id="topic_2",
            title="Customer Complaints",
            target_entity="Brand B",
            research_questions=["What are common complaints?"],
            suggested_queries=["Brand B complaints"],
            max_tool_budget=1,
        ),
    ]
    plan = DeepResearchPlan(
        plan_summary="Investigation plan for Brand A and B.",
        sub_topics=sub_topics,
    )
    assert len(plan.sub_topics) == 2
    assert plan.sub_topics[0].target_entity == "Brand A"
    assert plan.sub_topics[1].max_tool_budget == 1


def test_topic_evidence_schema():
    """Verify TopicEvidence captures findings, excerpts, and metrics."""
    ev = TopicEvidence(
        topic_id="topic_1",
        topic_title="Pricing Tiers",
        target_entity="Blue Tokai",
        findings=["Found ₹250 subscriptions"],
        key_excerpts=["Free delivery on orders above ₹350"],
        detected_metrics=["₹250", "₹350"],
        inspected_sources=["https://bluetokaicoffee.com"],
        snippet_sources=["https://coffeeprice.in"],
        status="answered",
        summary="Verified low-barrier subscription model.",
    )
    assert ev.status == "answered"
    assert "₹250" in ev.detected_metrics
    assert len(ev.key_excerpts) == 1


def test_route_topics_logic():
    """Verify route_topics conditionally routes to topic_worker or compile_report."""
    plan = DeepResearchPlan(
        plan_summary="Test plan",
        sub_topics=[
            ResearchSubTopic(
                topic_id=f"topic_{i}",
                title=f"Topic {i}",
                research_questions=["Q"],
                suggested_queries=["q"],
            )
            for i in range(3)
        ],
    )

    # Case 1: More topics remain and budget is available -> topic_worker
    state_in_progress: DeepResearchState = {
        "query": "test",
        "context": None,
        "plan": plan,
        "current_topic_idx": 1,
        "used_tool_budget": 2,
        "max_global_budget": 6,
        "topic_evidences": [],
        "discovered_sources": {},
        "inspected_sources": {},
        "synthesis": None,
        "final_report": "",
        "activity_logs": [],
        "on_event_fn": None,
    }
    assert route_topics(state_in_progress) == "topic_worker"

    # Case 2: All topics completed -> compile_report
    state_completed: DeepResearchState = dict(state_in_progress)
    state_completed["current_topic_idx"] = 3
    assert route_topics(state_completed) == "compile_report"

    # Case 3: Global tool budget exhausted -> compile_report
    state_budget_exhausted: DeepResearchState = dict(state_in_progress)
    state_budget_exhausted["used_tool_budget"] = 6
    assert route_topics(state_budget_exhausted) == "compile_report"


def test_deep_research_adapter_registry():
    """Verify DeepResearchSpecialistAdapter is properly registered in SPECIALIST_REGISTRY."""
    assert "deep_research" in SPECIALIST_REGISTRY
    adapter = get_specialist_adapter("deep_research")
    assert isinstance(adapter, DeepResearchSpecialistAdapter)
    assert adapter.specialist_id == "deep_research"
    assert adapter.specialist_name == "Deep Research Analyst"


def test_graph_compilation():
    """Verify build_deep_research_graph compiles without topology errors."""
    graph = build_deep_research_graph()
    assert graph is not None
    assert hasattr(graph, "ainvoke")


@pytest.mark.asyncio
async def test_market_research_routes_to_deep_research():
    """Verify MarketResearchSpecialistAdapter routes to deep research by default (without needing 'deep research' keywords)."""
    adapter = MarketResearchSpecialistAdapter()

    agency_id = uuid.uuid4()
    client_id = uuid.uuid4()
    campaign_id = uuid.uuid4()

    brief = CampaignBrief(
        client_id=client_id,
        agency_id=agency_id,
        period_month=11,
        period_year=2026,
        objective="Analyze competitors",
    )
    context = CampaignStudioContext(
        agency_id=agency_id,
        client_id=client_id,
        campaign_id=campaign_id,
        client_name="Test Agency",
        campaign_brief=brief,
    )

    with patch(
        "app.campaign_intelligence.specialists.deep_research_adapter.DeepResearchSpecialistAdapter.execute",
        new_callable=AsyncMock,
    ) as mock_deep_run:
        mock_deep_run.return_value = "mock_result"
        # 1. Plain query without mentioning "deep research" -> defaults to deep research
        res = await adapter.execute(
            query="Analyze competitors and pricing",
            context=context,
            db=AsyncMock(),
        )
        assert res == "mock_result"
        mock_deep_run.assert_called_once()


@pytest.mark.asyncio
async def test_run_deep_research_payload_serialization():
    """Verify run_deep_research correctly serializes EvidenceCitation and MarketResearchArtifactPayload."""
    from app.campaign_intelligence.research.deep_research_graph import run_deep_research
    from app.campaign_intelligence.specialists.market_research_adapter import (
        CitedKeyFinding,
        CompetitorFindingItem,
        InferredOpportunityItem,
        MarketResearchSynthesisOutput,
    )

    agency_id = uuid.uuid4()
    client_id = uuid.uuid4()
    campaign_id = uuid.uuid4()

    brief = CampaignBrief(
        client_id=client_id,
        agency_id=agency_id,
        period_month=11,
        period_year=2026,
        objective="Analyze meal delivery competitors",
    )
    context = CampaignStudioContext(
        agency_id=agency_id,
        client_id=client_id,
        campaign_id=campaign_id,
        client_name="Test Food Co",
        campaign_brief=brief,
    )

    mock_synthesis = MarketResearchSynthesisOutput(
        executive_summary="Executive overview of meal delivery.",
        key_findings=[
            CitedKeyFinding(
                finding="Healthy-O-Me offers 7, 14, and 24 day plans.",
                source_url="https://healthyome.in",
            )
        ],
        observed_competitors=[
            CompetitorFindingItem(
                competitor_name="Healthy-O-Me",
                platform="instagram",
                observed_creative_angle="Dietitian-approved 7, 14, 24-day plans",
                observed_format="Carousel Deck",
                supporting_source_url="https://healthyome.in",
                citation_quote="Healthy-O-Me is a dietitian-approved service",
            )
        ],
        inferred_opportunities=[
            InferredOpportunityItem(
                opportunity_description="Evening delivery slot whitespace",
                target_whitespace="Late night healthy snacking",
                supporting_source_urls=["https://healthyome.in"],
            )
        ],
        research_dimensions=[],
        search_limitations=None,
    )

    mock_graph_output = {
        "synthesis": mock_synthesis,
        "activity_logs": ["Scoping completed", "Compiled report"],
        "discovered_sources": {"https://healthyome.in": {"title": "Healthy-O-Me", "snippet": "Healthy meals"}},
        "inspected_sources": {"https://healthyome.in": {"title": "Healthy-O-Me Home", "summary": "Full plans"}},
    }

    with patch("app.campaign_intelligence.research.deep_research_graph.build_deep_research_graph") as mock_build:
        mock_graph = AsyncMock()
        mock_graph.ainvoke.return_value = mock_graph_output
        mock_build.return_value = mock_graph

        result = await run_deep_research(
            query="Healthy meal subscription in Pune",
            context=context,
        )

        assert result.specialist_id == "market_research"
        assert result.artifact_type.value == "research_evidence"
        payload = result.artifact_payload
        assert len(payload["observed_competitors"]) == 1
        comp = payload["observed_competitors"][0]
        assert comp["competitor_name"] == "Healthy-O-Me"
        assert comp["citation"]["source_title"] == "Healthy-O-Me"
        assert comp["citation"]["publisher"] == "healthyome.in"
        assert comp["citation"]["source_url"] == "https://healthyome.in"
        assert len(payload["inferred_opportunities"]) == 1


def test_extract_json_from_llm_handles_extra_data():
    """Verify extract_json_from_llm gracefully extracts the primary JSON object even when trailing extra data exists."""
    from app.core.llm import extract_json_from_llm

    # Case 1: Trailing conversational text after JSON
    text_with_extra = '{"executive_summary": "Great summary", "key_findings": []}\n\nHere are some extra notes: {not json}'
    res = extract_json_from_llm(text_with_extra)
    assert isinstance(res, dict)
    assert res.get("executive_summary") == "Great summary"

    # Case 2: Two JSON objects output back-to-back
    two_objects = '{"first": true}\n{"second": false}'
    res2 = extract_json_from_llm(two_objects)
    assert isinstance(res2, dict)
    assert res2.get("first") is True

    # Case 3: Code block with extra data inside
    code_block_extra = '```json\n{"report": "done"}\n{"unrelated": 123}\n```'
    res3 = extract_json_from_llm(code_block_extra)
    assert isinstance(res3, dict)
    assert res3.get("report") == "done"


def test_is_substantive_content_line_filters_navigation_and_social():
    """Verify that scrapers/nav elements like [Close Menu](#) and # Facebook are stripped."""
    from app.campaign_intelligence.tools.market_research_tools import is_substantive_content_line

    assert is_substantive_content_line("[Close Menu](#)") is False
    assert is_substantive_content_line("[Skip to content](#main)") is False
    assert is_substantive_content_line("# Facebook") is False
    assert is_substantive_content_line("# Instagram") is False
    assert is_substantive_content_line("Share on WhatsApp") is False
    assert is_substantive_content_line("Home > Pune > Restaurants") is False
    assert is_substantive_content_line("Short") is False

    valid_narrative = "Blue Tokai Coffee Roasters operates specialty cafes in Koregaon Park and provides roasted coffee subscriptions starting from ₹250."
    assert is_substantive_content_line(valid_narrative) is True


def test_select_best_url_for_topic_dynamically_prefers_entity_domain():
    """Verify dynamic entity domain prioritization over scraper directories without hardcoded names."""
    from app.campaign_intelligence.research.deep_research_graph import _select_best_url_for_topic

    search_results = [
        {"url": "https://bestmenuhub.com/subko-menu-mumbai", "title": "Subko Menu Mumbai", "content": "Menu listings", "score": 0.8},
        {"url": "https://subko.cr/collections/coffee", "title": "Subko Coffee Roasters Official", "content": "Official Subko specialty coffee beans and bakehouse offerings.", "score": 0.75},
        {"url": "https://instagram.com/subkocoffee", "title": "Subko on Instagram", "content": "Instagram photos", "score": 0.9},
    ]

    selected = _select_best_url_for_topic(
        results=search_results,
        topic_title="Subko Specialty Coffee & Bakehouse",
        target_entity="Subko Coffee",
        already_inspected=set(),
    )
    # subko.cr should be selected because entity token 'subko' is in domain netloc, beating bestmenuhub and filtered instagram
    assert selected == "https://subko.cr/collections/coffee"


def test_transient_error_detection_handles_timeout_error_objects():
    """Verify _is_transient_error returns True for asyncio.TimeoutError and TimeoutError even with empty str()."""
    import asyncio
    from app.core.llm import _is_transient_error

    timeout_err = asyncio.TimeoutError()
    assert str(timeout_err) == ""
    assert _is_transient_error(timeout_err) is True

    std_timeout = TimeoutError("Request timed out")
    assert _is_transient_error(std_timeout) is True


def test_format_brand_context_block_injects_client_identity():
    """Verify brand context block anchors client brand, category, location, and pillars."""
    from app.campaign_intelligence.research.deep_research_graph import _format_brand_context_block
    from app.campaign_intelligence.schemas.brand import BrandContext

    context = CampaignStudioContext(
        agency_id=uuid.uuid4(),
        client_id=uuid.uuid4(),
        campaign_id=uuid.uuid4(),
        client_name="Hotel Shauryawada",
        client_industry="Restaurant",
        client_location="Handewadi, Pune",
        campaign_brief=CampaignBrief(
            client_id=uuid.uuid4(),
            agency_id=uuid.uuid4(),
            period_month=11,
            period_year=2026,
            objective="Drive foot traffic for signature mutton raan",
            target_audience=["Local families and foodies in Pune"],
        ),
        brand_context=BrandContext(
            client_id=uuid.uuid4(),
            agency_id=uuid.uuid4(),
            business_name="Hotel Shauryawada",
            industry="Restaurant",
            brand_voice=["Authentic", "Hearty"],
            content_pillars=["Maharashtrian Thalis", "Mutton Raan Specials"],
            confirmed_facts=["Iconic dining restaurant in Handewadi, Pune"],
        ),
    )

    block = _format_brand_context_block(context, "what do you think are our direct and indirect competitors ?")
    assert "Hotel Shauryawada" in block
    assert "Restaurant" in block
    assert "Handewadi, Pune" in block
    assert "Mutton Raan Specials" in block
    assert "refers EXCLUSIVELY to the active client brand: Hotel Shauryawada" in block


def test_format_brand_context_block_handles_none_gracefully():
    """Verify _format_brand_context_block returns empty string when context is None or empty."""
    from app.campaign_intelligence.research.deep_research_graph import _format_brand_context_block

    assert _format_brand_context_block(None, "test") == ""


# ===========================================================================
# The 12-Item Freeze Gate Acceptance Tests
# ===========================================================================

def test_freeze_gate_01_context_resolution():
    """Gate 1: Context resolution — 'Who are our competitors?' resolves to active client brand, discarding stale coffee artifacts."""
    from app.campaign_intelligence.research.deep_research_graph import (
        _build_deep_research_prior_context,
        _resolve_research_mode,
    )
    from app.campaign_intelligence.collaboration.schemas import ResearchScopeMode

    client_context = CampaignStudioContext(
        agency_id=uuid.uuid4(),
        client_id=uuid.uuid4(),
        campaign_id=uuid.uuid4(),
        client_name="Hotel Shauryawada",
        client_industry="Restaurant",
        client_location="Handewadi, Pune",
        campaign_brief=CampaignBrief(
            client_id=uuid.uuid4(),
            agency_id=uuid.uuid4(),
            period_month=11,
            period_year=2026,
            objective="Local dining growth",
        ),
        active_artifact_type="research_evidence",
        active_artifact_payload={
            "query_topic": "Specialty Coffee Roasters Subko and Blue Tokai",
            "observed_competitors": [{"competitor_name": "Blue Tokai", "platform": "instagram", "observed_creative_angle": "Roastery tours"}],
        },
    )

    mode, is_ambiguous = _resolve_research_mode("Who are our competitors?", client_context)
    assert mode == ResearchScopeMode.CLIENT_SCOPED
    assert is_ambiguous is False

    # Stale topic isolation: Coffee artifact has zero keyword overlap with "Who are our competitors?"
    prior_ctx = _build_deep_research_prior_context(client_context, "Who are our competitors?", mode)
    assert prior_ctx == ""  # Stale coffee artifact discarded!


def test_freeze_gate_02_independent_research():
    """Gate 2: Independent research — Explicit external subjects take priority over unrelated client context."""
    from app.campaign_intelligence.research.deep_research_graph import _resolve_research_mode
    from app.campaign_intelligence.collaboration.schemas import ResearchScopeMode

    client_context = CampaignStudioContext(
        agency_id=uuid.uuid4(),
        client_id=uuid.uuid4(),
        campaign_id=uuid.uuid4(),
        client_name="Hotel Shauryawada",
        client_industry="Restaurant",
        client_location="Handewadi, Pune",
        campaign_brief=CampaignBrief(
            client_id=uuid.uuid4(),
            agency_id=uuid.uuid4(),
            period_month=11,
            period_year=2026,
            objective="Local dining growth",
        ),
    )

    query = "Conduct deep market research on specialty coffee roasters in Mumbai and Pune, specifically Blue Tokai, Subko, Third Wave Coffee"
    mode, is_ambiguous = _resolve_research_mode(query, client_context)
    assert mode == ResearchScopeMode.INDEPENDENT_RESEARCH
    assert is_ambiguous is False


def test_freeze_gate_03_client_informed_external():
    """Gate 3: Client-informed external research — External trends queries informed by client context."""
    from app.campaign_intelligence.research.deep_research_graph import _resolve_research_mode
    from app.campaign_intelligence.collaboration.schemas import ResearchScopeMode

    client_context = CampaignStudioContext(
        agency_id=uuid.uuid4(),
        client_id=uuid.uuid4(),
        campaign_id=uuid.uuid4(),
        client_name="Hotel Shauryawada",
        client_industry="Restaurant",
        client_location="Handewadi, Pune",
        campaign_brief=CampaignBrief(
            client_id=uuid.uuid4(),
            agency_id=uuid.uuid4(),
            period_month=11,
            period_year=2026,
            objective="Local dining growth",
        ),
    )

    query = "What are the viral reels hooks and trending formats for food brands this month?"
    mode, is_ambiguous = _resolve_research_mode(query, client_context)
    assert mode == ResearchScopeMode.CLIENT_INFORMED_EXTERNAL
    assert is_ambiguous is False


@pytest.mark.asyncio
async def test_freeze_gate_04_ambiguity_handling():
    """Gate 4: Ambiguity handling — Missing client business category triggers clarification question without guessing."""
    from app.campaign_intelligence.research.deep_research_graph import (
        _resolve_research_mode,
        compile_report_node,
        plan_scoping_node,
    )
    from app.campaign_intelligence.collaboration.schemas import ResearchScopeMode

    ambiguous_context = CampaignStudioContext(
        agency_id=uuid.uuid4(),
        client_id=uuid.uuid4(),
        campaign_id=uuid.uuid4(),
        client_name="Shaurya Holdings",
        client_industry=None,  # Missing business category!
        campaign_brief=CampaignBrief(
            client_id=uuid.uuid4(),
            agency_id=uuid.uuid4(),
            period_month=11,
            period_year=2026,
            objective="Brand strategy",
        ),
    )

    query = "What are our direct and indirect competitors?"
    mode, is_ambiguous = _resolve_research_mode(query, ambiguous_context)
    assert mode == ResearchScopeMode.CLIENT_SCOPED
    assert is_ambiguous is True

    # plan_scoping_node should halt with is_ambiguous_clarification=True
    state = {
        "query": query,
        "context": ambiguous_context,
        "plan": None,
        "current_topic_idx": 0,
        "used_tool_budget": 0,
        "max_global_budget": 6,
        "topic_evidences": [],
        "discovered_sources": {},
        "inspected_sources": {},
        "synthesis": None,
        "final_report": "",
        "activity_logs": [],
        "on_event_fn": None,
        "research_mode": "client_scoped",
        "is_ambiguous": False,
    }
    plan_res = await plan_scoping_node(state)
    assert plan_res["is_ambiguous"] is True
    plan = plan_res["plan"]
    assert plan.is_ambiguous_clarification is True
    assert len(plan.sub_topics) == 0

    # compile_report_node should return clarification request
    state["plan"] = plan
    compile_res = await compile_report_node(state)
    synthesis = compile_res["synthesis"]
    assert "clarify the primary business category" in synthesis.executive_summary
    assert len(synthesis.observed_competitors) == 0


def test_freeze_gate_05_research_planning_evidence_types():
    """Gate 5: Research planning — Pre-flight evidence types prioritize sources appropriately."""
    from app.campaign_intelligence.research.deep_research_graph import _select_best_url_for_topic

    results = [
        {"url": "https://brandx.com", "title": "BrandX Official Homepage", "content": "Welcome to our store", "score": 0.9},
        {"url": "https://consumerforum.in/brandx-complaints", "title": "BrandX Delivery Delay Reviews", "content": "Customer complaints regarding stale food and delays", "score": 0.7},
        {"url": "https://brandx.com/menu-pricing", "title": "BrandX Official Menu & Pricing", "content": "Full pricing tiers and pack options", "score": 0.8},
    ]

    # For 'independent_reviews', brand homepage is penalized; review portal is selected
    review_url = _select_best_url_for_topic(
        results=results,
        topic_title="Customer Complaints and Delivery Delays",
        target_entity="BrandX",
        already_inspected=set(),
        evidence_type="independent_reviews",
    )
    assert review_url == "https://consumerforum.in/brandx-complaints"

    # For 'official_menu_or_store', menu page on official domain is preferred
    store_url = _select_best_url_for_topic(
        results=results,
        topic_title="Menu Offerings and Bean Pricing Tiers",
        target_entity="BrandX",
        already_inspected=set(),
        evidence_type="official_menu_or_store",
    )
    assert store_url == "https://brandx.com/menu-pricing"


def test_freeze_gate_06_evidence_accounting():
    """Gate 6: Evidence accounting — Discovered search snippets and deeply inspected pages are counted separately."""
    from app.campaign_intelligence.collaboration.schemas import (
        CompetitorActivity,
        EvidenceCitation,
        MarketResearchArtifactPayload,
    )

    payload = MarketResearchArtifactPayload(
        query_topic="Competitor pricing",
        observed_competitors=[
            CompetitorActivity(
                competitor_name="Brand A",
                observed_creative_angle="Discount pricing",
                observed_format="Post",
                citation=EvidenceCitation(
                    source_title="Brand A",
                    source_url="https://branda.com",
                    publisher="branda.com",
                    excerpt="Price is ₹500",
                ),
            )
        ],
        discovered_count=12,
        inspected_count=3,
        claim_supported_count=1,
    )
    assert payload.discovered_count == 12
    assert payload.inspected_count == 3
    assert payload.claim_supported_count == 1


@pytest.mark.asyncio
async def test_freeze_gate_07_claim_verification():
    """Gate 7: Claim verification — Unverified numerical metrics not in inspected sources are tagged unverified."""
    from app.campaign_intelligence.research.deep_research_graph import (
        TopicEvidence,
        compile_report_node,
    )
    from app.campaign_intelligence.specialists.market_research_adapter import (
        CitedKeyFinding,
        MarketResearchSynthesisOutput,
    )

    fake_synthesis = MarketResearchSynthesisOutput(
        executive_summary="Competitive study.",
        key_findings=[
            # This finding claims 900 daily Raans and ₹20 lakh, but neither exists in inspected dossier
            CitedKeyFinding(
                finding="Hotel Shauryawada serves 900 daily Raans generating ₹20 lakh in daily turnover.",
                source_url="https://someblog.in/raan",
            ),
            # This finding's metric IS in inspected metrics
            CitedKeyFinding(
                finding="Subko starts pricing at ₹495 for 158g bags.",
                source_url="https://subko.cr/coffee",
            ),
        ],
        observed_competitors=[],
        inferred_opportunities=[],
        research_dimensions=[],
    )

    ev = TopicEvidence(
        topic_id="t1",
        topic_title="Subko pricing",
        target_entity="Subko",
        findings=["Subko pricing from ₹495"],
        key_excerpts=["Packs start from ₹495 for 158g"],
        detected_metrics=["₹495", "158g"],
        inspected_sources=["https://subko.cr/coffee"],
        snippet_sources=[],
        status="answered",
        summary="Verified pricing",
    )

    state = {
        "query": "Pricing check",
        "context": None,
        "plan": None,
        "current_topic_idx": 1,
        "used_tool_budget": 2,
        "max_global_budget": 6,
        "topic_evidences": [ev],
        "discovered_sources": {"https://subko.cr/coffee": {"title": "Subko", "snippet": "₹495"}},
        "inspected_sources": {"https://subko.cr/coffee": {"title": "Subko", "summary": "Packs start from ₹495"}},
        "synthesis": fake_synthesis,
        "final_report": "",
        "activity_logs": [],
        "on_event_fn": None,
        "research_mode": "client_scoped",
        "is_ambiguous": False,
    }

    with patch("app.campaign_intelligence.research.deep_research_graph.invoke_structured_llm", return_value=fake_synthesis):
        res = await compile_report_node(state)
        synth = res["synthesis"]
        # Finding 1 should be flagged as unverified metric because 900 and 20 lakh are not in inspected sources
        f1 = synth.key_findings[0].finding
        assert "[Unverified Metric" in f1 or "[PRELIMINARY" in f1
        # Finding 2 should NOT be flagged as unverified
        f2 = synth.key_findings[1].finding
        assert "[Unverified Metric" not in f2


@pytest.mark.asyncio
async def test_freeze_gate_08_review_integrity():
    """Gate 8: Review integrity — Distinguishes 1 review (anecdote) from 2-4 (repeated) and 5+ (recurring complaint)."""
    from app.campaign_intelligence.research.deep_research_graph import (
        TopicEvidence,
        compile_report_node,
    )
    from app.campaign_intelligence.specialists.market_research_adapter import (
        CitedKeyFinding,
        MarketResearchSynthesisOutput,
    )

    fake_synthesis = MarketResearchSynthesisOutput(
        executive_summary="Complaints audit.",
        key_findings=[
            CitedKeyFinding(
                finding="Single diner reported delivery delay on weekend evening.",
                source_url="https://reviewsite.in/1",
            ),
            CitedKeyFinding(
                finding="Multiple recurring complaints regarding stale beans across Bangalore hubs.",
                source_url="https://reviewsite.in/2",
            ),
        ],
        observed_competitors=[],
        inferred_opportunities=[],
        research_dimensions=[],
    )

    ev = TopicEvidence(
        topic_id="t1",
        topic_title="Review check",
        findings=["Found reviews"],
        inspected_sources=["https://reviewsite.in/1"],
        snippet_sources=[],
    )

    state = {
        "query": "Complaints check",
        "context": None,
        "plan": None,
        "current_topic_idx": 1,
        "used_tool_budget": 2,
        "max_global_budget": 6,
        "topic_evidences": [ev],
        "discovered_sources": {"https://reviewsite.in/1": {"title": "R1", "snippet": "delay"}},
        "inspected_sources": {"https://reviewsite.in/1": {"title": "R1", "summary": "delay"}},
        "synthesis": fake_synthesis,
        "final_report": "",
        "activity_logs": [],
        "on_event_fn": None,
        "research_mode": "client_scoped",
        "is_ambiguous": False,
    }

    with patch("app.campaign_intelligence.research.deep_research_graph.invoke_structured_llm", return_value=fake_synthesis):
        res = await compile_report_node(state)
        synth = res["synthesis"]
        assert synth.key_findings[0].finding.startswith("Preliminary individual anecdote (1 review):")
        assert synth.key_findings[1].finding.startswith("Recurring customer complaint (multiple verified reviews):")


@pytest.mark.asyncio
async def test_freeze_gate_09_competitor_classification_channel():
    """Gate 9: Competitor classification — Aggregators (Zomato, Swiggy) classified as CHANNEL, not DIRECT."""
    from app.campaign_intelligence.research.deep_research_graph import (
        TopicEvidence,
        compile_report_node,
    )
    from app.campaign_intelligence.collaboration.schemas import CompetitorType
    from app.campaign_intelligence.specialists.market_research_adapter import (
        CitedKeyFinding,
        CompetitorFindingItem,
        MarketResearchSynthesisOutput,
    )

    fake_synthesis = MarketResearchSynthesisOutput(
        executive_summary="Competitor map.",
        key_findings=[
            CitedKeyFinding(finding="Competitors identified across local market.", source_url=None)
        ],
        observed_competitors=[
            CompetitorFindingItem(
                competitor_name="Zomato",
                platform="instagram",
                observed_creative_angle="Online restaurant delivery",
                supporting_source_url="https://zomato.com",
            ),
            CompetitorFindingItem(
                competitor_name="Surve's Pure Non-Veg",
                platform="instagram",
                observed_creative_angle="Authentic Maharashtrian mutton thalis",
                supporting_source_url="https://surves.in",
            ),
        ],
        inferred_opportunities=[],
        research_dimensions=[],
    )

    ev = TopicEvidence(
        topic_id="t1",
        topic_title="Competitors",
        findings=["Found competitors"],
        inspected_sources=["https://surves.in"],
    )

    state = {
        "query": "Competitors check",
        "context": None,
        "plan": None,
        "current_topic_idx": 1,
        "used_tool_budget": 2,
        "max_global_budget": 6,
        "topic_evidences": [ev],
        "discovered_sources": {"https://surves.in": {"title": "Surves", "snippet": "Thalis"}},
        "inspected_sources": {"https://surves.in": {"title": "Surves", "summary": "Thalis"}},
        "synthesis": fake_synthesis,
        "final_report": "",
        "activity_logs": [],
        "on_event_fn": None,
        "research_mode": "client_scoped",
        "is_ambiguous": False,
    }

    with patch("app.campaign_intelligence.research.deep_research_graph.invoke_structured_llm", return_value=fake_synthesis):
        res = await compile_report_node(state)
        synth = res["synthesis"]
        zomato = synth.observed_competitors[0]
        surves = synth.observed_competitors[1]
        assert zomato.competitor_type == CompetitorType.CHANNEL
        assert "channel platform" in zomato.relevance.product_or_service_overlap.lower()
        assert surves.competitor_type == CompetitorType.DIRECT


@pytest.mark.asyncio
async def test_freeze_gate_10_recommendation_discipline():
    """Gate 10: Recommendation discipline — Opportunities default to HYPOTHESIS with low-risk test methods."""
    from app.campaign_intelligence.research.deep_research_graph import (
        TopicEvidence,
        compile_report_node,
    )
    from app.campaign_intelligence.collaboration.schemas import OpportunityStatus
    from app.campaign_intelligence.specialists.market_research_adapter import (
        CitedKeyFinding,
        InferredOpportunityItem,
        MarketResearchSynthesisOutput,
    )

    fake_synthesis = MarketResearchSynthesisOutput(
        executive_summary="Opportunity analysis.",
        key_findings=[
            CitedKeyFinding(finding="Opportunities identified across target whitespace.", source_url=None)
        ],
        observed_competitors=[],
        inferred_opportunities=[
            InferredOpportunityItem(
                opportunity_description="Introduce ready-to-eat vacuum packed mutton curries",
                target_whitespace="Take-home weekend packs",
                supporting_source_urls=["https://source.in"],
            )
        ],
        research_dimensions=[],
    )

    ev = TopicEvidence(
        topic_id="t1",
        topic_title="Whitespace",
        findings=["Found whitespace"],
        inspected_sources=["https://source.in"],
    )

    state = {
        "query": "Whitespace check",
        "context": None,
        "plan": None,
        "current_topic_idx": 1,
        "used_tool_budget": 2,
        "max_global_budget": 6,
        "topic_evidences": [ev],
        "discovered_sources": {"https://source.in": {"title": "Source", "snippet": "Packs"}},
        "inspected_sources": {"https://source.in": {"title": "Source", "summary": "Packs"}},
        "synthesis": fake_synthesis,
        "final_report": "",
        "activity_logs": [],
        "on_event_fn": None,
        "research_mode": "client_scoped",
        "is_ambiguous": False,
    }

    with patch("app.campaign_intelligence.research.deep_research_graph.invoke_structured_llm", return_value=fake_synthesis):
        res = await compile_report_node(state)
        synth = res["synthesis"]
        opp = synth.inferred_opportunities[0]
        assert opp.status == OpportunityStatus.HYPOTHESIS
        assert len(opp.missing_evidence) > 0
        assert opp.test_method is not None
        assert opp.validation_criteria is not None


@pytest.mark.asyncio
async def test_freeze_gate_11_failure_honesty():
    """Gate 11: Failure honesty — Explicitly reports zero sources when search yields no evidence."""
    from app.campaign_intelligence.research.deep_research_graph import compile_report_node

    empty_state = {
        "query": "Impossible query with zero results",
        "context": None,
        "plan": None,
        "current_topic_idx": 0,
        "used_tool_budget": 2,
        "max_global_budget": 6,
        "topic_evidences": [],
        "discovered_sources": {},
        "inspected_sources": {},
        "synthesis": None,
        "final_report": "",
        "activity_logs": [],
        "on_event_fn": None,
        "research_mode": "independent_research",
        "is_ambiguous": False,
    }

    res = await compile_report_node(empty_state)
    synth = res["synthesis"]
    assert "Zero sources retrieved" in synth.executive_summary
    assert "No verifiable market evidence could be retrieved" in synth.executive_summary
    assert len(synth.observed_competitors) == 0


def test_freeze_gate_12_runtime_safety():
    """Gate 12: Runtime safety — Tool inputs sanitize illegal characters, quotes, and empty values safely."""
    from app.campaign_intelligence.tools.market_research_tools import (
        ExtractWebpagesInput,
        WebSearchInput,
    )

    # WebSearchInput sanitization
    in1 = WebSearchInput(query="   \"\"\"   ")
    assert in1.query == "market research intelligence"

    in2 = WebSearchInput(query="  \"Blue Tokai pricing\"  ")
    assert in2.query == "Blue Tokai pricing"

    # ExtractWebpagesInput sanitization
    in3 = ExtractWebpagesInput(urls=["malformed_string", "   https://subko.cr/menu   ", "ftp://invalid.com"])
    assert in3.urls == ["https://subko.cr/menu"]

    in4 = ExtractWebpagesInput(urls=["all_invalid"])
    assert in4.urls == ["https://example.com"]


# ===========================================================================
# The 3-Query Manual Sequence & Strict Scope Contract Tests
# ===========================================================================

def test_manual_sequence_3_modes():
    """Verify the exact 3-step sequence from user audit resolves to the correct 3 modes."""
    from app.campaign_intelligence.research.deep_research_graph import _resolve_research_mode
    from app.campaign_intelligence.collaboration.schemas import ResearchScopeMode

    client_context = CampaignStudioContext(
        agency_id=uuid.uuid4(),
        client_id=uuid.uuid4(),
        campaign_id=uuid.uuid4(),
        client_name="Hotel Shauryawada",
        client_industry="Restaurant",
        client_location="Handewadi, Pune",
        campaign_brief=CampaignBrief(
            client_id=uuid.uuid4(),
            agency_id=uuid.uuid4(),
            period_month=11,
            period_year=2026,
            objective="Local dining growth",
        ),
    )

    # 1. Who are our direct and indirect competitors? -> CLIENT_SCOPED
    q1 = "Who are our direct and indirect competitors?"
    m1, a1 = _resolve_research_mode(q1, client_context)
    assert m1 == ResearchScopeMode.CLIENT_SCOPED
    assert a1 is False

    # 2. Compare Blue Tokai, Subko and Third Wave Coffee in Mumbai and Pune. Do not relate this research to our active client. -> INDEPENDENT_RESEARCH
    q2 = "Compare Blue Tokai, Subko and Third Wave Coffee in Mumbai and Pune. Do not relate this research to our active client."
    m2, a2 = _resolve_research_mode(q2, client_context)
    assert m2 == ResearchScopeMode.INDEPENDENT_RESEARCH
    assert a2 is False

    # 3. Based on the specialty coffee research, what opportunities could Hotel Shauryawada realistically explore? -> CLIENT_INFORMED_EXTERNAL
    q3 = "Based on the specialty coffee research, what opportunities could Hotel Shauryawada realistically explore?"
    m3, a3 = _resolve_research_mode(q3, client_context)
    assert m3 == ResearchScopeMode.CLIENT_INFORMED_EXTERNAL
    assert a3 is False


@pytest.mark.asyncio
async def test_independent_research_scrubs_client_and_sets_direct():
    """Verify that in INDEPENDENT_RESEARCH, competitor entities are DIRECT to each other and client context is not forced."""
    from app.campaign_intelligence.research.deep_research_graph import (
        DeepResearchPlan,
        TopicEvidence,
        compile_report_node,
    )
    from app.campaign_intelligence.collaboration.schemas import CompetitorType, ResearchScopeMode
    from app.campaign_intelligence.specialists.market_research_adapter import (
        CitedKeyFinding,
        CompetitorFindingItem,
        InferredOpportunityItem,
        MarketResearchSynthesisOutput,
    )

    client_context = CampaignStudioContext(
        agency_id=uuid.uuid4(),
        client_id=uuid.uuid4(),
        campaign_id=uuid.uuid4(),
        client_name="Hotel Shauryawada",
        client_industry="Restaurant",
        client_location="Handewadi, Pune",
        campaign_brief=CampaignBrief(
            client_id=uuid.uuid4(),
            agency_id=uuid.uuid4(),
            period_month=11,
            period_year=2026,
            objective="Local dining growth",
        ),
    )

    plan = DeepResearchPlan(
        plan_summary="Independent specialty coffee analysis",
        research_mode=ResearchScopeMode.INDEPENDENT_RESEARCH,
        sub_topics=[],
    )

    fake_synthesis = MarketResearchSynthesisOutput(
        executive_summary="Specialty coffee roasters Blue Tokai, Subko, and Third Wave Coffee operate in Mumbai and Pune. While these entities operate in specialty coffee rather than direct restaurant competition with Hotel Shauryawada, they represent beverage opportunities.",
        key_findings=[
            CitedKeyFinding(finding="Blue Tokai operates 250+ cafes.", source_url="https://bluetokai.com"),
        ],
        observed_competitors=[
            CompetitorFindingItem(
                competitor_name="Blue Tokai",
                platform="instagram",
                observed_creative_angle="Specialty coffee single origin",
                supporting_source_url="https://bluetokai.com",
            ),
            CompetitorFindingItem(
                competitor_name="Subko",
                platform="instagram",
                observed_creative_angle="Pan-India microlots",
                supporting_source_url="https://subko.coffee",
            ),
        ],
        inferred_opportunities=[
            InferredOpportunityItem(
                opportunity_description="Introduce specialty coffee at Hotel Shauryawada for diners.",
                target_whitespace="Post-dinner coffee at Hotel Shauryawada",
                supporting_source_urls=["https://bluetokai.com"],
            )
        ],
        research_dimensions=[],
    )

    ev = TopicEvidence(
        topic_id="t1",
        topic_title="Coffee roasters",
        findings=["Found roasters"],
        inspected_sources=["https://bluetokai.com"],
    )

    state = {
        "query": "Compare Blue Tokai, Subko and Third Wave Coffee in Mumbai and Pune. Do not relate this research to our active client.",
        "context": client_context,
        "plan": plan,
        "current_topic_idx": 1,
        "used_tool_budget": 2,
        "max_global_budget": 6,
        "topic_evidences": [ev],
        "discovered_sources": {"https://bluetokai.com": {"title": "Blue Tokai", "snippet": "Coffee"}},
        "inspected_sources": {"https://bluetokai.com": {"title": "Blue Tokai", "summary": "Coffee"}},
        "synthesis": fake_synthesis,
        "final_report": "",
        "activity_logs": [],
        "on_event_fn": None,
        "research_mode": "independent_research",
        "is_ambiguous": False,
    }

    with patch("app.campaign_intelligence.research.deep_research_graph.invoke_structured_llm", return_value=fake_synthesis):
        res = await compile_report_node(state)
        synth = res["synthesis"]

        # Competitors must be DIRECT competitors to each other in specialty coffee
        for comp in synth.observed_competitors:
            assert comp.competitor_type == CompetitorType.DIRECT

        # Hotel Shauryawada must be scrubbed from executive summary and opportunities
        assert "Hotel Shauryawada" not in synth.executive_summary
        assert "Hotel Shauryawada" not in synth.inferred_opportunities[0].opportunity_description
        assert "Hotel Shauryawada" not in synth.inferred_opportunities[0].target_whitespace


@pytest.mark.asyncio
async def test_dimension_truth_demotion():
    """Verify that dimensions with negative admissions in their summary are demoted to NOT_VERIFIED."""
    from app.campaign_intelligence.research.deep_research_graph import (
        DeepResearchPlan,
        TopicEvidence,
        compile_report_node,
    )
    from app.campaign_intelligence.collaboration.schemas import (
        ResearchDimensionItem,
        ResearchDimensionStatus,
        ResearchScopeMode,
    )
    from app.campaign_intelligence.specialists.market_research_adapter import (
        CitedKeyFinding,
        MarketResearchSynthesisOutput,
    )

    plan = DeepResearchPlan(
        plan_summary="Competitor landscape",
        research_mode=ResearchScopeMode.CLIENT_SCOPED,
        sub_topics=[],
    )

    # LLM marked customer sentiment as 'answered' (Verified), but summary admits competitor review sentiment was not extracted!
    fake_synthesis = MarketResearchSynthesisOutput(
        executive_summary="Dining study.",
        key_findings=[CitedKeyFinding(finding="Sample finding", source_url=None)],
        observed_competitors=[],
        inferred_opportunities=[],
        research_dimensions=[
            ResearchDimensionItem(
                dimension="Customer review sentiment & complaint analysis",
                status=ResearchDimensionStatus.ANSWERED,  # Misleading verified status!
                summary="Tripadvisor hosts Shauryawada Pune listing; competitor review sentiment not distinctly extracted from snippets.",
            ),
            ResearchDimensionItem(
                dimension="Footprint & locations",
                status=ResearchDimensionStatus.ANSWERED,
                summary="Confirmed 14 locations across Pune metropolitan area.",
            ),
        ],
    )

    ev = TopicEvidence(
        topic_id="t1",
        topic_title="Review check",
        findings=["Found data"],
        inspected_sources=["https://tripadvisor.com"],
    )

    state = {
        "query": "Who are our competitors?",
        "context": None,
        "plan": plan,
        "current_topic_idx": 1,
        "used_tool_budget": 2,
        "max_global_budget": 6,
        "topic_evidences": [ev],
        "discovered_sources": {"https://tripadvisor.com": {"title": "Tripadvisor", "snippet": "Reviews"}},
        "inspected_sources": {"https://tripadvisor.com": {"title": "Tripadvisor", "summary": "Reviews"}},
        "synthesis": fake_synthesis,
        "final_report": "",
        "activity_logs": [],
        "on_event_fn": None,
        "research_mode": "client_scoped",
        "is_ambiguous": False,
    }

    with patch("app.campaign_intelligence.research.deep_research_graph.invoke_structured_llm", return_value=fake_synthesis):
        res = await compile_report_node(state)
        synth = res["synthesis"]

        # First dimension MUST be demoted to NOT_VERIFIED
        d1 = synth.research_dimensions[0]
        assert d1.status == ResearchDimensionStatus.NOT_VERIFIED

        # Second dimension should remain ANSWERED
        d2 = synth.research_dimensions[1]
        assert d2.status == ResearchDimensionStatus.ANSWERED


@pytest.mark.asyncio
async def test_listicle_and_aggregator_cleanup():
    """Verify that aggregate listing titles are filtered or cleaned to platform names."""
    from app.campaign_intelligence.research.deep_research_graph import (
        DeepResearchPlan,
        TopicEvidence,
        compile_report_node,
    )
    from app.campaign_intelligence.collaboration.schemas import CompetitorType, ResearchScopeMode
    from app.campaign_intelligence.specialists.market_research_adapter import (
        CitedKeyFinding,
        CompetitorFindingItem,
        MarketResearchSynthesisOutput,
    )

    fake_synthesis = MarketResearchSynthesisOutput(
        executive_summary="Competitor study.",
        key_findings=[CitedKeyFinding(finding="Sample", source_url=None)],
        observed_competitors=[
            CompetitorFindingItem(
                competitor_name="Restaurants listed on Zomato Handewadi, Pune",
                platform="instagram",
                observed_creative_angle="Casual dining listings",
                supporting_source_url="https://zomato.com",
            ),
            CompetitorFindingItem(
                competitor_name="10 gorgeous restaurants for outdoor dining in Pune",
                platform="web",
                observed_creative_angle="Listicle article",
                supporting_source_url="https://cntraveller.in",
            ),
            CompetitorFindingItem(
                competitor_name="Garden Gate Family Restaurant",
                platform="facebook",
                observed_creative_angle="Murg Mussalam family specials",
                supporting_source_url="https://facebook.com/gardengate",
            ),
        ],
        inferred_opportunities=[],
        research_dimensions=[],
    )

    ev = TopicEvidence(
        topic_id="t1",
        topic_title="Competitors",
        findings=["Found competitors"],
        inspected_sources=["https://facebook.com/gardengate"],
    )

    state = {
        "query": "Who are our competitors?",
        "context": None,
        "plan": DeepResearchPlan(plan_summary="Plan", research_mode=ResearchScopeMode.CLIENT_SCOPED, sub_topics=[]),
        "current_topic_idx": 1,
        "used_tool_budget": 2,
        "max_global_budget": 6,
        "topic_evidences": [ev],
        "discovered_sources": {"https://facebook.com/gardengate": {"title": "GG", "snippet": "Food"}},
        "inspected_sources": {"https://facebook.com/gardengate": {"title": "GG", "summary": "Food"}},
        "synthesis": fake_synthesis,
        "final_report": "",
        "activity_logs": [],
        "on_event_fn": None,
        "research_mode": "client_scoped",
        "is_ambiguous": False,
    }

    with patch("app.campaign_intelligence.research.deep_research_graph.invoke_structured_llm", return_value=fake_synthesis):
        res = await compile_report_node(state)
        synth = res["synthesis"]

        comp_names = [c.competitor_name for c in synth.observed_competitors]
        # "10 gorgeous restaurants..." must be filtered out
        assert "10 gorgeous restaurants for outdoor dining in Pune" not in comp_names
        # "Restaurants listed on Zomato..." must be cleaned to "Zomato"
        assert "Zomato" in comp_names
        assert "Garden Gate Family Restaurant" in comp_names
        # Zomato must be CHANNEL
        zomato_comp = next(c for c in synth.observed_competitors if c.competitor_name == "Zomato")
        assert zomato_comp.competitor_type == CompetitorType.CHANNEL


