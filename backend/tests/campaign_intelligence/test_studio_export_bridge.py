import uuid
from datetime import date
from typing import AsyncGenerator
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
from app.models.content_version import ContentVersion
from app.models.deliverable import Deliverable
from app.models.studio_artifact import (
    CampaignStudioSession,
    StudioArtifact,
    StudioArtifactStatus,
    StudioArtifactVersion,
    StudioExport,
)
from app.models.task import Task
from app.models.user import Membership, RoleEnum, User
from app.campaign_intelligence.services.studio_service import (
    approve_artifact_version,
    export_artifact_to_production,
    get_or_create_studio_session,
    save_or_revise_artifact,
)
from app.routers.campaigns import export_studio_artifact_pipeline_endpoint
from app.schemas.campaign import (
    StudioExportPipelineRequest,
    StudioExportPipelineResponse,
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
        name="Production Apex",
        slug=f"apex-{uuid.uuid4().hex[:6]}",
    )
    db.add(agency)
    await db.flush()

    user = User(
        id=uuid.uuid4(),
        email=f"producer_{uuid.uuid4().hex[:6]}@apex.com",
        hashed_password="pw",
        full_name="Senior Creative Producer",
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
        business_name="BrewCraft Innovations",
        industry="Beverage",
        status=ClientStatus.active,
    )
    db.add(client)
    await db.flush()

    campaign = Campaign(
        id=uuid.uuid4(),
        client_id=client.id,
        name="Nitro Cold Brew Launch",
        status=CampaignStatus.planning,
        period_month=11,
        period_year=2026,
    )
    db.add(campaign)
    await db.flush()

    return agency, client, campaign, user, membership


# =====================================================================
# 1. Successful Export of Approved Artifact to Deliverable + Task
# =====================================================================
@pytest.mark.asyncio
async def test_export_approved_artifact_to_production(db_session: AsyncSession):
    agency, client, campaign, user, membership = await _seed_test_env(db_session)

    session = await get_or_create_studio_session(
        agency_id=agency.id,
        client_id=client.id,
        campaign_id=campaign.id,
        user_id=user.id,
        db=db_session,
    )

    storyboard_payload = {
        "deliverable_title": "Nitro Pour ASMR Hero Reel",
        "format_type": "reel_storyboard",
        "platform": "instagram",
        "target_duration_seconds": 30,
        "scenes": [
            {
                "scene_number": 1,
                "timestamp_range": "0:00-0:03",
                "shot_type": "Macro close-up",
                "visual_action": "Nitro cascading through chilled glass in extreme slow motion",
                "voiceover": "Stop settling for burnt office water.",
                "on_screen_text": "Real nitro cold brew.",
                "camera_movement": "Push in slowly",
                "flux_image_prompt": "Cinematic macro shot of nitro coffee cascading foam bubbles",
            },
            {
                "scene_number": 2,
                "timestamp_range": "0:03-0:07",
                "shot_type": "Medium action",
                "visual_action": "Founder tapping the keg and pulling fresh cold brew",
                "voiceover": "Micro-roasted in small batches right here.",
                "on_screen_text": "Zero bitter bite.",
                "camera_movement": "Side pan right",
            },
        ],
        "primary_caption": "Your 3 PM slump doesn't stand a chance.",
        "hashtags": ["#coldbrew", "#specialtycoffee"],
        "call_to_action": "Tap link in bio to claim your first flight free",
    }

    artifact, version = await save_or_revise_artifact(
        session_id=session.id,
        agency_id=agency.id,
        client_id=client.id,
        campaign_id=campaign.id,
        artifact_type="storyboard",
        title="Nitro Pour ASMR Hero Reel",
        payload=storyboard_payload,
        actor_type="specialist",
        actor_id="content_architect",
        db=db_session,
    )
    await db_session.commit()

    # Approve version 1
    await approve_artifact_version(
        artifact_id=artifact.id,
        version_number=1,
        agency_id=agency.id,
        campaign_id=campaign.id,
        user_id=user.id,
        db=db_session,
    )
    await db_session.commit()

    # Export via endpoint
    req = StudioExportPipelineRequest(
        artifact_id=artifact.id,
        expected_version_number=1,
        assignee_id=user.id,
        default_due_date=date(2026, 11, 20),
        target_format="reel_storyboard",
        deliverable_name="Nitro Pour ASMR Hero Reel (Final)",
    )
    idempotency_key = f"export-test-{uuid.uuid4().hex}"

    res: StudioExportPipelineResponse = await export_studio_artifact_pipeline_endpoint(
        agency_id=agency.id,
        campaign_id=campaign.id,
        payload=req,
        x_idempotency_key=idempotency_key,
        membership=membership,
        db=db_session,
    )

    assert res.is_replay is False
    assert res.deliverable_id is not None
    assert res.task_id is not None
    assert res.deliverable_title == "Nitro Pour ASMR Hero Reel (Final)"

    # Verify Deliverable in DB
    deliv_stmt = select(Deliverable).where(Deliverable.id == res.deliverable_id)
    deliv = (await db_session.execute(deliv_stmt)).scalars().first()
    assert deliv is not None
    assert deliv.campaign_id == campaign.id
    assert deliv.title == "Nitro Pour ASMR Hero Reel (Final)"
    assert deliv.deliverable_type == "reel_storyboard"
    assert deliv.platform == "instagram"
    assert deliv.planned_date == date(2026, 11, 20)

    # Verify Task in DB
    task_stmt = select(Task).where(Task.id == res.task_id)
    task = (await db_session.execute(task_stmt)).scalars().first()
    assert task is not None
    assert task.deliverable_id == deliv.id
    assert task.assignee_id == user.id
    assert task.due_date == date(2026, 11, 20)
    assert "Storyboard with 2 scenes" in (task.notes or "")

    # Verify all multi-stage tasks created for reel
    all_tasks = (await db_session.execute(select(Task).where(Task.deliverable_id == deliv.id))).scalars().all()
    assert len(all_tasks) == 4
    stage_types = {t.task_type for t in all_tasks}
    assert stage_types == {"scripting", "filming", "editing", "approval"}

    # Verify initial ContentVersion (Version 1) created with caption and brief doc
    cv_stmt = select(ContentVersion).where(ContentVersion.deliverable_id == deliv.id)
    cv = (await db_session.execute(cv_stmt)).scalars().first()
    assert cv is not None
    assert cv.version_number == 1
    assert cv.caption is not None
    assert "Nitro Pour" in cv.caption or "Nitro" in cv.caption or len(cv.caption) > 0
    assert cv.file_name.endswith(".txt")
    assert cv.storage_key is not None

    # Verify Artifact status updated to 'exported'
    art_stmt = select(StudioArtifact).where(StudioArtifact.id == artifact.id)
    refreshed_art = (await db_session.execute(art_stmt)).scalars().first()
    assert refreshed_art.status == StudioArtifactStatus.exported.value

    # Verify StudioExport audit entry
    export_stmt = select(StudioExport).where(StudioExport.id == res.export_id)
    export_rec = (await db_session.execute(export_stmt)).scalars().first()
    assert export_rec is not None
    assert export_rec.idempotency_key == idempotency_key
    assert export_rec.agency_id == agency.id
    assert export_rec.campaign_id == campaign.id


