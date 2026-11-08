from __future__ import annotations

import re
import uuid
from typing import Any

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
from app.models.approval import Approval, ApprovalDecision
from app.models.brand_profile import BrandProfile
from app.models.campaign import Campaign
from app.models.client import Client
from app.models.comment import DeliverableComment
from app.models.content_version import ContentVersion
from app.models.contract import Contract, ContractStatus, ScopeItem
from app.models.deliverable import Deliverable, DeliverableStatus


class ClientNotFoundError(Exception):
    """Raised when client is not found or agency mismatch occurs."""
    pass


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
        # If goals_data has 'offers' or 'products' key
        if isinstance(goals_data, dict):
            raw_offers = goals_data.get("offers") or goals_data.get("products") or []
            if isinstance(raw_offers, list):
                for item in raw_offers:
                    if isinstance(item, dict) and "name" in item:
                        offers.append(
                            VerifiedOffer(
                                name=item["name"],
                                description=item.get("description", ""),
                                source="confirmed_brand_profile",
                                is_verified=brand_profile.is_confirmed,
                            )
                        )
                    elif isinstance(item, str):
                        offers.append(
                            VerifiedOffer(
                                name=item,
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

