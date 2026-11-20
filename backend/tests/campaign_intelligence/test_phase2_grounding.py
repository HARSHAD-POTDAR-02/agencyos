from __future__ import annotations

import asyncio
import datetime
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.campaign_intelligence.agents.brand_intelligence import (
    BrandIntelligenceAgent,
    BrandSynthesisOutput,
)
from app.campaign_intelligence.agents.historical_performance import (
    HistoricalPerformanceAgent,
)
from app.campaign_intelligence.agents.market_research import (
    AudienceObservationItem,
    MarketResearchAgent,
    MarketSynthesisOutput,
)
from app.campaign_intelligence.schemas.brand import BrandContext, VerifiedOffer
from app.campaign_intelligence.schemas.campaign import CampaignBrief
from app.campaign_intelligence.schemas.performance import (
    DataSufficiency,
    PerformancePlaybook,
)
from app.campaign_intelligence.schemas.research import (
    AudienceObservation,
    MarketResearchReport,
    ResearchEvidence,
)
from app.campaign_intelligence.tools.brand_tools import crawl_client_website
from app.campaign_intelligence.tools.performance_tools import (
    calculate_format_performance_metrics,
    calculate_instagram_media_metrics,
)
from app.campaign_intelligence.tools.research_tools import (
    BLOCKED_SEO_DOMAINS,
    gather_market_evidence,
)
from app.models.brand_profile import BrandProfile
from app.models.client import Client
from app.models.client_social_account import ClientSocialAccount


# ============================================================================
# 1. Test SSRF Protection on Direct URLs and Redirects
# ============================================================================

@pytest.mark.asyncio
async def test_crawl_blocks_ssrf_direct_and_redirect():
    """Verify crawler blocks local/private IPs directly and on 3xx redirects."""
    # 1. Direct SSRF attempts
    for unsafe_url in [
        "http://127.0.0.1:8000/internal",
        "http://localhost:3000/admin",
        "http://169.254.169.254/latest/meta-data/",
        "http://10.0.0.1/status",
        "http://192.168.1.1/router",
    ]:
        res = await crawl_client_website(unsafe_url, brand_profile=None)
        assert res["combined_text"] == "", f"Direct unsafe URL {unsafe_url} was not blocked!"

    # 2. Redirect to SSRF target
    fake_homepage_resp = MagicMock()
    fake_homepage_resp.status_code = 302
    fake_homepage_resp.headers = {"Location": "http://127.0.0.1:8000/admin/secrets"}

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = fake_homepage_resp
        res = await crawl_client_website("https://example-legit-client.com", brand_profile=None)
        assert res["combined_text"] == ""
        # Ensure it never followed redirect to 127.0.0.1
        for call_item in mock_get.call_args_list:
            call_url = str(call_item[0][0])
            assert "127.0.0.1" not in call_url


# ============================================================================
# 2. Test Link Discovery Priority Cap & PostgreSQL 7-Day Cache
# ============================================================================

