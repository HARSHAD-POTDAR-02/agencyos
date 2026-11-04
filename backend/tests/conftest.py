"""
Pytest fixtures for the AgencyOS test suite.

Uses an in-memory SQLite database (via aiosqlite) to avoid needing a live
Postgres instance.  httpx.AsyncClient is used to drive the FastAPI app.
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import timedelta
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import Base, get_db
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.agency import Agency
from app.models.user import Membership, RoleEnum, User

# ---------------------------------------------------------------------------
# Engine & session factory for tests (SQLite in-memory)
# ---------------------------------------------------------------------------

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
)

TestSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


# ---------------------------------------------------------------------------
# Override the app's DB dependency
# ---------------------------------------------------------------------------


async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    async with TestSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


app.dependency_overrides[get_db] = override_get_db


# ---------------------------------------------------------------------------
# Create / drop all tables once per test session
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_database():
    async with test_engine.begin() as conn:
        import app.models  # noqa: F401 — registers all models on metadata
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


# ---------------------------------------------------------------------------
# Helper: seed a user + agency + membership
# ---------------------------------------------------------------------------


async def _create_user_and_agency(
    db: AsyncSession,
    email: str,
    agency_name: str,
    agency_slug: str,
) -> tuple[User, Agency, Membership]:
    user = User(
        id=uuid.uuid4(),
        email=email,
        hashed_password=hash_password("TestPass123!"),
        full_name="Test User",
    )
    db.add(user)
    await db.flush()

    agency = Agency(
        id=uuid.uuid4(),
        name=agency_name,
        slug=agency_slug,
    )
    db.add(agency)
    await db.flush()

    membership = Membership(
        id=uuid.uuid4(),
        user_id=user.id,
        agency_id=agency.id,
        role=RoleEnum.owner,
    )
    db.add(membership)
    await db.commit()
    await db.refresh(user)
    await db.refresh(agency)
    return user, agency, membership


# ---------------------------------------------------------------------------
# Agency A fixtures
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture(scope="session")
async def agency_a_data() -> tuple[User, Agency]:
    async with TestSessionLocal() as db:
        user, agency, _ = await _create_user_and_agency(
            db,
            email="owner_a@example.com",
            agency_name="Agency Alpha",
            agency_slug="agency-alpha",
        )
    return user, agency


@pytest_asyncio.fixture(scope="session")
async def agency_b_data() -> tuple[User, Agency]:
    async with TestSessionLocal() as db:
        user, agency, _ = await _create_user_and_agency(
            db,
            email="owner_b@example.com",
            agency_name="Agency Beta",
            agency_slug="agency-beta",
        )
    return user, agency


# ---------------------------------------------------------------------------
# Authenticated httpx clients (one per agency)
# ---------------------------------------------------------------------------


def _make_token(user_id: uuid.UUID) -> str:
    return create_access_token({"sub": str(user_id)})


@pytest_asyncio.fixture(scope="session")
async def agency_a_client(agency_a_data: tuple[User, Agency]) -> AsyncClient:
    user, _ = agency_a_data
    token = _make_token(user.id)
    transport = ASGITransport(app=app)
    client = AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Authorization": f"Bearer {token}"},
    )
    async with client:
        yield client


@pytest_asyncio.fixture(scope="session")
async def agency_b_client(agency_b_data: tuple[User, Agency]) -> AsyncClient:
    user, _ = agency_b_data
    token = _make_token(user.id)
    transport = ASGITransport(app=app)
    client = AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Authorization": f"Bearer {token}"},
    )
    async with client:
        yield client


# ---------------------------------------------------------------------------
# Un-authenticated client (for auth tests)
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture(scope="session")
async def anon_client() -> AsyncClient:
    transport = ASGITransport(app=app)
    client = AsyncClient(transport=transport, base_url="http://test")
    async with client:
        yield client
