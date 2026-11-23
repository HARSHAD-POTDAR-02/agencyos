import uuid
import pytest
from datetime import datetime, timezone
from sqlalchemy import select

from tests.conftest import TestSessionLocal
from app.models.cortex import BrandFact, FactAuditLog, KnowledgeChunk, MemorySource
from app.models.client import Client
from app.models.agency import Agency
from app.schemas.cortex import FactReviewDecision
from app.services.cortex_service import cortex_service


@pytest.mark.asyncio
async def test_deterministic_sql_rule_loading():
    """
    Test deterministic SQL rule loading:
    Verifies that active guardrails, taboos, and personas are loaded via pure SQL with 100% recall.
    """
    async with TestSessionLocal() as db_session:
        # 1. Create a test agency and client
        unique_id = uuid.uuid4()
        agency = Agency(
            id=unique_id,
            name="Cortex Test Agency",
            slug=f"cortex-{unique_id.hex[:8]}",
        )
        db_session.add(agency)
        
        client_id = uuid.uuid4()
        client = Client(
            id=client_id,
            agency_id=unique_id,
            business_name="Acme Tech",
            industry="SaaS",
        )
        db_session.add(client)
        await db_session.flush()

        # 2. Add an active taboo and an active guardrail
        taboo = BrandFact(
            id=uuid.uuid4(),
            client_id=client_id,
            scope="client",
            fact_type="taboo",
            status="active",
            statement="Never mention pricing or discounts in public posts.",
            rationale="Client is enterprise-tier value priced.",
            channels=["all"],
            confidence_score=0.95,
        )
        guardrail = BrandFact(
            id=uuid.uuid4(),
            client_id=client_id,
            scope="client",
            fact_type="guardrail",
            status="active",
            statement="Always highlight SOC-2 Type II and HIPAA compliance.",
            rationale="Core differentiator for healthcare buyers.",
            channels=["linkedin"],
            confidence_score=0.90,
        )
        proposed_fact = BrandFact(
            id=uuid.uuid4(),
            client_id=client_id,
            scope="client",
            fact_type="taboo",
            status="proposed",
            statement="Never use emojis in headlines.",
            channels=["all"],
        )
        db_session.add_all([taboo, guardrail, proposed_fact])
        await db_session.commit()

        # 3. Retrieve for LinkedIn: should return taboo (channels: all) and guardrail (channels: linkedin)
        linkedin_rules = await cortex_service.get_deterministic_rules(
            db=db_session,
            client_id=client_id,
            channel="linkedin",
        )
        assert len(linkedin_rules["taboos"]) == 1
        assert linkedin_rules["taboos"][0]["statement"] == taboo.statement
        assert len(linkedin_rules["guardrails"]) == 1
        assert linkedin_rules["guardrails"][0]["statement"] == guardrail.statement

        # 4. Retrieve for Instagram: should return taboo, but NOT the linkedin-only guardrail
        instagram_rules = await cortex_service.get_deterministic_rules(
            db=db_session,
            client_id=client_id,
            channel="instagram",
        )
        assert len(instagram_rules["taboos"]) == 1
        assert instagram_rules["taboos"][0]["statement"] == taboo.statement
        assert len(instagram_rules["guardrails"]) == 0


@pytest.mark.asyncio
async def test_document_ingestion_and_chunking():
    """
    Test document ingestion, chunking, and pgvector embedding storage.
    """
    async with TestSessionLocal() as db_session:
        unique_id = uuid.uuid4()
        agency = Agency(
            id=unique_id,
            name="Cortex Ingest Agency",
            slug=f"ingest-{unique_id.hex[:8]}",
        )
        db_session.add(agency)
        client_id = uuid.uuid4()
        client = Client(
            id=client_id,
            agency_id=unique_id,
            business_name="Vertex Tech",
            industry="Cloud",
        )
        db_session.add(client)
        await db_session.flush()

        doc_content = (
            "Vertex Cloud Technologies delivers high-throughput streaming compute for distributed systems. "
            "Our target audience consists of VP of Infrastructure and Chief Technology Officers. "
            "Never compare latency numbers against legacy vendors without linking verified independent benchmarks."
        )

        source = await cortex_service.ingest_source_and_create_chunks(
            db=db_session,
            client_id=client_id,
            source_type="document",
            title="Vertex Brand Positioning Guide v1",
            raw_content=doc_content,
            metadata={"author": "Strategy Director"},
            channels=["all"],
        )

        assert source.id is not None
        assert source.title == "Vertex Brand Positioning Guide v1"

        # Verify chunks exist in knowledge_chunks table
        res = await db_session.execute(
            select(KnowledgeChunk).where(KnowledgeChunk.source_id == source.id)
        )
        chunks = res.scalars().all()
        assert len(chunks) >= 1
        assert len(chunks[0].embedding) == 1536


