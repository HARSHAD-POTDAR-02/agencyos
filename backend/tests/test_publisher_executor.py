from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import Base
from app.models.agency import Agency
from app.models.campaign import Campaign
from app.models.client import Client
from app.models.client_social_account import ClientSocialAccount
from app.models.content_version import ContentVersion
from app.models.deliverable import Deliverable, DeliverableStatus
from app.models.publication_job import AttemptStatus, JobStatus, PublicationAttempt, PublicationJob
from app.models.task import Task, TaskStatus
from app.models.user import User
from app.services.lease_manager import claim_due_jobs
from app.services.meta_publisher import MetaPublishingError
from app.services.publisher_executor import classify_provider_error, execute_publication_job

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture
async def db_session():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session

    await engine.dispose()


async def _seed_test_env(db: AsyncSession):
    user = User(email="exec_test@agencyos.local", hashed_password="pw", full_name="Exec Tester")
    db.add(user)
    await db.flush()

    agency = Agency(name="Executor Agency", slug=f"exec-{uuid.uuid4().hex[:6]}")
    db.add(agency)
    await db.flush()

    client = Client(agency_id=agency.id, business_name="Beta Brands")
    db.add(client)
    await db.flush()

    social_ig = ClientSocialAccount(
        client_id=client.id,
        platform="instagram",
        access_token="valid_ig_token",
        instagram_business_id="1784140001",
    )
    db.add(social_ig)
    await db.flush()

    campaign = Campaign(client_id=client.id, name="Winter Promo")
    db.add(campaign)
    await db.flush()

    deliverable = Deliverable(
        campaign_id=campaign.id,
        title="IG Winter Post",
        deliverable_type="single_image",
        platform="instagram",
        status=DeliverableStatus.approved,
    )
    db.add(deliverable)
    await db.flush()

    task = Task(
        deliverable_id=deliverable.id,
        title="Design Winter Asset",
        status=TaskStatus.internal_review,
    )
    db.add(task)
    await db.flush()

    version = ContentVersion(
        deliverable_id=deliverable.id,
        version_number=1,
        storage_key="uploads/winter.jpg",
        file_name="winter.jpg",
        checksum_sha256="abc123sha256",
        caption="Winter is here!",
        uploaded_by_id=user.id,
    )
    db.add(version)
    await db.flush()

    await db.commit()
    return {
        "agency": agency,
        "client": client,
        "social_ig": social_ig,
        "deliverable": deliverable,
        "version": version,
        "task": task,
    }


def test_classify_provider_error():
    """Verifies that Meta provider error codes are classified accurately."""
    # 1. Auth errors
    cat, retry, _ = classify_provider_error({"code": 190, "error_subcode": 463})
    assert cat == "auth"
    assert retry is False

    # 2. Rate limit errors
    cat, retry, delay = classify_provider_error({"code": 17, "error_subcode": 2207001})
    assert cat == "rate_limit"
    assert retry is True
    assert delay == 3600

    # 3. Policy violations
    cat, retry, _ = classify_provider_error({"code": 368, "message": "Blocked for spam"})
    assert cat == "policy"
    assert retry is False

    # 4. Unknown error -> MUST NOT default to retryable
    cat, retry, _ = classify_provider_error({"code": 99999, "message": "Mystery error"})
    assert cat == "unknown"
    assert retry is False


@pytest.mark.asyncio
async def test_successful_instagram_execution(db_session: AsyncSession):
    """
    Simulates a successful Instagram publication:
    - Pre-flight ownership check.
    - PublicationAttempt record created.
    - Success updates job and attempt to 'published'.
    - Associated deliverable tasks marked 'done'.
    - Parent Deliverable aggregate status synchronized to 'published'.
    """
    env = await _seed_test_env(db_session)
    now = datetime.now(timezone.utc)
    op_id = uuid.uuid4()

    job = PublicationJob(
        deliverable_id=env["deliverable"].id,
        content_version_id=env["version"].id,
        client_social_account_id=env["social_ig"].id,
        platform="instagram",
        publication_operation_id=op_id,
        status=JobStatus.scheduled,
        scheduled_at=now - timedelta(minutes=1),
        next_attempt_at=now - timedelta(minutes=1),
        media_url_snapshot="https://cdn.agencyos.local/winter.jpg",
        caption_snapshot="Winter is here!",
    )
    db_session.add(job)
    await db_session.commit()

    claimed = await claim_due_jobs(db_session, worker_id="worker-test", batch_size=1)
    job_id, claim_token = claimed[0]

    # Mock Meta API photo publish
    mock_res = {
        "media_id": "ig_post_99999",
        "permalink": "https://www.instagram.com/p/DDDDDDDD/",
        "creation_id": "container_123",
        "platform": "instagram",
    }
    with patch("app.services.publisher_executor.publish_instagram_photo", new=AsyncMock(return_value=mock_res)):
        success = await execute_publication_job(db_session, job_id, claim_token)

    assert success is True

    # Verify job record
    refreshed_job = (await db_session.execute(select(PublicationJob).where(PublicationJob.id == job_id))).scalar_one()
    assert refreshed_job.status == JobStatus.published
    assert refreshed_job.external_post_id == "ig_post_99999"
    assert refreshed_job.live_post_url == "https://www.instagram.com/p/DDDDDDDD/"

    # Verify attempt record
    attempt_res = await db_session.execute(
        select(PublicationAttempt).where(PublicationAttempt.publication_job_id == job_id)
    )
    attempts = list(attempt_res.scalars().all())
    assert len(attempts) == 1
    assert attempts[0].status == AttemptStatus.published
    assert attempts[0].external_post_id == "ig_post_99999"

    # Verify deliverable task is marked done
    task_res = await db_session.execute(select(Task).where(Task.id == env["task"].id))
    task = task_res.scalar_one()
    assert task.status == TaskStatus.done

    # Verify parent deliverable aggregate status
    deliv_res = await db_session.execute(select(Deliverable).where(Deliverable.id == env["deliverable"].id))
    deliv = deliv_res.scalar_one()
    assert deliv.status == DeliverableStatus.published


