"""Alembic environment configuration."""
from __future__ import annotations

import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

# ---------------------------------------------------------------------------
# Load all models so their tables are registered on Base.metadata
# ---------------------------------------------------------------------------
# This is critical for autogenerate to detect schema changes.
import app.models  # noqa: F401
from app.core.database import Base, sync_engine
from app.core.config import settings

# Alembic Config object (gives access to alembic.ini values)
config = context.config

# Override the sqlalchemy.url from our settings so we don't have to
# hard-code credentials in alembic.ini.
config.set_main_option("sqlalchemy.url", settings.SYNC_DATABASE_URL)

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """
    Run migrations in 'offline' mode.
    This configures the context with just a URL and not an Engine;
    calls to context.execute() emit the SQL to stdout.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """
    Run migrations in 'online' mode — an Engine is created and a connection
    is associated with the context.
    """
    connectable = sync_engine

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
