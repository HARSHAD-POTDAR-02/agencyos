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