@pytest.mark.asyncio
async def test_crawl_link_discovery_cap_and_pg_cache():
    """Verify discovery extracts up to 3 keyword subpages (4 pages total) and hits PG cache."""
    homepage_html = """
    <html>
      <head><title>Acme Dental Clinic</title></head>
      <body>
        <h1>Welcome to Acme Dental</h1>
        <p>Providing exceptional dentistry in Austin Texas for 15 years.</p>
        <nav>
          <a href="/about-us">About Us</a>
          <a href="/services/dental-implants">Dental Implants & Services</a>
          <a href="/pricing-plans">Transparent Pricing & Plans</a>
          <a href="/blog/why-floss">Blog Post 1</a>
          <a href="/blog/brushing-tips">Blog Post 2</a>
          <a href="/careers">Careers</a>
          <a href="https://external-partner.com/link">Partner</a>
        </nav>
      </body>
    </html>
    """

    subpage_html = """
    <html>
      <body>
        <h2>Specialized Page</h2>
        <p>Comprehensive clinical care, transparent pricing, and experienced dentists.</p>
      </body>
    </html>
    """

    async def mock_fetch(url, *args, **kwargs):
        resp = MagicMock()
        resp.status_code = 200
        resp.headers = {"content-type": "text/html; charset=utf-8"}
        resp.encoding = "utf-8"
        resp.content = homepage_html.encode("utf-8") if "example-dental.com/" == url.rstrip("/") + "/" else subpage_html.encode("utf-8")
        resp.text = homepage_html if "example-dental.com/" == url.rstrip("/") + "/" else subpage_html
        return resp

    brand_profile = BrandProfile(id=uuid.uuid4(), client_id=uuid.uuid4())

    with patch("httpx.AsyncClient.get", side_effect=mock_fetch) as mock_get:
        # First call: uncached
        res = await crawl_client_website("https://example-dental.com", brand_profile=brand_profile)
        combined_text = res["combined_text"]
        assert len(combined_text) > 0
        assert "--- SOURCE: https://example-dental.com" in combined_text
        # Max 4 pages fetched (homepage + up to 3 subpages)
        assert mock_get.call_count <= 4
        # Verify PG cache was populated on brand_profile
        assert brand_profile.website_crawl_cache is not None
        cache_entry = brand_profile.website_crawl_cache
        assert cache_entry["url"] == "https://example-dental.com"
        assert len(cache_entry["pages"]) <= 4
        assert cache_entry["combined_text"] == combined_text

    # Second call: Should hit PostgreSQL cache with 0 network calls
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get_second:
        cached_result = await crawl_client_website("https://example-dental.com", brand_profile=brand_profile)
        assert cached_result["combined_text"] == combined_text
        mock_get_second.assert_not_called()


# ============================================================================
# 3. Test Tavily Fallback on Empty JS Shell
# ============================================================================

@pytest.mark.asyncio
async def test_crawl_tavily_fallback_on_empty_html():
    """Verify single-shot extract_tavily fallback when homepage yields < 150 characters."""
    spa_empty_html = "<html><head><title>App</title></head><body><div id='root'></div><script src='/bundle.js'></script></body></html>"

    resp = MagicMock()
    resp.status_code = 200
    resp.headers = {"content-type": "text/html; charset=utf-8"}
    resp.encoding = "utf-8"
    resp.content = spa_empty_html.encode("utf-8")
    resp.text = spa_empty_html

    tavily_extracted_mock = [
        {"url": "https://spa-client.com", "raw_content": "Extracted via Tavily fallback: Modern cloud analytics platform with automated telemetry."}
    ]

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get, \
         patch("app.campaign_intelligence.tools.brand_tools.extract_tavily", new_callable=AsyncMock) as mock_tavily:
        mock_get.return_value = resp
        mock_tavily.return_value = tavily_extracted_mock

        result = await crawl_client_website("https://spa-client.com", brand_profile=None)
        assert mock_tavily.call_count == 1
        assert "Extracted via Tavily fallback" in result["combined_text"]


# ============================================================================
# 4. Test Epistemic Provenance Enforcement & Demoting Unverified Facts
# ============================================================================

