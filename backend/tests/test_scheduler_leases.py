from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timedelta, timezone

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
from app.models.publication_job import JobStatus, PublicationJob
from app.models.user import User
from app.services.lease_manager import (
    StaleWorkerError,
    claim_due_jobs,
    find_expired_leases,
    guarded_update_job,
    reconcile_deliverable_status,
    renew_lease,
)
from app.services.scheduler_coordinator import SchedulerCoordinator

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


async def _seed_test_hierarchy(db: AsyncSession):
    """Creates a basic agency -> client -> campaign -> deliverable -> version hierarchy."""
    user = User(
        email="test_worker@agencyos.local",
        hashed_password="pw",
        full_name="Worker Lead",
    )
    db.add(user)
    await db.flush()

    agency = Agency(name="Titan Agency", slug=f"titan-{uuid.uuid4().hex[:6]}")
    db.add(agency)
    await db.flush()

    client = Client(agency_id=agency.id, business_name="Alpha Foods")
    db.add(client)
    await db.flush()

    social_ig = ClientSocialAccount(
        client_id=client.id,
        platform="instagram",
        access_token="valid_ig_token",
        instagram_business_id="1784140001",
    )
    social_fb = ClientSocialAccount(
        client_id=client.id,
        platform="facebook",
        access_token="valid_fb_token",
        facebook_page_id="105230001",
    )
    db.add_all([social_ig, social_fb])
    await db.flush()

    campaign = Campaign(client_id=client.id, name="Q4 Launch")
    db.add(campaign)
    await db.flush()

    deliverable = Deliverable(
        campaign_id=campaign.id,
        title="Reel Teaser",
        deliverable_type="reel",
        platform="both",
        status=DeliverableStatus.approved,
    )
    db.add(deliverable)
    await db.flush()

    version = ContentVersion(
        deliverable_id=deliverable.id,
        version_number=1,
        storage_key="uploads/reel.mp4",
        file_name="reel.mp4",
        checksum_sha256="abc123sha256",
        caption="Launch teaser!",
        uploaded_by_id=user.id,
    )
    db.add(version)
    await db.flush()

    await db.commit()
    return {
        "agency": agency,
        "client": client,
        "social_ig": social_ig,
        "social_fb": social_fb,
        "deliverable": deliverable,
        "version": version,
    }


@pytest.mark.asyncio
async def test_atomic_claiming_with_unique_tokens(db_session: AsyncSession):
    """
    Verifies that due jobs are claimed atomically, assigned unique claim tokens,
    have active leases, and transition the parent Deliverable to 'publishing'.
    Subsequent claims find nothing left to claim.
    """
    data = await _seed_test_hierarchy(db_session)
    now = datetime.now(timezone.utc)
    op_id = uuid.uuid4()

    job_ig = PublicationJob(
        deliverable_id=data["deliverable"].id,
        content_version_id=data["version"].id,
        client_social_account_id=data["social_ig"].id,
        platform="instagram",
        publication_operation_id=op_id,
        status=JobStatus.scheduled,
        scheduled_at=now - timedelta(minutes=5),
        next_attempt_at=now - timedelta(minutes=5),
        media_url_snapshot="https://cdn.agencyos.local/video.mp4",
    )
    job_fb = PublicationJob(
        deliverable_id=data["deliverable"].id,
        content_version_id=data["version"].id,
        client_social_account_id=data["social_fb"].id,
        platform="facebook",
        publication_operation_id=op_id,
        status=JobStatus.scheduled,
        scheduled_at=now - timedelta(minutes=5),
        next_attempt_at=now - timedelta(minutes=5),
        media_url_snapshot="https://cdn.agencyos.local/video.mp4",
    )
    db_session.add_all([job_ig, job_fb])
    await db_session.commit()

    # Worker 1 claims due jobs
    claimed = await claim_due_jobs(db_session, worker_id="worker-node-1", batch_size=10)
    assert len(claimed) == 2

    job_ids = [c[0] for c in claimed]
    tokens = [c[1] for c in claimed]

    assert job_ig.id in job_ids
    assert job_fb.id in job_ids
    assert len(set(tokens)) == 2  # Tokens must be distinct per job

    # Verify state in DB
    refreshed_ig = (await db_session.execute(select(PublicationJob).where(PublicationJob.id == job_ig.id))).scalar_one()
    assert refreshed_ig.status == JobStatus.publishing
    assert refreshed_ig.claimed_by == "worker-node-1"
    assert refreshed_ig.claim_token is not None
    lease_at = refreshed_ig.lease_expires_at
    if lease_at.tzinfo is None:
        lease_at = lease_at.replace(tzinfo=timezone.utc)
    assert lease_at > now
    assert refreshed_ig.attempts_count == 1

    # Verify parent deliverable aggregate status
    deliv = (await db_session.execute(select(Deliverable).where(Deliverable.id == data["deliverable"].id))).scalar_one()
    assert deliv.status == DeliverableStatus.publishing

    # Worker 2 attempts to claim immediately after -> gets 0 rows
    claimed_again = await claim_due_jobs(db_session, worker_id="worker-node-2", batch_size=10)
    assert len(claimed_again) == 0


