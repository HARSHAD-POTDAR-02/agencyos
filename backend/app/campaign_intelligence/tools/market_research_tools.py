from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Any, Literal
from pydantic import BaseModel, Field

from app.campaign_intelligence.runtime.schemas import ToolExecutionContext
from app.campaign_intelligence.runtime.tool_registry import SpecialistTool, ToolRegistry
from app.campaign_intelligence.tools.research_tools import (
    _is_safe_url,
    _normalize_url,
    execute_query_with_fallbacks,
    extract_tavily,
    get_platform_format_evidence,
)

logger = logging.getLogger(__name__)


# =====================================================================
# Tool Input Schemas
# =====================================================================

class WebSearchInput(BaseModel):
    """Input for dynamic web search across competitors, trends, campaigns, and local markets."""
    query: str = Field(description="Precise search query. Specify competitor names, locations, platforms, or marketing topics.")
    search_depth: Literal["basic", "advanced"] = Field(
        default="basic",
        description="Use 'basic' for rapid discovery and broad checks; use 'advanced' for deep investigative queries."
    )
    days: int | None = Field(
        default=None,
        ge=1,
        le=365,
        description="Optional recency window in days (e.g. 7 or 30 days to focus on recent campaigns and trends)."
    )
    max_results: int = Field(default=5, ge=1, le=10, description="Maximum number of search results to retrieve (1-10).")


class ExtractWebpagesInput(BaseModel):
    """Input for inspecting full webpage content of discovered URLs."""
    urls: list[str] = Field(
        min_length=1,
        max_length=4,
        description=(
            "List of 1 to 4 discovered webpage URLs (articles, reviews, blogs, directories, guides, or company sites) "
            "to inspect deeply for concrete evidence. Note: Do not submit login-walled social feed URLs (Instagram, "
            "TikTok, Facebook, LinkedIn, etc.) as scrapers are blocked by authentication walls."
        )
    )


class PlatformDocumentationInput(BaseModel):
    """Input for retrieving verified official platform documentation for target platforms."""
    platforms: list[str] = Field(
        description="Target social platforms to retrieve documentation for (e.g. ['instagram', 'tiktok', 'linkedin', 'youtube'])."
    )


PlatformBenchmarkInput = PlatformDocumentationInput


class BrandContextToolInput(BaseModel):
    """Input for retrieving verified internal client and brand guidelines."""
    focus_areas: list[str] = Field(
        default_factory=lambda: ["brand_voice", "content_pillars", "prohibited_claims", "target_audience"],
        description="Brand context fields to inspect."
    )


# =====================================================================
# Tool Execution Handlers
# =====================================================================

async def web_search_handler(args: WebSearchInput, ctx: ToolExecutionContext) -> dict[str, Any]:
    """Execute live web search with fallback cascade and return clean, structured evidence."""
    results = await execute_query_with_fallbacks(
        query=args.query,
        max_results=args.max_results,
        search_depth=args.search_depth,
        days=args.days,
    )
    clean_results = []
    for r in results:
        clean_results.append({
            "title": r.source_title,
            "url": r.source_url,
            "publisher": r.publisher,
            "publication_date": r.publication_date,   # None when unavailable — never fabricate
            "snippet": r.excerpt[:350] if r.excerpt else "",
            "relevance_score": r.relevance_score,
        })
    return {
        "query": args.query,
        "search_depth": args.search_depth,
        "result_count": len(clean_results),
        "results": clean_results,
    }


# =====================================================================
# Compact Evidence Extraction Helpers
# =====================================================================

PRICE_METRIC_PATTERN = re.compile(
    r'(?:(?:₹|rs\.?|inr|\$)\s*\d+(?:[.,]\d+)?(?:\s*(?:per|/)\s*(?:100g|250g|500g|kg|month|meal|box|order|pack|year|day|session|serving))?)'
    r'|(?:\b\d+(?:[.,]\d+)?\s*%\s*(?:off|discount|growth|engagement|margin)?\b)'
    r'|(?:\b\d+\+?\s*(?:cafes?|cafés?|stores?|subscribers?|followers?|reviews?|outlets?|branches?|cities|locations?)\b)',
    re.IGNORECASE
)

BOILERPLATE_PATTERN = re.compile(
    r'privacy policy|cookie|terms of (?:service|use)|rights reserved|cart\s*\(\d+\)|'
    r'skip to content|menu toggle|sign in|create account|log in|search for:|'
    r'leave a (?:reply|comment)|related posts?|table of contents|newsletter signup|'
    r'all rights reserved|powered by\b',
    re.IGNORECASE
)

