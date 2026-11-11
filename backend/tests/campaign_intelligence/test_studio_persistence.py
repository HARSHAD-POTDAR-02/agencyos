import hashlib
import json
import uuid
from typing import AsyncGenerator
import pytest
import pytest_asyncio
from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import TestSessionLocal, test_engine
from app.core.database import Base


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with test_engine.begin() as conn:
        import app.models  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)
    async with TestSessionLocal() as session:
        yield session

from app.campaign_intelligence.services.studio_service import (
    approve_artifact_version,
    check_idempotency_or_existing_export,
    compute_request_fingerprint,
    get_or_create_studio_session,
    save_or_revise_artifact,
)
from app.models.agency import Agency
from app.models.campaign import Campaign, CampaignStatus
from app.models.client import Client, ClientStatus
from app.models.studio_artifact import (
    CampaignStudioSession,
    StudioArtifact,
    StudioArtifactStatus,
    StudioArtifactVersion,
    StudioExport,
)
from app.models.user import Membership, RoleEnum, User


async def _seed_test_campaign(db: AsyncSession) -> tuple[Agency, Client, Campaign, User]:
    agency = Agency(
        id=uuid.uuid4(),
        name="Creative Apex Agency",
        slug=f"creative-apex-{uuid.uuid4().hex[:6]}",
    )
    db.add(agency)
    await db.flush()

    user = User(
        id=uuid.uuid4(),
        email=f"director_{uuid.uuid4().hex[:6]}@agency.com",
        hashed_password="hashed_pw",
        full_name="Creative Director",
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
        business_name="The Artisanal Roaster",
        industry="Food & Beverage",
        status=ClientStatus.active,
    )
    db.add(client)
    await db.flush()

    campaign = Campaign(
        id=uuid.uuid4(),
        client_id=client.id,
        name="Autumn Blend Sprint 2026",
        status=CampaignStatus.planning,
    )
    db.add(campaign)
    await db.flush()

    return agency, client, campaign, user


# =====================================================================
# 1. Studio Session Creation & Multi-Tenant Isolation
# =====================================================================
@pytest.mark.asyncio
async def test_studio_session_creation_and_tenancy(db_session: AsyncSession):
    agency, client, campaign, user = await _seed_test_campaign(db_session)

    # 1. Successful session creation
    session = await get_or_create_studio_session(
        campaign_id=campaign.id,
        client_id=client.id,
        agency_id=agency.id,
        user_id=user.id,
        db=db_session,
    )
    assert session.id is not None
    assert session.campaign_id == campaign.id
    assert session.agency_id == agency.id

    # 2. Re-fetching session returns the same session
    session_again = await get_or_create_studio_session(
        campaign_id=campaign.id,
        client_id=client.id,
        agency_id=agency.id,
        user_id=user.id,
        db=db_session,
    )
    assert session_again.id == session.id

    # 3. Cross-tenant access attempt by unauthorized agency must raise 404
    unauthorized_agency_id = uuid.uuid4()
    with pytest.raises(HTTPException) as exc_info:
        await get_or_create_studio_session(
            campaign_id=campaign.id,
            client_id=client.id,
            agency_id=unauthorized_agency_id,
            user_id=user.id,
            db=db_session,
        )
    assert exc_info.value.status_code == 404


