from __future__ import annotations

import logging
import re
import uuid
from typing import Any
from urllib.parse import urljoin, urlparse

import asyncio
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from trafilatura import extract as trafilatura_extract
from trafilatura.settings import use_config

from app.campaign_intelligence.schemas.brand import (
    ContractQuota,
    FeedbackClassification,
    FeedbackItem,
    ProhibitedClaim,
    ProhibitedTerm,
    ToneGuideline,
    VerifiedOffer,
)
from app.campaign_intelligence.schemas.campaign import CampaignBrief
from app.campaign_intelligence.tools.research_tools import _clean_html, _is_safe_url, extract_tavily
from app.models.approval import Approval, ApprovalDecision
from app.models.brand_profile import BrandProfile
from app.models.campaign import Campaign
from app.models.client import Client
from app.models.comment import DeliverableComment
from app.models.content_version import ContentVersion
from app.models.contract import Contract, ContractStatus, ScopeItem
from app.models.deliverable import Deliverable, DeliverableStatus

logger = logging.getLogger(__name__)


class ClientNotFoundError(Exception):
    """Raised when client is not found or agency mismatch occurs."""
    pass


def _extract_html_sync(html: str, page_url: str) -> str:
    """Synchronous trafilatura extraction with POSIX signals disabled for thread safety."""
    cfg = use_config()
    cfg.set("DEFAULT", "EXTRACTION_TIMEOUT", "0")
    try:
        return trafilatura_extract(
            html,
            url=page_url,
            include_comments=False,
            include_tables=True,  # critical for pricing/menu tables
            favor_recall=True,
            config=cfg,
        ) or ""
    except Exception as e:
        logger.debug(f"trafilatura extraction error on {page_url}: {e}")
        return ""


class _SimpleLinkExtractor(HTMLParser):
    """Extracts href attributes and anchor text from HTML for link discovery."""
    def __init__(self, base_url: str):
        super().__init__()
        self.base_url = base_url
        self.links: list[tuple[str, str]] = []  # (resolved_url, anchor_text)
        self._current_href: str | None = None
        self._current_text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]):
        if tag.lower() == "a":
            for k, v in attrs:
                if k.lower() == "href" and v:
                    self._current_href = v.strip()
                    self._current_text = []
                    break

    def handle_data(self, data: str):
        if self._current_href is not None:
            self._current_text.append(data)

    def handle_endtag(self, tag: str):
        if tag.lower() == "a" and self._current_href is not None:
            full_url = urljoin(self.base_url, self._current_href)
            anchor = " ".join(self._current_text).strip()
            self.links.append((full_url, anchor))
            self._current_href = None
            self._current_text = []


DISCOVERY_KEYWORDS = [
    "about", "story", "menu", "pricing", "plans", "service", "services",
    "product", "products", "faq", "offer", "treatment", "classes"
]


async def _fetch_page_ssrf_safe(
    client: httpx.AsyncClient,
    target_url: str,
    max_redirects: int = 3,
    max_bytes: int = 1_500_000,
) -> tuple[str, str | None]:
    """
    Fetch a single URL with manual redirect checking against SSRF rules.
    Returns (html_text, final_safe_url) or ("", None) if failed/blocked.
    """
    current_url = target_url
    for _ in range(max_redirects + 1):
        if not _is_safe_url(current_url):
            logger.warning(f"SSRF blocked URL: {current_url}")
            return "", None

        try:
            resp = await client.get(current_url)
            # Check redirect status
            if resp.status_code in (301, 302, 303, 307, 308):
                location = resp.headers.get("location")
                if not location:
                    return "", None
                next_url = urljoin(current_url, location)
                if not _is_safe_url(next_url):
                    logger.warning(f"SSRF blocked redirect to: {next_url}")
                    return "", None
                current_url = next_url
                continue

            if resp.status_code == 200:
                content_type = resp.headers.get("content-type", "").lower()
                if "text/html" not in content_type and "text/plain" not in content_type:
                    return "", None
                # Check byte length cap
                body_bytes = resp.content[:max_bytes]
                return body_bytes.decode(resp.encoding or "utf-8", errors="replace"), current_url

            return "", None
        except Exception as e:
            logger.debug(f"Error fetching {current_url}: {e}")
            return "", None

    return "", None


