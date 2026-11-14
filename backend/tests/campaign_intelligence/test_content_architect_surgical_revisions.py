from __future__ import annotations

import uuid
from datetime import date
from typing import AsyncGenerator
import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import TestSessionLocal, test_engine
from app.core.database import Base
from app.models.agency import Agency
from app.models.campaign import Campaign
from app.models.client import Client
from app.models.comment import DeliverableComment
from app.models.deliverable import Deliverable
from app.models.studio_artifact import (
    CampaignStudioSession,
    StudioArtifact,
    StudioArtifactStatus,
    StudioArtifactVersion,
)
from app.models.task import Task, TaskStatus
from app.models.user import Membership, RoleEnum, User
from app.campaign_intelligence.collaboration.schemas import (
    ArtifactType,
    CarouselDeckArtifactPayload,
    CarouselSlideCard,
    SceneCard,
    SocialPlatform,
    StoryboardArtifactPayload,
)
from app.campaign_intelligence.schemas.brand import BrandContext
from app.campaign_intelligence.schemas.campaign import CampaignBrief
from app.campaign_intelligence.schemas.studio_context import CampaignStudioContext
from app.campaign_intelligence.services.studio_service import (
    approve_artifact_version,
    export_artifact_to_production,
    format_production_brief,
    save_or_revise_artifact,
)
from app.campaign_intelligence.specialists.content_architect_adapter import (
    ContentArchitectAdapter,
    ReviseAllScenesOutput,
    SceneScriptUpdate,
    TargetedCopyRevisionOutput,
    TargetedSceneRevisionOutput,
    TargetedSlideRevisionOutput,
    classify_storyboard_operation,
    classify_carousel_operation,
    normalize_storyboard_scenes_timing,
    parse_insert_position,
)


# =====================================================================
# Fixtures & Helpers
# =====================================================================

@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with test_engine.begin() as conn:
        import app.models  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)
    async with TestSessionLocal() as session:
        yield session


def _build_test_storyboard_payload() -> dict:
    scenes = [
        SceneCard(
            scene_number=1,
            start_ms=0,
            end_ms=3000,
            timestamp_range="0:00 - 0:03",
            shot_type="Extreme Close-Up",
            visual_action="Camera macro dive into sizzling tandoor oven.",
            voiceover_script="You have never tasted mutton cooked this way.",
            on_screen_text="The Secret of Handewadi",
            audio_sfx_cue="Sizzle + whoosh bass hit",
            ai_visual_prompt="Macro close-up of tandoori flames illuminating seasoned meat, cinematic lighting",
        ),
        SceneCard(
            scene_number=2,
            start_ms=3000,
            end_ms=8000,
            timestamp_range="0:03 - 0:08",
            shot_type="Medium POV",
            visual_action="Chef cuts the slow-cooked raan with precision.",
            voiceover_script="Slow-cooked for 6 hours in 18 authentic Maharashtrian spices.",
            on_screen_text="18 Spices • 6 Hours",
            audio_sfx_cue="Upbeat local rhythm percussion",
            ai_visual_prompt="Medium shot of master chef carving tender meat on a wooden board, warm ambiance",
        ),
        SceneCard(
            scene_number=3,
            start_ms=8000,
            end_ms=15000,
            timestamp_range="0:08 - 0:15",
            shot_type="Hero Table Reveal",
            visual_action="Steam rises from the grand Shauryawada special thali.",
            voiceover_script="Taste the legendary tradition. Reserve your thali today.",
            on_screen_text="Hotel Shauryawada • Handewadi, Pune",
            audio_sfx_cue="Grand melodic brass finale",
            ai_visual_prompt="Hero wide shot of authentic Maharashtrian grand dining thali, golden hour steam",
        ),
    ]
    return StoryboardArtifactPayload(
        deliverable_title="Shauryawada: Signature Raan Showcase",
        platform=SocialPlatform.instagram,
        format_type="reel",
        target_duration_seconds=15,
        strategic_pillar="Culinary Craft",
        scenes=scenes,
        full_caption="Authentic flavors slow-cooked to perfection. Link in bio to book your table!",
        hashtags=["#Shauryawada", "#PuneFoodie", "#MaharashtrianCuisine"],
        call_to_action="Tap link in bio to book your table",
    ).model_dump()


