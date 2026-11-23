from __future__ import annotations

import hashlib
import hmac
import json
import uuid
from datetime import datetime, timezone
import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.config import settings
from app.models.agency import Agency
from app.models.campaign import Campaign
from app.models.client import Client
from app.models.client_social_account import ClientSocialAccount
from app.models.deliverable import Deliverable
from app.models.social_comment import SocialComment, SocialConversation, SocialMessage
from tests.conftest import TestSessionLocal


def compute_meta_signature(body: bytes, secret: str) -> str:
    digest = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


@pytest.mark.asyncio
async def test_meta_webhook_verification_success(anon_client: AsyncClient):
    """
    Verifies that GET /webhooks/meta with correct hub.verify_token
    returns the hub.challenge with HTTP 200.
    """
    challenge_val = "1158201444"
    res = await anon_client.get(
        "/webhooks/meta",
        params={
            "hub.mode": "subscribe",
            "hub.challenge": challenge_val,
            "hub.verify_token": settings.META_WEBHOOK_VERIFY_TOKEN,
        },
    )
    assert res.status_code == 200
    assert res.text == challenge_val


@pytest.mark.asyncio
async def test_meta_webhook_verification_api_v1_alias(anon_client: AsyncClient):
    """
    Verifies that the /api/v1/webhooks/meta alias also succeeds.
    """
    challenge_val = "99887766"
    res = await anon_client.get(
        "/api/v1/webhooks/meta",
        params={
            "hub.mode": "subscribe",
            "hub.challenge": challenge_val,
            "hub.verify_token": settings.META_WEBHOOK_VERIFY_TOKEN,
        },
    )
    assert res.status_code == 200
    assert res.text == challenge_val