@pytest.mark.asyncio
async def test_brand_provenance_demotes_unverified_facts():
    """Verify unverified or hallucinated facts are strictly demoted to assumptions."""
    client_id = uuid.uuid4()
    agency_id = uuid.uuid4()

    client = Client(
        id=client_id,
        agency_id=agency_id,
        business_name="Artisan Bakery",
        website="https://artisanbakery.com",
        industry="Bakery",
    )
    brand_profile = BrandProfile(
        id=uuid.uuid4(),
        client_id=client_id,
        brand_voice="warm, artisanal",
        approved_phrases=["slow fermented sourdough"],
        prohibited_claims={"claims": ["cheap", "factory-made"]},
    )

    crawled_crawl_res = {
        "url": "https://artisanbakery.com",
        "crawled_at": "2026-11-20T12:00:00+00:00",
        "pages": [
            {"url": "https://artisanbakery.com", "text": "We specialize in sourdough bread and organic pastries."},
            {"url": "https://artisanbakery.com/menu", "text": "Weekly sourdough bread box available for delivery."},
        ],
        "combined_text": (
            "--- SOURCE: https://artisanbakery.com ---\n"
            "We specialize in sourdough bread and organic pastries.\n"
            "--- SOURCE: https://artisanbakery.com/menu ---\n"
            "Weekly sourdough bread box available for delivery."
        ),
    }

    mock_llm_output = BrandSynthesisOutput(
        brand_positioning="Portland's premier organic sourdough bakery",
        tone_do=["Emphasize craftsmanship"],
        tone_dont=["Avoid industrial jargon"],
        semantic_conflicts=[],
        assumptions=[],
        additional_knowledge_gaps=[],
        prohibited_concepts=["discount-bin pricing language"],
        website_extracted_facts=[
            "[Website Confirmed | https://artisanbakery.com/menu] Weekly sourdough bread box available for delivery",  # Crawl match
            "Generates $10 million in revenue annually with 50 franchise locations",  # HALLUCINATION - No crawl/DB proof!
        ],
        website_extracted_offers=[
            {
                "name": "Weekly Bread Box",
                "description": "Organic sourdough loaves delivered weekly",
                "source_url": "https://artisanbakery.com/menu",
            },
            {
                "name": "Franchise Opportunity Package",
                "description": "Open your own store for $250,000",
                "source_url": "https://unverified-third-party.com/scam",  # Invalid non-crawled source url!
            },
        ],
    )

    brief = CampaignBrief(
        client_id=client_id,
        agency_id=agency_id,
        period_month=12,
        period_year=2026,
        objective="Promote artisan baking",
    )

    mock_db = AsyncMock(spec=AsyncSession)

    agent = BrandIntelligenceAgent()

    with patch("app.campaign_intelligence.agents.brand_intelligence.get_client_and_brand_profile", new_callable=AsyncMock, return_value=(client, brand_profile)), \
         patch("app.campaign_intelligence.agents.brand_intelligence.get_client_contract_quotas", new_callable=AsyncMock, return_value=[]), \
         patch("app.campaign_intelligence.agents.brand_intelligence.retrieve_client_feedback_history", new_callable=AsyncMock, return_value=[]), \
         patch("app.campaign_intelligence.agents.brand_intelligence.get_client_verified_offers", new_callable=AsyncMock, return_value=[]), \
         patch("app.campaign_intelligence.agents.brand_intelligence.crawl_client_website", new_callable=AsyncMock, return_value=crawled_crawl_res), \
         patch("app.campaign_intelligence.agents.brand_intelligence.invoke_structured_llm", new_callable=AsyncMock, return_value=mock_llm_output):

        result: BrandContext = await agent.run(brief=brief, db=mock_db)

        # 1. Hallucinated fact MUST NOT be in confirmed_facts
        assert not any("10 million" in f for f in result.confirmed_facts)
        # 2. Hallucinated fact MUST be demoted to assumptions prefixed with [INFERRED_NEEDS_REVIEW]
        assert any("[INFERRED_NEEDS_REVIEW]" in a and "10 million" in a for a in result.assumptions)
        # 3. Legitimate fact retained in confirmed_facts
        assert any("Weekly sourdough" in f for f in result.confirmed_facts)
        # 4. Verified offer from crawled URL accepted
        assert any(o.name == "Weekly Bread Box" for o in result.verified_offers)
        # 5. Non-crawled offer demoted to assumptions
        assert not any(o.name == "Franchise Opportunity Package" for o in result.verified_offers)
        assert any("Franchise Opportunity Package" in a for a in result.assumptions)
        # 6. Prohibited concepts populated
        assert any("discount-bin" in p.lower() for p in result.prohibited_concepts)


# ============================================================================
# 5. Test Market Research Tri-Vector Queries, Location & SEO Exclusion
# ============================================================================