@pytest.mark.asyncio
async def test_heartbeat_lease_renewal(db_session: AsyncSession):
    """
    Verifies that a worker can renew its lease using its claim token,
    and renewals with an incorrect token are rejected.
    """
    data = await _seed_test_hierarchy(db_session)
    now = datetime.now(timezone.utc)
    op_id = uuid.uuid4()

    job = PublicationJob(
        deliverable_id=data["deliverable"].id,
        content_version_id=data["version"].id,
        client_social_account_id=data["social_ig"].id,
        platform="instagram",
        publication_operation_id=op_id,
        status=JobStatus.scheduled,
        scheduled_at=now - timedelta(minutes=1),
        next_attempt_at=now - timedelta(minutes=1),
        media_url_snapshot="https://cdn.agencyos.local/video.mp4",
    )
    db_session.add(job)
    await db_session.commit()

    claimed = await claim_due_jobs(db_session, worker_id="worker-node-1", batch_size=1)
    job_id, valid_token = claimed[0]

    # Valid renewal extends lease
    renewed = await renew_lease(db_session, job_id, valid_token, lease_duration_seconds=300)
    assert renewed is True

    # Invalid token fails to renew
    wrong_token = uuid.uuid4()
    renewed_fake = await renew_lease(db_session, job_id, wrong_token, lease_duration_seconds=300)
    assert renewed_fake is False


@pytest.mark.asyncio
async def test_guarded_write_rejects_stale_workers(db_session: AsyncSession):
    """
    Fencing test: if a worker's claim token is revoked/superseded,
    guarded updates raise StaleWorkerError and reject corrupting the database.
    """
    data = await _seed_test_hierarchy(db_session)
    now = datetime.now(timezone.utc)
    op_id = uuid.uuid4()

    job = PublicationJob(
        deliverable_id=data["deliverable"].id,
        content_version_id=data["version"].id,
        client_social_account_id=data["social_ig"].id,
        platform="instagram",
        publication_operation_id=op_id,
        status=JobStatus.scheduled,
        scheduled_at=now - timedelta(minutes=1),
        next_attempt_at=now - timedelta(minutes=1),
        media_url_snapshot="https://cdn.agencyos.local/video.mp4",
    )
    db_session.add(job)
    await db_session.commit()

    claimed = await claim_due_jobs(db_session, worker_id="worker-1", batch_size=1)
    job_id, token_1 = claimed[0]

    # Simulate worker 1 losing its lease (re-claimed by worker 2)
    token_2 = uuid.uuid4()
    job.claim_token = token_2
    job.claimed_by = "worker-2"
    await db_session.commit()

    # Worker 1 attempts to finish the job -> MUST be rejected!
    with pytest.raises(StaleWorkerError):
        await guarded_update_job(
            db_session,
            job_id=job_id,
            claim_token=token_1,  # Stale token
            status=JobStatus.published,
            external_post_id="ig_12345",
        )

    # Worker 2 with active token succeeds
    updated = await guarded_update_job(
        db_session,
        job_id=job_id,
        claim_token=token_2,  # Current token
        status=JobStatus.published,
        external_post_id="ig_12345",
    )
    assert updated.status == JobStatus.published
    assert updated.external_post_id == "ig_12345"


