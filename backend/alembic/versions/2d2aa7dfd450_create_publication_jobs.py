"""create_publication_jobs

Revision ID: 2d2aa7dfd450
Revises: 
Create Date: 2026-11-10 17:05:29.944775

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2d2aa7dfd450'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create publication_jobs table
    op.create_table(
        'publication_jobs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('deliverable_id', sa.UUID(), nullable=False),
        sa.Column('content_version_id', sa.UUID(), nullable=False),
        sa.Column('client_social_account_id', sa.UUID(), nullable=False),
        sa.Column('platform', sa.String(length=50), nullable=False),
        sa.Column('publication_operation_id', sa.UUID(), nullable=False),
        sa.Column(
            'status',
            sa.Enum(
                'pending',
                'scheduled',
                'publishing',
                'published',
                'failed',
                'needs_reconnection',
                'ambiguous',
                'cancellation_pending',
                'cancelled',
                name='job_status_enum',
            ),
            nullable=False,
            default='scheduled',
        ),
        sa.Column('scheduled_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('scheduled_timezone', sa.String(length=64), nullable=False, server_default='UTC'),
        sa.Column('next_attempt_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('last_attempt_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('claimed_by', sa.String(length=255), nullable=True),
        sa.Column('claim_token', sa.UUID(), nullable=True),
        sa.Column('lease_expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('heartbeat_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('attempts_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('max_attempts', sa.Integer(), nullable=False, server_default='3'),
        sa.Column('caption_snapshot', sa.Text(), nullable=True),
        sa.Column('media_url_snapshot', sa.String(length=1024), nullable=False),
        sa.Column('share_to_feed', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('external_post_id', sa.String(length=255), nullable=True),
        sa.Column('live_post_url', sa.String(length=512), nullable=True),
        sa.Column('last_error_code', sa.Integer(), nullable=True),
        sa.Column('last_error_subcode', sa.Integer(), nullable=True),
        sa.Column('last_error_message', sa.Text(), nullable=True),
        sa.Column('last_error_category', sa.String(length=50), nullable=True),
        sa.Column('retry_after_seconds', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['client_social_account_id'], ['client_social_accounts.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['content_version_id'], ['content_versions.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['deliverable_id'], ['deliverables.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_pub_jobs_due', 'publication_jobs', ['status', 'next_attempt_at'], unique=False)
    op.create_index('idx_pub_jobs_lease', 'publication_jobs', ['status', 'lease_expires_at'], unique=False)
    op.create_index('ix_publication_jobs_deliverable_id', 'publication_jobs', ['deliverable_id'], unique=False)
    op.create_index('ix_publication_jobs_content_version_id', 'publication_jobs', ['content_version_id'], unique=False)
    op.create_index('ix_publication_jobs_client_social_account_id', 'publication_jobs', ['client_social_account_id'], unique=False)
    op.create_index('ix_publication_jobs_publication_operation_id', 'publication_jobs', ['publication_operation_id'], unique=False)
    op.create_index('ix_publication_jobs_next_attempt_at', 'publication_jobs', ['next_attempt_at'], unique=False)
    op.create_index('ix_publication_jobs_lease_expires_at', 'publication_jobs', ['lease_expires_at'], unique=False)

    # 2. Create publication_attempts table
    op.create_table(
        'publication_attempts',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('publication_job_id', sa.UUID(), nullable=False),
        sa.Column('publication_operation_id', sa.UUID(), nullable=False),
        sa.Column('attempt_number', sa.Integer(), nullable=False),
        sa.Column(
            'status',
            sa.Enum(
                'started',
                'container_created',
                'polling',
                'publishing',
                'published',
                'failed',
                'ambiguous',
                name='attempt_status_enum',
            ),
            nullable=False,
            default='started',
        ),
        sa.Column('claim_token', sa.UUID(), nullable=True),
        sa.Column('external_container_id', sa.String(length=255), nullable=True),
        sa.Column('external_post_id', sa.String(length=255), nullable=True),
        sa.Column('http_status', sa.Integer(), nullable=True),
        sa.Column('meta_error_code', sa.Integer(), nullable=True),
        sa.Column('meta_error_subcode', sa.Integer(), nullable=True),
        sa.Column('meta_error_message', sa.Text(), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['publication_job_id'], ['publication_jobs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('publication_job_id', 'attempt_number', name='uq_pub_attempts_job_num'),
    )
    op.create_index('idx_pub_attempts_container', 'publication_attempts', ['external_container_id'], unique=False)
    op.create_index('ix_publication_attempts_publication_job_id', 'publication_attempts', ['publication_job_id'], unique=False)
    op.create_index('ix_publication_attempts_publication_operation_id', 'publication_attempts', ['publication_operation_id'], unique=False)

    # 3. Add scheduling columns to deliverables
    try:
        op.add_column('deliverables', sa.Column('scheduled_at', sa.DateTime(timezone=True), nullable=True))
        op.create_index('ix_deliverables_scheduled_at', 'deliverables', ['scheduled_at'], unique=False)
    except Exception:
        pass  # Column or index may already exist

    try:
        op.add_column('deliverables', sa.Column('scheduled_timezone', sa.String(length=64), nullable=True))
    except Exception:
        pass


def downgrade() -> None:
    try:
        op.drop_index('ix_deliverables_scheduled_at', table_name='deliverables')
        op.drop_column('deliverables', 'scheduled_timezone')
        op.drop_column('deliverables', 'scheduled_at')
    except Exception:
        pass

    op.drop_index('ix_publication_attempts_publication_operation_id', table_name='publication_attempts')
    op.drop_index('ix_publication_attempts_publication_job_id', table_name='publication_attempts')
    op.drop_index('idx_pub_attempts_container', table_name='publication_attempts')
    op.drop_table('publication_attempts')

    op.drop_index('ix_publication_jobs_lease_expires_at', table_name='publication_jobs')
    op.drop_index('ix_publication_jobs_next_attempt_at', table_name='publication_jobs')
    op.drop_index('ix_publication_jobs_publication_operation_id', table_name='publication_jobs')
    op.drop_index('ix_publication_jobs_client_social_account_id', table_name='publication_jobs')
    op.drop_index('ix_publication_jobs_content_version_id', table_name='publication_jobs')
    op.drop_index('ix_publication_jobs_deliverable_id', table_name='publication_jobs')
    op.drop_index('idx_pub_jobs_lease', table_name='publication_jobs')
    op.drop_index('idx_pub_jobs_due', table_name='publication_jobs')
    op.drop_table('publication_jobs')
