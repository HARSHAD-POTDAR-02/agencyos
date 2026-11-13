import asyncio
import uuid
from typing import AsyncGenerator
from unittest.mock import AsyncMock, patch
import pytest
import pytest_asyncio
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import TestSessionLocal, test_engine
from app.core.database import Base
from app.models.agency import Agency
from app.models.campaign import Campaign, CampaignStatus
from app.models.client import Client, ClientStatus
from app.models.studio_artifact import (
    CampaignStudioSession,
    StudioArtifact,
    StudioArtifactStatus,
    StudioArtifactVersion,
)
from app.models.user import Membership, RoleEnum, User
from app.campaign_intelligence.schemas.campaign import CampaignBrief
from app.campaign_intelligence.schemas.studio_context import CampaignStudioContext
from app.campaign_intelligence.services.studio_service import (
    approve_artifact_version,
    export_artifact_to_production,
    get_or_create_studio_session,
    save_or_revise_artifact,
)
from app.campaign_intelligence.specialists.content_architect_adapter import (
    ContentArchitectAdapter,
)
from app.campaign_intelligence.specialists.market_research_adapter import (
    MarketResearchSpecialistAdapter,
)


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with test_engine.begin() as conn:
        import app.models  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)
    async with TestSessionLocal() as session:
        yield session


async def _seed_test_env(db: AsyncSession) -> tuple[Agency, Client, Campaign, User, Membership]:
    agency = Agency(
        id=uuid.uuid4(),
        name="Failure Testing Agency",
        slug=f"fail-{uuid.uuid4().hex[:6]}",
    )
    db.add(agency)
    await db.flush()

    user = User(
        id=uuid.uuid4(),
        email=f"tester_{uuid.uuid4().hex[:6]}@fail.com",
        hashed_password="pw",
        full_name="Reliability QA",
    )
    db.add(user)
    await db.flush()

    membership = Membership(
        id=uuid.uuid4(),
        user_id=user.id,
        agency_id=agency.id,
        role=RoleEnum.owner,
        is_active=True,
    )
    db.add(membership)
    await db.flush()

    client = Client(
        id=uuid.uuid4(),
        agency_id=agency.id,
        business_name="Robustness Corp",
        industry="Enterprise Tech",
        status=ClientStatus.active,
    )
    db.add(client)
    await db.flush()

    campaign = Campaign(
        id=uuid.uuid4(),
        client_id=client.id,
        name="Reliability Drill 2026",
        status=CampaignStatus.planning,
        period_month=11,
        period_year=2026,
    )
    db.add(campaign)
    await db.flush()

    return agency, client, campaign, user, membership