def _build_test_carousel_payload() -> dict:
    slides = [
        CarouselSlideCard(
            slide_number=1,
            headline="Why 90% of Biryanis Are Cooked Wrong",
            body_copy="Most places rush the dum process. Here is what real slow cooking looks like.",
            visual_layout="High-contrast split image comparing commercial vs traditional dum pot",
            slide_type="cover",
        ),
        CarouselSlideCard(
            slide_number=2,
            headline="Mistake 1: High Heat Boiling",
            body_copy="Boiling meat instead of braising destroys the aromatic spice infusion.",
            visual_layout="Cross-section diagram illustrating heat distribution",
            slide_type="content",
        ),
        CarouselSlideCard(
            slide_number=3,
            headline="Mistake 2: Pre-ground Spices",
            body_copy="Essential oils evaporate within 48 hours of grinding.",
            visual_layout="Macro close-up of whole spices on traditional stone mortar",
            slide_type="content",
        ),
        CarouselSlideCard(
            slide_number=4,
            headline="The Shauryawada 4-Hour Standard",
            body_copy="We grind whole spices every morning and seal our handis with fresh dough.",
            visual_layout="Photo of freshly sealed clay pots cooking over charcoal embers",
            slide_type="content",
        ),
        CarouselSlideCard(
            slide_number=5,
            headline="Taste the Difference This Weekend",
            body_copy="Visit us in Handewadi, Pune or save this post for your next feast.",
            visual_layout="Hero dish photo with prominent bookmark/save icon callout",
            slide_type="cta",
        ),
    ]
    return CarouselDeckArtifactPayload(
        deliverable_title="The Science of Authentic Dum Biryani",
        platform=SocialPlatform.linkedin,
        format_type="carousel",
        slides=slides,
        full_caption="Swipe through to see why authentic technique matters. Save for your next food trip!",
        hashtags=["#CulinaryScience", "#AuthenticCooking", "#PuneFood"],
        call_to_action="Save this post and visit us this weekend",
    ).model_dump()


def _build_test_studio_context(active_payload: dict, artifact_type: str = "storyboard") -> CampaignStudioContext:
    agency_id = uuid.uuid4()
    client_id = uuid.uuid4()
    campaign_id = uuid.uuid4()
    brief = CampaignBrief(
        client_id=client_id,
        agency_id=agency_id,
        period_month=11,
        period_year=2026,
        objective="Drive foot traffic for signature thalis",
        platforms=["instagram"],
    )
    brand_context = BrandContext(
        client_id=client_id,
        agency_id=agency_id,
        business_name="Hotel Shauryawada",
        industry="Authentic Regional Restaurant",
        brand_voice=["Flavor-obsessed", "Warm", "Authentic"],
    )
    return CampaignStudioContext(
        agency_id=agency_id,
        client_id=client_id,
        campaign_id=campaign_id,
        client_name="Hotel Shauryawada",
        client_industry="Authentic Regional Restaurant",
        client_location="Handewadi, Pune",
        campaign_brief=brief,
        brand_context=brand_context,
        active_artifact_id=uuid.uuid4(),
        active_artifact_type=artifact_type,
        active_artifact_version=1,
        active_artifact_payload=active_payload,
    )


# =====================================================================
# Unit Tests: Intent Classification & Math
# =====================================================================

def test_classify_storyboard_operations():
    payload = _build_test_storyboard_payload()

    # Targeted edits
    op, info = classify_storyboard_operation("make scene 2 more humorous", payload)
    assert op == "TARGETED_EDIT"
    assert info["target_type"] == "scene"
    assert info["target_number"] == 2

    op, info = classify_storyboard_operation("change the hook to focus on aroma", payload)
    assert op == "TARGETED_EDIT"
    assert info["target_type"] == "scene"
    assert info["target_number"] == 1

    op, info = classify_storyboard_operation("revise the call to action to ask for saves", payload)
    assert op == "TARGETED_EDIT"
    assert info["target_type"] == "cta"

    op, info = classify_storyboard_operation("update caption with more hashtags", payload)
    assert op == "TARGETED_EDIT"
    assert info["target_type"] in ["caption", "hashtags"]

    # Structural edits
    op, info = classify_storyboard_operation("delete scene 2", payload)
    assert op == "STRUCTURAL_EDIT"
    assert info["action"] == "delete"
    assert info["target_number"] == 2

    op, info = classify_storyboard_operation("add a scene at the end showing customer reactions", payload)
    assert op == "STRUCTURAL_EDIT"
    assert info["action"] == "add"

    # Full rewrite
    op, info = classify_storyboard_operation("scrap this and start over with a fresh concept", payload)
    assert op == "FULL_REWRITE"