@pytest.mark.asyncio
async def test_bounded_worker_concurrency(db_session: AsyncSession):
    """
    Verifies that the coordinator respects bounded concurrency (max_concurrency)
    and only claims up to available capacity, never spawning unbounded tasks.
    """
    data = await _seed_test_hierarchy(db_session)
    now = datetime.now(timezone.utc)
    op_id = uuid.uuid4()

    # Seed 5 due jobs
    for i in range(5):
        j = PublicationJob(
            deliverable_id=data["deliverable"].id,
            content_version_id=data["version"].id,
            client_social_account_id=data["social_ig"].id,
            platform="instagram",
            publication_operation_id=uuid.uuid4(),
            status=JobStatus.scheduled,
            scheduled_at=now - timedelta(minutes=i + 1),
            next_attempt_at=now - timedelta(minutes=i + 1),
            media_url_snapshot="https://cdn.agencyos.local/video.mp4",
        )
        db_session.add(j)
    await db_session.commit()

    # Create coordinator with max_concurrency = 2
    coord = SchedulerCoordinator(max_concurrency=2)
    assert coord.available_capacity == 2

    # Claim next batch: should claim exactly 2 jobs
    claimed_batch = await coord.claim_next_batch(db_session)
    assert len(claimed_batch) == 2

    # Register active dummy tasks for both claimed jobs
    for jid, tok in claimed_batch:
        task = asyncio.create_task(asyncio.sleep(10))
        coord.register_task(jid, task)

    # Available capacity should now be 0
    assert coord.available_capacity == 0

    # Attempting to claim again while tasks are active yields 0 claims
    claimed_second = await coord.claim_next_batch(db_session)
    assert len(claimed_second) == 0

    # Cancel dummy tasks
    for t in coord.active_tasks.values():
        t.cancel()


@pytest.mark.asyncio
async def test_bounded_sleep_calculation(db_session: AsyncSession):
    """
    Verifies next-due sleep calculation:
    - Bounded by 300s when future post is far in future.
    - Exact time when due soon.
    - 0s when overdue.
    - 300s when table is empty.
    """
    coord = SchedulerCoordinator()

    # 1. No jobs scheduled -> max_sleep (300.0)
    sleep_empty = await coord.calculate_next_sleep_seconds(db_session, max_sleep=300)
    assert sleep_empty == 300.0

    data = await _seed_test_hierarchy(db_session)
    now = datetime.now(timezone.utc)

    # 2. Job 10 hours in future -> bounded by 300s
    job_far = PublicationJob(
        deliverable_id=data["deliverable"].id,
        content_version_id=data["version"].id,
        client_social_account_id=data["social_ig"].id,
        platform="instagram",
        publication_operation_id=uuid.uuid4(),
        status=JobStatus.scheduled,
        scheduled_at=now + timedelta(hours=10),
        next_attempt_at=now + timedelta(hours=10),
        media_url_snapshot="https://cdn.agencyos.local/video.mp4",
    )
    db_session.add(job_far)
    await db_session.commit()

    sleep_far = await coord.calculate_next_sleep_seconds(db_session, max_sleep=300)
    assert sleep_far == 300.0

    # 3. Add job due in 40 seconds -> returns ~40.0s
    job_soon = PublicationJob(
        deliverable_id=data["deliverable"].id,
        content_version_id=data["version"].id,
        client_social_account_id=data["social_fb"].id,
        platform="facebook",
        publication_operation_id=uuid.uuid4(),
        status=JobStatus.scheduled,
        scheduled_at=now + timedelta(seconds=40),
        next_attempt_at=now + timedelta(seconds=40),
        media_url_snapshot="https://cdn.agencyos.local/video.mp4",
    )
    db_session.add(job_soon)
    await db_session.commit()

    sleep_soon = await coord.calculate_next_sleep_seconds(db_session, max_sleep=300)
    assert 35.0 <= sleep_soon <= 45.0


