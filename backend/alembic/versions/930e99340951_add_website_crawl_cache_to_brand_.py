"""add_website_crawl_cache_to_brand_profiles

Revision ID: 930e99340951
Revises: 36ff63652442
Create Date: 2026-11-20 13:42:36.092755

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON


# revision identifiers, used by Alembic.
revision: str = '930e99340951'
down_revision: Union[str, None] = '36ff63652442'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("brand_profiles", sa.Column("website_crawl_cache", JSON, nullable=True))


def downgrade() -> None:
    op.drop_column("brand_profiles", "website_crawl_cache")