def test_parse_insert_position_all_variations():
    # Between
    assert parse_insert_position("add a scene between 1 and 2", 3) == 1
    assert parse_insert_position("insert between scene 2 and scene 3", 3) == 2
    assert parse_insert_position("put a card between scenes 1 & 2", 3) == 1

    # After
    assert parse_insert_position("add a scene after scene 1", 3) == 1
    assert parse_insert_position("add a slide after slide 2", 4) == 2

    # Before
    assert parse_insert_position("insert before scene 2", 3) == 1
    assert parse_insert_position("add a card before scene 1", 3) == 0

    # Start / Beginning / End
    assert parse_insert_position("add a scene at the beginning", 3) == 0
    assert parse_insert_position("add a new scene at the start", 3) == 0
    assert parse_insert_position("add a scene at the end", 3) == 3


def test_classify_positional_scene_insert_and_script_revision():
    payload = _build_test_storyboard_payload()

    # User's exact prompt from live testing:
    q_insert = "add a scene between 1 and 2 where the chef sprinkles some tasty masala and ghee on the mutton raan"
    op, info = classify_storyboard_operation(q_insert, payload)
    assert op == "STRUCTURAL_EDIT"
    assert info["action"] == "add"
    assert info["insert_index"] == 1

    # User's exact prompt from live testing:
    q_script = "also change the script for all the scenes"
    op, info = classify_storyboard_operation(q_script, payload)
    assert op == "REVISE_ALL_SCENES"

    # User's exact prompt from live testing:
    q_use = "okay use that in the storyboard"
    op, info = classify_storyboard_operation(q_use, payload)
    assert op == "REVISE_ALL_SCENES"

    # Caption / Hashtag targeted edit (does not trigger REVISE_ALL_SCENES)
    q_caption = "update the caption with regional hashtags and emojis"
    op, info = classify_storyboard_operation(q_caption, payload)
    assert op == "TARGETED_EDIT"
    assert info["target_type"] in ["caption", "hashtags"]

    # User's hook insertion test:
    q_hook = "Insert a new hook scene at the beginning showing a close-up reaction of a foodie taking their first bite and closing their eyes in delight."
    op, info = classify_storyboard_operation(q_hook, payload)
    assert op == "STRUCTURAL_EDIT"
    assert info["action"] == "add"
    assert info["insert_index"] == 0


def test_normalize_storyboard_scenes_timing():
    raw_scenes = [
        SceneCard(
            scene_number=5,
            start_ms=1000,
            end_ms=4000,
            shot_type="POV",
            visual_action="Action A",
            voiceover_script="VO A",
        ),
        SceneCard(
            scene_number=9,
            start_ms=9000,
            end_ms=16000,
            shot_type="Close-Up",
            visual_action="Action B",
            voiceover_script="VO B",
        ),
    ]
    norm, total_dur = normalize_storyboard_scenes_timing(raw_scenes)
    assert len(norm) == 2
    assert norm[0].scene_number == 1
    assert norm[0].start_ms == 0
    assert norm[0].end_ms == 3000
    assert norm[0].timestamp_range == "0:00 - 0:03"

    assert norm[1].scene_number == 2
    assert norm[1].start_ms == 3000
    assert norm[1].end_ms == 10000
    assert norm[1].timestamp_range == "0:03 - 0:10"
    assert total_dur == 10


# =====================================================================
# Targeted Edit Tests: Backend Preservation Guarantee
# =====================================================================

