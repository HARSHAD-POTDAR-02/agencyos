from __future__ import annotations

import asyncio
import logging
import re
import socket
from ipaddress import ip_address
from typing import Any
from urllib.parse import urljoin, urlparse, urlunparse

import httpx

from app.campaign_intelligence.schemas.research import ResearchEvidence
from app.core.config import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Platform documentation references — only link to real doc pages.
# Quantitative performance claims (e.g. "3x engagement", "40% higher
# completion") have been removed because they are not established by the
# linked documentation pages.  The tool now returns factual feature
# descriptions only.  If you need empirical benchmarks, run web_search
# against industry research sources.
# ---------------------------------------------------------------------------
PLATFORM_DOCUMENTATION_SOURCES: dict[str, dict[str, ResearchEvidence]] = {
    "linkedin": {
        "carousel": ResearchEvidence(
            source_title="LinkedIn Help: Share a document on LinkedIn",
            source_url="https://www.linkedin.com/help/linkedin/answer/a522525",
            publisher="LinkedIn Help Center",
            publication_date=None,
            excerpt=(
                "You can share a PDF, PowerPoint, or Word document as a "
                "multi-page slideshow post on LinkedIn. Each page is displayed "
                "as a swipeable slide."
            ),
            key_takeaway="LinkedIn supports multi-page document posts (carousels) as a native organic format.",
            relevance_score=0.90,
        ),
        "video": ResearchEvidence(
            source_title="LinkedIn Help: Video on LinkedIn",
            source_url="https://www.linkedin.com/help/linkedin/answer/a475511",
            publisher="LinkedIn Help Center",
            publication_date=None,
            excerpt=(
                "LinkedIn supports native video uploads. "
                "Videos auto-play silently in feed. Captions and subtitles "
                "can be added via creator tools."
            ),
            key_takeaway="LinkedIn videos auto-play silently with optional closed captions.",
            relevance_score=0.85,
        ),
    },
    "instagram": {
        "reel": ResearchEvidence(
            source_title="Instagram for Creators: What are Reels?",
            source_url="https://about.instagram.com/features/reels",
            publisher="Instagram",
            publication_date=None,
            excerpt=(
                "Reels are short, entertaining videos on Instagram where you "
                "can express your creativity. They are discovered in Feed, Reels tab, and Explore."
            ),
            key_takeaway="Instagram Reels is a short-form video surface distributed across Feed, Explore, and the Reels tab.",
            relevance_score=0.90,
        ),
        "carousel": ResearchEvidence(
            source_title="Instagram Help: Post Multiple Photos or Videos",
            source_url="https://help.instagram.com/269314056700537",
            publisher="Instagram Help Center",
            publication_date=None,
            excerpt=(
                "You can share multiple photos or videos in one post. People "
                "who see your post can swipe to see all the media items."
            ),
            key_takeaway="Instagram carousels support swipeable photos or videos in a single post.",
            relevance_score=0.85,
        ),
    },
    "youtube": {
        "shorts": ResearchEvidence(
            source_title="YouTube Help: YouTube Shorts",
            source_url="https://support.google.com/youtube/answer/10059070",
            publisher="YouTube Help Center",
            publication_date=None,
            excerpt=(
                "YouTube Shorts are vertical videos that appear in the Shorts shelf on the YouTube homepage "
                "and in the Shorts tab."
            ),
            key_takeaway="YouTube Shorts are vertical videos distributed via the Shorts shelf and tab.",
            relevance_score=0.90,
        ),
    },
}

# Keep old name as an alias so any import of VERIFIED_PLATFORM_SOURCES continues to work.
VERIFIED_PLATFORM_SOURCES = PLATFORM_DOCUMENTATION_SOURCES


# ---------------------------------------------------------------------------
# Private URL safety helpers
# ---------------------------------------------------------------------------

