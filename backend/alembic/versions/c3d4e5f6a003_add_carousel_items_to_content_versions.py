"""add carousel_items jsonb column to content_versions

Revision ID: c3d4e5f6a003
Revises: b2d3e5f6a002
Create Date: 2026-11-26 01:10:00.000000

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "c3d4e5f6a003"
down_revision: Union[str, None] = "b2d3e5f6a002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE content_versions ADD COLUMN IF NOT EXISTS carousel_items JSONB"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE content_versions DROP COLUMN IF EXISTS carousel_items"
    )
