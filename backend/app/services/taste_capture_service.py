from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.core.llm import invoke_structured_llm
from app.models.brand_profile import BrandProfile

logger = logging.getLogger(__name__)


class ExtractedTasteRule(BaseModel):
    category: Literal["do", "dont", "style", "pacing", "tone"] = Field(
        ...,
        description="The category of the creative taste preference (do, dont, style, pacing, tone)",
    )
    rule: str = Field(
        ...,
        description="Clear, concise, actionable prescriptive creative rule for future asset generations",
    )
    reason: str = Field(
        ...,
        description="Brief justification or context why this rule was derived from the reviewer feedback",
    )


class TasteExtractionResult(BaseModel):
    has_taste_preferences: bool = Field(
        ...,
        description="True if the feedback expresses recurring creative preferences or stylistic constraints; False if purely one-off logistical comments",
    )
    rules: list[ExtractedTasteRule] = Field(
        default_factory=list,
        description="List of extracted actionable taste rules",
    )


async def capture_cortex_taste_memory(
    client_id: uuid.UUID,
    feedback_text: str | None,
    source: str,
    db: AsyncSession,
) -> list[dict[str, Any]]:
    """
    Cortex Continuous Brand Memory ("Taste Capture"):
    When a manager or client requests revisions, this service invokes the NVIDIA Nemotron model
    to extract durable creative dos, don'ts, styling, and pacing rules into the client's BrandProfile.
    """
    if not feedback_text or len(feedback_text.strip()) < 8:
        return []

    # 1. Fetch or create the active BrandProfile for this client
    profile_stmt = (
        select(BrandProfile)
        .where(BrandProfile.client_id == client_id)
        .order_by(BrandProfile.version.desc())
    )
    res = await db.execute(profile_stmt)
    brand_profile = res.scalars().first()

    if not brand_profile:
        brand_profile = BrandProfile(
            id=uuid.uuid4(),
            client_id=client_id,
            version=1,
            is_confirmed=False,
            taste_memory=[],
        )
        db.add(brand_profile)

    # 2. Invoke NVIDIA Nemotron (strictly LLM, never keyword/heuristic matching)
    prompt = (
        "You are the Cortex Brand Taste Engine for AgencyOS. "
        "Analyze the following creative revision feedback from a creative director or client. "
        "Identify and extract durable brand preferences, styling guidelines, dos, and don'ts "
        "that should permanently inform future content generation for this brand.\n\n"
        f"FEEDBACK TEXT:\n\"{feedback_text.strip()}\"\n\n"
        "Instructions:\n"
        "- If the feedback contains stylistic rules (e.g. 'never use neon fonts', 'keep hooks under 8 words', "
        "'avoid corporate jargon', 'more cinematic framing'), set has_taste_preferences=true and extract the rules.\n"
        "- If the feedback is purely one-off mechanical (e.g. 'typo in word 3', 're-upload file'), set has_taste_preferences=false and rules=[].\n"
        "- Categorize each rule as 'do', 'dont', 'style', 'pacing', or 'tone'."
    )

    try:
        extraction: TasteExtractionResult = await invoke_structured_llm(
            prompt=prompt,
            schema_class=TasteExtractionResult,
            model="nvidia/nemotron-3.5-bolt-e4b",
            temperature=0.1,
            max_tokens=1500,
        )
    except Exception as exc:
        logger.warning(
            f"Failed to extract taste memory via Nemotron for client {client_id}: {exc}"
        )
        return []

    if not extraction.has_taste_preferences or not extraction.rules:
        return []

    # 3. Format and append newly discovered rules
    existing_memory: list[dict[str, Any]] = list(brand_profile.taste_memory or [])
    new_rules_records: list[dict[str, Any]] = []

    for r in extraction.rules:
        # Prevent exact duplicate rules
        if any(e.get("rule", "").lower() == r.rule.lower() for e in existing_memory):
            continue

        record = {
            "id": f"taste-{uuid.uuid4().hex[:8]}",
            "category": r.category,
            "rule": r.rule,
            "reason": r.reason,
            "source": source,
            "extracted_from": feedback_text[:200],
            "created_at": datetime.utcnow().isoformat(),
        }
        new_rules_records.append(record)
        existing_memory.append(record)

    if new_rules_records:
        brand_profile.taste_memory = existing_memory
        flag_modified(brand_profile, "taste_memory")
        await db.commit()
        logger.info(
            f"Captured {len(new_rules_records)} new taste rules into BrandProfile for client {client_id}"
        )

    return new_rules_records


async def get_client_taste_memory(
    client_id: uuid.UUID,
    db: AsyncSession,
) -> list[dict[str, Any]]:
    """Retrieve all captured brand taste rules for a client."""
    profile_stmt = (
        select(BrandProfile)
        .where(BrandProfile.client_id == client_id)
        .order_by(BrandProfile.version.desc())
    )
    res = await db.execute(profile_stmt)
    brand_profile = res.scalars().first()
    if not brand_profile or not brand_profile.taste_memory:
        return []
    return list(brand_profile.taste_memory)


async def add_manual_taste_rule(
    client_id: uuid.UUID,
    category: str,
    rule: str,
    reason: str,
    db: AsyncSession,
) -> dict[str, Any]:
    """Manually add a brand taste rule for a client."""
    profile_stmt = (
        select(BrandProfile)
        .where(BrandProfile.client_id == client_id)
        .order_by(BrandProfile.version.desc())
    )
    res = await db.execute(profile_stmt)
    brand_profile = res.scalars().first()
    if not brand_profile:
        brand_profile = BrandProfile(
            id=uuid.uuid4(),
            client_id=client_id,
            version=1,
            is_confirmed=False,
            taste_memory=[],
        )
        db.add(brand_profile)

    memory: list[dict[str, Any]] = list(brand_profile.taste_memory or [])
    record = {
        "id": f"taste-{uuid.uuid4().hex[:8]}",
        "category": category,
        "rule": rule,
        "reason": reason,
        "source": "manual",
        "extracted_from": "User Defined",
        "created_at": datetime.utcnow().isoformat(),
    }
    memory.append(record)
    brand_profile.taste_memory = memory
    flag_modified(brand_profile, "taste_memory")
    await db.commit()
    return record


async def delete_taste_rule(
    client_id: uuid.UUID,
    rule_id: str,
    db: AsyncSession,
) -> bool:
    """Delete a captured brand taste rule."""
    profile_stmt = (
        select(BrandProfile)
        .where(BrandProfile.client_id == client_id)
        .order_by(BrandProfile.version.desc())
    )
    res = await db.execute(profile_stmt)
    brand_profile = res.scalars().first()
    if not brand_profile or not brand_profile.taste_memory:
        return False

    old_len = len(brand_profile.taste_memory)
    brand_profile.taste_memory = [
        r for r in brand_profile.taste_memory if r.get("id") != rule_id
    ]
    if len(brand_profile.taste_memory) < old_len:
        flag_modified(brand_profile, "taste_memory")
        await db.commit()
        return True
    return False