@pytest.mark.asyncio
async def test_market_research_trivector_location_and_seo_exclusion():
    """Verify tri-vector query formulation with location, blocked SEO domains, and fallback."""
    captured_queries: list[str] = []
    captured_exclude_domains: list[list[str]] = []

    async def mock_execute_query(query, *args, **kwargs):
        captured_queries.append(query)
        exc = kwargs.get("exclude_domains")
        if exc:
            captured_exclude_domains.append(exc)
        # Return empty for vector 1 reddit query to trigger fallback
        if "site:reddit.com" in query:
            return []
        # Return evidence for other queries
        return [
            ResearchEvidence(
                source_title="Real buyer discussion",
                source_url=f"https://authentic-community.org/thread/{len(captured_queries)}",
                publisher="Reddit Community",
                publication_date="2025-05-01",
                excerpt="Customers in Austin complain about long wait times and hidden fees.",
                key_takeaway="Austin customers demand transparent wait times.",
                relevance_score=0.9,
            ),
            # Return an SEO domain item to test Python post-processing filter
            ResearchEvidence(
                source_title="Hubspot Marketing Tips",
                source_url="https://hubspot.com/marketing/dental-tips",
                publisher="HubSpot",
                publication_date="2025-01-01",
                excerpt="Generic marketing listicle content.",
                key_takeaway="Generic tips.",
                relevance_score=0.8,
            ),
        ]

    with patch("app.campaign_intelligence.tools.research_tools.execute_query_with_fallbacks", side_effect=mock_execute_query), \
         patch("app.campaign_intelligence.tools.research_tools.extract_tavily", new_callable=AsyncMock) as mock_extract:
        mock_extract.return_value = []

        evidence = await gather_market_evidence(
            industry="Dental Clinic",
            target_audience=["Local residents"],
            platforms=["Instagram"],
            location="Austin, TX",
        )

        # Check Vector 1 Reddit query included location
        assert any("Austin, TX" in q and "site:reddit.com" in q for q in captured_queries)
        # Check Vector 1 fallback was triggered since Reddit returned 0 results
        assert any("Austin, TX" in q and "customer reviews complaints" in q for q in captured_queries)
        # Check Vector 2 Competitor Reality
        assert any("competitors pricing alternatives" in q for q in captured_queries)
        # Check Vector 3 Platform Trends
        assert any("Instagram" in q and "format trends" in q for q in captured_queries)

        # Check BLOCKED_SEO_DOMAINS passed in query execution
        assert all(BLOCKED_SEO_DOMAINS == exc for exc in captured_exclude_domains)

        # Check Python post-filter strictly purged hubspot.com
        assert not any("hubspot.com" in ev.source_url for ev in evidence)


# ============================================================================
# 6. Test Deep Excerpt Enrichment and 1,250 Char Limit
# ============================================================================

@pytest.mark.asyncio
async def test_market_research_extract_tavily_enrichment_and_1250_chars():
    """Verify top evidence items get deep excerpts enriched and report includes buyer snippets."""
    sample_evidence = [
        ResearchEvidence(
            source_title="Local Review Thread",
            source_url="https://austin-foodies.com/reviews",
            publisher="Austin Foodies Forum",
            publication_date="2025-06-01",
            excerpt="Short initial snippet.",
            key_takeaway="Initial customer reaction.",
            relevance_score=0.95,
        ),
        ResearchEvidence(
            source_title="Customer Complaints",
            source_url="https://austin-dining-forum.org/complaints",
            publisher="Austin Dining Forum",
            publication_date="2025-06-02",
            excerpt="Short snippet 2.",
            key_takeaway="Customer feedback.",
            relevance_score=0.92,
        ),
    ]

    deep_text = "Detailed customer critique: " + ("The reservation system failed and portions shrank. " * 30)

    async def mock_extract(urls=None, *args, **kwargs):
        target_url = urls[0] if urls else "https://austin-foodies.com/reviews"
        return [{"url": target_url, "raw_content": deep_text}]

    with patch("app.campaign_intelligence.tools.research_tools.execute_query_with_fallbacks", new_callable=AsyncMock) as mock_query, \
         patch("app.campaign_intelligence.tools.research_tools.extract_tavily", side_effect=mock_extract):
        mock_query.return_value = sample_evidence

        enriched = await gather_market_evidence(
            industry="Restaurant",
            target_audience=["Foodies"],
            platforms=["Instagram"],
            location="Austin, TX",
        )
        # The first item should have expanded deep snippet
        assert len(enriched[0].excerpt) > 200
        assert "The reservation system failed" in enriched[0].excerpt

    # Now verify MarketResearchAgent formats report with deep snippets up to 1,250 chars and buyer snippets
    mock_synthesis = MarketSynthesisOutput(
        target_audience_insights=[
            AudienceObservationItem(
                segment_name="Dining Enthusiasts",
                pain_point="Booking friction leads to negative word of mouth.",
                trigger_topic="Reservation cancellation fees",
                cited_evidence_indices=[0],
            )
        ],
        competitor_landscape=[],
        format_and_platform_trends=[],
        strategic_opportunities=["Offer self-serve online modification of booking"],
        buyer_language_snippets=["'the reservation system failed'", "'tasting menu with no hidden surcharges'"],
    )

    agent = MarketResearchAgent()
    brief = CampaignBrief(
        client_id=uuid.uuid4(),
        agency_id=uuid.uuid4(),
        period_month=12,
        period_year=2026,
        objective="Drive bookings",
    )
    brand_context = BrandContext(
        client_id=brief.client_id,
        agency_id=brief.agency_id,
        business_name="Austin Bistro",
        industry="Restaurant",
        location="Austin, TX",
    )

    with patch("app.campaign_intelligence.agents.market_research.gather_market_evidence", new_callable=AsyncMock) as mock_gather, \
         patch("app.campaign_intelligence.agents.market_research.invoke_structured_llm", new_callable=AsyncMock) as mock_llm:
        mock_gather.return_value = sample_evidence
        mock_llm.return_value = mock_synthesis

        report: MarketResearchReport = await agent.run(brief=brief, brand_context=brand_context)
        assert len(report.buyer_language_snippets) == 2
        assert "the reservation system failed" in report.buyer_language_snippets[0]
        assert len(report.target_audience_insights) == 1
        assert len(report.target_audience_insights[0].evidence) == 1
        assert report.target_audience_insights[0].evidence[0].source_url == "https://austin-foodies.com/reviews"


