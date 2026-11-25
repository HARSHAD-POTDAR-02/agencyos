from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.llm import invoke_structured_llm
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
from app.schemas.engagement import AIReplyOption, CommentAIResponseResponse
from app.services.meta_publisher import (
    fetch_instagram_conversations,
    fetch_instagram_media_comments,
    fetch_live_meta_telemetry,
    hide_instagram_comment,
    like_instagram_comment,
    reply_to_instagram_comment,
    send_instagram_dm,
)

logger = logging.getLogger(__name__)

# Nemotron models prioritized for deep intent and sentiment classification
# nvidia/nemotron-3.5-bolt-e4b via NVIDIA NIM API (https://integrate.api.nvidia.com/v1)
NEMOTRON_MODELS = [
    "nvidia/nemotron-3.5-bolt-e4b",
    "nvidia/nemotron-mini-4b-instruct",
    "llama-3.1-8b-instant",
]


class LLMCommentTriageSchema(BaseModel):
    sentiment: str = Field(description="Exact value from: positive, inquiry, complaint, neutral, spam")
    intent_category: str = Field(
        description="Specific intent: pricing, product_info, shipping, support, partnership, brand_praise, general_discussion, spam"
    )
    urgency: str = Field(description="Exact value from: urgent, high, normal, low")
    explanation: str = Field(description="Concise 1-sentence analytical reasoning for the classification")
    suggested_replies: list[AIReplyOption] = Field(
        description="Exactly 3 distinct reply options matching brand voice: (1) friendly, (2) informative_faq, (3) conversion_cta"
    )


async def triage_social_comment_llm(
    comment_text: str,
    brand_context: str | None = None,
    post_context: str | None = None,
) -> LLMCommentTriageSchema:
    """
    Classify comment intent, sentiment, urgency, and generate 3 brand-aligned replies
    using Nemotron 8B LLM. Avoids simplistic keyword heuristics.
    """
    system_prompt = (
        "You are an elite AI Community Intelligence Agent specializing in social media customer psychology and intent classification. "
        "Your task is to analyze user comments and direct messages on brand posts, classify their sentiment and latent intent, "
        "and craft 3 high-converting, brand-aligned replies.\n\n"
        "STRICT CLASSIFICATION CRITERIA:\n"
        "- inquiry: User asks about price, link, availability, sizing, features, or where to buy. (HIGH INTENT LEAD).\n"
        "- complaint: User mentions negative experience, delayed shipping, bug, or dissatisfaction.\n"
        "- positive: Genuine appreciation, excitement, complimenting content/product, tagging friends with praise.\n"
        "- neutral: Passive observation, emoji-only without strong emotion, friend tag without context.\n"
        "- spam: Scams, bot links, crypto schemes, promotional link dumps, or abusive insults.\n\n"
        "DO NOT use simple keyword matching. Understand nuances, questions, slang, and context."
    )

    user_prompt = f"""
Analyze the following social media comment:
COMMENT TEXT: "{comment_text}"

POST / CONTENT CONTEXT:
{post_context or "Organic brand video/post on Instagram."}

BRAND PROFILE & VOICE GUIDELINES:
{brand_context or "Modern, helpful, professional, engaging, and customer-first."}

Perform deep intent classification and generate 3 distinct reply options:
1. 'friendly': Warm, conversational, human appreciation.
2. 'informative_faq': Direct, helpful answer addressing the specific question.
3. 'conversion_cta': Direct call to action (e.g. check bio link, DM us for direct support/order link).
"""

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt),
    ]

    for model_name in NEMOTRON_MODELS:
        try:
            result = await invoke_structured_llm(
                prompt=messages,
                schema_class=LLMCommentTriageSchema,
                model=model_name,
                temperature=0.2,
                max_tokens=2048,
                timeout=45.0,
            )
            # Normalize sentiment to enum range
            s = (result.sentiment or "neutral").lower().strip()
            if s not in ("positive", "inquiry", "complaint", "neutral", "spam"):
                if "inquir" in s or "lead" in s or "price" in s:
                    s = "inquiry"
                elif "complaint" in s or "negat" in s:
                    s = "complaint"
                elif "posit" in s or "praise" in s or "love" in s:
                    s = "positive"
                else:
                    s = "neutral"
            result.sentiment = s
            return result
        except Exception as e:
            logger.warning("Nemotron model %s failed for comment triage: %s. Trying next...", model_name, e)

    # Safe fallback if network fails
    return LLMCommentTriageSchema(
        sentiment="neutral",
        intent_category="general_discussion",
        urgency="normal",
        explanation="Default triage applied.",
        suggested_replies=[
            AIReplyOption(tone="friendly", title="Warm Engagement", reply="Thanks so much for reaching out! We appreciate your support! 🙌"),
            AIReplyOption(tone="informative_faq", title="Helpful Information", reply="Hey there! Feel free to send us a direct message if you have any questions."),
            AIReplyOption(tone="conversion_cta", title="Direct Action", reply="Check out the link in our bio for all details and updates! ✨"),
        ],
    )


