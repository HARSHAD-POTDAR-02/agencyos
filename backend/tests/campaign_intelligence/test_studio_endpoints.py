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
from app.models.deliverable import Deliverable
from app.models.studio_artifact import (
    CampaignStudioSession,
    StudioArtifact,
    StudioArtifactStatus,
    StudioArtifactVersion,
)
from app.models.user import Membership, RoleEnum, User
from app.schemas.campaign import (
    ChatBriefRequest,
    ChatMessage,
    StudioApproveVersionRequest,
)
from app.routers.campaigns import (
    approve_studio_artifact_endpoint,
    chat_brief_endpoint,
    get_studio_artifact_detail,
    list_studio_artifacts,
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
        name="Apex Creative",
        slug=f"apex-{uuid.uuid4().hex[:6]}",
    )
    db.add(agency)
    await db.flush()

    user = User(
        id=uuid.uuid4(),
        email=f"strategist_{uuid.uuid4().hex[:6]}@apex.com",
        hashed_password="pw",
        full_name="Lead Strategist",
    )
    db.add(user)
    await db.flush()

    membership = Membership(
        id=uuid.uuid4(),
        user_id=user.id,
        agency_id=agency.id,
        role=RoleEnum.strategist,
        is_active=True,
    )
    db.add(membership)
    await db.flush()

    client = Client(
        id=uuid.uuid4(),
        agency_id=agency.id,
        business_name="Artisanal Roaster Co",
        industry="Specialty Coffee",
        status=ClientStatus.active,
    )
    db.add(client)
    await db.flush()

    campaign = Campaign(
        id=uuid.uuid4(),
        client_id=client.id,
        name="Winter Single-Origin Launch",
        status=CampaignStatus.planning,
        period_month=11,
        period_year=2026,
    )
    db.add(campaign)
    await db.flush()

    return agency, client, campaign, user, membership


# =====================================================================
# 1. Specialist Conversation Dispatch & Draft Artifact Creation
# =====================================================================
@pytest.mark.asyncio
async def test_specialist_chat_creates_draft_artifact_without_production_mutation(db_session: AsyncSession):
    agency, client, campaign, user, membership = await _seed_test_env(db_session)

    request = ChatBriefRequest(
        agent_id="content_architect",
        campaign_id=campaign.id,
        messages=[
            ChatMessage(role="user", content="Draft a high-retention 20-second Reel storyboard introducing the Ethiopian Yirgacheffe harvest."),
        ],
        period_month=11,
        period_year=2026,
    )

    response = await chat_brief_endpoint(
        agency_id=agency.id,
        client_id=client.id,
        payload=request,
        membership=membership,
        db=db_session,
    )

    # 1. Verify response structure
    assert response.agent_id == "content_architect"
    assert response.artifact_id is not None
    assert response.artifact_type == "storyboard"
    assert response.artifact_version_number == 1
    assert response.artifact_payload is not None
    assert "scenes" in response.artifact_payload
    assert len(response.artifact_payload["scenes"]) >= 2
    assert response.session_id is not None

    # 2. Verify draft table persistence
    art = await db_session.get(StudioArtifact, response.artifact_id)
    assert art is not None
    assert art.agency_id == agency.id
    assert art.campaign_id == campaign.id
    assert art.status == StudioArtifactStatus.draft.value
    assert art.current_version_number == 1

    ver_stmt = select(StudioArtifactVersion).where(
        StudioArtifactVersion.artifact_id == art.id,
        StudioArtifactVersion.version_number == 1,
    )
    ver = (await db_session.execute(ver_stmt)).scalars().first()
    assert ver is not None
    assert ver.is_approved is False
    assert ver.payload["deliverable_title"] == response.artifact_payload["deliverable_title"]

    # 3. CRITICAL ACCEPTANCE GATE: Verify production deliverables table remains 100% EMPTY
    deliv_count_stmt = select(Deliverable).where(Deliverable.campaign_id == campaign.id)
    deliv_records = (await db_session.execute(deliv_count_stmt)).scalars().all()
    assert len(deliv_records) == 0, "Propose layer must NEVER mutate production deliverables table!"