def _is_safe_url(url: str, check_dns: bool = True) -> bool:
    """
    Return True only when the URL:
    - Uses http:// or https://
    - Has a non-empty host
    - Is not localhost or internal name (.local, .internal, .lan, .home, .localhost)
    - Host IP is not private, loopback, link-local, reserved, multicast, or unspecified
    - Host domain does not resolve via DNS to an unsafe IP address
    """
    try:
        parsed = urlparse(url.strip())
    except Exception:
        return False

    if parsed.scheme not in ("http", "https"):
        return False

    host = (parsed.hostname or "").lower().strip()
    if not host:
        return False

    if (
        host in ("localhost", "127.0.0.1", "::1")
        or host.endswith(".local")
        or host.endswith(".internal")
        or host.endswith(".lan")
        or host.endswith(".home")
        or host.endswith(".localhost")
    ):
        return False

    try:
        addr = ip_address(host)
        if (
            addr.is_private
            or addr.is_loopback
            or addr.is_link_local
            or addr.is_reserved
            or addr.is_multicast
            or addr.is_unspecified
        ):
            return False
        return True
    except ValueError:
        pass  # Hostname / domain

    if check_dns:
        try:
            addr_info = socket.getaddrinfo(host, None)
            for item in addr_info:
                ip_str = item[4][0]
                addr = ip_address(ip_str)
                if (
                    addr.is_private
                    or addr.is_loopback
                    or addr.is_link_local
                    or addr.is_reserved
                    or addr.is_multicast
                    or addr.is_unspecified
                ):
                    return False
        except (socket.gaierror, OSError):
            pass

    return True


def _normalize_url(url: str) -> str:
    """Strip fragment (#anchor) and trailing slash, returning a canonical key."""
    parsed = urlparse(url.strip())
    normalized = urlunparse(parsed._replace(fragment=""))
    return normalized.rstrip("/")


