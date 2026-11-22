import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.agency import Agency
from app.models.campaign import Campaign
from app.models.client import Client
from app.models.deliverable import Deliverable
from app.models.task import Task, TaskPriority, TaskStatus
from app.models.user import Membership, RoleEnum, User
from app.routers.tasks import _compute_script_metrics
from tests.conftest import TestSessionLocal


def test_script_metrics_computation():
    """Verify live speaking duration and hook length warning rules."""
    # Under 12 words: No warning
    short_blocks = [
        {"spoken_words": "Stop wasting your time today.", "duration_seconds": 3},
        {"spoken_words": "Here is the new way to do social media at scale with AI.", "duration_seconds": 6},
    ]
    total_words, sec, hook_words, hook_warning = _compute_script_metrics(short_blocks, 30)
    assert hook_words == 5
    assert hook_warning is None
    assert total_words == 18
    assert sec == round((18 / 140.0) * 60)

    # Over 15 words: Trigger retention drop-off warning
    long_blocks = [
        {
            "spoken_words": "In this video I am going to explain exactly why every single creator and agency is completely failing to get engagement on their Instagram reels in 2026.",
            "duration_seconds": 8,
        },
        {"spoken_words": "Watch closely.", "duration_seconds": 2},
    ]
    total_words, sec, hook_words, hook_warning = _compute_script_metrics(long_blocks, 30)
    assert hook_words > 15
    assert hook_warning is not None
    assert "exceeds 15 words" in hook_warning
    assert "viewer drop-off" in hook_warning


@pytest.mark.asyncio
async def test_teleprompter_and_studio_sync_e2e(agency_a_client: AsyncClient, agency_a_data):
    """
    Test Track 4 End-to-End:
    1. Fetch task details: verify starter script blocks, checklists, and duration metrics.
    2. Update task checklists and script blocks.
    3. Call sync-studio endpoint: verify campaign.ai_plan_draft receives refined script & hook.
    """
    user_a, agency = agency_a_data

    async with TestSessionLocal() as db:
        client = Client(id=uuid.uuid4(), agency_id=agency.id, business_name="Track4 Client")
        campaign = Campaign(
            id=uuid.uuid4(),
            client_id=client.id,
            name="Track4 Q1 Campaign",
            ai_plan_draft={
                "deliverables": [
                    {
                        "deliverable_id": "will-be-replaced",
                        "title": "Viral Hook Breakdown",
                        "hook": "Original raw hook",
                        "caption": "Original caption",
                        "visual_concept": "Original visual concept",
                        "cta": "Original CTA",
                    }
                ]
            },
        )
        deliv = Deliverable(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            title="Viral Hook Breakdown",
            deliverable_type="reel",
            platform="instagram",
        )
        task = Task(
            id=uuid.uuid4(),
            deliverable_id=deliv.id,
            title="Write Teleprompter Script",
            task_type="scripting",
            status=TaskStatus.todo,
            priority=TaskPriority.high,
            assignee_id=user_a.id,
        )
        db.add_all([client, campaign, deliv, task])
        await db.commit()

        # Update the campaign deliverable_id in draft to match deliv.id
        campaign.ai_plan_draft["deliverables"][0]["deliverable_id"] = str(deliv.id)
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(campaign, "ai_plan_draft")
        await db.commit()

        task_id = str(task.id)
        agency_id = str(agency.id)

    # 1. GET /agencies/{agency_id}/tasks/{task_id}
    res = await agency_a_client.get(f"/agencies/{agency_id}/tasks/{task_id}")
    assert res.status_code == 200
    data = res.json()
    assert len(data["script_blocks"]) >= 4
    assert len(data["checklists"]) >= 5
    assert data["target_duration_seconds"] == 30
    assert data["total_word_count"] > 0
    assert data["speaking_duration_seconds"] > 0

    # 2. PATCH task to update checklists and script blocks
    updated_blocks = [
        {
            "id": "scene-1",
            "scene_number": 1,
            "title": "Scene 1: Refined Hook",
            "spoken_words": "Stop guessing your reels strategy.",
            "visual_cue": "Fast-paced montage.",
            "audio_notes": "Upbeat synth riser.",
            "duration_seconds": 4,
        },
        {
            "id": "scene-2",
            "scene_number": 2,
            "title": "Scene 2: Problem",
            "spoken_words": "You waste 5 hours every week creating content that gets zero reach.",
            "visual_cue": "Frustrated creator looking at analytics.",
            "audio_notes": "Tension build.",
            "duration_seconds": 6,
        },
        {
            "id": "scene-3",
            "scene_number": 3,
            "title": "Scene 3: Solution",
            "spoken_words": "AgencyOS auto-generates your strategy and locks production.",
            "visual_cue": "Sleek UI walkthrough.",
            "audio_notes": "Beat drop.",
            "duration_seconds": 8,
        },
        {
            "id": "scene-4",
            "scene_number": 4,
            "title": "Scene 4: Call to Action",
            "spoken_words": "Comment 'GROWTH' to get our free system.",
            "visual_cue": "Pointer to comment icon.",
            "audio_notes": "Chime.",
            "duration_seconds": 4,
        },
    ]
    updated_checklists = [
        {"id": "chk-1", "text": "Hook Drafted & Polished (<12 words)", "completed": True, "stage": "scripting"},
        {"id": "chk-2", "text": "Scene Dialogue & Pacing Written", "completed": True, "stage": "scripting"},
    ]
    patch_res = await agency_a_client.patch(
        f"/agencies/{agency_id}/tasks/{task_id}",
        json={
            "script_blocks": updated_blocks,
            "checklists": updated_checklists,
            "target_duration_seconds": 25,
        },
    )
    assert patch_res.status_code == 200
    patched_data = patch_res.json()
    assert len(patched_data["script_blocks"]) == 4
    assert patched_data["hook_word_count"] == 5
    assert patched_data["hook_warning"] is None

    # 3. POST /agencies/{agency_id}/tasks/{task_id}/sync-studio
    sync_res = await agency_a_client.post(
        f"/agencies/{agency_id}/tasks/{task_id}/sync-studio",
        json={
            "hook": "Stop guessing your reels strategy.",
            "caption": "Refined viral caption with #AgencyOS",
            "visual_concept": "Cinematic visual montage",
            "cta": "Comment 'GROWTH' to get our free system.",
            "script_blocks": updated_blocks,
        },
    )
    assert sync_res.status_code == 200
    sync_data = sync_res.json()
    assert sync_data["success"] is True

    # 4. Verify in DB that campaign.ai_plan_draft was updated!
    async with TestSessionLocal() as db:
        camp = await db.get(Campaign, uuid.UUID(sync_data["campaign_id"]))
        deliv_in_draft = camp.ai_plan_draft["deliverables"][0]
        assert deliv_in_draft["hook"] == "Stop guessing your reels strategy."
        assert deliv_in_draft["caption"] == "Refined viral caption with #AgencyOS"
        assert deliv_in_draft["cta"] == "Comment 'GROWTH' to get our free system."