# =====================================================================
# 2. Conversational Revision with active_artifact_id Increments Version
# =====================================================================
@pytest.mark.asyncio
async def test_specialist_chat_revision_increments_version_number(db_session: AsyncSession):
    agency, client, campaign, user, membership = await _seed_test_env(db_session)

    # Initial draft creation
    req1 = ChatBriefRequest(
        agent_id="content_architect",
        campaign_id=campaign.id,
        messages=[
            ChatMessage(role="user", content="Draft a Reel concept for cold brew launch."),
        ],
        period_month=11,
        period_year=2026,
    )
    res1 = await chat_brief_endpoint(agency.id, client.id, req1, membership, db_session)
    artifact_id = res1.artifact_id
    assert res1.artifact_version_number == 1

    # Conversational revision referencing active_artifact_id
    req2 = ChatBriefRequest(
        agent_id="content_architect",
        campaign_id=campaign.id,
        active_artifact_id=artifact_id,
        messages=[
            ChatMessage(role="user", content="Make the hook more punchy and add lighting notes."),
        ],
        period_month=11,
        period_year=2026,
    )
    res2 = await chat_brief_endpoint(agency.id, client.id, req2, membership, db_session)

    assert res2.artifact_id == artifact_id
    assert res2.artifact_version_number == 2

    # Verify both versions exist in database
    v_stmt = select(StudioArtifactVersion).where(StudioArtifactVersion.artifact_id == artifact_id).order_by(StudioArtifactVersion.version_number)
    versions = (await db_session.execute(v_stmt)).scalars().all()
    assert len(versions) == 2
    assert [v.version_number for v in versions] == [1, 2]


# =====================================================================
# 3. Artifact Listing, Detail & Version Approval Gate
# =====================================================================
@pytest.mark.asyncio
async def test_artifact_listing_detail_and_approval_workflow(db_session: AsyncSession):
    agency, client, campaign, user, membership = await _seed_test_env(db_session)

    # 1. Create artifact
    req = ChatBriefRequest(
        agent_id="content_architect",
        campaign_id=campaign.id,
        messages=[ChatMessage(role="user", content="Reel concept.")],
    )
    res = await chat_brief_endpoint(agency.id, client.id, req, membership, db_session)
    artifact_id = res.artifact_id

    # 2. List artifacts
    artifact_list = await list_studio_artifacts(agency.id, campaign.id, membership, db_session)
    assert len(artifact_list) == 1
    assert artifact_list[0].id == artifact_id
    assert artifact_list[0].status == StudioArtifactStatus.draft.value

    # 3. Get detail
    detail = await get_studio_artifact_detail(agency.id, campaign.id, artifact_id, membership, db_session)
    assert detail.id == artifact_id
    assert len(detail.versions) == 1

    # 4. Approve version 1
    approve_req = StudioApproveVersionRequest(version_number=1)
    approved_detail = await approve_studio_artifact_endpoint(
        agency_id=agency.id,
        campaign_id=campaign.id,
        artifact_id=artifact_id,
        payload=approve_req,
        membership=membership,
        db=db_session,
    )
    assert approved_detail.status == StudioArtifactStatus.approved.value
    assert approved_detail.latest_version.is_approved is True
    assert approved_detail.latest_version.approved_by_id == user.id

    # 5. Subsequent revision resets status back to draft
    rev_req = ChatBriefRequest(
        agent_id="content_architect",
        campaign_id=campaign.id,
        active_artifact_id=artifact_id,
        messages=[ChatMessage(role="user", content="Revise scene 2.")],
    )
    rev_res = await chat_brief_endpoint(agency.id, client.id, rev_req, membership, db_session)
    assert rev_res.artifact_version_number == 2

    # Status of artifact must now be reset to draft!
    updated_art = await db_session.get(StudioArtifact, artifact_id)
    assert updated_art.status == StudioArtifactStatus.draft.value


# =====================================================================
# 4. Multi-Tenant Boundary Enforcement
# =====================================================================
@pytest.mark.asyncio
async def test_tenant_isolation_rejects_cross_agency_artifact_access(db_session: AsyncSession):
    agency1, client1, campaign1, user1, membership1 = await _seed_test_env(db_session)

    # Seed second agency
    agency2 = Agency(id=uuid.uuid4(), name="Rival Agency", slug=f"rival-{uuid.uuid4().hex[:6]}")
    db_session.add(agency2)
    user2 = User(id=uuid.uuid4(), email="user2@rival.com", hashed_password="pw", full_name="User 2")
    db_session.add(user2)
    membership2 = Membership(id=uuid.uuid4(), user_id=user2.id, agency_id=agency2.id, role=RoleEnum.owner)
    db_session.add(membership2)
    await db_session.flush()

    # Create artifact in Agency 1
    req = ChatBriefRequest(
        agent_id="content_architect",
        campaign_id=campaign1.id,
        messages=[ChatMessage(role="user", content="Create artifact.")],
    )
    res = await chat_brief_endpoint(agency1.id, client1.id, req, membership1, db_session)

    # Attempt access from Agency 2 -> MUST be rejected with 403 or 404
    with pytest.raises(HTTPException) as exc_info:
        await get_studio_artifact_detail(agency2.id, campaign1.id, res.artifact_id, membership2, db_session)
    assert exc_info.value.status_code in [403, 404]

    with pytest.raises(HTTPException) as exc_info:
        await approve_studio_artifact_endpoint(
            agency2.id,
            campaign1.id,
            res.artifact_id,
            StudioApproveVersionRequest(version_number=1),
            membership2,
            db_session,
        )
    assert exc_info.value.status_code in [403, 404]
