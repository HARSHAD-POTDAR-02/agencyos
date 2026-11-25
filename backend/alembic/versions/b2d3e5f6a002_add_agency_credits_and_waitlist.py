"""add agency credits_balance and waitlist table

Revision ID: b2d3e5f6a002
Revises: a1c0r7e4x001
Create Date: 2026-11-25 22:05:00.000000

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "b2d3e5f6a002"
down_revision: Union[str, None] = "a1c0r7e4x001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add credits_balance to agencies (idempotent for existing local DBs)
    op.execute(
        "ALTER TABLE agencies ADD COLUMN IF NOT EXISTS credits_balance INTEGER NOT NULL DEFAULT 1000"
    )

    # 2. Create waitlist table (idempotent)
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS waitlist (
            id UUID PRIMARY KEY,
            email VARCHAR(255) NOT NULL UNIQUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_waitlist_email ON waitlist (email)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_waitlist_email")
    op.execute("DROP TABLE IF EXISTS waitlist")
    op.execute("ALTER TABLE agencies DROP COLUMN IF EXISTS credits_balance")