@pytest.mark.asyncio
async def test_storyboard_targeted_scene_edit_preserves_untouched_scenes(monkeypatch: pytest.MonkeyPatch):
    """
    Verifies that when Scene 2 is surgically revised:
    1. Scene 2 updates with new direction.
    2. Scene 1 and Scene 3 remain 100% physically identical in backend code.
    """
    initial_payload = _build_test_storyboard_payload()
    ctx = _build_test_studio_context(initial_payload, "storyboard")
    adapter = ContentArchitectAdapter()

    # Mock LLM for targeted scene 2 revision
    revised_scene_output = TargetedSceneRevisionOutput(
        conversational_intro="I've injected warm comedy into Scene 2 with the chef.",
        shot_type="Medium Comedic POV",
        visual_action="Chef playfully catches himself dipping a third piece of roti into the rich rassa.",
        voiceover_script="Rules say wait for the customers, but honestly? Nobody can resist this aroma.",
        on_screen_text="Can you blame him? 🤤",
        audio_sfx_cue="Playful comedic record-scratch + sizzle",
        ai_visual_prompt="Warm comedic candid shot of friendly Indian chef smiling while tasting rich mutton gravy in authentic kitchen",
    )

    async def mock_invoke(*args, **kwargs):
        return revised_scene_output

    monkeypatch.setattr("app.campaign_intelligence.specialists.content_architect_adapter.invoke_structured_llm", mock_invoke)

    res = await adapter.execute(
        query="make scene 2 more humorous showing the chef unable to resist tasting",
        context=ctx,
        db=None,
    )

    assert res.specialist_id == "content_architect"
    assert res.artifact_type == ArtifactType.storyboard
    new_payload = res.artifact_payload
    scenes = new_payload["scenes"]
    assert len(scenes) == 3

    # CRITICAL CODE PRESERVATION CHECK:
    # Scene 1 must be 100% IDENTICAL to the original Scene 1
    orig_s1 = initial_payload["scenes"][0]
    assert scenes[0]["shot_type"] == orig_s1["shot_type"]
    assert scenes[0]["visual_action"] == orig_s1["visual_action"]
    assert scenes[0]["voiceover_script"] == orig_s1["voiceover_script"]
    assert scenes[0]["on_screen_text"] == orig_s1["on_screen_text"]
    assert scenes[0]["ai_visual_prompt"] == orig_s1["ai_visual_prompt"]

    # Scene 2 must be updated
    assert scenes[1]["shot_type"] == "Medium Comedic POV"
    assert "playfully catches himself" in scenes[1]["visual_action"]
    assert "Nobody can resist this aroma" in scenes[1]["voiceover_script"]
    assert scenes[1]["on_screen_text"] == "Can you blame him? 🤤"

    # Scene 3 must be 100% IDENTICAL to the original Scene 3
    orig_s3 = initial_payload["scenes"][2]
    assert scenes[2]["shot_type"] == orig_s3["shot_type"]
    assert scenes[2]["visual_action"] == orig_s3["visual_action"]
    assert scenes[2]["voiceover_script"] == orig_s3["voiceover_script"]
    assert scenes[2]["on_screen_text"] == orig_s3["on_screen_text"]
    assert scenes[2]["ai_visual_prompt"] == orig_s3["ai_visual_prompt"]


@pytest.mark.asyncio
async def test_storyboard_targeted_cta_edit_preserves_all_scenes(monkeypatch: pytest.MonkeyPatch):
    """
    Verifies that revising the CTA updates ONLY call_to_action
    while preserving 100% of scenes, caption, hashtags, and title.
    """
    initial_payload = _build_test_storyboard_payload()
    ctx = _build_test_studio_context(initial_payload, "storyboard")
    adapter = ContentArchitectAdapter()

    revised_cta_output = TargetedCopyRevisionOutput(
        conversational_intro="Updated closing CTA for direct table reservations.",
        revised_text="WhatsApp us at +91 98765 43210 to book your weekend family table!",
    )

    async def mock_invoke(*args, **kwargs):
        return revised_cta_output

    monkeypatch.setattr("app.campaign_intelligence.specialists.content_architect_adapter.invoke_structured_llm", mock_invoke)

    res = await adapter.execute(
        query="Revise the CTA to direct people to our WhatsApp reservation number",
        context=ctx,
        db=None,
    )

    new_payload = res.artifact_payload
    assert new_payload["call_to_action"] == "WhatsApp us at +91 98765 43210 to book your weekend family table!"

    # All 3 scenes must remain untouched
    assert len(new_payload["scenes"]) == 3
    for idx in range(3):
        assert new_payload["scenes"][idx] == initial_payload["scenes"][idx]

    # Full caption and hashtags must remain untouched
    assert new_payload["full_caption"] == initial_payload["full_caption"]
    assert new_payload["hashtags"] == initial_payload["hashtags"]


@pytest.mark.asyncio
async def test_storyboard_structural_delete_scene():
    """
    Verifies that deleting Scene 2 leaves Scenes 1 and 3 (now 2)
    with clean sequential re-indexing and accurate duration math.
    """
    initial_payload = _build_test_storyboard_payload()
    ctx = _build_test_studio_context(initial_payload, "storyboard")
    adapter = ContentArchitectAdapter()

    res = await adapter.execute(
        query="delete scene 2 from the storyboard",
        context=ctx,
        db=None,
    )

    new_payload = res.artifact_payload
    scenes = new_payload["scenes"]
    assert len(scenes) == 2

    # Scene 1 is preserved
    assert scenes[0]["scene_number"] == 1
    assert scenes[0]["voiceover_script"] == initial_payload["scenes"][0]["voiceover_script"]

    # Scene 2 is the former Scene 3, cleanly re-indexed
    assert scenes[1]["scene_number"] == 2
    assert scenes[1]["voiceover_script"] == initial_payload["scenes"][2]["voiceover_script"]
    assert scenes[1]["start_ms"] == scenes[0]["end_ms"]