NAV_OR_SOCIAL_PATTERN = re.compile(
    r'^(?:#+\s*)?(?:share (?:on|this)|follow us(?: on)?|connect with us|like us on|'
    r'facebook|instagram|twitter|x|linkedin|pinterest|whatsapp|youtube|tiktok|'
    r'close menu|open menu|navigation|menu|search|breadcrumbs?)\b',
    re.IGNORECASE
)


def is_substantive_content_line(line: str) -> bool:
    """Validate whether an extracted line contains substantive editorial text rather than nav/scraper chrome."""
    s = line.strip()
    if len(s) < 20:
        return False
    if BOILERPLATE_PATTERN.search(s):
        return False
    if NAV_OR_SOCIAL_PATTERN.match(s):
        return False
    # Filter markdown anchor jumps or empty targets like [Close Menu](#) or [Top](#top)
    if re.match(r"^\[.*?\]\((?:#|javascript:|/).*?\)$", s, re.IGNORECASE):
        return False
    # Filter lines that are just sequences of markdown links (e.g. navigation bars)
    if s.count("](") >= 2 and len(s) < 140:
        return False
    # Filter breadcrumb lines
    if (s.count(" > ") >= 2 or s.count(" | ") >= 2) and len(s) < 120:
        return False
    return True


def _process_extracted_webpage(
    raw_content: str,
    url: str,
    title: str | None = None,
    status: str = "success",
) -> dict[str, Any]:
    """Process raw extracted page content into compact, structured evidence.

    Preserves:
    - Original URL and page title
    - Relevant verbatim excerpts
    - Extracted price, offer or metric where available
    - Extraction timestamp
    - Whether the page actually supports claims
    """
    title = title or url
    extracted_at = datetime.now(timezone.utc).isoformat()
    if not raw_content or not raw_content.strip():
        return {
            "url": url,
            "title": title,
            "extracted_at": extracted_at,
            "status": status,
            "summary": "Page could not be inspected or returned empty content.",
            "key_excerpts": [],
            "extracted_metrics": [],
            "content": "",
            "supports_claim": False,
        }

    # Split into lines and filter navigation/legal boilerplate
    lines = [line.strip() for line in raw_content.splitlines() if line.strip()]
    cleaned_lines = [l for l in lines if is_substantive_content_line(l)]

    # Find sentences with metrics or key entities
    key_excerpts: list[str] = []
    extracted_metrics: list[str] = []
    seen_excerpts: set[str] = set()

    for line in cleaned_lines:
        metrics_found = PRICE_METRIC_PATTERN.findall(line)
        if metrics_found:
            for m in metrics_found:
                m_clean = m.strip()
                if m_clean and m_clean not in extracted_metrics:
                    extracted_metrics.append(m_clean)
            if line not in seen_excerpts and len(key_excerpts) < 4:
                key_excerpts.append(line[:250])
                seen_excerpts.add(line)

    # Clean primary content (top substantive lines up to 1200 chars)
    passage = " ".join(cleaned_lines[:8])[:1200]
    
    # Select first substantive narrative sentence or paragraph for summary
    summary = "Inspected webpage content."
    for l in cleaned_lines:
        if len(l) >= 40 and not l.startswith("#") and " " in l:
            summary = l[:250]
            break
    if summary == "Inspected webpage content." and cleaned_lines:
        summary = cleaned_lines[0][:200]

    return {
        "url": url,
        "title": title,
        "extracted_at": extracted_at,
        "status": status,
        "summary": summary,
        "key_excerpts": key_excerpts,
        "extracted_metrics": extracted_metrics[:8],
        "content": passage,
        "supports_claim": bool(key_excerpts or len(passage) > 50),
    }


async def extract_webpages_handler(args: ExtractWebpagesInput, ctx: ToolExecutionContext) -> dict[str, Any]:
    """Deeply inspect webpage content using Tavily Extract with direct fetch fallback."""
    # Deduplicate URLs by canonical key before calling extract_tavily
    seen: set[str] = set()
    deduped_urls: list[str] = []
    for u in args.urls:
        canonical = _normalize_url(u) if _is_safe_url(u) else u
        if canonical not in seen:
            seen.add(canonical)
            deduped_urls.append(u)

    extracted = await extract_tavily(urls=deduped_urls)
    pages = []
    for p in extracted:
        processed = _process_extracted_webpage(
            raw_content=p.get("raw_content", ""),
            url=p["url"],
            title=p.get("title") or p["url"],
            status=p.get("status", "success"),
        )
        pages.append(processed)
    return {
        "requested_count": len(args.urls),
        "extracted_count": len(pages),
        "pages": pages,
    }