# =====================================================================
# 1. Draft Revision Resets Approval Status (Gate Protection)
# =====================================================================
@pytest.mark.asyncio
async def test_revision_resets_approval_status(db_session: AsyncSession):
    """
    When an approved artifact receives a new draft revision, its parent
    status MUST immediately reset to 'draft'. This prevents accidentally
    exporting unvetted revisions without explicit manager sign-off.
    """
    agency, client, campaign, user, _ = await _seed_test_env(db_session)
    session = await get_or_create_studio_session(
        agency_id=agency.id,
        client_id=client.id,
        campaign_id=campaign.id,
        user_id=user.id,
        db=db_session,
    )

    # 1. Create v1
    artifact, v1 = await save_or_revise_artifact(
        session_id=session.id,
        agency_id=agency.id,
        client_id=client.id,
        campaign_id=campaign.id,
        artifact_type="storyboard",
        title="Initial Storyboard",
        payload={"scenes": [{"scene_number": 1, "text": "Draft 1"}]},
        actor_type="specialist",
        actor_id="content_architect",
        db=db_session,
    )
    assert artifact.status == StudioArtifactStatus.draft.value

    # 2. Approve v1
    await approve_artifact_version(
        artifact_id=artifact.id,
        version_number=1,
        agency_id=agency.id,
        campaign_id=campaign.id,
        user_id=user.id,
        db=db_session,
    )
    await db_session.commit()

    # Re-fetch parent artifact: should be approved
    art_stmt = select(StudioArtifact).where(StudioArtifact.id == artifact.id)
    refreshed = (await db_session.execute(art_stmt)).scalars().first()
    assert refreshed.status == StudioArtifactStatus.approved.value

    # 3. User revises artifact, producing v2
    artifact_v2, v2 = await save_or_revise_artifact(
        session_id=session.id,
        agency_id=agency.id,
        client_id=client.id,
        campaign_id=campaign.id,
        artifact_id=artifact.id,
        parent_version_id=v1.id,
        artifact_type="storyboard",
        title="Initial Storyboard (Revised)",
        payload={"scenes": [{"scene_number": 1, "text": "Draft 2 with new hook"}]},
        actor_type="user",
        actor_id=str(user.id),
        change_summary="Punchier opening beat",
        db=db_session,
    )
    await db_session.commit()

    # 4. Status must be reset to 'draft', v2 must NOT be approved
    assert artifact_v2.status == StudioArtifactStatus.draft.value
    assert artifact_v2.current_version_number == 2
    assert v2.is_approved is False

    # Attempting to export v2 must fail because v2 is unapproved
    with pytest.raises(HTTPException) as exc:
        await export_artifact_to_production(
            agency_id=agency.id,
            campaign_id=campaign.id,
            artifact_id=artifact.id,
            expected_version_number=2,
            user_id=user.id,
            idempotency_key="fail-key-unapproved-v2",
            raw_payload_dict={"artifact_id": str(artifact.id), "expected_version_number": 2},
            db=db_session,
        )
    assert exc.value.status_code == 400
    assert "has not been approved" in exc.value.detail


# =====================================================================
# 2. Serialized Concurrent Version Appends (SELECT FOR UPDATE)
# =====================================================================
@pytest.mark.asyncio
async def test_concurrent_version_append_serialized(db_session: AsyncSession):
    """
    Verify that consecutive revisions on an existing artifact correctly
    increment the version counter without collision or data loss.
    """
    agency, client, campaign, user, _ = await _seed_test_env(db_session)
    session = await get_or_create_studio_session(
        agency_id=agency.id,
        client_id=client.id,
        campaign_id=campaign.id,
        user_id=user.id,
        db=db_session,
    )

    # Create root artifact
    artifact, v1 = await save_or_revise_artifact(
        session_id=session.id,
        agency_id=agency.id,
        client_id=client.id,
        campaign_id=campaign.id,
        artifact_type="storyboard",
        title="Sequential Revision Test",
        payload={"scenes": [{"scene_number": 1}]},
        actor_type="specialist",
        actor_id="content_architect",
        db=db_session,
    )
    await db_session.commit()

    # Append 4 sequential revisions
    prev_v_id = v1.id
    for v_num in range(2, 6):
        art, v = await save_or_revise_artifact(
            session_id=session.id,
            agency_id=agency.id,
            client_id=client.id,
            campaign_id=campaign.id,
            artifact_id=artifact.id,
            parent_version_id=prev_v_id,
            artifact_type="storyboard",
            title=f"Sequential Revision Test v{v_num}",
            payload={"scenes": [{"scene_number": 1, "rev": v_num}]},
            actor_type="specialist",
            actor_id="content_architect",
            change_summary=f"Automated iteration {v_num}",
            db=db_session,
        )
        await db_session.commit()
        assert art.current_version_number == v_num
        assert v.version_number == v_num
        prev_v_id = v.id

    # Verify all 5 versions exist in database
    v_stmt = select(StudioArtifactVersion).where(StudioArtifactVersion.artifact_id == artifact.id).order_by(StudioArtifactVersion.version_number.asc())
    versions = (await db_session.execute(v_stmt)).scalars().all()
    assert len(versions) == 5
    assert [v.version_number for v in versions] == [1, 2, 3, 4, 5]