@pytest.mark.asyncio
async def test_storyboard_structural_insert_between_scenes(monkeypatch: pytest.MonkeyPatch):
    """
    Verifies that inserting a scene 'between 1 and 2' places the new scene
    at position 2 (index 1), pushes the original Scene 2 to Scene 3,
    and original Scene 3 to Scene 4, with smooth monotonic timestamps.
    """
    initial_payload = _build_test_storyboard_payload()
    ctx = _build_test_studio_context(initial_payload, "storyboard")
    adapter = ContentArchitectAdapter()

    new_scene_mock = TargetedSceneRevisionOutput(
        conversational_intro="Added the ghee and spice sprinkling scene right after the opening hook.",
        shot_type="Macro Close-Up • Slow Motion",
        visual_action="Chef sprinkles stone-ground masala and pours fragrant golden desi ghee over the sizzling mutton raan.",
        voiceover_script="A generous pour of desi ghee and our signature secret masala blend.",
        on_screen_text="Pure Desi Ghee & Handewadi Masala",
        audio_sfx_cue="Sizzling ghee crackle + rich chime",
        ai_visual_prompt="Macro slow-motion shot of golden clarified butter drizzled over roasted spiced meat, cinematic restaurant lighting",
    )

    async def mock_invoke(*args, **kwargs):
        return new_scene_mock

    monkeypatch.setattr(
        "app.campaign_intelligence.specialists.content_architect_adapter.invoke_structured_llm",
        mock_invoke,
    )

    res = await adapter.execute(
        query="add a scene between 1 and 2 where the chef sprinkles some tasty masala and ghee on the mutton raan",
        context=ctx,
        db=None,
    )

    assert res.artifact_type == ArtifactType.storyboard
    new_payload = res.artifact_payload
    scenes = new_payload["scenes"]

    # Must now have 4 scenes (3 original + 1 inserted)
    assert len(scenes) == 4

    # Scene 1: Untouched original Scene 1
    assert scenes[0]["scene_number"] == 1
    assert scenes[0]["voiceover_script"] == initial_payload["scenes"][0]["voiceover_script"]
    assert scenes[0]["start_ms"] == 0

    # Scene 2: Newly inserted scene!
    assert scenes[1]["scene_number"] == 2
    assert "A generous pour of desi ghee" in scenes[1]["voiceover_script"]
    assert "Chef sprinkles stone-ground masala" in scenes[1]["visual_action"]
    assert scenes[1]["start_ms"] == scenes[0]["end_ms"]

    # Scene 3: Original Scene 2, shifted to position 3
    assert scenes[2]["scene_number"] == 3
    assert scenes[2]["voiceover_script"] == initial_payload["scenes"][1]["voiceover_script"]
    assert scenes[2]["visual_action"] == initial_payload["scenes"][1]["visual_action"]
    assert scenes[2]["start_ms"] == scenes[1]["end_ms"]

    # Scene 4: Original Scene 3, shifted to position 4
    assert scenes[3]["scene_number"] == 4
    assert scenes[3]["voiceover_script"] == initial_payload["scenes"][2]["voiceover_script"]
    assert scenes[3]["start_ms"] == scenes[2]["end_ms"]


