"""
Authentication tests.
"""
from __future__ import annotations

from datetime import timedelta

import pytest
from httpx import AsyncClient

from app.core.security import create_access_token


REGISTER_URL = "/auth/register"
LOGIN_URL = "/auth/login"
ME_URL = "/auth/me"


@pytest.mark.asyncio
async def test_register_and_login(anon_client: AsyncClient):
    """Full happy-path: register → login → /auth/me returns the user."""
    email = "happy_user@example.com"
    password = "StrongPass!99"
    full_name = "Happy User"

    # Register
    reg_resp = await anon_client.post(
        REGISTER_URL,
        json={"email": email, "password": password, "full_name": full_name},
    )
    assert reg_resp.status_code == 201, reg_resp.text
    user_data = reg_resp.json()
    assert user_data["email"] == email

    # Login
    login_resp = await anon_client.post(
        LOGIN_URL,
        json={"email": email, "password": password},
    )
    assert login_resp.status_code == 200, login_resp.text
    token_data = login_resp.json()
    assert "access_token" in token_data

    # /auth/me
    me_resp = await anon_client.get(
        ME_URL,
        headers={"Authorization": f"Bearer {token_data['access_token']}"},
    )
    assert me_resp.status_code == 200, me_resp.text
    me = me_resp.json()
    assert me["email"] == email
    assert me["full_name"] == full_name


@pytest.mark.asyncio
async def test_invalid_password_rejected(anon_client: AsyncClient):
    """Login with the wrong password must return 401."""
    email = "wrong_pass@example.com"
    # Register first
    await anon_client.post(
        REGISTER_URL,
        json={"email": email, "password": "CorrectPass!1", "full_name": "Wrong Pass"},
    )

    login_resp = await anon_client.post(
        LOGIN_URL,
        json={"email": email, "password": "WrongPassword!"},
    )
    assert login_resp.status_code == 401, login_resp.text


@pytest.mark.asyncio
async def test_expired_token_rejected(anon_client: AsyncClient):
    """A JWT that is already expired must be rejected with 401."""
    import uuid

    expired_token = create_access_token(
        data={"sub": str(uuid.uuid4())},
        expires_delta=timedelta(seconds=-1),  # already expired
    )
    me_resp = await anon_client.get(
        ME_URL,
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert me_resp.status_code == 401, me_resp.text