# =====================================================================
# 2. Versioned Artifact Creation & Immutability
# =====================================================================
@pytest.mark.asyncio
async def test_artifact_version_creation_and_immutability(db_session: AsyncSession):
    agency, client, campaign, user = await _seed_test_campaign(db_session)
    session = await get_or_create_studio_session(
        campaign_id=campaign.id,
        client_id=client.id,
        agency_id=agency.id,
        user_id=user.id,
        db=db_session,
    )

    # 1. Create Version 1
    v1_payload = {
        "deliverable_title": "Day 1: Cold Brew Hook",
        "scenes": [{"scene_number": 1, "action": "Pouring iced coffee over glass"}],
    }
    artifact, v1 = await save_or_revise_artifact(
        session_id=session.id,
        agency_id=agency.id,
        client_id=client.id,
        campaign_id=campaign.id,
        artifact_type="storyboard",
        title="Day 1: Cold Brew Hook",
        payload=v1_payload,
        actor_type="specialist",
        actor_id="content_architect",
        db=db_session,
    )
    assert artifact.current_version_number == 1
    assert v1.version_number == 1
    assert v1.payload["deliverable_title"] == "Day 1: Cold Brew Hook"

    # 2. Revise Artifact to Version 2
    v2_payload = {
        "deliverable_title": "Day 1: Cold Brew Hook (Tightened Cut)",
        "scenes": [{"scene_number": 1, "action": "Whip pan into dripping espresso"}],
    }
    artifact_updated, v2 = await save_or_revise_artifact(
        session_id=session.id,
        agency_id=agency.id,
        client_id=client.id,
        campaign_id=campaign.id,
        artifact_type="storyboard",
        title="Day 1: Cold Brew Hook (Tightened Cut)",
        payload=v2_payload,
        actor_type="user",
        actor_id=str(user.id),
        artifact_id=artifact.id,
        parent_version_id=v1.id,
        change_summary="Tightened Scene 1 timing",
        db=db_session,
    )
    assert artifact_updated.id == artifact.id
    assert artifact_updated.current_version_number == 2
    assert v2.version_number == 2
    assert v2.parent_version_id == v1.id
    assert v2.change_summary == "Tightened Scene 1 timing"

    # Verify Version 1 remains completely immutable
    assert v1.version_number == 1
    assert v1.payload["deliverable_title"] == "Day 1: Cold Brew Hook"


# =====================================================================
# 3. Unique Constraint Protection Against Duplicate Versions
# =====================================================================
@pytest.mark.asyncio
async def test_duplicate_version_number_unique_constraint(db_session: AsyncSession):
    agency, client, campaign, user = await _seed_test_campaign(db_session)
    session = await get_or_create_studio_session(
        campaign_id=campaign.id,
        client_id=client.id,
        agency_id=agency.id,
        user_id=user.id,
        db=db_session,
    )

    artifact, v1 = await save_or_revise_artifact(
        session_id=session.id,
        agency_id=agency.id,
        client_id=client.id,
        campaign_id=campaign.id,
        artifact_type="storyboard",
        title="Reel Concept",
        payload={"scenes": []},
        actor_type="specialist",
        actor_id="content_architect",
        db=db_session,
    )

    # Attempting to manually insert another version with the EXACT SAME version_number must raise IntegrityError
    dup_v1 = StudioArtifactVersion(
        id=uuid.uuid4(),
        artifact_id=artifact.id,
        version_number=1,  # Duplicate of v1!
        actor_type="specialist",
        actor_id="content_architect",
        schema_version="1.0",
        payload={"scenes": []},
    )
    db_session.add(dup_v1)
    with pytest.raises(IntegrityError):
        await db_session.flush()

    await db_session.rollback()