async def platform_documentation_handler(args: PlatformDocumentationInput, ctx: ToolExecutionContext) -> dict[str, Any]:
    """Retrieve verified platform documentation and feature descriptions."""
    evidence = get_platform_format_evidence(args.platforms)
    return {
        "platforms": args.platforms,
        "benchmarks": [
            {
                "platform": e.publisher,
                "title": e.source_title,
                "url": e.source_url,
                "retention_benchmark": e.excerpt,
                "key_takeaway": e.key_takeaway,
            }
            for e in evidence
        ],
    }


platform_benchmarks_handler = platform_documentation_handler


async def brand_context_handler(args: BrandContextToolInput, ctx: ToolExecutionContext) -> dict[str, Any]:
    """Retrieve verified brand guidelines safely from trusted execution context."""
    studio_ctx = ctx.studio_context
    if not studio_ctx:
        return {
            "client_name": "Client",
            "industry": "General Business",
            "location": None,
            "status": "minimal_context",
        }

    b = studio_ctx.brand_context
    return {
        "client_name": studio_ctx.client_name,
        "industry": studio_ctx.client_industry or (b.industry if b else "General Business"),
        "location": studio_ctx.client_location,
        "brand_voice": b.brand_voice if b else [],
        "content_pillars": b.content_pillars if b else [],
        "confirmed_facts": b.confirmed_facts if b else [],
        "target_audience": studio_ctx.campaign_brief.target_audience or (b.target_audience if b else []),
        "prohibited_terms": [p.term for p in b.prohibited_terms] if b and b.prohibited_terms else [],
    }


# =====================================================================
# Registry Factory
# =====================================================================

def get_market_research_tool_registry() -> ToolRegistry:
    """Construct and return a ToolRegistry populated with Market Research tools."""
    registry = ToolRegistry()

    registry.register_tool(
        SpecialistTool(
            name="web_search",
            description="Search the live web for competitors, campaigns, viral trends, audience discussions, and local business market data.",
            args_schema=WebSearchInput,
            handler=web_search_handler,
            allowed_specialists={"market_research"},
            cost_units=10.0,
        )
    )

    registry.register_tool(
        SpecialistTool(
            name="extract_webpages",
            description="Deeply inspect the full webpage text of up to 4 discovered URLs to verify claims, marketing angles, and campaigns.",
            args_schema=ExtractWebpagesInput,
            handler=extract_webpages_handler,
            allowed_specialists={"market_research"},
            cost_units=15.0,
        )
    )

    # Backward-compatible alias for extract_webpages
    registry.register_tool(
        SpecialistTool(
            name="web_extract",
            description="Alias for extract_webpages. Deeply inspect the full webpage text of up to 4 discovered URLs to verify claims.",
            args_schema=ExtractWebpagesInput,
            handler=extract_webpages_handler,
            allowed_specialists={"market_research"},
            cost_units=15.0,
        )
    )

    registry.register_tool(
        SpecialistTool(
            name="get_platform_documentation",
            description=(
                "Retrieve official platform feature documentation for supported social platforms "
                "(Instagram, TikTok, LinkedIn, YouTube). Returns factual feature descriptions "
                "from platform help centres. Does NOT provide empirical performance statistics "
                "— use web_search for third-party benchmark studies."
            ),
            args_schema=PlatformDocumentationInput,
            handler=platform_documentation_handler,
            allowed_specialists={"market_research", "content_architect"},
            cost_units=5.0,
        )
    )

    # Alias for backward compatibility
    registry.register_tool(
        SpecialistTool(
            name="get_platform_benchmarks",
            description="Alias for get_platform_documentation.",
            args_schema=PlatformBenchmarkInput,
            handler=platform_benchmarks_handler,
            allowed_specialists={"market_research", "content_architect"},
            cost_units=5.0,
        )
    )

    registry.register_tool(
        SpecialistTool(
            name="get_brand_context",
            description="Retrieve verified internal client guidelines, brand voice, content pillars, and confirmed facts from AgencyOS.",
            args_schema=BrandContextToolInput,
            handler=brand_context_handler,
            allowed_specialists={"market_research", "content_architect", "brand_intelligence"},
            cost_units=2.0,
        )
    )

    return registry
