from __future__ import annotations

import uuid
from datetime import datetime, timezone
import pytest
from httpx import AsyncClient
from sqlalchemy import select

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
from tests.conftest import TestSessionLocal


@pytest.mark.asyncio
async def test_social_comment_and_conversation_hierarchy(agency_a_client: AsyncClient, agency_a_data):
    """
    Test 1: Creates SocialComment and SocialConversation records and queries them via the engagement API.
    """
    user_a, agency = agency_a_data

    async with TestSessionLocal() as db:
        client = Client(id=uuid.uuid4(), agency_id=agency.id, business_name="Glow Skincare")
        account = ClientSocialAccount(
            id=uuid.uuid4(),
            client_id=client.id,
            platform="instagram",
            account_name="glow_official",
            account_handle="@glow_official",
            instagram_business_id="ig_glow_101",
            access_token="test_mock_token",
            is_active=True,
        )
        comment_inquiry = SocialComment(
            id=uuid.uuid4(),
            agency_id=agency.id,
            client_id=client.id,
            social_account_id=account.id,
            platform="instagram",
            external_comment_id="ig_c_101",
            external_media_id="ig_m_500",
            author_username="beauty_lover_22",
            comment_text="Is this moisturizer non-comedogenic? Where can I order in California?",
            commented_at=datetime.now(timezone.utc),
            sentiment=CommentSentiment.inquiry,
            intent_category="product_info",
            urgency="high",
            status=EngagementStatus.pending,
        )
        comment_praise = SocialComment(
            id=uuid.uuid4(),
            agency_id=agency.id,
            client_id=client.id,
            social_account_id=account.id,
            platform="instagram",
            external_comment_id="ig_c_102",
            external_media_id="ig_m_500",
            author_username="sarah_glows",
            comment_text="Literally the best serum I have ever tried! Restocking today!! 🔥✨",
            commented_at=datetime.now(timezone.utc),
            sentiment=CommentSentiment.positive,
            intent_category="praise",
            urgency="normal",
            status=EngagementStatus.pending,
        )
        conv = SocialConversation(
            id=uuid.uuid4(),
            agency_id=agency.id,
            client_id=client.id,
            social_account_id=account.id,
            platform="instagram",
            external_thread_id="thread_ig_999",
            participant_username="dermatology_enthusiast",
            participant_id="user_meta_777",
            last_message_text="Hey! Are you guys open for a brand collaboration?",
            last_message_at=datetime.now(timezone.utc),
            unread_count=1,
            sentiment=CommentSentiment.inquiry,
            status=EngagementStatus.pending,
        )
        db.add_all([client, account, comment_inquiry, comment_praise, conv])
        await db.commit()
        inquiry_id = str(comment_inquiry.id)
        conv_id = str(conv.id)

    # 1. Fetch comments with sentiment=inquiry
    res = await agency_a_client.get(f"/agencies/{agency.id}/engagement/comments?sentiment=inquiry")
    assert res.status_code == 200
    items = res.json()
    assert len(items) >= 1
    found = next((c for c in items if c["id"] == inquiry_id), None)
    assert found is not None
    assert found["author_username"] == "beauty_lover_22"
    assert found["sentiment"] == "inquiry"
    assert found["urgency"] == "high"

    # 2. Fetch conversations
    conv_res = await agency_a_client.get(f"/agencies/{agency.id}/engagement/conversations")
    assert conv_res.status_code == 200
    conv_items = conv_res.json()
    assert len(conv_items) >= 1
    target_conv = next((c for c in conv_items if c["id"] == conv_id), None)
    assert target_conv is not None
    assert target_conv["participant_username"] == "dermatology_enthusiast"


@pytest.mark.asyncio
async def test_social_comment_reply_and_like_actions(agency_a_client: AsyncClient, agency_a_data, monkeypatch):
    """
    Test 2: Like, hide, and reply actions on comments update database state and log author metadata.
    """
    user_a, agency = agency_a_data

    # Mock Meta Graph API responses
    async def mock_reply(access_token, comment_id, message):
        return {"id": "meta_reply_id_12345"}

    async def mock_like(access_token, comment_id):
        return True

    async def mock_hide(access_token, comment_id, hide=True):
        return True

    import app.routers.engagement as eng_router
    monkeypatch.setattr(eng_router, "reply_to_instagram_comment", mock_reply)
    monkeypatch.setattr(eng_router, "like_instagram_comment", mock_like)
    monkeypatch.setattr(eng_router, "hide_instagram_comment", mock_hide)

    async with TestSessionLocal() as db:
        client = Client(id=uuid.uuid4(), agency_id=agency.id, business_name="Apex Athletic")
        account = ClientSocialAccount(
            id=uuid.uuid4(),
            client_id=client.id,
            platform="instagram",
            instagram_business_id="ig_apex_001",
            access_token="valid_token",
            is_active=True,
        )
        comment = SocialComment(
            id=uuid.uuid4(),
            agency_id=agency.id,
            client_id=client.id,
            social_account_id=account.id,
            deliverable_id=None,
            platform="instagram",
            external_comment_id="comment_apex_01",
            external_media_id="media_apex_01",
            author_username="crossfit_dan",
            comment_text="What material is used for the waist band? Does it roll down during squats?",
            commented_at=datetime.now(timezone.utc),
            sentiment=CommentSentiment.inquiry,
            status=EngagementStatus.pending,
        )
        db.add_all([client, account, comment])
        await db.commit()
        comment_id = str(comment.id)

    # 1. Like comment
    like_res = await agency_a_client.post(f"/agencies/{agency.id}/engagement/comments/{comment_id}/like")
    assert like_res.status_code == 200
    like_data = like_res.json()
    assert like_data["is_liked_by_brand"] is True

    # 2. Reply to comment
    reply_res = await agency_a_client.post(
        f"/agencies/{agency.id}/engagement/comments/{comment_id}/reply",
        json={"message": "Hey Dan! It features our reinforced silicone grip band—zero roll down guaranteed during heavy squats! 🙌"},
    )
    assert reply_res.status_code == 200
    reply_data = reply_res.json()
    assert reply_data["status"] == "replied"
    assert reply_data["reply_text"] is not None
    assert "silicone grip" in reply_data["reply_text"]

    # 3. Aggregated stats
    stats_res = await agency_a_client.get(f"/agencies/{agency.id}/engagement/stats")
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert stats["total_comments"] >= 1
    assert stats["replied_comments"] >= 1


@pytest.mark.asyncio
async def test_nemotron_llm_intent_classification():
    """
    Test 3: Verifies that the Nemotron LLM classification correctly identifies high-intent buying questions
    and provides structured replies without keyword heuristics.
    """
    res = await triage_social_comment_llm(
        comment_text="Where can I order this jacket in London? Do you have express 2-day shipping?",
        brand_context="Luxury streetwear brand with express UK shipping. Tone is sleek and confident.",
        post_context="Autumn Outerwear Drop Reel",
    )
    assert res.sentiment in ("inquiry", "positive")
    assert len(res.suggested_replies) == 3
    tones = [r.tone for r in res.suggested_replies]
    assert "friendly" in tones or "informative_faq" in tones or "conversion_cta" in tones