@pytest.mark.asyncio
async def test_reconcile_deliverable_aggregate_status(db_session: AsyncSession):
    """
    Verifies that the aggregate Deliverable status correctly resolves across all
    combinations of platform job statuses.
    """
    data = await _seed_test_hierarchy(db_session)
    deliv_id = data["deliverable"].id
    now = datetime.now(timezone.utc)

    job_ig = PublicationJob(
        deliverable_id=deliv_id,
        content_version_id=data["version"].id,
        client_social_account_id=data["social_ig"].id,
        platform="instagram",
        publication_operation_id=uuid.uuid4(),
        status=JobStatus.published,
        scheduled_at=now,
        next_attempt_at=now,
        media_url_snapshot="https://cdn.agencyos.local/video.mp4",
    )
    job_fb = PublicationJob(
        deliverable_id=deliv_id,
        content_version_id=data["version"].id,
        client_social_account_id=data["social_fb"].id,
        platform="facebook",
        publication_operation_id=uuid.uuid4(),
        status=JobStatus.failed,
        scheduled_at=now,
        next_attempt_at=now,
        media_url_snapshot="https://cdn.agencyos.local/video.mp4",
    )
    db_session.add_all([job_ig, job_fb])
    await db_session.commit()

    # 1. Instagram published + Facebook failed -> partially_published
    agg_1 = await reconcile_deliverable_status(db_session, deliv_id)
    assert agg_1 == DeliverableStatus.partially_published

    # 2. Both published -> published
    job_fb.status = JobStatus.published
    await db_session.commit()
    agg_2 = await reconcile_deliverable_status(db_session, deliv_id)
    assert agg_2 == DeliverableStatus.published

    # 3. Both cancelled -> approved (eligible for re-scheduling)
    job_ig.status = JobStatus.cancelled
    job_fb.status = JobStatus.cancelled
    await db_session.commit()
    agg_3 = await reconcile_deliverable_status(db_session, deliv_id)
    assert agg_3 == DeliverableStatus.approved


@pytest.mark.asyncio
async def test_expired_lease_detection(db_session: AsyncSession):
    """
    Verifies that find_expired_leases identifies crashed or timed-out workers.
    """
    data = await _seed_test_hierarchy(db_session)
    now = datetime.now(timezone.utc)

    job_expired = PublicationJob(
        deliverable_id=data["deliverable"].id,
        content_version_id=data["version"].id,
        client_social_account_id=data["social_ig"].id,
        platform="instagram",
        publication_operation_id=uuid.uuid4(),
        status=JobStatus.publishing,
        claimed_by="crashed-worker-99",
        claim_token=uuid.uuid4(),
        lease_expires_at=now - timedelta(minutes=2),  # Expired
        scheduled_at=now - timedelta(minutes=10),
        next_attempt_at=now - timedelta(minutes=10),
        media_url_snapshot="https://cdn.agencyos.local/video.mp4",
    )
    db_session.add(job_expired)
    await db_session.commit()

    expired_list = await find_expired_leases(db_session)
    assert len(expired_list) == 1
    assert expired_list[0].id == job_expired.id
    assert expired_list[0].claimed_by == "crashed-worker-99"