async def crawl_client_website(
    client_website: str | None,
    max_pages: int = 4,
    db: AsyncSession | None = None,
    brand_profile: BrandProfile | None = None,
) -> dict[str, Any]:
    """
    Zero-budget, SSRF-safe website crawler for client grounding.
    - PostgreSQL 7-day cache with zero in-memory cross-process leakage.
    - Manual redirect protection (max 3) checking every hop against _is_safe_url.
    - Real link discovery parsing up to 3 relevant subpages from homepage.
    - Non-blocking trafilatura extraction with tables enabled.
    - Single-shot extract_tavily fallback only when homepage yields < 150 chars.
    - Combined text strictly capped at 12,000 characters.
    """
    if not client_website or not client_website.strip():
        return {"url": "", "crawled_at": None, "pages": [], "combined_text": ""}

    raw_url = client_website.strip()
    if not raw_url.startswith(("http://", "https://")):
        raw_url = "https://" + raw_url

    if not _is_safe_url(raw_url):
        logger.warning(f"crawl_client_website: Unsafe URL rejected: {raw_url}")
        return {"url": raw_url, "crawled_at": None, "pages": [], "combined_text": ""}

    parsed = urlparse(raw_url)
    normalized_website_url = f"{parsed.scheme}://{parsed.netloc}".rstrip("/")

    # 1. Check PostgreSQL 7-Day Cache
    now_utc = datetime.now(timezone.utc)
    if brand_profile and getattr(brand_profile, "website_crawl_cache", None):
        cache = brand_profile.website_crawl_cache
        if isinstance(cache, dict) and cache.get("url") == normalized_website_url:
            crawled_at_str = cache.get("crawled_at")
            if crawled_at_str and cache.get("combined_text"):
                try:
                    crawled_at = datetime.fromisoformat(crawled_at_str)
                    if now_utc - crawled_at < timedelta(days=7):
                        logger.info(f"crawl_client_website: Cache hit for {normalized_website_url} ({len(cache.get('pages', []))} pages)")
                        return cache
                except Exception:
                    pass

    # 2. Fetch Homepage
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36 AgencyOS-Crawler/1.0"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }

    crawled_pages: list[dict[str, str]] = []  # [{"url": url, "text": text}]
    homepage_html = ""
    resolved_homepage_url = raw_url

    async with httpx.AsyncClient(timeout=8.0, follow_redirects=False, headers=headers, verify=False) as client:
        html, final_url = await _fetch_page_ssrf_safe(client, raw_url)
        if html and final_url:
            homepage_html = html
            resolved_homepage_url = final_url
            hp_text = await asyncio.to_thread(_extract_html_sync, html, final_url)
            if not hp_text or len(hp_text.strip()) < 150:
                hp_text = _clean_html(html)

            # Single-shot extract_tavily fallback if direct HTML extraction yielded < 150 chars
            if len(hp_text.strip()) < 150:
                logger.info(f"crawl_client_website: Homepage extraction < 150 chars. Calling single-shot extract_tavily for {final_url}")
                try:
                    tavily_res = await extract_tavily([final_url], timeout=8.0)
                    if tavily_res and tavily_res[0].get("raw_content"):
                        hp_text = tavily_res[0]["raw_content"].strip()
                except Exception as t_err:
                    logger.debug(f"extract_tavily fallback failed: {t_err}")

            if hp_text and len(hp_text.strip()) >= 50:
                crawled_pages.append({"url": final_url, "text": hp_text.strip()})

        # 3. Discover Subpages (up to 3 matching unique subpages)
        subpage_urls_to_try: list[str] = []
        if homepage_html:
            try:
                parser = _SimpleLinkExtractor(resolved_homepage_url)
                parser.feed(homepage_html)
                hp_netloc = urlparse(resolved_homepage_url).netloc.lower()

                scored_links: list[tuple[int, str]] = []
                seen_sub = {resolved_homepage_url.rstrip("/")}

                for link_url, anchor in parser.links:
                    p = urlparse(link_url)
                    # Must be same host, http/https, no fragment-only
                    if p.scheme not in ("http", "https") or p.netloc.lower() != hp_netloc:
                        continue
                    clean_sub = f"{p.scheme}://{p.netloc}{p.path}".rstrip("/")
                    if clean_sub in seen_sub:
                        continue

                    # Score by keywords in path or anchor
                    path_and_anchor = (p.path + " " + anchor).lower()
                    score = 0
                    for kw in DISCOVERY_KEYWORDS:
                        if kw in path_and_anchor:
                            score += 1

                    if score > 0:
                        scored_links.append((score, clean_sub))
                        seen_sub.add(clean_sub)

                scored_links.sort(key=lambda x: x[0], reverse=True)
                subpage_urls_to_try = [url for _, url in scored_links[:3]]
            except Exception as parse_err:
                logger.debug(f"Link discovery parsing error: {parse_err}")

        # If 0 matching links discovered from HTML, probe at most 2 fallback paths
        if not subpage_urls_to_try:
            for fallback_path in ("/about", "/pricing"):
                probe_url = urljoin(resolved_homepage_url, fallback_path)
                if probe_url.rstrip("/") != resolved_homepage_url.rstrip("/"):
                    subpage_urls_to_try.append(probe_url)

        # Fetch discovered subpages
        for sub_url in subpage_urls_to_try:
            if len(crawled_pages) >= max_pages:
                break
            if not _is_safe_url(sub_url):
                continue

            sub_html, final_sub_url = await _fetch_page_ssrf_safe(client, sub_url)
            if sub_html and final_sub_url:
                text = await asyncio.to_thread(_extract_html_sync, sub_html, final_sub_url)
                if not text or len(text.strip()) < 150:
                    text = _clean_html(sub_html)
                if text and len(text.strip()) >= 50:
                    crawled_pages.append({"url": final_sub_url, "text": text.strip()})

    # 4. Strict 12,000-Character Budget Allocation
    formatted_parts: list[str] = []
    if crawled_pages:
        # Up to 4,500 chars for homepage
        hp_page = crawled_pages[0]
        hp_text = hp_page["text"][:4500]
        formatted_parts.append(f"--- SOURCE: {hp_page['url']} ---\n{hp_text}")

        # Remaining budget divided evenly across subpages
        sub_pages = crawled_pages[1:]
        if sub_pages:
            remaining_budget = max(1000, (12000 - len(hp_text)) // len(sub_pages))
            for sp in sub_pages:
                sp_text = sp["text"][:remaining_budget]
                formatted_parts.append(f"--- SOURCE: {sp['url']} ---\n{sp_text}")

    combined_text = "\n\n".join(formatted_parts)[:12000]

    result = {
        "url": normalized_website_url,
        "crawled_at": now_utc.isoformat(),
        "pages": crawled_pages,
        "combined_text": combined_text,
    }

    # 5. Save to PostgreSQL Cache
    if brand_profile is not None:
        try:
            brand_profile.website_crawl_cache = result
            if db:
                await db.flush()
        except Exception as save_err:
            logger.debug(f"Failed to persist crawl cache to brand_profile: {save_err}")

    return result


async def get_client_and_brand_profile(
    client_id: uuid.UUID,
    agency_id: uuid.UUID,
    db: AsyncSession,
) -> tuple[Client, BrandProfile | None]:
    """
    Retrieve Client and latest/confirmed BrandProfile with strict tenant isolation.
    Raises ClientNotFoundError if client does not belong to agency.
    """
    client_stmt = select(Client).where(Client.id == client_id, Client.agency_id == agency_id)
    client_res = await db.execute(client_stmt)
    client = client_res.scalar_one_or_none()
    if not client:
        raise ClientNotFoundError(f"Client {client_id} does not exist or does not belong to agency {agency_id}")

    # Prioritize confirmed profiles, then latest version
    bp_stmt = (
        select(BrandProfile)
        .where(BrandProfile.client_id == client_id)
        .order_by(BrandProfile.is_confirmed.desc(), BrandProfile.version.desc())
    )
    bp_res = await db.execute(bp_stmt)
    brand_profile = bp_res.scalars().first()

    return client, brand_profile


async def get_client_contract_quotas(
    client_id: uuid.UUID,
    agency_id: uuid.UUID,
    db: AsyncSession,
) -> list[ContractQuota]:
    """
    Retrieve active contract scope items and deliverable quotas with strict tenant verification.
    """
    stmt = (
        select(ScopeItem, Contract)
        .join(Contract, ScopeItem.contract_id == Contract.id)
        .join(Client, Contract.client_id == Client.id)
        .where(
            Client.id == client_id,
            Client.agency_id == agency_id,
            Contract.status.in_([ContractStatus.active, ContractStatus.draft]),
        )
        .order_by(Contract.created_at.desc())
    )
    result = await db.execute(stmt)
    rows = result.all()

    quotas: list[ContractQuota] = []
    for scope_item, _ in rows:
        # Count deliverables currently published or in production for this scope item
        deliv_stmt = (
            select(
                func.count().filter(Deliverable.status == DeliverableStatus.published).label("published_count"),
                func.count().label("total_count"),
            )
            .select_from(Deliverable)
            .where(Deliverable.scope_item_id == scope_item.id)
        )
        deliv_res = await db.execute(deliv_stmt)
        counts = deliv_res.one_or_none()
        used = counts.total_count if counts else 0

        remaining = max(0, scope_item.monthly_quantity - used)
        quotas.append(
            ContractQuota(
                scope_item_id=scope_item.id,
                deliverable_type=scope_item.deliverable_type,
                platform=scope_item.platform,
                monthly_quantity=scope_item.monthly_quantity,
                contracted=scope_item.monthly_quantity,
                remaining=remaining,
            )
        )

    return quotas


def classify_feedback_message(message: str, is_internal: bool = False) -> FeedbackClassification:
    """
    Classify historical reviewer feedback into explicit rules, repeated preferences,
    deliverable-specific comments, or internal reviewer notes.
    """
    if is_internal:
        return FeedbackClassification.internal_reviewer

    msg_lower = message.lower()
    rule_keywords = ["never", "always", "prohibited", "forbidden", "mandatory", "must not", "do not", "rule", "policy"]
    if any(re.search(rf"\b{re.escape(kw)}\b", msg_lower) for kw in rule_keywords):
        return FeedbackClassification.explicit_rule

    pref_keywords = ["prefer", "usually", "tone", "style", "aesthetic", "vibe", "palette", "font", "consistently", "better when"]
    if any(re.search(rf"\b{re.escape(kw)}\b", msg_lower) for kw in pref_keywords):
        return FeedbackClassification.repeated_preference

    return FeedbackClassification.deliverable_specific


async def retrieve_client_feedback_history(
    client_id: uuid.UUID,
    agency_id: uuid.UUID,
    db: AsyncSession,
    limit: int = 25,
) -> list[FeedbackItem]:
    """
    Retrieve historical comments and rejected approval feedback for this client
    across previous campaigns with strict tenant verification.
    """
    feedback_items: list[FeedbackItem] = []

    # 1. Fetch DeliverableComments
    comment_stmt = (
        select(DeliverableComment)
        .join(Deliverable, DeliverableComment.deliverable_id == Deliverable.id)
        .join(Campaign, Deliverable.campaign_id == Campaign.id)
        .join(Client, Campaign.client_id == Client.id)
        .where(Client.id == client_id, Client.agency_id == agency_id)
        .order_by(DeliverableComment.created_at.desc())
        .limit(limit)
    )
    comments = (await db.execute(comment_stmt)).scalars().all()
    for c in comments:
        feedback_items.append(
            FeedbackItem(
                classification=classify_feedback_message(c.message, is_internal=c.is_internal),
                content=c.message,
                source_deliverable_id=c.deliverable_id,
                author_name=c.author_name if hasattr(c, "author_name") else None,
                is_internal=c.is_internal,
            )
        )

    # 2. Fetch Approval feedback (changes requested or rejected)
    approval_stmt = (
        select(Approval, Deliverable.id.label("deliverable_id"))
        .join(ContentVersion, Approval.content_version_id == ContentVersion.id)
        .join(Deliverable, ContentVersion.deliverable_id == Deliverable.id)
        .join(Campaign, Deliverable.campaign_id == Campaign.id)
        .join(Client, Campaign.client_id == Client.id)
        .where(
            Client.id == client_id,
            Client.agency_id == agency_id,
            Approval.decision.in_([ApprovalDecision.changes_requested, ApprovalDecision.rejected]),
            Approval.comment.is_not(None),
        )
        .order_by(Approval.reviewed_at.desc())
        .limit(limit)
    )
    approvals = (await db.execute(approval_stmt)).all()
    for appr, deliv_id in approvals:
        if appr.comment:
            feedback_items.append(
                FeedbackItem(
                    classification=classify_feedback_message(appr.comment, is_internal=False),
                    content=appr.comment,
                    source_deliverable_id=deliv_id,
                    author_name=appr.reviewer.full_name if appr.reviewer else None,
                    is_internal=False,
                )
            )

    return feedback_items


async def get_client_verified_offers(
    client_id: uuid.UUID,
    agency_id: uuid.UUID,
    db: AsyncSession,
    brand_profile: BrandProfile | None,
) -> list[VerifiedOffer]:
    """
    Extract verified client offerings from confirmed BrandProfile or Contract notes.
    Preserves verification status and source origin.
    """
    offers: list[VerifiedOffer] = []

    # 1. Offers from confirmed BrandProfile
    if brand_profile and brand_profile.goals:
        goals_data = brand_profile.goals
        raw_offers: list[Any] = []
        if isinstance(goals_data, dict):
            raw_offers = goals_data.get("offers") or goals_data.get("products") or []
        elif isinstance(goals_data, list):
            raw_offers = goals_data

        if isinstance(raw_offers, list):
            for item in raw_offers:
                if isinstance(item, dict):
                    name = item.get("name") or item.get("title") or item.get("offer") or str(item)
                    desc = item.get("description") or item.get("desc") or ""
                    offers.append(
                        VerifiedOffer(
                            name=str(name),
                            description=str(desc),
                            source="confirmed_brand_profile",
                            is_verified=brand_profile.is_confirmed,
                        )
                    )
                elif isinstance(item, str) and item.strip():
                    offers.append(
                        VerifiedOffer(
                            name=item.strip(),
                            description="",
                            source="confirmed_brand_profile",
                            is_verified=brand_profile.is_confirmed,
                        )
                    )

    # 2. Offers from active Contract notes
    contract_stmt = (
        select(Contract)
        .join(Client, Contract.client_id == Client.id)
        .where(
            Client.id == client_id,
            Client.agency_id == agency_id,
            Contract.status == ContractStatus.active,
            Contract.notes.is_not(None),
        )
    )
    active_contracts = (await db.execute(contract_stmt)).scalars().all()
    for contract in active_contracts:
        if contract.notes and "offer:" in contract.notes.lower():
            for line in contract.notes.splitlines():
                if "offer:" in line.lower():
                    offer_text = line.split(":", 1)[1].strip()
                    offers.append(
                        VerifiedOffer(
                            name=offer_text,
                            description=f"From contract #{contract.name}",
                            source="contract_notes",
                            is_verified=True,
                        )
                    )

    return offers


def detect_exact_prohibited_term_conflicts(
    brief: CampaignBrief,
    prohibited_terms: list[ProhibitedTerm],
) -> list[str]:
    """
    Deterministically scan brief text for exact prohibited terms.
    """
    conflicts: list[str] = []
    text_corpus = " ".join([
        brief.objective,
        brief.custom_brief or "",
        " ".join(brief.additional_constraints),
    ]).lower()

    for pt in prohibited_terms:
        term_clean = pt.term.strip().lower()
        if not term_clean:
            continue
        # Use regex word boundary check for exact match
        pattern = rf"\b{re.escape(term_clean)}\b"
        if re.search(pattern, text_corpus):
            reason_suffix = f" ({pt.reason})" if pt.reason else ""
            conflicts.append(
                f"Prohibited term violation: The exact term '{pt.term}' was found in the campaign brief{reason_suffix}."
            )

    return conflicts