@pytest.mark.asyncio
async def test_auth_error_transitions_to_needs_reconnection(db_session: AsyncSession):
    """
    Verifies that when Meta returns an expired/revoked token error (Code 190),
    the job moves to 'needs_reconnection', retries are halted,
    and the parent deliverable status becomes 'needs_reconnection'.
    """
    env = await _seed_test_env(db_session)
    now = datetime.now(timezone.utc)
    op_id = uuid.uuid4()

    job = PublicationJob(
        deliverable_id=env["deliverable"].id,
        content_version_id=env["version"].id,
        client_social_account_id=env["social_ig"].id,
        platform="instagram",
        publication_operation_id=op_id,
        status=JobStatus.scheduled,
        scheduled_at=now - timedelta(minutes=1),
        next_attempt_at=now - timedelta(minutes=1),
        media_url_snapshot="https://cdn.agencyos.local/winter.jpg",
        caption_snapshot="Winter is here!",
    )
    db_session.add(job)
    await db_session.commit()

    claimed = await claim_due_jobs(db_session, worker_id="worker-test", batch_size=1)
    job_id, claim_token = claimed[0]

    # Mock expired token error (Code 190, subcode 463)
    auth_err = MetaPublishingError(
        "Error validating access token: Session has expired",
        meta_error={"code": 190, "error_subcode": 463, "message": "Session expired"},
    )
    with patch("app.services.publisher_executor.publish_instagram_photo", side_effect=auth_err):
        success = await execute_publication_job(db_session, job_id, claim_token)

    assert success is False

    refreshed_job = (await db_session.execute(select(PublicationJob).where(PublicationJob.id == job_id))).scalar_one()
    assert refreshed_job.status == JobStatus.needs_reconnection
    assert refreshed_job.last_error_category == "auth"
    assert refreshed_job.last_error_code == 190

    # Deliverable reflects needs_reconnection
    deliv_res = await db_session.execute(select(Deliverable).where(Deliverable.id == env["deliverable"].id))
    deliv = deliv_res.scalar_one()
    assert deliv.status == DeliverableStatus.needs_reconnection


@pytest.mark.asyncio
async def test_transient_error_schedules_backoff_retry(db_session: AsyncSession):
    """
    Verifies that when a transient upstream error occurs,
    if attempts_count < max_attempts, the job is returned to 'scheduled'
    with next_attempt_at pushed into the future.
    """
    env = await _seed_test_env(db_session)
    now = datetime.now(timezone.utc)
    op_id = uuid.uuid4()

    job = PublicationJob(
        deliverable_id=env["deliverable"].id,
        content_version_id=env["version"].id,
        client_social_account_id=env["social_ig"].id,
        platform="instagram",
        publication_operation_id=op_id,
        status=JobStatus.scheduled,
        scheduled_at=now - timedelta(minutes=1),
        next_attempt_at=now - timedelta(minutes=1),
        media_url_snapshot="https://cdn.agencyos.local/winter.jpg",
        caption_snapshot="Winter is here!",
        max_attempts=3,
    )
    db_session.add(job)
    await db_session.commit()

    claimed = await claim_due_jobs(db_session, worker_id="worker-test", batch_size=1)
    job_id, claim_token = claimed[0]

    transient_err = MetaPublishingError(
        "Temporary upstream service error",
        meta_error={"code": 2, "message": "Service temporarily unavailable"},
    )
    with patch("app.services.publisher_executor.publish_instagram_photo", side_effect=transient_err):
        success = await execute_publication_job(db_session, job_id, claim_token)

    assert success is False

    refreshed_job = (await db_session.execute(select(PublicationJob).where(PublicationJob.id == job_id))).scalar_one()
    assert refreshed_job.status == JobStatus.scheduled
    assert refreshed_job.last_error_category == "transient"
    # next_attempt_at must be in the future (backoff)
    next_at = refreshed_job.next_attempt_at
    if next_at.tzinfo is None:
        next_at = next_at.replace(tzinfo=timezone.utc)
    assert next_at > now