# =====================================================================
# 4. Explicit Version-Level Approval Gate
# =====================================================================
@pytest.mark.asyncio
async def test_version_level_approval_gate(db_session: AsyncSession):
    agency, client, campaign, user = await _seed_test_campaign(db_session)
    session = await get_or_create_studio_session(
        campaign_id=campaign.id,
        client_id=client.id,
        agency_id=agency.id,
        user_id=user.id,
        db=db_session,
    )

    # Create Version 1
    artifact, v1 = await save_or_revise_artifact(
        session_id=session.id,
        agency_id=agency.id,
        client_id=client.id,
        campaign_id=campaign.id,
        artifact_type="storyboard",
        title="Reel Concept",
        payload={"scenes": [{"scene_number": 1}]},
        actor_type="specialist",
        actor_id="content_architect",
        db=db_session,
    )
    assert v1.is_approved is False

    # Explicitly approve Version 1
    approved_v1 = await approve_artifact_version(
        artifact_id=artifact.id,
        version_number=1,
        agency_id=agency.id,
        campaign_id=campaign.id,
        user_id=user.id,
        db=db_session,
    )
    assert approved_v1.is_approved is True
    assert approved_v1.approved_by_id == user.id
    assert approved_v1.approved_at is not None
    assert artifact.status == StudioArtifactStatus.approved.value

    # Now create Version 2 (a new draft edit)
    artifact_revised, v2 = await save_or_revise_artifact(
        session_id=session.id,
        agency_id=agency.id,
        client_id=client.id,
        campaign_id=campaign.id,
        artifact_type="storyboard",
        title="Reel Concept Rev 2",
        payload={"scenes": [{"scene_number": 1}, {"scene_number": 2}]},
        actor_type="user",
        actor_id=str(user.id),
        artifact_id=artifact.id,
        parent_version_id=v1.id,
        db=db_session,
    )

    # CRITICAL: Version 2 must be draft (NOT approved!). Approval does not leak across revisions!
    assert v2.is_approved is False
    assert v2.approved_by_id is None
    assert artifact_revised.status == StudioArtifactStatus.draft.value
    # Version 1 remains approved
    assert approved_v1.is_approved is True


# =====================================================================
# 5. Idempotency Key & Canonical Fingerprint Protection
# =====================================================================
@pytest.mark.asyncio
async def test_idempotency_fingerprint_and_recovery(db_session: AsyncSession):
    agency, client, campaign, user = await _seed_test_campaign(db_session)

    export_payload = {
        "artifact_id": str(uuid.uuid4()),
        "expected_version_number": 1,
        "workflow_preset": "full_agency",
    }
    idempotency_key = "idemp_test_998877"
    fingerprint = compute_request_fingerprint(export_payload)

    # 1. No export exists initially
    existing = await check_idempotency_or_existing_export(
        agency_id=agency.id,
        idempotency_key=idempotency_key,
        request_fingerprint=fingerprint,
        db=db_session,
    )
    assert existing is None

    # Create dummy export record
    session = await get_or_create_studio_session(
        campaign_id=campaign.id,
        client_id=client.id,
        agency_id=agency.id,
        user_id=user.id,
        db=db_session,
    )
    artifact, v1 = await save_or_revise_artifact(
        session_id=session.id,
        agency_id=agency.id,
        client_id=client.id,
        campaign_id=campaign.id,
        artifact_type="storyboard",
        title="Exported Storyboard",
        payload=export_payload,
        actor_type="specialist",
        actor_id="content_architect",
        db=db_session,
    )

    export_record = StudioExport(
        id=uuid.uuid4(),
        artifact_version_id=v1.id,
        agency_id=agency.id,
        client_id=client.id,
        campaign_id=campaign.id,
        exported_by_id=user.id,
        idempotency_key=idempotency_key,
        request_fingerprint=fingerprint,
        production_mapping={"deliverable_ids": [str(uuid.uuid4())], "task_ids": [str(uuid.uuid4())]},
    )
    db_session.add(export_record)
    await db_session.flush()

    # 2. Retrying export with identical key and identical fingerprint returns existing record (no re-insertion!)
    existing_hit = await check_idempotency_or_existing_export(
        agency_id=agency.id,
        idempotency_key=idempotency_key,
        request_fingerprint=fingerprint,
        db=db_session,
    )
    assert existing_hit is not None
    assert existing_hit.id == export_record.id

    # 3. Retrying with identical key but DIFFERENT payload fingerprint must raise HTTP 400
    different_payload = {
        "artifact_id": str(uuid.uuid4()),
        "expected_version_number": 2,  # Changed version!
        "workflow_preset": "solo_creator",
    }
    different_fingerprint = compute_request_fingerprint(different_payload)

    with pytest.raises(HTTPException) as exc_info:
        await check_idempotency_or_existing_export(
            agency_id=agency.id,
            idempotency_key=idempotency_key,
            request_fingerprint=different_fingerprint,
            db=db_session,
        )
    assert exc_info.value.status_code == 400
    assert "differing request payload" in exc_info.value.detail