@pytest.mark.asyncio
async def test_meta_webhook_verification_forbidden(anon_client: AsyncClient):
    """
    Verifies that GET /webhooks/meta with wrong verify_token is rejected with HTTP 403.
    """
    res = await anon_client.get(
        "/webhooks/meta",
        params={
            "hub.mode": "subscribe",
            "hub.challenge": "12345",
            "hub.verify_token": "wrong_secret_token",
        },
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_meta_webhook_comment_ingestion(anon_client: AsyncClient):
    """
    Simulates Meta pushing an Instagram reel comment webhook event.
    Verifies comment creation in database and linking to deliverable.
    """
    unique_id = uuid.uuid4()
    ig_biz_id = f"ig_biz_{unique_id.hex[:8]}"
    post_id = f"media_{unique_id.hex[:8]}"
    ext_comment_id = f"comment_{unique_id.hex[:8]}"

    # Seed agency, client, social account, campaign, deliverable
    async with TestSessionLocal() as db:
        agency = Agency(id=unique_id, name="Webhook Agency", slug=f"webhook-{unique_id.hex[:8]}")
        db.add(agency)
        client = Client(id=uuid.uuid4(), agency_id=unique_id, business_name="Glow Skincare")
        db.add(client)
        await db.flush()

        social_account = ClientSocialAccount(
            id=uuid.uuid4(),
            client_id=client.id,
            platform="instagram",
            account_name="Glow Skincare Official",
            account_handle="@glowskincare",
            instagram_business_id=ig_biz_id,
            access_token="mock_token",
            is_active=True,
        )
        db.add(social_account)

        campaign = Campaign(id=uuid.uuid4(), client_id=client.id, name="Summer Glow Campaign")
        db.add(campaign)
        await db.flush()

        deliverable = Deliverable(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            title="Summer Sunscreen Reel",
            deliverable_type="reels",
            platform="instagram",
            status="published",
            external_post_id=post_id,
            comments_count=2,
        )
        db.add(deliverable)
        await db.commit()

    # Meta Webhook payload for incoming reel comment
    payload = {
        "object": "instagram",
        "entry": [
            {
                "id": ig_biz_id,
                "time": 1700000000,
                "changes": [
                    {
                        "field": "comments",
                        "value": {
                            "id": ext_comment_id,
                            "text": "What is the SPF rating and does it leave a white cast?",
                            "from": {
                                "id": "ig_user_101",
                                "username": "serena_glow",
                            },
                            "media": {
                                "id": post_id,
                                "media_product_type": "REELS",
                            },
                        },
                    }
                ],
            }
        ],
    }

    res = await anon_client.post("/webhooks/meta", json=payload)
    assert res.status_code == 200
    assert res.json() == {"status": "EVENT_RECEIVED"}

    # Verify database persistence
    async with TestSessionLocal() as db:
        c_res = await db.execute(
            select(SocialComment).where(SocialComment.external_comment_id == ext_comment_id)
        )
        comment = c_res.scalar_one_or_none()
        assert comment is not None
        assert comment.author_username == "serena_glow"
        assert comment.comment_text == "What is the SPF rating and does it leave a white cast?"
        assert comment.deliverable_id == deliverable.id
        assert comment.platform == "instagram"

        # Verify deliverable comments_count was incremented from 2 to 3
        d_res = await db.execute(select(Deliverable).where(Deliverable.id == deliverable.id))
        deliv = d_res.scalar_one_or_none()
        assert deliv is not None
        assert deliv.comments_count == 3


@pytest.mark.asyncio
async def test_meta_webhook_dm_ingestion(anon_client: AsyncClient):
    """
    Simulates Meta pushing an Instagram Direct Message webhook event.
    Verifies conversation and message persistence.
    """
    unique_id = uuid.uuid4()
    ig_biz_id = f"ig_biz_dm_{unique_id.hex[:8]}"
    sender_id = f"sender_{unique_id.hex[:8]}"
    mid = f"mid_{unique_id.hex[:8]}"

    async with TestSessionLocal() as db:
        agency = Agency(id=unique_id, name="DM Agency", slug=f"dm-{unique_id.hex[:8]}")
        db.add(agency)
        client = Client(id=uuid.uuid4(), agency_id=unique_id, business_name="Aura Spa")
        db.add(client)
        await db.flush()

        social_account = ClientSocialAccount(
            id=uuid.uuid4(),
            client_id=client.id,
            platform="instagram",
            account_name="Aura Spa",
            account_handle="@auraspa",
            instagram_business_id=ig_biz_id,
            access_token="mock_token",
            is_active=True,
        )
        db.add(social_account)
        await db.commit()

    # Meta Webhook payload for incoming DM
    payload = {
        "object": "instagram",
        "entry": [
            {
                "id": ig_biz_id,
                "time": 1700000000,
                "messaging": [
                    {
                        "sender": {"id": sender_id},
                        "recipient": {"id": ig_biz_id},
                        "timestamp": 1700000000000,
                        "message": {
                            "mid": mid,
                            "text": "Can I book a massage for this Saturday?",
                        },
                    }
                ],
            }
        ],
    }

    res = await anon_client.post("/webhooks/meta", json=payload)
    assert res.status_code == 200
    assert res.json() == {"status": "EVENT_RECEIVED"}

    async with TestSessionLocal() as db:
        conv_res = await db.execute(
            select(SocialConversation).where(SocialConversation.external_thread_id == sender_id)
        )
        conv = conv_res.scalar_one_or_none()
        assert conv is not None
        assert conv.last_message_text == "Can I book a massage for this Saturday?"

        msg_res = await db.execute(
            select(SocialMessage).where(SocialMessage.external_message_id == mid)
        )
        msg = msg_res.scalar_one_or_none()
        assert msg is not None
        assert msg.message_text == "Can I book a massage for this Saturday?"
        assert msg.is_from_brand is False


@pytest.mark.asyncio
async def test_meta_webhook_hmac_signature_validation(anon_client: AsyncClient):
    """
    Verifies that valid HMAC-SHA256 signature passes and tampered signature is rejected.
    """
    payload = {"object": "instagram", "entry": []}
    raw_body = json.dumps(payload).encode("utf-8")
    valid_sig = compute_meta_signature(raw_body, settings.META_APP_SECRET or "test_secret")

    # Valid signature
    res = await anon_client.post(
        "/webhooks/meta",
        content=raw_body,
        headers={"Content-Type": "application/json", "X-Hub-Signature-256": valid_sig},
    )
    assert res.status_code == 200

    # Tampered signature
    res_tampered = await anon_client.post(
        "/webhooks/meta",
        content=raw_body,
        headers={"Content-Type": "application/json", "X-Hub-Signature-256": "sha256=invalidhex00000000"},
    )
    assert res_tampered.status_code == 403


@pytest.mark.asyncio
async def test_social_metrics_worker_sync():
    """
    Verifies that the social metrics worker runs cleanly, updates deliverable views/likes/shares,
    and commits.
    """
    from unittest.mock import AsyncMock, patch
    from app.services.metrics_worker import sync_account_metrics

    unique_id = uuid.uuid4()
    ig_biz_id = f"ig_{unique_id.hex[:8]}"
    post_id = f"post_{unique_id.hex[:8]}"

    async with TestSessionLocal() as db:
        agency = Agency(id=unique_id, name="Metrics Agency", slug=f"metrics-{unique_id.hex[:8]}")
        db.add(agency)
        client = Client(id=uuid.uuid4(), agency_id=unique_id, business_name="Metrics Brand")
        db.add(client)
        await db.flush()

        social_account = ClientSocialAccount(
            id=uuid.uuid4(),
            client_id=client.id,
            platform="instagram",
            account_name="Metrics Brand",
            instagram_business_id=ig_biz_id,
            access_token="test_token",
            is_active=True,
        )
        db.add(social_account)

        campaign = Campaign(id=uuid.uuid4(), client_id=client.id, name="Metrics Campaign")
        db.add(campaign)
        await db.flush()

        deliverable = Deliverable(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            title="Viral Reel",
            deliverable_type="reels",
            platform="instagram",
            status="published",
            external_post_id=post_id,
            views_count=100,
            likes_count=10,
        )
        db.add(deliverable)
        await db.commit()

        mock_telemetry = {
            "posts": [
                {
                    "id": post_id,
                    "views": 4500,
                    "likes_count": 320,
                    "comments_count": 45,
                    "shares_count": 88,
                }
            ]
        }

        with patch("app.services.metrics_worker.fetch_live_meta_telemetry", new_callable=AsyncMock) as mock_fetch, \
             patch("app.services.metrics_worker.sync_client_social_engagement", new_callable=AsyncMock) as mock_eng:
            mock_fetch.return_value = mock_telemetry
            mock_eng.return_value = {"comments_synced": 0, "conversations_synced": 0}

            res = await sync_account_metrics(social_account, db)
            assert res["updated_posts"] == 1

        # Verify updated counts in DB
        await db.refresh(deliverable)
        assert deliverable.views_count == 4500
        assert deliverable.likes_count == 320
        assert deliverable.comments_count == 45
        assert deliverable.shares_count == 88
