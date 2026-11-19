from __future__ import annotations

import logging
import re
import uuid
from typing import Any
from urllib.parse import urljoin, urlparse

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

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


# In-memory crawl cache with timestamp to prevent redundant network fetches
_CRAWL_CACHE: dict[str, tuple[float, dict[str, str]]] = {}
_CRAWL_CACHE_TTL_SECONDS = 7 * 86400  # 7-day TTL


async def crawl_client_website(
    client_website: str | None,
    max_pages: int = 4,
    db: AsyncSession | None = None,
) -> dict[str, str]:
    """
    Zero-budget, SSRF-safe website crawler for client grounding.
    Fetches homepage and up to 3 core discovery paths (about, services/products, pricing).
    Extracts high-fidelity text using trafilatura (with fallback to _clean_html / extract_tavily).
    Caches results with a 7-day TTL.
    """
    if not client_website or not client_website.strip():
        return {}

    raw_url = client_website.strip()
    if not raw_url.startswith(("http://", "https://")):
        raw_url = "https://" + raw_url

    if not _is_safe_url(raw_url):
        logger.warning(f"crawl_client_website: Unsafe URL rejected: {raw_url}")
        return {}

    parsed = urlparse(raw_url)
    base_origin = f"{parsed.scheme}://{parsed.netloc}"

    # Check memory cache
    now = time_now = time_perf = 0.0
    try:
        import time
        now = time.time()
        if base_origin in _CRAWL_CACHE:
            cached_time, cached_data = _CRAWL_CACHE[base_origin]
            if now - cached_time < _CRAWL_CACHE_TTL_SECONDS:
                logger.info(f"crawl_client_website: Returning cached crawl for {base_origin} ({len(cached_data)} pages)")
                return cached_data
    except Exception:
        pass

    target_paths = ["/", "/about", "/about-us", "/services", "/products", "/pricing", "/menu"]
    urls_to_try = [urljoin(base_origin, path) for path in target_paths]

    crawled_pages: dict[str, str] = {}
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36 AgencyOS-BrandCrawler/1.0"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }

    try:
        import trafilatura
    except ImportError:
        trafilatura = None

    async with httpx.AsyncClient(timeout=8.0, follow_redirects=True, headers=headers, verify=False) as client:
        for url in urls_to_try:
            if len(crawled_pages) >= max_pages:
                break
            if not _is_safe_url(url):
                continue

            try:
                resp = await client.get(url)
                if resp.status_code == 200 and "text/html" in resp.headers.get("content-type", "").lower():
                    html_content = resp.text
                    extracted_text = ""
                    if trafilatura:
                        try:
                            extracted_text = trafilatura.extract(html_content, include_comments=False, include_tables=True) or ""
                        except Exception:
                            pass

                    if not extracted_text or len(extracted_text.strip()) < 150:
                        extracted_text = _clean_html(html_content)

                    clean_text = extracted_text.strip()
                    if clean_text and len(clean_text) >= 100:
                        # Keep up to 2,500 chars per page
                        crawled_pages[url] = clean_text[:2500]
            except Exception as req_err:
                logger.debug(f"crawl_client_website: Failed fetching {url}: {req_err}")
                continue

    # Fallback to extract_tavily if direct HTTP got 0 pages
    if not crawled_pages and raw_url:
        try:
            tavily_results = await extract_tavily([raw_url], timeout=8.0)
            for res in tavily_results:
                content = res.get("raw_content") or ""
                if content and len(content.strip()) >= 100:
                    crawled_pages[res.get("url") or raw_url] = content.strip()[:2500]
        except Exception as tavily_err:
            logger.debug(f"crawl_client_website: Tavily fallback error for {raw_url}: {tavily_err}")

    if crawled_pages:
        try:
            import time
            _CRAWL_CACHE[base_origin] = (time.time(), crawled_pages)
        except Exception:
            pass

    return crawled_pages


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