def _clean_html(raw_html: str) -> str:
    """Strip HTML tags and unescape common HTML entities."""
    clean = re.sub(r"<[^>]+>", "", raw_html)
    clean = (
        clean
        .replace("&quot;", '"')
        .replace("&amp;", "&")
        .replace("&#39;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
    )
    return re.sub(r"\s+", " ", clean).strip()


# ---------------------------------------------------------------------------
# Primary search provider — Tavily
# ---------------------------------------------------------------------------

async def search_tavily(
    query: str,
    api_key: str,
    max_results: int = 4,
    search_depth: str = "basic",
    days: int | None = None,
    include_raw_content: bool = False,
) -> list[ResearchEvidence]:
    """Search the live web using the Tavily AI Search API."""
    evidence: list[ResearchEvidence] = []
    try:
        payload: dict[str, Any] = {
            "api_key": api_key,
            "query": query,
            "search_depth": search_depth,
            "include_answer": False,
            "include_raw_content": include_raw_content,
            "max_results": max_results,
        }
        if days is not None and days > 0:
            payload["days"] = days

        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.post("https://api.tavily.com/search", json=payload)
            if resp.status_code == 200:
                data = resp.json()
                for item in data.get("results", []):
                    title = item.get("title", "")
                    page_url = item.get("url", "")
                    if not title or not page_url:
                        continue
                    if not _is_safe_url(page_url):
                        logger.debug("search_tavily: skipping unsafe URL %r", page_url)
                        continue

                    content = _clean_html(item.get("content", ""))
                    raw_content = item.get("raw_content") or ""
                    if not (content or raw_content):
                        continue

                    excerpt_text = _clean_html(raw_content)[:500] if raw_content else content[:350]
                    # Only preserve publication_date when the API actually supplies it
                    pub_date: str | None = item.get("published_date") or None

                    evidence.append(
                        ResearchEvidence(
                            source_title=title,
                            source_url=page_url,
                            publisher=item.get("source") or "Tavily Web Search",
                            publication_date=pub_date,
                            excerpt=excerpt_text,
                            key_takeaway=content[:120] if content else excerpt_text[:120],
                            relevance_score=round(float(item.get("score", 0.90)), 2),
                        )
                    )
    except Exception as e:
        logger.warning("Tavily search failed for query %r: %s", query, e)
    return evidence


# ---------------------------------------------------------------------------
# Webpage extraction — Tavily Extract + direct HTTP fallback
# ---------------------------------------------------------------------------

WALLED_GARDEN_DOMAINS = {
    "instagram.com",
    "facebook.com",
    "fb.com",
    "tiktok.com",
    "twitter.com",
    "x.com",
    "threads.net",
    "pinterest.com",
    "linkedin.com",
}


def _is_walled_garden_domain(url: str) -> bool:
    """Return True if URL belongs to a login-walled social platform unextractable by web scrapers."""
    try:
        host = (urlparse(url.strip()).hostname or "").lower()
        if not host:
            return False
        parts = host.split(".")
        if len(parts) >= 2:
            base_domain = ".".join(parts[-2:])
            if base_domain in WALLED_GARDEN_DOMAINS:
                return True
        return False
    except Exception:
        return False


async def extract_tavily(
    urls: list[str],
    api_key: str | None = None,
    timeout: float = 8.0,
) -> list[dict[str, Any]]:
    """
    Extract full webpage content using Tavily Extract API.

    Safety guarantees
    -----------------
    - Rejects unsafe / private / localhost URLs before making any network call.
    - Deduplicates requested URLs (by normalized key) before the API call.
    - Falls back to a direct HTTP GET for any URL the Tavily API cannot extract.

    Returns one result dict per unique safe URL.  Each dict contains:
        url, title, raw_content, status
    ``raw_content`` is an empty string when extraction failed.
    ``status`` is one of: "extracted_tavily", "extracted_direct_http",
    "skipped_unsafe", "http_error_<code>", "fetch_error: <reason>".
    """
    if not urls:
        return []

    safe_urls: list[str] = []
    skipped_results: list[dict[str, Any]] = []
    seen_canonical: set[str] = set()

    for raw_url in urls:
        if not _is_safe_url(raw_url):
            logger.warning("extract_tavily: rejecting unsafe URL %r", raw_url)
            skipped_results.append({
                "url": raw_url,
                "title": raw_url,
                "raw_content": "",
                "status": "skipped_unsafe",
            })
            continue

        if _is_walled_garden_domain(raw_url):
            logger.info("extract_tavily: skipping login-walled social domain %r", raw_url)
            skipped_results.append({
                "url": raw_url,
                "title": raw_url,
                "raw_content": "",
                "status": "skipped_login_wall",
            })
            continue

        canonical = _normalize_url(raw_url)
        if canonical in seen_canonical:
            continue  # deduplicate
        seen_canonical.add(canonical)
        safe_urls.append(raw_url)

    if not safe_urls:
        return skipped_results

    effective_keys = [api_key] if api_key else settings.tavily_api_keys
    extracted_results: list[dict[str, Any]] = []

    # 1. Primary: Tavily Extract API (tries all configured keys on rate limit/error)
    for t_key in effective_keys:
        if not t_key or not t_key.strip():
            continue
        try:
            payload = {
                "api_key": t_key.strip(),
                "urls": safe_urls[:4],
                "extract_depth": "basic",
            }
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.post("https://api.tavily.com/extract", json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    for item in data.get("results", []):
                        page_url = item.get("url", "")
                        raw_text = item.get("raw_content") or ""
                        if page_url and raw_text:
                            clean_text = _clean_html(raw_text)
                            extracted_results.append({
                                "url": page_url,
                                "title": item.get("title") or page_url,
                                "raw_content": clean_text[:12000],
                                "status": "extracted_tavily",
                            })
                    if extracted_results:
                        break  # Key succeeded, proceed to unextracted check
                elif resp.status_code in (429, 401, 403):
                    logger.warning(
                        "Tavily extract API returned %d with key (...%s). Trying next key.",
                        resp.status_code,
                        t_key[-6:],
                    )
                    continue
        except Exception as ex:
            logger.warning("Tavily extract API error with key (...%s): %s", t_key[-6:], ex)

    # 2. Direct HTTP GET fallback for any safe URL not yet extracted (concurrent)
    already_extracted = {r["url"] for r in extracted_results}
    urls_to_fallback = [u for u in safe_urls if u not in already_extracted]

    if urls_to_fallback:
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }

        async def _fetch_single_fallback(u: str) -> dict[str, Any]:
            try:
                async with httpx.AsyncClient(
                    timeout=5.0,
                    headers=headers,
                ) as client:
                    current_url = u
                    redirect_count = 0
                    max_redirects = 3

                    while redirect_count <= max_redirects:
                        if not _is_safe_url(current_url):
                            logger.warning("extract_tavily: target URL is unsafe: %r", current_url)
                            return {
                                "url": u,
                                "title": u,
                                "raw_content": "",
                                "status": "skipped_unsafe" if redirect_count == 0 else "skipped_unsafe_redirect",
                            }

                        resp = await client.get(current_url, follow_redirects=False)

                        if resp.is_redirect and "location" in resp.headers:
                            redirect_count += 1
                            if redirect_count > max_redirects:
                                return {
                                    "url": u,
                                    "title": u,
                                    "raw_content": "",
                                    "status": "http_error_too_many_redirects",
                                }

                            loc = resp.headers["location"]
                            next_url = urljoin(current_url, loc)

                            # Validate redirect target BEFORE making any request to it
                            if not _is_safe_url(next_url):
                                logger.warning(
                                    "extract_tavily: redirect destination is unsafe: %r -> %r",
                                    current_url,
                                    next_url,
                                )
                                return {
                                    "url": u,
                                    "title": u,
                                    "raw_content": "",
                                    "status": "skipped_unsafe_redirect",
                                }

                            current_url = next_url
                        else:
                            # Final response (not a redirect)
                            if resp.status_code == 200:
                                cleaned = _clean_html(resp.text)
                                return {
                                    "url": u,
                                    "title": u,
                                    "raw_content": cleaned[:8000],
                                    "status": "extracted_direct_http",
                                }
                            else:
                                return {
                                    "url": u,
                                    "title": u,
                                    "raw_content": "",
                                    "status": f"http_error_{resp.status_code}",
                                }

                    return {
                        "url": u,
                        "title": u,
                        "raw_content": "",
                        "status": "http_error_too_many_redirects",
                    }
            except Exception as e:
                logger.info("extract_tavily direct HTTP fallback error for %r: %s", u, e)
                return {
                    "url": u,
                    "title": u,
                    "raw_content": "",
                    "status": f"fetch_error: {str(e)[:60]}",
                }

        fallback_tasks = [_fetch_single_fallback(u) for u in urls_to_fallback[:3]]
        fallback_results = await asyncio.gather(*fallback_tasks)
        extracted_results.extend(fallback_results)

    return extracted_results + skipped_results


# ---------------------------------------------------------------------------
# Fallback search providers
# ---------------------------------------------------------------------------

async def search_brave(
    query: str,
    api_key: str,
    max_results: int = 4,
) -> list[ResearchEvidence]:
    """Fallback Tier 1: Brave Search API."""
    evidence: list[ResearchEvidence] = []
    try:
        headers = {
            "Accept": "application/json",
            "X-Subscription-Token": api_key,
        }
        params = {"q": query, "count": max_results}
        async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
            resp = await client.get("https://api.search.brave.com/res/v1/web/search", params=params)
            if resp.status_code == 200:
                data = resp.json()
                for item in data.get("web", {}).get("results", []):
                    title = item.get("title", "")
                    page_url = item.get("url", "")
                    desc = _clean_html(item.get("description", ""))
                    if title and page_url and desc and _is_safe_url(page_url):
                        evidence.append(
                            ResearchEvidence(
                                source_title=title,
                                source_url=page_url,
                                publisher="Brave Web Index",
                                publication_date=None,
                                excerpt=desc[:350],
                                key_takeaway=desc[:120],
                                relevance_score=0.88,
                            )
                        )
    except Exception as e:
        logger.warning("Brave search failed for query %r: %s", query, e)
    return evidence


async def search_serper(
    query: str,
    api_key: str,
    max_results: int = 4,
) -> list[ResearchEvidence]:
    """Fallback Tier 2: Serper (Google Search API)."""
    evidence: list[ResearchEvidence] = []
    try:
        headers = {
            "X-API-KEY": api_key,
            "Content-Type": "application/json",
        }
        payload = {"q": query, "num": max_results}
        async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
            resp = await client.post("https://google.serper.dev/search", json=payload)
            if resp.status_code == 200:
                data = resp.json()
                for item in data.get("organic", []):
                    title = item.get("title", "")
                    page_url = item.get("link", "")
                    snippet = _clean_html(item.get("snippet", ""))
                    if title and page_url and snippet and _is_safe_url(page_url):
                        evidence.append(
                            ResearchEvidence(
                                source_title=title,
                                source_url=page_url,
                                publisher="Google Search (Serper)",
                                publication_date=None,
                                excerpt=snippet[:350],
                                key_takeaway=snippet[:120],
                                relevance_score=0.90,
                            )
                        )
    except Exception as e:
        logger.warning("Serper search failed for query %r: %s", query, e)
    return evidence


async def search_wikipedia(
    query: str,
    max_results: int = 4,
) -> list[ResearchEvidence]:
    """Zero-config Fallback: Wikipedia API."""
    evidence: list[ResearchEvidence] = []
    headers = {"User-Agent": "AgencyOS-Research/1.0 (dev@agencyos.local)"}
    params = {
        "action": "query",
        "list": "search",
        "srsearch": query,
        "format": "json",
        "utf8": 1,
        "srlimit": max_results,
    }
    try:
        async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
            resp = await client.get("https://en.wikipedia.org/w/api.php", params=params)
            if resp.status_code == 200:
                data = resp.json()
                for item in data.get("query", {}).get("search", []):
                    title = item.get("title", "")
                    snippet = _clean_html(item.get("snippet", ""))
                    if title and snippet:
                        slug = title.replace(" ", "_")
                        page_url = f"https://en.wikipedia.org/wiki/{slug}"
                        evidence.append(
                            ResearchEvidence(
                                source_title=title,
                                source_url=page_url,
                                publisher="Wikipedia",
                                publication_date=None,
                                excerpt=snippet[:350],
                                key_takeaway=f"Overview of {title}: {snippet[:120]}",
                                relevance_score=0.82,
                            )
                        )
    except Exception as e:
        logger.warning("Wikipedia search failed for query %r: %s", query, e)
    return evidence


async def search_duckduckgo_topics(query: str) -> list[ResearchEvidence]:
    """Zero-config Fallback: DuckDuckGo Instant Answers."""
    evidence: list[ResearchEvidence] = []
    params = {"q": query, "format": "json"}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get("https://api.duckduckgo.com/", params=params)
            if resp.status_code in (200, 202):
                data = resp.json()
                abstract = data.get("Abstract")
                heading = data.get("Heading")
                abstract_url = data.get("AbstractURL")
                source = data.get("AbstractSource") or "DuckDuckGo"
                if abstract and abstract_url and _is_safe_url(abstract_url):
                    evidence.append(
                        ResearchEvidence(
                            source_title=heading or query,
                            source_url=abstract_url,
                            publisher=source,
                            publication_date=None,
                            excerpt=_clean_html(abstract)[:350],
                            key_takeaway=f"Overview of {heading or query}",
                            relevance_score=0.85,
                        )
                    )
                for topic in data.get("RelatedTopics", []):
                    if isinstance(topic, dict) and "Text" in topic and "FirstURL" in topic:
                        text = _clean_html(topic.get("Text", ""))
                        first_url = topic.get("FirstURL", "")
                        if text and first_url and _is_safe_url(first_url):
                            title = text.split(" - ")[0] if " - " in text else text[:50]
                            evidence.append(
                                ResearchEvidence(
                                    source_title=title,
                                    source_url=first_url,
                                    publisher="DuckDuckGo",
                                    publication_date=None,
                                    excerpt=text[:350],
                                    key_takeaway=text[:120],
                                    relevance_score=0.80,
                                )
                            )
    except Exception as e:
        logger.warning("DuckDuckGo search failed for query %r: %s", query, e)
    return evidence


# ---------------------------------------------------------------------------
# Cascading search orchestrator
# ---------------------------------------------------------------------------

async def execute_query_with_fallbacks(
    query: str,
    max_results: int = 4,
    search_depth: str = "basic",
    days: int | None = None,
) -> list[ResearchEvidence]:
    """
    Execute search across the provider hierarchy:
    1. Tavily AI Search (Preferred)
    2. Brave Search API (Fallback Tier 1)
    3. Serper / Google API (Fallback Tier 2)
    4. Wikipedia & DuckDuckGo (Zero-config Fallback)
    """
    # 1. Tavily AI Search (Try all available Tavily keys in pool)
    for t_key in settings.tavily_api_keys:
        if not t_key or not t_key.strip():
            continue
        results = await search_tavily(
            query=query,
            api_key=t_key.strip(),
            max_results=max_results,
            search_depth=search_depth,
            days=days,
        )
        if results:
            logger.info("Tavily returned %d results for %r with key (...%s)", len(results), query, t_key[-6:])
            return results
        logger.warning("Tavily key (...%s) returned 0 results or failed for %r. Trying next key.", t_key[-6:], query)

    if settings.BRAVE_SEARCH_API_KEY:
        results = await search_brave(query, settings.BRAVE_SEARCH_API_KEY, max_results=max_results)
        if results:
            return results

    if settings.SERPER_API_KEY:
        results = await search_serper(query, settings.SERPER_API_KEY, max_results=max_results)
        if results:
            return results

    wiki = await search_wikipedia(query, max_results=max_results)
    if wiki:
        return wiki

    return await search_duckduckgo_topics(query)


# ---------------------------------------------------------------------------
# Platform documentation accessor
# ---------------------------------------------------------------------------

def get_platform_format_evidence(platforms: list[str]) -> list[ResearchEvidence]:
    """
    Return factual platform documentation references for the requested platforms.

    Important: these entries describe platform features only.  They do NOT
    contain empirical performance statistics.  Use ``web_search`` to discover
    third-party benchmark studies.
    """
    evidence: list[ResearchEvidence] = []
    for platform in platforms:
        plat_lower = platform.lower().strip()
        if plat_lower in PLATFORM_DOCUMENTATION_SOURCES:
            for _, ev in PLATFORM_DOCUMENTATION_SOURCES[plat_lower].items():
                evidence.append(ev)
    return evidence


# ---------------------------------------------------------------------------
# Batch campaign pipeline — gather_market_evidence
# (signature preserved for existing callers)
# ---------------------------------------------------------------------------

async def gather_market_evidence(
    industry: str,
    target_audience: list[str],
    platforms: list[str],
    custom_brief: str | None = None,
    location: str | None = None,
) -> list[ResearchEvidence]:
    """
    Orchestrate multi-source evidence gathering for the batch campaign pipeline.

    This function is used by the legacy ``MarketResearchAgent`` batch workflow.
    The Campaign Studio specialist uses ``BoundedToolRuntime`` with the
    ``web_search`` and ``extract_webpages`` tools instead.

    Deduplicates by source_url and skips unsafe URLs.
    """
    evidence_list: list[ResearchEvidence] = []
    urls_seen: set[str] = set()

    # 1. Platform documentation references
    for ev in get_platform_format_evidence(platforms):
        canonical = _normalize_url(ev.source_url)
        if canonical not in urls_seen and _is_safe_url(ev.source_url):
            evidence_list.append(ev)
            urls_seen.add(canonical)

    # 2. Build search queries
    queries: list[str] = []
    if custom_brief and custom_brief.strip():
        queries.append(custom_brief.strip()[:140])
    if location and location.strip() and location.strip().lower() not in ("not specified", ""):
        queries.append(f"{industry} businesses competitors in {location.strip()} marketing social media")
    clean_industry = industry.strip() if industry and industry.strip() else "Business"
    queries.append(f"{clean_industry} social media viral trends hooks 2026")
    queries.append(f"{clean_industry} competitor positioning content whitespace")
    if target_audience and len(target_audience) > 0 and isinstance(target_audience[0], str):
        queries.append(f"{target_audience[0]} {clean_industry} customer expectations")

    # 3. Execute queries concurrently (top 4)
    tasks = [execute_query_with_fallbacks(q, max_results=3) for q in queries[:4]]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    for res in results:
        if isinstance(res, list):
            for ev in res:
                if isinstance(ev, ResearchEvidence) and _is_safe_url(ev.source_url):
                    canonical = _normalize_url(ev.source_url)
                    if canonical not in urls_seen:
                        evidence_list.append(ev)
                        urls_seen.add(canonical)

    return evidence_list
