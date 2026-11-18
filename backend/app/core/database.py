from __future__ import annotations

from pathlib import Path
from typing import AsyncGenerator
import urllib.parse

from sqlalchemy import create_engine, event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


def _normalize_database_urls(
    async_url_raw: str, sync_url_raw: str
) -> tuple[str, dict, str, dict]:
    """
    Normalizes database URLs and connection arguments for both SQLite and PostgreSQL (including Neon).
    Handles SSL and statement_cache_size=0 for connection-pooled serverless PostgreSQL.
    """
    is_sqlite = async_url_raw.startswith("sqlite")
    if is_sqlite:
        # Resolve relative SQLite paths
        def _clean_sqlite(url: str) -> str:
            prefix, sep, rest = url.partition(":///")
            if rest.startswith("./") or rest.startswith(".\\") or not Path(rest).is_absolute():
                clean_rel = rest.lstrip("./").lstrip(".\\")
                project_root = Path(__file__).resolve().parent.parent.parent.parent
                abs_db_path = (project_root / clean_rel).resolve().as_posix()
                return f"{prefix}:///{abs_db_path}"
            return url

        eff_async = _clean_sqlite(async_url_raw)
        eff_sync = _clean_sqlite(sync_url_raw)
        async_kwargs = {
            "echo": settings.APP_ENV == "development",
            "connect_args": {"timeout": 60.0, "check_same_thread": False},
        }
        sync_kwargs = {
            "echo": False,
            "connect_args": {"timeout": 30.0, "check_same_thread": False},
        }
        return eff_async, async_kwargs, eff_sync, sync_kwargs

    # PostgreSQL / Neon handling
    # 1. Async URL for asyncpg
    parsed_async = urllib.parse.urlparse(async_url_raw)
    async_qs = urllib.parse.parse_qs(parsed_async.query)
    is_neon = "neon.tech" in (parsed_async.netloc or "").lower()
    is_supabase = "supabase" in (parsed_async.netloc or "").lower()
    needs_ssl = is_neon or is_supabase or "sslmode" in async_qs or "ssl" in async_qs

    # Clean query string for asyncpg (asyncpg expects ssl via connect_args or ssl=require, rejects sslmode/channel_binding)
    async_qs.pop("sslmode", None)
    async_qs.pop("channel_binding", None)
    if needs_ssl:
        async_qs["ssl"] = ["require"]
    new_async_query = urllib.parse.urlencode(async_qs, doseq=True)

    async_scheme = "postgresql+asyncpg"
    eff_async = urllib.parse.urlunparse((
        async_scheme,
        parsed_async.netloc,
        parsed_async.path,
        parsed_async.params,
        new_async_query,
        parsed_async.fragment,
    ))

    async_connect_args: dict = {}
    if needs_ssl:
        async_connect_args["ssl"] = "require"
    if is_neon or "-pooler" in (parsed_async.netloc or "").lower():
        # Crucial for PgBouncer / Neon transaction poolers:
        async_connect_args["statement_cache_size"] = 0

    async_kwargs = {
        "echo": False,
        "pool_pre_ping": True,
        "pool_size": 10,
        "max_overflow": 20,
        "pool_recycle": 300,
    }
    if async_connect_args:
        async_kwargs["connect_args"] = async_connect_args

    # 2. Sync URL for psycopg2 (Alembic)
    parsed_sync = urllib.parse.urlparse(sync_url_raw or async_url_raw)
    sync_qs = urllib.parse.parse_qs(parsed_sync.query)
    sync_qs.pop("channel_binding", None)
    if needs_ssl and "sslmode" not in sync_qs:
        sync_qs["sslmode"] = ["require"]
    new_sync_query = urllib.parse.urlencode(sync_qs, doseq=True)

    sync_scheme = "postgresql"
    eff_sync = urllib.parse.urlunparse((
        sync_scheme,
        parsed_sync.netloc,
        parsed_sync.path,
        parsed_sync.params,
        new_sync_query,
        parsed_sync.fragment,
    ))
    sync_kwargs = {
        "echo": False,
        "pool_pre_ping": True,
    }

    return eff_async, async_kwargs, eff_sync, sync_kwargs


# ---------------------------------------------------------------------------
# Engines initialization
# ---------------------------------------------------------------------------

effective_db_url, engine_kwargs, effective_sync_url, sync_kwargs = _normalize_database_urls(
    settings.DATABASE_URL, settings.SYNC_DATABASE_URL
)

is_sqlite = effective_db_url.startswith("sqlite")

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
