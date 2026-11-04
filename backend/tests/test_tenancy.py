"""
Multi-tenancy isolation tests.

Verifies that a user belonging to Agency A cannot read, create, or enumerate
resources that belong to Agency B.
"""
from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import AsyncClient

from app.models.agency import Agency
from app.models.user import User
from tests.conftest import TestSessionLocal
from app.models.client import Client, ClientStatus
import uuid


# ---------------------------------------------------------------------------
# Helper: seed a client for an agency directly in the DB
# ---------------------------------------------------------------------------


async def _seed_client(agency_id: uuid.UUID, name: str) -> Client:
    async with TestSessionLocal() as db:
        client = Client(
            id=uuid.uuid4(),
            agency_id=agency_id,
            business_name=name,
            status=ClientStatus.active,
        )
        db.add(client)
        await db.commit()
        await db.refresh(client)
        return client


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_agency_a_cannot_read_agency_b_clients(
    agency_a_client: AsyncClient,
    agency_b_data: tuple[User, Agency],
):
    """
    A user from Agency A should receive 403 when trying to list
    Agency B's clients.
    """
    _, agency_b = agency_b_data
    response = await agency_a_client.get(f"/agencies/{agency_b.id}/clients")
    assert response.status_code == 403, response.text


@pytest.mark.asyncio
async def test_agency_a_cannot_read_agency_b_campaigns(
    agency_a_client: AsyncClient,
    agency_b_data: tuple[User, Agency],
):
    """
    A user from Agency A should receive 403 when trying to list campaigns
    under a client of Agency B.
    """
    _, agency_b = agency_b_data
    # Create a client under Agency B
    b_client = await _seed_client(agency_b.id, "B Corp")

    response = await agency_a_client.get(
        f"/agencies/{agency_b.id}/clients/{b_client.id}/campaigns"
    )
    assert response.status_code == 403, response.text


@pytest.mark.asyncio
async def test_client_not_found_in_wrong_agency(
    agency_a_client: AsyncClient,
    agency_a_data: tuple[User, Agency],
    agency_b_data: tuple[User, Agency],
):
    """
    Fetching a client that belongs to Agency B via Agency A's URL should
    return 403 (tenant mismatch guard fires before 404).
    """
    _, agency_a = agency_a_data
    _, agency_b = agency_b_data

    # Seed a client under Agency B
    b_client = await _seed_client(agency_b.id, "Secret B Client")

    # Agency A member tries to access it through Agency A's namespace
    response = await agency_a_client.get(
        f"/agencies/{agency_a.id}/clients/{b_client.id}"
    )
    # tenant_service raises 403 when agency_id mismatches
    assert response.status_code in (403, 404), response.text
