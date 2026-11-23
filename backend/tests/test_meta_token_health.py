import uuid
from datetime import datetime, timedelta, timezone

import pytest
from app.models.client_social_account import ClientSocialAccount
from app.routers.social import compute_token_health, format_social_account_out


def test_token_health_active():
    account = ClientSocialAccount(
        id=uuid.uuid4(),
        client_id=uuid.uuid4(),
        platform="instagram",
        account_name="Acme Corp",
        access_token="fake_token",
        token_expires_at=datetime.now(timezone.utc) + timedelta(days=45),
        is_active=True,
    )
    status_str, days_rem, is_exp, msg, exp_date = compute_token_health(account)
    assert status_str == "active"
    assert days_rem == 45 or days_rem == 44
    assert is_exp is False
    assert "Token active" in msg

    out = format_social_account_out(account)
    assert out.token_status == "active"
    assert out.is_expired is False
    assert out.days_remaining in (44, 45)


def test_token_health_expiring_soon():
    account = ClientSocialAccount(
        id=uuid.uuid4(),
        client_id=uuid.uuid4(),
        platform="instagram",
        account_name="Acme Corp",
        access_token="fake_token",
        token_expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        is_active=True,
    )
    status_str, days_rem, is_exp, msg, exp_date = compute_token_health(account)
    assert status_str == "expiring_soon"
    assert days_rem in (6, 7)
    assert is_exp is False
    assert "expiring in" in msg.lower()

    out = format_social_account_out(account)
    assert out.token_status == "expiring_soon"
    assert out.is_expired is False


def test_token_health_expired():
    account = ClientSocialAccount(
        id=uuid.uuid4(),
        client_id=uuid.uuid4(),
        platform="facebook",
        account_name="Acme Facebook",
        access_token="fake_token",
        token_expires_at=datetime.now(timezone.utc) - timedelta(days=2),
        is_active=True,
    )
    status_str, days_rem, is_exp, msg, exp_date = compute_token_health(account)
    assert status_str == "expired"
    assert days_rem == 0
    assert is_exp is True
    assert "expired" in msg.lower()

    out = format_social_account_out(account)
    assert out.token_status == "expired"
    assert out.is_expired is True
    assert out.days_remaining == 0


def test_token_health_fallback_to_60_days():
    # When token_expires_at is None, it defaults to 60 days from updated_at or created_at
    account = ClientSocialAccount(
        id=uuid.uuid4(),
        client_id=uuid.uuid4(),
        platform="instagram",
        account_name="Acme Corp",
        access_token="fake_token",
        token_expires_at=None,
        created_at=datetime.now(timezone.utc) - timedelta(days=10),
        updated_at=datetime.now(timezone.utc) - timedelta(days=10),
        is_active=True,
    )
    status_str, days_rem, is_exp, msg, exp_date = compute_token_health(account)
    assert status_str == "active"
    assert days_rem in (49, 50)
    assert is_exp is False