@pytest.mark.asyncio
async def test_storyboard_revise_all_scenes_updates_voiceovers(monkeypatch: pytest.MonkeyPatch):
    """
    Verifies that requesting a global script revision updates voiceover_script
    and on_screen_text across all scenes while preserving camera framing and structure.
    """
    initial_payload = _build_test_storyboard_payload()
    ctx = _build_test_studio_context(initial_payload, "storyboard")
    adapter = ContentArchitectAdapter()

    revised_all_output = ReviseAllScenesOutput(
        conversational_intro="हे बघा, मी संपूर्ण स्टोरीबोर्ड अस्सल गावरान आणि मराठी स्टाइलमध्ये बदलला आहे!",
        scenes=[
            SceneScriptUpdate(
                scene_number=1,
                voiceover_script="मंडळी, अस्सल हांडेवाडी स्टाइल मटण रान कधी खाल्लंय का? थांबा आणि बघा!",
                on_screen_text="अस्सल गावरान चव • हांडेवाडी",
            ),
            SceneScriptUpdate(
                scene_number=2,
                voiceover_script="१८ सुगंधी मसाल्यांमध्ये ६ तास मंद आचेवर शिजवलेलं गावरान मटण!",
                on_screen_text="६ तास मंद आचेवर शिजवलेलं",
            ),
            SceneScriptUpdate(
                scene_number=3,
                voiceover_script="हॉटेल्स शौर्यवाड्यात या, आणि आजच आपल्या कुटुंबासोबत या चवीचा आनंद घ्या!",
                on_screen_text="हॉटेल शौर्यवाडा • आजच बुक करा",
            ),
        ],
        caption="🍲✨ अस्सल गावरान चवीचा अनुभव फक्त शौर्यवाड्यात! आजच भेट द्या. #PuneFoodies #HotelShauryawada",
        call_to_action="आताच बायोमधील लिंकवर क्लिक करून टेबल बुक करा!",
    )

    async def mock_invoke(*args, **kwargs):
        return revised_all_output

    monkeypatch.setattr(
        "app.campaign_intelligence.specialists.content_architect_adapter.invoke_structured_llm",
        mock_invoke,
    )

    res = await adapter.execute(
        query="also change the script for all the scenes to authentic Marathi village style",
        context=ctx,
        db=None,
    )

    assert res.artifact_type == ArtifactType.storyboard
    new_payload = res.artifact_payload
    scenes = new_payload["scenes"]
    assert len(scenes) == 3

    # All scenes must have the updated Marathi voiceover
    assert "मंडळी, अस्सल हांडेवाडी स्टाइल" in scenes[0]["voiceover_script"]
    assert scenes[0]["on_screen_text"] == "अस्सल गावरान चव • हांडेवाडी"
    # Core framing preserved
    assert scenes[0]["shot_type"] == initial_payload["scenes"][0]["shot_type"]

    assert "१८ सुगंधी मसाल्यांमध्ये" in scenes[1]["voiceover_script"]
    assert scenes[1]["shot_type"] == initial_payload["scenes"][1]["shot_type"]

    assert "हॉटेल्स शौर्यवाड्यात या" in scenes[2]["voiceover_script"]

    # Updated caption and call to action
    assert "अस्सल गावरान चवीचा अनुभव" in new_payload["full_caption"]
    assert "आताच बायोमधील लिंकवर" in new_payload["call_to_action"]


@pytest.mark.asyncio
async def test_carousel_targeted_slide_edit_preserves_other_slides(monkeypatch: pytest.MonkeyPatch):
    """
    Verifies that revising Slide 3 in a carousel updates Slide 3
    while preserving Slides 1, 2, 4, 5 completely.
    """
    initial_payload = _build_test_carousel_payload()
    ctx = _build_test_studio_context(initial_payload, "carousel_deck")
    adapter = ContentArchitectAdapter()

    revised_slide = TargetedSlideRevisionOutput(
        conversational_intro="Updated Slide 3 with fresh whole spice analysis.",
        headline="Secret 2: Whole Spice Extraction",
        body_copy="Crushing whole black cardamom and mace releases oils that powder completely loses.",
        visual_layout="Macro studio shot of crushed black cardamom seeds with visible amber resin",
        slide_type="content",
    )

    async def mock_invoke(*args, **kwargs):
        return revised_slide

    monkeypatch.setattr("app.campaign_intelligence.specialists.content_architect_adapter.invoke_structured_llm", mock_invoke)

    res = await adapter.execute(
        query="rewrite slide 3 to focus on whole spice extraction and aroma",
        context=ctx,
        db=None,
    )

    new_payload = res.artifact_payload
    slides = new_payload["slides"]
    assert len(slides) == 5

    # Slides 1, 2, 4, 5 untouched
    assert slides[0] == initial_payload["slides"][0]
    assert slides[1] == initial_payload["slides"][1]
    assert slides[3] == initial_payload["slides"][3]
    assert slides[4] == initial_payload["slides"][4]

    # Slide 3 updated
    assert slides[2]["headline"] == "Secret 2: Whole Spice Extraction"
    assert "black cardamom" in slides[2]["body_copy"]


# =====================================================================
# Production-Ready Export Tests
# =====================================================================

def test_format_production_brief_markdown_content():
    payload = _build_test_storyboard_payload()
    brief_md = format_production_brief(payload, "storyboard")

    # Header and backward-compatibility summary
    assert "Storyboard with 3 scenes ready for shoot." in brief_md
    assert "# Creative Shoot Brief: Shauryawada: Signature Raan Showcase" in brief_md
    assert "**Platform**: INSTAGRAM | **Duration**: 15s" in brief_md

    # Scene breakdown
    assert "### Scene 1 [0:00 - 0:03] • Extreme Close-Up" in brief_md
    assert "Camera macro dive into sizzling tandoor oven." in brief_md
    assert "You have never tasted mutton cooked this way." in brief_md
    assert "Macro close-up of tandoori flames" in brief_md

    assert "### Scene 2 [0:03 - 0:08] • Medium POV" in brief_md
    assert "### Scene 3 [0:08 - 0:15] • Hero Table Reveal" in brief_md

    # Post copy
    assert "## Post Copy & Off-Ramp:" in brief_md
    assert "Link in bio to book your table!" in brief_md
    assert "#Shauryawada" in brief_md
    assert "Tap link in bio to book your table" in brief_md


