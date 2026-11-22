import uuid
from datetime import datetime, timezone, timedelta
import pytest

from app.core.database import AsyncSessionLocal
from app.models.agency import Agency
from app.models.client import Client, ClientStatus
from app.models.user import User, Membership, RoleEnum
from app.models.historical_post import ClientHistoricalPost
from app.services.analytics_engine import (
    classify_post_intelligence_with_nemotron,
    compute_client_benchmarks,
)


@pytest.mark.asyncio
async def test_nemotron_hook_classification():
    # Test Nemotron classification on real-world copywriting
    caption = "Why do 90% of SaaS founders fail at social media? Here is the full breakdown of what high-growth agencies do differently."
    res = await classify_post_intelligence_with_nemotron(
        caption=caption,
        media_type="VIDEO",
        deliverable_format="reel",
    )
    assert res.extracted_hook is not None
    assert len(res.extracted_hook) > 0
    assert res.hook_archetype in [
        "Curiosity / Question Hook",
        "Contrarian / Myth-Buster",
        "High-Value Checklist / Framework",
        "Social Proof & Transformation",
        "Behind-The-Scenes Craft",
        "Direct Announcement / CTA",
        "Authoritative Insight",
    ]
    assert res.content_pillar in [
        "Educational Authority",
        "Social Proof & Results",
        "Brand Culture & Process",
        "Conversion & Offer",
        "Community Engagement",
    ]


@pytest.mark.asyncio
async def test_analytics_benchmarks_and_outliers():
    async with AsyncSessionLocal() as db:
        # Create test agency, user, client with valid slug
        agency_id = uuid.uuid4()
        client_id = uuid.uuid4()
        user_id = uuid.uuid4()
        unique_slug = f"analytics-test-{uuid.uuid4().hex[:8]}"

        agency = Agency(id=agency_id, name="Test Analytics Agency", slug=unique_slug)
        db.add(agency)
        user = User(id=user_id, email=f"analyst-{uuid.uuid4().hex[:6]}@example.com", hashed_password="pw", full_name="Analyst")
        db.add(user)
        membership = Membership(user_id=user_id, agency_id=agency_id, role=RoleEnum.owner)
        db.add(membership)
        client = Client(id=client_id, agency_id=agency_id, business_name="Alpha Tech Brand", status=ClientStatus.active)
        db.add(client)
        await db.flush()

        # Seed 10 historical posts with differing engagement
        now = datetime.now(timezone.utc)
        for i in range(10):
            # i=0 and i=1 will be high outliers
            is_outlier = (i < 2)
            likes = 150 if is_outlier else 10 + i
            views = 1000
            er = round((likes / views) * 100.0, 2)
            p = ClientHistoricalPost(
                id=uuid.uuid4(),
                client_id=client_id,
                platform="instagram",
                external_post_id=f"test-post-{uuid.uuid4().hex[:8]}",
                media_type="VIDEO" if i % 2 == 0 else "CAROUSEL_ALBUM",
                deliverable_format="reel" if i % 2 == 0 else "carousel",
                caption=f"Hook number {i}: Why your workflow is broken. Learn more here." if is_outlier else f"Normal post {i} caption.",
                published_at=now - timedelta(days=i * 5),
                likes_count=likes,
                comments_count=5 if is_outlier else 1,
                shares_count=2,
                saves_count=10 if is_outlier else 0,
                views_count=views,
                reach_count=800,
                engagement_rate=er,
                is_outlier=is_outlier,
                outlier_score=3.5 if is_outlier else 1.0,
                extracted_hook=f"Why your workflow is broken" if is_outlier else f"Normal post {i}",
                hook_archetype="Curiosity / Question Hook" if is_outlier else "Authoritative Insight",
                content_pillar="Educational Authority" if is_outlier else "Community Engagement",
            )
            db.add(p)
        await db.commit()

        # Compute benchmarks
        benchmarks = await compute_client_benchmarks(client_id=client_id, db=db)
        assert benchmarks.data_sufficiency == "sufficient"
        assert benchmarks.total_posts_analyzed == 10
        assert len(benchmarks.top_winning_outliers) >= 2
        assert benchmarks.dominant_winning_format in ("REEL", "CAROUSEL", "SINGLE_IMAGE")
        assert len(benchmarks.format_benchmarks) >= 2
        assert len(benchmarks.winning_hooks_and_angles) >= 1