# =====================================================================
# 2. Rejection of Unapproved Artifact Versions
# =====================================================================
@pytest.mark.asyncio
async def test_export_unapproved_artifact_raises_400(db_session: AsyncSession):
    agency, client, campaign, user, membership = await _seed_test_env(db_session)

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
        title="Draft Carousel",
        payload={"slides": [{"slide_number": 1, "headline": "Unapproved slide"}]},
        actor_type="specialist",
        actor_id="content_architect",
        db=db_session,
    )
    await db_session.commit()

    # Attempt to export without approval
    req = StudioExportPipelineRequest(
        artifact_id=artifact.id,
        expected_version_number=1,
    )
    with pytest.raises(HTTPException) as exc_info:
        await export_studio_artifact_pipeline_endpoint(
            agency_id=agency.id,
            campaign_id=campaign.id,
            payload=req,
            x_idempotency_key="unapproved-key-1",
            membership=membership,
            db=db_session,
        )

    assert exc_info.value.status_code == 400
    assert "not been approved" in exc_info.value.detail

    # Verify no deliverables were created
    delivs = (await db_session.execute(select(Deliverable).where(Deliverable.campaign_id == campaign.id))).scalars().all()
    assert len(delivs) == 0


# =====================================================================
# 3. Idempotency Replay (Identical Key & Fingerprint Returns Cached IDs)
# =====================================================================
@pytest.mark.asyncio
async def test_export_idempotency_replay(db_session: AsyncSession):
    agency, client, campaign, user, membership = await _seed_test_env(db_session)

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
        artifact_type="storyboard",
        title="Replay Storyboard",
        payload={"scenes": [{"scene_number": 1, "voiceover": "Replay VO"}]},
        actor_type="specialist",
        actor_id="content_architect",
        db=db_session,
    )
    await approve_artifact_version(
        artifact_id=artifact.id,
        version_number=1,
        agency_id=agency.id,
        campaign_id=campaign.id,
        user_id=user.id,
        db=db_session,
    )
    await db_session.commit()

    req = StudioExportPipelineRequest(
        artifact_id=artifact.id,
        expected_version_number=1,
        deliverable_name="Idempotent Reel",
    )
    fixed_key = "idempotency-key-canonical-42"

    # First call -> creates records
    res1 = await export_studio_artifact_pipeline_endpoint(
        agency_id=agency.id,
        campaign_id=campaign.id,
        payload=req,
        x_idempotency_key=fixed_key,
        membership=membership,
        db=db_session,
    )
    assert res1.is_replay is False

    # Second call -> identical request returns is_replay=True with exact same IDs
    res2 = await export_studio_artifact_pipeline_endpoint(
        agency_id=agency.id,
        campaign_id=campaign.id,
        payload=req,
        x_idempotency_key=fixed_key,
        membership=membership,
        db=db_session,
    )
    assert res2.is_replay is True
    assert res2.deliverable_id == res1.deliverable_id
    assert res2.task_id == res1.task_id
    assert res2.export_id == res1.export_id

    # Verify in DB there is strictly only 1 Deliverable and the canonical 4 tasks without duplicates
    delivs = (await db_session.execute(select(Deliverable).where(Deliverable.campaign_id == campaign.id))).scalars().all()
    assert len(delivs) == 1

    tasks = (await db_session.execute(select(Task).where(Task.deliverable_id == res1.deliverable_id))).scalars().all()
    assert len(tasks) == 4