@pytest.mark.asyncio
async def test_end_to_end_production_export_enrichment(db_session: AsyncSession):
    """
    Verifies that exporting an approved storyboard creates:
    1. Deliverable with correct metadata.
    2. Task with detailed scene-by-scene shoot script in notes.
    3. DeliverableComment containing the complete creative brief.
    """
    # 1. Seed Agency, User, Campaign
    agency = Agency(id=uuid.uuid4(), name="Creative Studio Apex", slug=f"apex-{uuid.uuid4().hex[:6]}")
    db_session.add(agency)
    await db_session.flush()

    user = User(
        id=uuid.uuid4(),
        email=f"editor_{uuid.uuid4().hex[:6]}@apex.com",
        hashed_password="pw",
        full_name="Video Editor Jane",
    )
    db_session.add(user)
    await db_session.flush()

    client = Client(
        id=uuid.uuid4(),
        agency_id=agency.id,
        business_name="Hotel Shauryawada",
        industry="Restaurant",
    )
    db_session.add(client)
    await db_session.flush()

    campaign = Campaign(
        id=uuid.uuid4(),
        client_id=client.id,
        name="Shauryawada Winter Sprint",
    )
    db_session.add(campaign)
    await db_session.flush()

    session = CampaignStudioSession(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        client_id=client.id,
        agency_id=agency.id,
        title="Studio Session",
    )
    db_session.add(session)
    await db_session.flush()

    # 2. Save and approve artifact
    payload = _build_test_storyboard_payload()
    artifact, version = await save_or_revise_artifact(
        session_id=session.id,
        agency_id=agency.id,
        client_id=client.id,
        campaign_id=campaign.id,
        artifact_type="storyboard",
        title=payload["deliverable_title"],
        payload=payload,
        actor_type="agent",
        actor_id="content_architect",
        db=db_session,
    )
    await approve_artifact_version(
        artifact_id=artifact.id,
        version_number=version.version_number,
        agency_id=agency.id,
        campaign_id=campaign.id,
        user_id=user.id,
        db=db_session,
    )
    await db_session.commit()

    # 3. Export to production
    export_rec, is_replay = await export_artifact_to_production(
        agency_id=agency.id,
        campaign_id=campaign.id,
        artifact_id=artifact.id,
        expected_version_number=1,
        user_id=user.id,
        idempotency_key=f"idem-key-{uuid.uuid4().hex}",
        raw_payload_dict={"test": "export"},
        db=db_session,
        assignee_id=user.id,
        default_due_date=date(2026, 11, 25),
        target_format="reel",
        deliverable_name="Shauryawada Signature Raan Reel",
    )
    await db_session.commit()

    assert is_replay is False
    mapping = export_rec.production_mapping
    deliv_id = uuid.UUID(mapping["deliverable_id"])
    task_id = uuid.UUID(mapping["task_id"])

    # Verify Deliverable in DB
    deliv_res = await db_session.execute(select(Deliverable).where(Deliverable.id == deliv_id))
    deliv = deliv_res.scalars().first()
    assert deliv is not None
    assert deliv.title == "Shauryawada Signature Raan Reel"
    assert deliv.deliverable_type == "reel"

    # Verify Task in DB has full shoot script in notes and is ready in To Do / Scripting stage
    task_res = await db_session.execute(select(Task).where(Task.id == task_id))
    task = task_res.scalars().first()
    assert task is not None
    assert task.assignee_id == user.id
    assert task.due_date == date(2026, 11, 25)
    assert task.task_type == "scripting"
    assert task.status == TaskStatus.todo
    assert "Storyboard with 3 scenes ready for shoot." in task.notes
    assert "Scene 1 [0:00 - 0:03] • Extreme Close-Up" in task.notes
    assert "You have never tasted mutton cooked this way" in task.notes
    assert "Macro close-up of tandoori flames" in task.notes

    # Verify internal DeliverableComment attached to deliverable
    comment_res = await db_session.execute(
        select(DeliverableComment).where(DeliverableComment.deliverable_id == deliv_id)
    )
    comments = comment_res.scalars().all()
    assert len(comments) == 1
    c = comments[0]
    assert c.is_internal is True
    assert c.author_id == user.id
    assert "Storyboard with 3 scenes ready for shoot." in c.message
    assert "Scene-by-Scene Shoot Script:" in c.message
    assert "Tap link in bio to book your table" in c.message