@pytest.mark.asyncio
async def test_rule_lifecycle_and_conflict_superseding():
    """
    Test rule lifecycle (proposed -> active -> superseded) and audit trail.
    """
    async with TestSessionLocal() as db_session:
        unique_id = uuid.uuid4()
        agency = Agency(
            id=unique_id,
            name="Cortex Lifecycle Agency",
            slug=f"life-{unique_id.hex[:8]}",
        )
        db_session.add(agency)
        client_id = uuid.uuid4()
        client = Client(
            id=client_id,
            agency_id=unique_id,
            business_name="Rule Client",
            industry="E-Commerce",
        )
        db_session.add(client)
        await db_session.flush()

        actor_id = uuid.uuid4()

        # Create active rule
        old_rule = BrandFact(
            id=uuid.uuid4(),
            client_id=client_id,
            scope="client",
            fact_type="guardrail",
            status="active",
            statement="All video clips must be strictly under 30 seconds.",
            channels=["all"],
            confidence_score=0.9,
        )
        # Create proposed rule that supersedes old rule
        new_rule = BrandFact(
            id=uuid.uuid4(),
            client_id=client_id,
            scope="client",
            fact_type="guardrail",
            status="proposed",
            statement="Reels can be up to 60 seconds if narrative pacing requires it.",
            channels=["instagram"],
            confidence_score=0.88,
            supersedes_fact_id=old_rule.id,
        )
        db_session.add_all([old_rule, new_rule])
        await db_session.commit()

        # Execute review decision: supersede_existing
        decision = FactReviewDecision(
            action="supersede_existing",
            target_superseded_fact_id=old_rule.id,
            reviewer_notes="Approved for Q4 product launch extensions.",
        )
        updated_new_rule = await cortex_service.review_fact(
            db=db_session,
            fact_id=new_rule.id,
            decision=decision,
            actor_id=actor_id,
        )

        assert updated_new_rule.status == "active"
        assert updated_new_rule.approved_by == actor_id

        # Verify old rule was superseded
        await db_session.refresh(old_rule)
        assert old_rule.status == "superseded"

        # Verify audit logs
        audit_res = await db_session.execute(
            select(FactAuditLog).where(FactAuditLog.fact_id.in_([old_rule.id, new_rule.id]))
        )
        logs = audit_res.scalars().all()
        assert len(logs) == 2


@pytest.mark.asyncio
async def test_living_brand_vault_compilation():
    """
    Test dynamic compilation of the read-only Living Brand Document.
    """
    async with TestSessionLocal() as db_session:
        unique_id = uuid.uuid4()
        agency = Agency(
            id=unique_id,
            name="Test Agency",
            slug=f"vault-{unique_id.hex[:8]}",
        )
        db_session.add(agency)

        client_id = uuid.uuid4()
        client = Client(
            id=client_id,
            agency_id=unique_id,
            business_name="Solaria Bio",
            industry="Biotech",
        )
        db_session.add(client)

        taboo = BrandFact(
            id=uuid.uuid4(),
            client_id=client_id,
            scope="client",
            fact_type="taboo",
            status="active",
            statement="Never make unsubstantiated clinical cure claims.",
            rationale="FDA compliance risk.",
            channels=["all"],
        )
        guardrail = BrandFact(
            id=uuid.uuid4(),
            client_id=client_id,
            scope="client",
            fact_type="guardrail",
            status="active",
            statement="Tone must remain academic, empirical, and restrained.",
            channels=["linkedin"],
        )
        persona = BrandFact(
            id=uuid.uuid4(),
            client_id=client_id,
            scope="client",
            fact_type="persona",
            status="active",
            statement="Principal Investigators & Clinical Trial Directors.",
            rationale="High skepticism, reads peer-reviewed citations only.",
            channels=["all"],
        )
        db_session.add_all([taboo, guardrail, persona])
        await db_session.commit()

        vault = await cortex_service.compile_living_brand_vault(db=db_session, client_id=client_id)
        assert vault.client_name == "Solaria Bio"
        assert vault.total_active_rules == 3
        assert vault.taboos_count == 1
        assert vault.guardrails_count == 1
        assert vault.personas_count == 1
        assert "# Solaria Bio — Living Brand Vault" in vault.compiled_markdown
        assert "Never make unsubstantiated clinical cure claims." in vault.compiled_markdown