# =====================================================================
# 4. Idempotency Collision with Differing Payload Raises 400
# =====================================================================
@pytest.mark.asyncio
async def test_export_idempotency_conflict_raises_400(db_session: AsyncSession):
    agency, client, campaign, user, membership = await _seed_test_env(db_session)

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
        artifact_type="storyboard",
        title="Conflict Storyboard",
        payload={"scenes": [{"scene_number": 1, "voiceover": "VO 1"}]},
        actor_type="specialist",
        actor_id="content_architect",
        db=db_session,
    )
    await approve_artifact_version(
        artifact_id=artifact.id,
        version_number=1,
        agency_id=agency.id,
        campaign_id=campaign.id,
        user_id=user.id,
        db=db_session,
    )
    await db_session.commit()

    shared_key = "conflict-collision-key-999"

    req1 = StudioExportPipelineRequest(
        artifact_id=artifact.id,
        expected_version_number=1,
        deliverable_name="Original Name",
    )
    await export_studio_artifact_pipeline_endpoint(
        agency_id=agency.id,
        campaign_id=campaign.id,
        payload=req1,
        x_idempotency_key=shared_key,
        membership=membership,
        db=db_session,
    )

    # Re-using the same key with different payload parameters
    req2 = StudioExportPipelineRequest(
        artifact_id=artifact.id,
        expected_version_number=1,
        deliverable_name="Completely Changed Name",
    )
    with pytest.raises(HTTPException) as exc_info:
        await export_studio_artifact_pipeline_endpoint(
            agency_id=agency.id,
            campaign_id=campaign.id,
            payload=req2,
            x_idempotency_key=shared_key,
            membership=membership,
            db=db_session,
        )

    assert exc_info.value.status_code == 400
    assert "differing request payload" in exc_info.value.detail


# =====================================================================
# 5. Multi-Tenant Isolation: Cross-Agency Export Rejected
# =====================================================================
@pytest.mark.asyncio
async def test_cross_tenant_export_rejected(db_session: AsyncSession):
    agency1, client1, campaign1, user1, membership1 = await _seed_test_env(db_session)

    session = await get_or_create_studio_session(
        agency_id=agency1.id,
        client_id=client1.id,
        campaign_id=campaign1.id,
        user_id=user1.id,
        db=db_session,
    )
    artifact, _ = await save_or_revise_artifact(
        session_id=session.id,
        agency_id=agency1.id,
        client_id=client1.id,
        campaign_id=campaign1.id,
        artifact_type="storyboard",
        title="Agency1 Private Storyboard",
        payload={"scenes": [{"scene_number": 1}]},
        actor_type="specialist",
        actor_id="content_architect",
        db=db_session,
    )
    await approve_artifact_version(
        artifact_id=artifact.id,
        version_number=1,
        agency_id=agency1.id,
        campaign_id=campaign1.id,
        user_id=user1.id,
        db=db_session,
    )
    await db_session.commit()

    # Create Agency 2
    agency2 = Agency(id=uuid.uuid4(), name="Rival Agency", slug=f"rival-{uuid.uuid4().hex[:6]}")
    db_session.add(agency2)
    user2 = User(id=uuid.uuid4(), email="spy@rival.com", hashed_password="pw", full_name="Spy")
    db_session.add(user2)
    membership2 = Membership(id=uuid.uuid4(), user_id=user2.id, agency_id=agency2.id, role=RoleEnum.owner)
    db_session.add(membership2)
    await db_session.commit()

    req = StudioExportPipelineRequest(
        artifact_id=artifact.id,
        expected_version_number=1,
    )

    # Agency 2 attempts to export Agency 1's artifact under Agency 2's context
    with pytest.raises(HTTPException) as exc_info:
        await export_studio_artifact_pipeline_endpoint(
            agency_id=agency2.id,
            campaign_id=campaign1.id,  # doesn't belong to agency2
            payload=req,
            x_idempotency_key="cross-tenant-key",
            membership=membership2,
            db=db_session,
        )
    # assert_campaign_belongs_to_agency raises 403
    assert exc_info.value.status_code == 403
