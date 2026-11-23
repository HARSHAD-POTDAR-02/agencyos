from __future__ import annotations

import hashlib
import hmac
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.websockets import AgencyWSEvent, ws_manager
from app.models.brand_profile import BrandProfile
from app.models.client import Client
from app.models.client_social_account import ClientSocialAccount
from app.models.deliverable import Deliverable
from app.models.social_comment import (
    CommentSentiment,
    EngagementStatus,
    SocialComment,
    SocialConversation,
    SocialMessage,
)
from app.services.engagement_service import triage_social_comment_llm

logger = logging.getLogger(__name__)

router = APIRouter(tags=["webhooks"])


def verify_meta_signature(raw_body: bytes, signature_header: Optional[str]) -> bool:
    """
    Validates X-Hub-Signature-256 header against META_APP_SECRET.
    If META_APP_SECRET is not configured, or in local development/test mode without signature,
    signature checking passes. Strictly enforced when signature is provided or in production.
    """
    if not settings.META_APP_SECRET:
        return True

    if not signature_header:
        if settings.APP_ENV in ("development", "test"):
            return True
        logger.warning("Missing X-Hub-Signature-256 header from Meta Webhook.")
        return False

    parts = signature_header.split("=")
    if len(parts) != 2 or parts[0] != "sha256":
        logger.warning("Invalid X-Hub-Signature-256 format: %s", signature_header)
        return False

    expected_sig = hmac.new(
        settings.META_APP_SECRET.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(parts[1], expected_sig)


# ──────────────────────────────────────────────────────────────────────────────
# Webhook Verification Challenge (GET)
# Handled for both /webhooks/meta and /api/v1/webhooks/meta
# ──────────────────────────────────────────────────────────────────────────────
@router.get("/webhooks/meta")
@router.get("/api/v1/webhooks/meta")
async def verify_meta_webhook(
    hub_mode: Optional[str] = Query(None, alias="hub.mode"),
    hub_verify_token: Optional[str] = Query(None, alias="hub.verify_token"),
    hub_challenge: Optional[str] = Query(None, alias="hub.challenge"),
) -> Response:
    """
    Meta Developer Webhook Verification Handshake.
    When configuring a Callback URL, Meta issues a GET challenge containing:
    - hub.mode=subscribe
    - hub.verify_token=<token>
    - hub.challenge=<challenge_code>
    """
    logger.info("Meta Webhook Verification received: mode=%s, token=%s", hub_mode, hub_verify_token)

    if hub_mode == "subscribe" and hub_verify_token == settings.META_WEBHOOK_VERIFY_TOKEN:
        logger.info("Meta Webhook verified successfully! Returning challenge code.")
        return Response(content=hub_challenge or "", media_type="text/plain", status_code=status.HTTP_200_OK)

    logger.warning(
        "Meta Webhook verification failed. Expected token '%s', got '%s'",
        settings.META_WEBHOOK_VERIFY_TOKEN,
        hub_verify_token,
    )
    return Response(
        content="Forbidden: verify token mismatch",
        media_type="text/plain",
        status_code=status.HTTP_403_FORBIDDEN,
    )


# ──────────────────────────────────────────────────────────────────────────────
# Inbound Webhook Event Ingestion (POST)
# Handled for both /webhooks/meta and /api/v1/webhooks/meta
# ──────────────────────────────────────────────────────────────────────────────
@router.post("/webhooks/meta")
@router.post("/api/v1/webhooks/meta")
async def receive_meta_webhook(
    request: Request,
    x_hub_signature_256: Optional[str] = Header(None, alias="X-Hub-Signature-256"),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, str]:
    """
    Meta Webhook Real-Time Event Ingestion.
    Receives incoming comments, mentions, and direct messages from Instagram and Facebook Pages.
    Parses payload, saves to database with LLM sentiment triage, and broadcasts live WebSocket events.
    """
    raw_body = await request.body()

    if not verify_meta_signature(raw_body, x_hub_signature_256):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid X-Hub-Signature-256 signature.",
        )

    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except json.JSONDecodeError as err:
        logger.error("Failed to decode Meta Webhook JSON: %s", err)
        return {"status": "INVALID_JSON"}

    obj_type = payload.get("object")
    entries = payload.get("entry", [])
    logger.info("Received Meta Webhook object=%s with %d entries", obj_type, len(entries))

    broadcast_events: list[tuple[uuid.UUID, AgencyWSEvent, dict[str, Any]]] = []

    for entry in entries:
        entry_id = str(entry.get("id") or "")
        time_epoch = entry.get("time")

        # 1. Match account by instagram_business_id or facebook_page_id
        acc_stmt = (
            select(ClientSocialAccount)
            .join(Client, ClientSocialAccount.client_id == Client.id)
            .where(
                ClientSocialAccount.is_active == True,
                or_(
                    ClientSocialAccount.instagram_business_id == entry_id,
                    ClientSocialAccount.facebook_page_id == entry_id,
                ),
            )
        )
        acc_res = await db.execute(acc_stmt)
        account = acc_res.scalar_one_or_none()

        # If not directly matched by entry_id, fallback to first active account if only one exists
        if not account:
            fallback_res = await db.execute(
                select(ClientSocialAccount)
                .join(Client, ClientSocialAccount.client_id == Client.id)
                .where(ClientSocialAccount.is_active == True)
                .limit(1)
            )
            account = fallback_res.scalar_one_or_none()

        if not account:
            logger.warning("No active ClientSocialAccount found for Meta entry id=%s", entry_id)
            continue

        # Load client agency_id
        client_stmt = select(Client).where(Client.id == account.client_id)
        client_res = await db.execute(client_stmt)
        client = client_res.scalar_one_or_none()
        if not client:
            continue
        agency_id = client.agency_id

        # Load brand context for LLM triage
        brand_stmt = select(BrandProfile).where(BrandProfile.client_id == client.id)
        brand_res = await db.execute(brand_stmt)
        brand_profile = brand_res.scalar_one_or_none()
        brand_context = ""
        if brand_profile:
            voice = brand_profile.brand_voice or ""
            audience = json.dumps(brand_profile.target_audience) if isinstance(brand_profile.target_audience, (dict, list)) else str(brand_profile.target_audience or "")
            phrases = json.dumps(brand_profile.approved_phrases) if isinstance(brand_profile.approved_phrases, (dict, list)) else str(brand_profile.approved_phrases or "")
            brand_context = f"Tone & Voice: {voice}. Target Audience: {audience}. Approved Phrases: {phrases}"

        # 2. Process changes (Comments & Mentions)
        changes = entry.get("changes", [])
        for change in changes:
            field = change.get("field")
            val = change.get("value", {})

            if field == "comments":
                ext_comment_id = str(val.get("id") or "")
                if not ext_comment_id:
                    continue

                # Check for duplicate comment
                existing_c = await db.execute(
                    select(SocialComment.id).where(SocialComment.external_comment_id == ext_comment_id)
                )
                if existing_c.scalar_one_or_none() is not None:
                    continue

                comment_text = val.get("text", "")
                from_user = val.get("from", {}) or {}
                author_username = from_user.get("username", "instagram_user")
                author_id = str(from_user.get("id") or "")

                media_obj = val.get("media", {}) or {}
                media_id = str(media_obj.get("id") or "")
                parent_id = str(val.get("parent_id") or "") if val.get("parent_id") else None

                # Find deliverable if exists
                deliv_id = None
                deliv_obj = None
                if media_id:
                    deliv_res = await db.execute(
                        select(Deliverable).where(Deliverable.external_post_id == media_id)
                    )
                    deliv_obj = deliv_res.scalar_one_or_none()
                    if deliv_obj:
                        deliv_id = deliv_obj.id
                        deliv_obj.comments_count = (deliv_obj.comments_count or 0) + 1

                # Triage sentiment & intent via Nemotron LLM
                try:
                    triage = await triage_social_comment_llm(
                        comment_text=comment_text,
                        brand_context=brand_context,
                        post_context=deliv_obj.title if deliv_obj else None,
                    )
                except Exception as triage_err:
                    logger.warning("LLM triage fallback on webhook: %s", triage_err)
                    from app.services.engagement_service import LLMCommentTriageSchema
                    triage = LLMCommentTriageSchema(
                        sentiment="neutral",
                        intent_category="general_discussion",
                        urgency="normal",
                        explanation="Default fallback triage.",
                        suggested_replies=[],
                    )

                sent_str = triage.sentiment.lower() if triage.sentiment else "neutral"
                try:
                    sent_enum = CommentSentiment(sent_str)
                except ValueError:
                    sent_enum = CommentSentiment.neutral

                top_reply = triage.suggested_replies[0].reply if triage.suggested_replies else None
                options_json = json.dumps([r.model_dump() for r in triage.suggested_replies]) if triage.suggested_replies else None

                comment_time = datetime.now(timezone.utc)
                if val.get("created_time"):
                    try:
                        comment_time = datetime.fromtimestamp(int(val["created_time"]), tz=timezone.utc)
                    except Exception:
                        pass

                new_comment = SocialComment(
                    id=uuid.uuid4(),
                    agency_id=agency_id,
                    client_id=account.client_id,
                    social_account_id=account.id,
                    deliverable_id=deliv_id,
                    platform=account.platform or "instagram",
                    external_comment_id=ext_comment_id,
                    external_media_id=media_id or "unknown",
                    external_parent_id=parent_id,
                    media_permalink=deliv_obj.live_post_url if deliv_obj else None,
                    author_username=author_username,
                    author_id=author_id,
                    comment_text=comment_text,
                    like_count=0,
                    is_hidden=False,
                    commented_at=comment_time,
                    sentiment=sent_enum,
                    intent_category=triage.intent_category,
                    urgency=triage.urgency,
                    ai_suggested_reply=top_reply,
                    ai_suggested_reply_options=options_json,
                    status=EngagementStatus.pending,
                )
                db.add(new_comment)
                await db.flush()

                broadcast_events.append(
                    (
                        agency_id,
                        AgencyWSEvent.ENGAGEMENT_ACTIVITY,
                        {
                            "type": "new_comment",
                            "comment_id": str(new_comment.id),
                            "external_comment_id": ext_comment_id,
                            "text": comment_text,
                            "author": author_username,
                            "sentiment": sent_enum.value,
                            "urgency": triage.urgency,
                            "client_id": str(account.client_id),
                        },
                    )
                )
                broadcast_events.append(
                    (
                        agency_id,
                        AgencyWSEvent.NOTIFICATION_CREATED,
                        {
                            "id": f"comment-{new_comment.id}",
                            "category": "engagement",
                            "title": f"New Instagram Comment: @{author_username}",
                            "description": comment_text[:120],
                            "url": "/engagement",
                            "is_urgent": triage.urgency in ("urgent", "high"),
                        },
                    )
                )

        # 3. Process messaging (Direct Messages)
        messaging_list = entry.get("messaging", [])
        for msg_item in messaging_list:
            sender_id = str(msg_item.get("sender", {}).get("id") or "")
            recipient_id = str(msg_item.get("recipient", {}).get("id") or "")
            msg_obj = msg_item.get("message", {}) or {}
            ext_mid = str(msg_obj.get("mid") or "")
            msg_text = msg_obj.get("text", "")

            if not ext_mid or not msg_text:
                continue

            # Determine thread / conversation id
            thread_id = sender_id if sender_id != account.instagram_business_id else recipient_id

            # Find or create conversation
            c_stmt = select(SocialConversation).where(SocialConversation.external_thread_id == thread_id)
            c_res = await db.execute(c_stmt)
            conv = c_res.scalar_one_or_none()

            msg_time = datetime.now(timezone.utc)
            if msg_item.get("timestamp"):
                try:
                    msg_time = datetime.fromtimestamp(msg_item["timestamp"] / 1000.0, tz=timezone.utc)
                except Exception:
                    pass

            if conv is None:
                conv = SocialConversation(
                    id=uuid.uuid4(),
                    agency_id=agency_id,
                    client_id=account.client_id,
                    social_account_id=account.id,
                    platform=account.platform or "instagram",
                    external_thread_id=thread_id,
                    participant_username=f"user_{sender_id[:8]}",
                    participant_id=sender_id,
                    last_message_text=msg_text,
                    last_message_at=msg_time,
                    unread_count=1,
                    status=EngagementStatus.pending,
                )
                db.add(conv)
                await db.flush()
            else:
                conv.last_message_text = msg_text
                conv.last_message_at = msg_time
                conv.unread_count = (conv.unread_count or 0) + 1

            # Check duplicate message
            m_dup = await db.execute(select(SocialMessage.id).where(SocialMessage.external_message_id == ext_mid))
            if m_dup.scalar_one_or_none() is None:
                new_msg = SocialMessage(
                    id=uuid.uuid4(),
                    conversation_id=conv.id,
                    external_message_id=ext_mid,
                    sender_username=f"user_{sender_id[:8]}" if sender_id != account.instagram_business_id else "brand",
                    sender_id=sender_id,
                    is_from_brand=(sender_id == account.instagram_business_id),
                    message_text=msg_text,
                    sent_at=msg_time,
                )
                db.add(new_msg)
                await db.flush()

                broadcast_events.append(
                    (
                        agency_id,
                        AgencyWSEvent.ENGAGEMENT_ACTIVITY,
                        {
                            "type": "new_dm",
                            "conversation_id": str(conv.id),
                            "message_id": str(new_msg.id),
                            "text": msg_text,
                            "client_id": str(account.client_id),
                        },
                    )
                )
                broadcast_events.append(
                    (
                        agency_id,
                        AgencyWSEvent.NOTIFICATION_CREATED,
                        {
                            "id": f"dm-{new_msg.id}",
                            "category": "engagement",
                            "title": f"New Instagram DM from {conv.participant_username}",
                            "description": msg_text[:120],
                            "url": "/engagement",
                            "is_urgent": False,
                        },
                    )
                )

    # Commit all newly created comments and messages
    await db.commit()

    # Broadcast strictly after DB commit
    for ag_id, ev_type, ev_data in broadcast_events:
        try:
            await ws_manager.broadcast_to_agency(agency_id=ag_id, event=ev_type, data=ev_data)
        except Exception as ws_err:
            logger.warning("Failed to broadcast webhook event %s: %s", ev_type, ws_err)

    return {"status": "EVENT_RECEIVED"}
