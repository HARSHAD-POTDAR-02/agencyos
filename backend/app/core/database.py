from __future__ import annotations

from pathlib import Path
from typing import AsyncGenerator

from sqlalchemy import create_engine, event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


def _normalize_sqlite_url(url: str) -> str:
    """Ensure relative SQLite database URLs always resolve to the workspace root."""
    if not url.startswith("sqlite"):
        return url
    prefix, sep, rest = url.partition(":///")
    if rest.startswith("./") or rest.startswith(".\\") or not Path(rest).is_absolute():
        clean_rel = rest.lstrip("./").lstrip(".\\")
        project_root = Path(__file__).resolve().parent.parent.parent.parent
        abs_db_path = (project_root / clean_rel).resolve().as_posix()
        return f"{prefix}:///{abs_db_path}"
    return url


# ---------------------------------------------------------------------------
# Async engine (used by the application at runtime)
# ---------------------------------------------------------------------------

effective_db_url = _normalize_sqlite_url(settings.DATABASE_URL)
effective_sync_url = _normalize_sqlite_url(settings.SYNC_DATABASE_URL)

is_sqlite = effective_db_url.startswith("sqlite")
engine_kwargs = {"echo": settings.APP_ENV == "development"}
if not is_sqlite:
    engine_kwargs.update({"pool_pre_ping": True, "pool_size": 10, "max_overflow": 20})
else:
    engine_kwargs["connect_args"] = {"timeout": 60.0, "check_same_thread": False}

async_engine = create_async_engine(
    effective_db_url,
    **engine_kwargs,
)

if is_sqlite:
    @event.listens_for(async_engine.sync_engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=60000")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()

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
if not effective_sync_url.startswith("sqlite"):
    sync_kwargs["pool_pre_ping"] = True
else:
    sync_kwargs["connect_args"] = {"timeout": 30.0, "check_same_thread": False}

sync_engine = create_engine(
    effective_sync_url,
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
