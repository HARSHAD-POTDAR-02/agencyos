from __future__ import annotations

from typing import AsyncGenerator

from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

# ---------------------------------------------------------------------------
# Async engine (used by the application at runtime)
# ---------------------------------------------------------------------------

is_sqlite = settings.DATABASE_URL.startswith("sqlite")
engine_kwargs = {"echo": settings.APP_ENV == "development"}
if not is_sqlite:
    engine_kwargs.update({"pool_pre_ping": True, "pool_size": 10, "max_overflow": 20})

async_engine = create_async_engine(
    settings.DATABASE_URL,
    **engine_kwargs,
)

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# ---------------------------------------------------------------------------
# Sync engine (used by Alembic migrations only)
# ---------------------------------------------------------------------------

sync_kwargs = {"echo": False}
if not settings.SYNC_DATABASE_URL.startswith("sqlite"):
    sync_kwargs["pool_pre_ping"] = True

sync_engine = create_engine(
    settings.SYNC_DATABASE_URL,
    **sync_kwargs,
)


# ---------------------------------------------------------------------------
# Declarative base shared by all models
# ---------------------------------------------------------------------------


class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async database session and guarantee it is closed afterward."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