async def sync_client_social_engagement(
    agency_id: uuid.UUID,
    client_id: uuid.UUID,
    db: AsyncSession,
) -> dict[str, int]:
    """
    Ingests live Instagram & Facebook comments and DM conversations for a client's connected accounts.
    Runs Nemotron 8B LLM intent & sentiment triage on all new comments.
    """
    accounts_res = await db.execute(
        select(ClientSocialAccount).where(
            ClientSocialAccount.client_id == client_id,
            ClientSocialAccount.is_active == True,
        )
    )
    accounts = accounts_res.scalars().all()
    if not accounts:
        return {"comments_synced": 0, "conversations_synced": 0}

    # Fetch client brand profile for voice-tailored classification
    brand_res = await db.execute(
        select(BrandProfile).where(BrandProfile.client_id == client_id)
    )
    brand_profile = brand_res.scalar_one_or_none()
    brand_context = ""
    if brand_profile:
        voice = brand_profile.brand_voice or ""
        audience = json.dumps(brand_profile.target_audience) if isinstance(brand_profile.target_audience, (dict, list)) else str(brand_profile.target_audience or "")
        phrases = json.dumps(brand_profile.approved_phrases) if isinstance(brand_profile.approved_phrases, (dict, list)) else str(brand_profile.approved_phrases or "")
        brand_context = f"Tone & Voice: {voice}. Target Audience: {audience}. Approved Phrases: {phrases}"

    comments_synced = 0
    conversations_synced = 0
    dm_warning: str | None = None

    for account in accounts:
        # -------------------------------------------------------------
        # 1. Instagram Comments Ingestion
        # -------------------------------------------------------------
        if account.platform == "instagram" and account.instagram_business_id:
            try:
                # Fetch recent media for this account
                telemetry = await fetch_live_meta_telemetry(
                    access_token=account.access_token,
                    instagram_business_id=account.instagram_business_id,
                )
                posts = telemetry.get("posts", [])

                # Only process posts with comments to avoid dozens of redundant network round-trips
                posts_with_comments = [
                    p for p in posts[:15]
                    if str(p.get("id")) and int(p.get("comments_count") or 0) > 0
                ]

                for post in posts_with_comments:
                    media_id = str(post.get("id"))

                    # Match with AgencyOS deliverable if possible
                    deliv_res = await db.execute(
                        select(Deliverable).where(Deliverable.external_post_id == media_id)
                    )
                    deliverable = deliv_res.scalar_one_or_none()
                    deliv_id = deliverable.id if deliverable else None

                    # Fetch comments on this media object from Meta
                    comments_data = await fetch_instagram_media_comments(
                        access_token=account.access_token,
                        media_id=media_id,
                        limit=30,
                    )

                    new_raw_comments = []
                    for c in comments_data:
                        ext_c_id = str(c.get("id"))
                        existing_res = await db.execute(
                            select(SocialComment.id).where(SocialComment.external_comment_id == ext_c_id)
                        )
                        if existing_res.scalar_one_or_none() is None:
                            new_raw_comments.append(c)

                    if not new_raw_comments:
                        continue

                    # Concurrently triage all new incoming comments using Nemotron Bolt
                    triage_tasks = [
                        triage_social_comment_llm(
                            comment_text=c.get("text") or "",
                            brand_context=brand_context,
                            post_context=post.get("caption"),
                        )
                        for c in new_raw_comments
                    ]
                    triage_results = await asyncio.gather(*triage_tasks, return_exceptions=True)

                    for c, triage in zip(new_raw_comments, triage_results):
                        if isinstance(triage, Exception):
                            logger.warning(f"Error triaging comment {c.get('id')}: {triage}")
                            continue

                        ext_c_id = str(c.get("id"))
                        comment_text = c.get("text") or ""
                        author_user = c.get("user", {}) or {}
                        author_username = c.get("username") or author_user.get("username") or "instagram_user"
                        author_pic = author_user.get("profile_picture_url")
                        time_str = c.get("timestamp")
                        commented_at = datetime.now(timezone.utc)
                        if time_str:
                            try:
                                commented_at = datetime.fromisoformat(time_str.replace("Z", "+00:00"))
                            except Exception:
                                pass

                        sentiment_map = {
                            "positive": CommentSentiment.positive,
                            "inquiry": CommentSentiment.inquiry,
                            "complaint": CommentSentiment.complaint,
                            "spam": CommentSentiment.spam,
                        }
                        sent_enum = sentiment_map.get(triage.sentiment, CommentSentiment.neutral)
                        options_json = json.dumps([r.model_dump() for r in triage.suggested_replies])
                        top_reply = triage.suggested_replies[0].reply if triage.suggested_replies else None

                        new_comment = SocialComment(
                            agency_id=agency_id,
                            client_id=client_id,
                            social_account_id=account.id,
                            deliverable_id=deliv_id,
                            platform="instagram",
                            external_comment_id=ext_c_id,
                            external_media_id=media_id,
                            media_permalink=post.get("permalink"),
                            media_thumbnail_url=post.get("media_url") or post.get("thumbnail_url"),
                            media_caption=post.get("caption"),
                            author_username=author_username,
                            author_id=author_user.get("id"),
                            author_profile_pic=author_pic,
                            comment_text=comment_text,
                            like_count=int(c.get("like_count") or 0),
                            is_hidden=bool(c.get("hidden", False)),
                            commented_at=commented_at,
                            sentiment=sent_enum,
                            intent_category=triage.intent_category,
                            urgency=triage.urgency,
                            ai_suggested_reply=top_reply,
                            ai_suggested_reply_options=options_json,
                            status=EngagementStatus.pending,
                        )
                        db.add(new_comment)
                        comments_synced += 1

                # ---------------------------------------------------------
                # 2. Instagram Direct Messages Ingestion
                # ---------------------------------------------------------
                conversations_data, dm_err = await fetch_instagram_conversations(
                    access_token=account.access_token,
                    instagram_business_id=account.instagram_business_id,
                    facebook_page_id=account.facebook_page_id,
                    limit=20,
                )
                if dm_err:
                    dm_warning = dm_err

                for conv_item in conversations_data:
                    thread_id = str(conv_item.get("id"))
                    participants = conv_item.get("participants", {}).get("data", [])
                    # Find external participant (not the brand itself)
                    other_user = next(
                        (p for p in participants if str(p.get("id")) != account.instagram_business_id),
                        participants[0] if participants else {}
                    )
                    participant_username = other_user.get("username") or "follower"
                    participant_id = str(other_user.get("id") or thread_id)

                    # Check or create conversation
                    c_res = await db.execute(
                        select(SocialConversation).where(SocialConversation.external_thread_id == thread_id)
                    )
                    conv_obj = c_res.scalar_one_or_none()

                    raw_messages = conv_item.get("messages", {}).get("data", [])
                    last_msg = raw_messages[0] if raw_messages else {}
                    last_msg_text = last_msg.get("message")
                    last_time = datetime.now(timezone.utc)
                    if last_msg.get("created_time"):
                        try:
                            last_time = datetime.fromisoformat(last_msg["created_time"].replace("Z", "+00:00"))
                        except Exception:
                            pass

                    if conv_obj is None:
                        conv_obj = SocialConversation(
                            agency_id=agency_id,
                            client_id=client_id,
                            social_account_id=account.id,
                            platform="instagram",
                            external_thread_id=thread_id,
                            participant_username=participant_username,
                            participant_id=participant_id,
                            last_message_text=last_msg_text,
                            last_message_at=last_time,
                            unread_count=int(conv_item.get("unread_count") or 0),
                            status=EngagementStatus.pending,
                        )
                        db.add(conv_obj)
                        await db.flush()
                        conversations_synced += 1
                    else:
                        conv_obj.participant_username = participant_username
                        conv_obj.participant_id = participant_id
                        conv_obj.last_message_text = last_msg_text
                        conv_obj.last_message_at = last_time
                        conv_obj.unread_count = int(conv_item.get("unread_count") or 0)

                    # Ingest individual messages in this thread
                    for msg in raw_messages:
                        ext_m_id = str(msg.get("id"))
                        m_res = await db.execute(
                            select(SocialMessage).where(SocialMessage.external_message_id == ext_m_id)
                        )
                        if m_res.scalar_one_or_none() is not None:
                            continue

                        sender_info = msg.get("from", {})
                        sender_id = str(sender_info.get("id"))
                        is_brand = sender_id == account.instagram_business_id
                        msg_time = datetime.now(timezone.utc)
                        if msg.get("created_time"):
                            try:
                                msg_time = datetime.fromisoformat(msg["created_time"].replace("Z", "+00:00"))
                            except Exception:
                                pass

                        new_msg = SocialMessage(
                            conversation_id=conv_obj.id,
                            external_message_id=ext_m_id,
                            sender_username=sender_info.get("username") or ("brand" if is_brand else participant_username),
                            sender_id=sender_id,
                            is_from_brand=is_brand,
                            message_text=msg.get("message") or "",
                            sent_at=msg_time,
                        )
                        db.add(new_msg)

            except Exception as e:
                logger.error("Error during Instagram engagement sync for account %s: %s", account.id, e)

    await db.commit()
    return {
        "comments_synced": comments_synced,
        "conversations_synced": conversations_synced,
        "dm_warning": dm_warning,
    }
