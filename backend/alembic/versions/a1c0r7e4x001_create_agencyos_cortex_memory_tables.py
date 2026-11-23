"""create agencyos cortex memory tables

Revision ID: a1c0r7e4x001
Revises: 930e99340951
Create Date: 2026-11-23 17:15:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'a1c0r7e4x001'
down_revision = '930e99340951'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Enable pgvector extension
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")

    # 2. Create memory_sources table
    op.execute("""
    CREATE TABLE IF NOT EXISTS memory_sources (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id UUID NOT NULL,
        source_type VARCHAR(32) NOT NULL CHECK (
            source_type IN ('document', 'transcript', 'revision_triple', 'performance_metric')
        ),
        title VARCHAR(255) NOT NULL,
        raw_content TEXT NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        processed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """)

    # 3. Create brand_facts table
    op.execute("""
    CREATE TABLE IF NOT EXISTS brand_facts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id UUID,
        scope VARCHAR(16) NOT NULL DEFAULT 'client' CHECK (
            scope IN ('agency', 'client', 'campaign')
        ),
        campaign_id UUID,
        fact_type VARCHAR(24) NOT NULL CHECK (
            fact_type IN ('guardrail', 'persona', 'winning_pattern', 'taboo')
        ),
        status VARCHAR(16) NOT NULL DEFAULT 'proposed' CHECK (
            status IN ('proposed', 'active', 'superseded', 'archived')
        ),
        statement TEXT NOT NULL,
        rationale TEXT,
        channels JSONB NOT NULL DEFAULT '["all"]'::jsonb,
        confidence_score DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        source_id UUID REFERENCES memory_sources(id) ON DELETE SET NULL,
        provenance_quote TEXT,
        provenance_location VARCHAR(128),
        supersedes_fact_id UUID REFERENCES brand_facts(id) ON DELETE SET NULL,
        expires_at TIMESTAMPTZ,
        approved_by UUID,
        approved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """)

    # 4. Indexes for brand_facts
    op.execute("""
    CREATE INDEX IF NOT EXISTS idx_brand_facts_active_lookup
        ON brand_facts (client_id, status, scope)
        WHERE status = 'active';
    """)

    op.execute("""
    CREATE INDEX IF NOT EXISTS idx_brand_facts_channels
        ON brand_facts USING GIN (channels);
    """)

    # 5. Create knowledge_chunks table
    op.execute("""
    CREATE TABLE IF NOT EXISTS knowledge_chunks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id UUID NOT NULL,
        source_id UUID NOT NULL REFERENCES memory_sources(id) ON DELETE CASCADE,
        fact_id UUID REFERENCES brand_facts(id) ON DELETE SET NULL,
        chunk_type VARCHAR(32) NOT NULL DEFAULT 'transcript_segment',
        content TEXT NOT NULL,
        embedding vector(1536) NOT NULL,
        performance_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
        channels JSONB NOT NULL DEFAULT '["all"]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """)

    # 6. HNSW Cosine Index for knowledge_chunks
    op.execute("""
    CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_hnsw
        ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);
    """)

    # 7. Create fact_audit_logs table
    op.execute("""
    CREATE TABLE IF NOT EXISTS fact_audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        fact_id UUID NOT NULL REFERENCES brand_facts(id) ON DELETE CASCADE,
        actor_id UUID NOT NULL,
        action VARCHAR(24) NOT NULL CHECK (
            action IN ('approved', 'superseded', 'rejected', 'archived')
        ),
        previous_status VARCHAR(16),
        new_status VARCHAR(16) NOT NULL,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """)


def downgrade():
    op.execute("DROP TABLE IF EXISTS fact_audit_logs CASCADE;")
    op.execute("DROP TABLE IF EXISTS knowledge_chunks CASCADE;")
    op.execute("DROP TABLE IF EXISTS brand_facts CASCADE;")
    op.execute("DROP TABLE IF EXISTS memory_sources CASCADE;")