# ============================================================================
# 7. Test Historical Performance Live Instagram Fallback & Timeout Resilience
# ============================================================================

@pytest.mark.asyncio
async def test_performance_ig_fallback_error_resilience():
    """Verify live Instagram fallback when deliverables=0, and resilience on API timeout."""
    brief = CampaignBrief(
        client_id=uuid.uuid4(),
        agency_id=uuid.uuid4(),
        period_month=12,
        period_year=2026,
        objective="Grow social following",
    )
    brand_context = BrandContext(
        client_id=brief.client_id,
        agency_id=brief.agency_id,
        business_name="Austin Cafe",
        industry="Cafe",
    )

    social_account = ClientSocialAccount(
        id=uuid.uuid4(),
        client_id=brief.client_id,
        platform="instagram",
        is_active=True,
        access_token="valid_token_123",
        instagram_business_id="1784140001",
    )

    # 1. Successful Instagram Live Sync (5 posts -> DataSufficiency.sufficient)
    mock_db = AsyncMock(spec=AsyncSession)
    async def mock_execute(stmt):
        m = MagicMock()
        s = str(stmt).lower()
        if "client_social_accounts" in s:
            m.scalars().first.return_value = social_account
        elif "deliverables" in s:
            m.scalars().all.return_value = []
        return m

    mock_db.execute = AsyncMock(side_effect=mock_execute)

    mock_ig_data = {
        "success": True,
        "data": {
            "data": [
                {"media_type": "VIDEO", "like_count": 120, "comments_count": 15, "caption": "Morning espresso workflow"},
                {"media_type": "CAROUSEL_ALBUM", "like_count": 85, "comments_count": 10, "caption": "Pastry lineup this week"},
                {"media_type": "IMAGE", "like_count": 60, "comments_count": 5, "caption": "New single-origin beans arrived"},
                {"media_type": "VIDEO", "like_count": 140, "comments_count": 20, "caption": "Latte art pour in slow motion"},
                {"media_type": "CAROUSEL_ALBUM", "like_count": 95, "comments_count": 8, "caption": "Meet our barista team"},
            ]
        }
    }

    agent = HistoricalPerformanceAgent()

    with patch("app.campaign_intelligence.agents.historical_performance.get_client_published_deliverables", new_callable=AsyncMock) as mock_deliv, \
         patch("app.services.instagram_service.InstagramService.get_media_list", return_value=mock_ig_data), \
         patch("app.campaign_intelligence.agents.historical_performance.invoke_structured_llm", new_callable=AsyncMock) as mock_llm:
        mock_deliv.return_value = []
        from app.campaign_intelligence.agents.historical_performance import PerformanceInterpretationOutput
        mock_llm.return_value = PerformanceInterpretationOutput(
            winning_hooks_and_angles=["Reel latte art & morning workflows drive 2x engagement"],
            underperforming_patterns=["Static single-image bean announcements"],
            recommended_format_mix={"reel": 3, "carousel": 3},
        )

        playbook: PerformancePlaybook = await agent.run(brief=brief, db=mock_db, brand_context=brand_context)
        assert playbook.data_sufficiency == DataSufficiency.sufficient
        assert playbook.historical_posts_analyzed == 5
        assert len(playbook.format_summaries) > 0
        assert any(f.deliverable_type == "reel" for f in playbook.format_summaries)

    # 2. Instagram Error / Timeout -> Graceful Cold Start without Exception
    with patch("app.campaign_intelligence.agents.historical_performance.get_client_published_deliverables", new_callable=AsyncMock) as mock_deliv, \
         patch("app.services.instagram_service.InstagramService.get_media_list", side_effect=asyncio.TimeoutError("Instagram API timeout")):
        mock_deliv.return_value = []

        # Must NOT raise exception
        cold_playbook: PerformancePlaybook = await agent.run(brief=brief, db=mock_db, brand_context=brand_context)
        assert cold_playbook.data_sufficiency == DataSufficiency.cold_start
        assert cold_playbook.historical_posts_analyzed == 0
        assert len(cold_playbook.winning_hooks_and_angles) >= 3