def test_parse_target_duration_all_variations():
    """Verifies natural language extraction of target durations across all common units."""
    from app.campaign_intelligence.specialists.content_architect_adapter import parse_target_duration

    assert parse_target_duration("create a 60 sec draft") == 60
    assert parse_target_duration("draft a 60-second reel") == 60
    assert parse_target_duration("give me a 60s thali video") == 60
    assert parse_target_duration("make it 45 seconds") == 45
    assert parse_target_duration("15 second teaser") == 15
    assert parse_target_duration("1 minute thali showcase") == 60
    assert parse_target_duration("2 mins behind the scenes") == 120
    assert parse_target_duration("1.5 minutes full walk-through") == 90
    assert parse_target_duration("add a scene between 1 and 2") == 20  # default fallback
    assert parse_target_duration("add some ghee and masala", default_duration=15) == 15


def test_normalize_storyboard_scenes_timing_with_target_duration():
    """
    Verifies that passing a target duration proportionally scales short scene cards
    to fill the full duration, producing smooth sequential timestamps ending at the target.
    """
    from app.campaign_intelligence.collaboration.schemas import SceneCard
    from app.campaign_intelligence.specialists.content_architect_adapter import normalize_storyboard_scenes_timing

    # 5 scenes that raw-sum to 20s (4s each)
    short_scenes = [
        SceneCard(scene_number=1, start_ms=0, end_ms=4000, timestamp_range="0:00 - 0:04", shot_type="Macro Close-Up", visual_action="Hook", voiceover_script="Hook line"),
        SceneCard(scene_number=2, start_ms=4000, end_ms=8000, timestamp_range="0:04 - 0:08", shot_type="Medium Shot", visual_action="Prep", voiceover_script="Prep line"),
        SceneCard(scene_number=3, start_ms=8000, end_ms=12000, timestamp_range="0:08 - 0:12", shot_type="Close-Up", visual_action="Sizzle", voiceover_script="Sizzle line"),
        SceneCard(scene_number=4, start_ms=12000, end_ms=16000, timestamp_range="0:12 - 0:16", shot_type="Overhead", visual_action="Garnish", voiceover_script="Garnish line"),
        SceneCard(scene_number=5, start_ms=16000, end_ms=20000, timestamp_range="0:16 - 0:20", shot_type="Wide Shot", visual_action="CTA", voiceover_script="CTA line"),
    ]

    # Normalize with 60 seconds requested
    scaled_scenes, total_dur = normalize_storyboard_scenes_timing(short_scenes, target_duration_seconds=60)

    assert total_dur == 60
    assert len(scaled_scenes) == 5
    assert scaled_scenes[0].start_ms == 0
    assert scaled_scenes[-1].end_ms == 60000
    assert scaled_scenes[-1].timestamp_range.endswith("1:00")

    # Timestamps strictly sequential and monotonic
    for i in range(len(scaled_scenes) - 1):
        assert scaled_scenes[i].end_ms == scaled_scenes[i + 1].start_ms


def test_normalize_storyboard_scenes_timing_auto_subdivides_single_long_scene():
    """
    Verifies that if an LLM returns a single scene for a 60-second video,
    the timing normalizer automatically subdivides it into distinct cinematic beats (e.g. 10 scenes)
    spanning 0:00 to 1:00, preventing single-scene overlong storyboards.
    """
    from app.campaign_intelligence.collaboration.schemas import SceneCard
    from app.campaign_intelligence.specialists.content_architect_adapter import normalize_storyboard_scenes_timing

    single_60s_scene = [
        SceneCard(
            scene_number=1,
            start_ms=0,
            end_ms=60000,
            timestamp_range="0:00 - 1:00",
            shot_type="Macro Close-Up",
            visual_action="Steaming mutton raan on wooden platter.",
            voiceover_script="Taste the magic of village food!",
            on_screen_text="Slow-Cooked Mutton Raan",
            audio_sfx_cue="ASMR sizzle",
        )
    ]

    subdivided, total_dur = normalize_storyboard_scenes_timing(single_60s_scene, target_duration_seconds=60)

    assert total_dur == 60
    assert len(subdivided) == 10
    assert subdivided[0].scene_number == 1
    assert subdivided[0].start_ms == 0
    assert subdivided[-1].scene_number == 10
    assert subdivided[-1].end_ms == 60000
    assert subdivided[-1].timestamp_range.endswith("1:00")

    # Verify no scene exceeds 8 seconds
    for s in subdivided:
        dur_s = (s.end_ms - s.start_ms) // 1000
        assert dur_s <= 8
        assert s.shot_type is not None
        assert s.visual_action is not None
        assert s.voiceover_script is not None