# =====================================================================
# 3. LLM Network Timeout / Error Recovery in Specialists
# =====================================================================
@pytest.mark.asyncio
async def test_specialist_llm_network_timeout_graceful_recovery(db_session: AsyncSession):
    """
    If the underlying LLM call raises a timeout or connectivity error,
    the specialist adapter must not crash with an uncaught 500 error;
    it should handle the error and raise an informative exception.
    """
    adapter = MarketResearchSpecialistAdapter()
    agency_id = uuid.uuid4()
    client_id = uuid.uuid4()
    context = CampaignStudioContext(
        campaign_id=uuid.uuid4(),
        client_id=client_id,
        agency_id=agency_id,
        client_name="AeroDynamics",
        client_industry="Aviation",
        campaign_brief=CampaignBrief(
            agency_id=agency_id,
            client_id=client_id,
            period_month=11,
            period_year=2026,
            objective="Analyze competitors in private jet catering",
        ),
        mode="fast",
    )

    from app.campaign_intelligence.schemas.research import ResearchEvidence

    fake_evidence = [
        ResearchEvidence(
            source_title="Aviation Catering Trends 2026",
            source_url="https://aviation-insights.org/catering",
            publisher="Aviation Journal",
            excerpt="Demand for artisanal menus in corporate aviation rose 40%.",
            key_takeaway="Artisanal menus drive private aviation differentiation.",
            relevance_score=0.9,
        )
    ]

    from app.campaign_intelligence.runtime.schemas import ToolExecutionResult, ExecutionStatus
    from langchain_core.messages import AIMessage
    fake_tool_res = ToolExecutionResult(
        status=ExecutionStatus.NORMAL_COMPLETION,
        final_message=AIMessage(content="Summary of catering"),
    )

    with patch("app.campaign_intelligence.specialists.market_research_adapter.BoundedToolRuntime.run", AsyncMock(return_value=fake_tool_res)), \
         patch("app.campaign_intelligence.specialists.market_research_adapter.gather_market_evidence", AsyncMock(return_value=fake_evidence)), \
         patch("app.campaign_intelligence.specialists.market_research_adapter.invoke_structured_llm", side_effect=TimeoutError("Connection timed out after 30s")):
        result = await adapter.execute("Analyze competitors in private jet catering", context, db=db_session)
        assert result is not None
        assert result.specialist_id == "market_research"
        assert "analyzed the market landscape" in result.reply
        assert result.artifact_payload is not None
        assert "observed_competitors" in result.artifact_payload


# =====================================================================
# 4. Export Reject Non-Existent Version
# =====================================================================
@pytest.mark.asyncio
async def test_export_nonexistent_version_rejected(db_session: AsyncSession):
    """
    Attempting to export a version number that does not exist returns HTTP 404.
    """
    agency, client, campaign, user, _ = await _seed_test_env(db_session)
    session = await get_or_create_studio_session(
        agency_id=agency.id,
        client_id=client.id,
        campaign_id=campaign.id,
        user_id=user.id,
        db=db_session,
    )
    artifact, _ = await save_or_revise_artifact(
        session_id=session.id,
        agency_id=agency.id,
        client_id=client.id,
        campaign_id=campaign.id,
        artifact_type="carousel",
        title="Slide Deck v1",
        payload={"slides": [{"slide_number": 1}]},
        actor_type="specialist",
        actor_id="content_architect",
        db=db_session,
    )
    await db_session.commit()

    # Attempt to export version 99
    with pytest.raises(HTTPException) as exc:
        await export_artifact_to_production(
            agency_id=agency.id,
            campaign_id=campaign.id,
            artifact_id=artifact.id,
            expected_version_number=99,
            user_id=user.id,
            idempotency_key="key-missing-v99",
            raw_payload_dict={"expected_version_number": 99},
            db=db_session,
        )
    assert exc.value.status_code == 404
    assert "version 99 does not exist" in exc.value.detail