# ============================================================================
# 8. Test Multi-Industry Cold Start Hypotheses & Zero Hallucinated Stats
# ============================================================================

@pytest.mark.asyncio
async def test_performance_cold_start_multi_industry_zero_fake_stats():
    """Verify multi-industry hypotheses contain testable angles and ZERO fabricated CTR/benchmarks."""
    industries_to_test = [
        ("Restaurant / Food", "restaurant"),
        ("Healthcare Clinic", "medical clinic"),
        ("D2C E-commerce Apparel", "d2c fashion"),
        ("B2B SaaS Software", "b2b enterprise software"),
        ("General Custom Brand", "logistics and distribution"),
    ]

    mock_db = AsyncMock(spec=AsyncSession)
    mock_db.execute = AsyncMock(return_value=MagicMock(scalars=lambda: MagicMock(first=lambda: None, all=lambda: [])))

    agent = HistoricalPerformanceAgent()

    for display_name, ind_slug in industries_to_test:
        brief = CampaignBrief(
            client_id=uuid.uuid4(),
            agency_id=uuid.uuid4(),
            period_month=12,
            period_year=2026,
            objective=f"Grow presence for {display_name}",
        )
        brand_context = BrandContext(
            client_id=brief.client_id,
            agency_id=brief.agency_id,
            business_name=f"Brand {ind_slug}",
            industry=ind_slug,
        )

        with patch("app.campaign_intelligence.agents.historical_performance.get_client_published_deliverables", new_callable=AsyncMock) as mock_deliv:
            mock_deliv.return_value = []
            playbook: PerformancePlaybook = await agent.run(brief=brief, db=mock_db, brand_context=brand_context)

            assert playbook.data_sufficiency == DataSufficiency.cold_start
            assert len(playbook.winning_hooks_and_angles) >= 3, f"Failed for {ind_slug}"

            # Verify multi-industry specificity
            hooks_joined = " ".join(playbook.winning_hooks_and_angles).lower()
            if "restaurant" in ind_slug:
                assert any(term in hooks_joined for term in ["sensory", "plating", "dining", "culinary", "dish"])
            elif "clinic" in ind_slug:
                assert any(term in hooks_joined for term in ["clinical", "procedure", "patient", "consultation"])
            elif "d2c" in ind_slug:
                assert any(term in hooks_joined for term in ["problem-solution", "tactile", "material", "unboxing", "routine"])
            elif "b2b" in ind_slug:
                assert any(term in hooks_joined for term in ["workflow", "architecture", "bottleneck", "blueprint"])

            # Strict Zero-Fabrication Checks: No fabricated CTR, hold rates, or % benchmarks
            for angle in playbook.winning_hooks_and_angles:
                assert "%" not in angle, f"Hallucinated % stat in hook: {angle}"
                assert "ctr" not in angle.lower(), f"Hallucinated CTR in hook: {angle}"
                assert "hold rate" not in angle.lower(), f"Hallucinated hold rate in hook: {angle}"

            # Cold start guardrails check
            underperf_joined = " ".join(playbook.underperforming_patterns)
            assert "No historical baseline yet" in underperf_joined
            assert "Sprint 1" in underperf_joined
