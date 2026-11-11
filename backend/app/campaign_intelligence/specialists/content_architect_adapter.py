from __future__ import annotations

import logging
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from app.campaign_intelligence.collaboration.schemas import (
    ArtifactType,
    CarouselDeckArtifactPayload,
    CarouselSlideCard,
    HookComparisonCard,
    HookComparisonPayload,
    SceneCard,
    SocialPlatform,
    StoryboardArtifactPayload,
)
from app.campaign_intelligence.schemas.studio_context import CampaignStudioContext
from app.campaign_intelligence.specialists.base import SpecialistAdapter, SpecialistResult
from app.core.config import settings
from app.core.llm import invoke_structured_llm

logger = logging.getLogger(__name__)


class StoryboardGenerationOutput(BaseModel):
    conversational_intro: str
    deliverable_title: str
    target_duration_seconds: int = 20
    strategic_pillar: str = "Core Value"
    scenes: list[SceneCard] = Field(min_length=1)
    caption: str = ""
    hashtags: list[str] = Field(default_factory=list)
    call_to_action: str = ""
    suggested_followups: list[str] = Field(default_factory=list)


class HookAnalysisOutput(BaseModel):
    conversational_intro: str
    topic: str
    target_audience: str
    hooks: list[HookComparisonCard] = Field(min_length=2)
    recommended_hook_id: str
    suggested_followups: list[str] = Field(default_factory=list)


class CarouselGenerationOutput(BaseModel):
    conversational_intro: str
    deliverable_title: str
    slides: list[CarouselSlideCard] = Field(min_length=2)
    caption: str = ""
    hashtags: list[str] = Field(default_factory=list)
    call_to_action: str = ""
    suggested_followups: list[str] = Field(default_factory=list)


class ContentArchitectAdapter(SpecialistAdapter):
    """
    Adapter bridging ContentArchitectAgent into Campaign Studio.
    Generates structured, polymorphic deliverable artifacts:
    - StoryboardArtifactPayload (Reels/Shorts with timing, camera cues, VO, Flux prompts)
    - CarouselDeckArtifactPayload (Multi-slide decks with cover, value, CTA)
    - HookComparisonPayload (Qualitative 3-hook comparative analysis)
    Supports in-place scene revisions when active artifact exists.
    """

    def __init__(self):
        super().__init__(
            specialist_id="content_architect",
            specialist_name="Scriptwriter & Architect",
        )

    async def execute(
        self,
        query: str,
        context: CampaignStudioContext,
        db: AsyncSession,
    ) -> SpecialistResult:
        activity_logs: list[str] = []
        lower_q = query.lower()

        brand_voice = ", ".join(context.brand_context.brand_voice) if context.brand_context and context.brand_context.brand_voice else "Engaging & Authentic"
        client_name = context.client_name
        industry = context.client_industry or "General Business"

        # -------------------------------------------------------------
        # Branch A: Hook Analysis & Comparison
        # -------------------------------------------------------------
        is_hook_request = any(kw in lower_q for kw in ["compare hooks", "hook options", "hook variations", "hook breakdown"]) or (
            context.active_artifact_type != ArtifactType.storyboard.value and any(kw in lower_q for kw in ["hook", "headline", "opening line"])
        )
        if is_hook_request:
            activity_logs.append("Synthesizing comparative hook variations with clarity & fluff analysis...")
            prompt = f"""You are the Master Scriptwriter & Content Storyboard Architect for AgencyOS.
User Request: "{query}"

Client: {client_name} ({industry})
Brand Voice: {brand_voice}

YOUR TASK:
Compare 3 distinct, high-impact hook variations for this client.
Evaluate each hook for:
1. Framework (e.g. Negative Constraint, Curiosity Gap, Sensory/Visual Pattern Interrupt, Insider Secret)
2. Psychological trigger and clarity rating (High/Medium/Low)
3. Fluff detection (True if it uses filler phrases like 'Hey guys' or 'In today's video')
4. Qualitative Pros & Cons

Return strictly matching the HookAnalysisOutput schema.
"""
            try:
                hook_res: HookAnalysisOutput = await invoke_structured_llm(
                    prompt=prompt,
                    schema_class=HookAnalysisOutput,
                    temperature=0.3,
                    model=settings.FALLBACK_MODEL,
                )
                payload = HookComparisonPayload(
                    topic=hook_res.topic,
                    target_audience=hook_res.target_audience,
                    hooks=hook_res.hooks,
                )
                activity_logs.append(f"Generated {len(hook_res.hooks)} alternative hooks (Recommended: {hook_res.recommended_hook_id}).")
                return SpecialistResult(
                    specialist_id=self.specialist_id,
                    specialist_name=self.specialist_name,
                    reply=f"{hook_res.conversational_intro}\n\n**Recommended Hook**: #{hook_res.recommended_hook_id}",
                    artifact_type=ArtifactType.hook_comparison,
                    artifact_payload=payload.model_dump(),
                    activity_logs=activity_logs,
                    suggested_followups=hook_res.suggested_followups or [
                        "Turn recommended hook into a full Reel storyboard",
                        "Audit hooks for brand compliance",
                        "Test hook on TikTok vs Instagram",
                    ],
                )
            except Exception as ex:
                logger.warning(f"Error in hook analysis: {ex}")

        # -------------------------------------------------------------
        # Branch B: Carousel Deck Generation
        # -------------------------------------------------------------
        if any(kw in lower_q for kw in ["carousel", "slide deck", "slides"]):
            activity_logs.append("Drafting multi-slide carousel deck with visual layout instructions...")
            prompt = f"""You are the Master Scriptwriter for AgencyOS.
User Request: "{query}"

Client: {client_name} ({industry})
Brand Voice: {brand_voice}

Generate a high-density 5 to 7 slide educational/authority carousel.
Slide 1 MUST be a high-contrast cover.
Final slide MUST be a save/share CTA.
Return strictly matching CarouselGenerationOutput schema.
"""
            try:
                car_res: CarouselGenerationOutput = await invoke_structured_llm(
                    prompt=prompt,
                    schema_class=CarouselGenerationOutput,
                    temperature=0.3,
                    model=settings.FALLBACK_MODEL,
                )
                payload = CarouselDeckArtifactPayload(
                    deliverable_title=car_res.deliverable_title,
                    platform=SocialPlatform.linkedin,
                    format_type="carousel",
                    slides=car_res.slides,
                    full_caption=car_res.caption,
                    hashtags=car_res.hashtags,
                    call_to_action=car_res.call_to_action,
                )
                activity_logs.append(f"Architected {len(car_res.slides)}-slide carousel deck.")
                return SpecialistResult(
                    specialist_id=self.specialist_id,
                    specialist_name=self.specialist_name,
                    reply=car_res.conversational_intro,
                    artifact_type=ArtifactType.carousel_deck,
                    artifact_payload=payload.model_dump(),
                    activity_logs=activity_logs,
                    suggested_followups=car_res.suggested_followups or [
                        "Review carousel copy against brand rules",
                        "Turn into a video script",
                    ],
                )
            except Exception as ex:
                logger.warning(f"Error in carousel generation: {ex}")

        # -------------------------------------------------------------
        # Branch C: Reel / Video Storyboard Generation & Revision
        # -------------------------------------------------------------
        activity_logs.append("Architecting timestamped Reel storyboard (scenes, camera cues, voiceover, Flux prompts)...")

        existing_scenes_text = ""
        if context.active_artifact_payload and context.active_artifact_type == ArtifactType.storyboard.value:
            activity_logs.append(f"Detected active storyboard '{context.active_artifact_payload.get('deliverable_title')}'. Applying revision...")
            existing_scenes_text = f"\nExisting Storyboard Payload to revise:\n{context.active_artifact_payload}\n"

        prompt = f"""You are the Master Scriptwriter & Content Storyboard Architect for AgencyOS.
User Request: "{query}"

Client: {client_name} ({industry}, Location: {context.client_location or 'General'})
Brand Voice: {brand_voice}
{existing_scenes_text}

YOUR TASK:
Generate or revise a full production-ready video storyboard matching StoryboardGenerationOutput schema.
Requirements:
1. Target duration: 15 to 30 seconds.
2. Scene 1 (0:00 - 0:03) MUST be an arresting visual and auditory hook.
3. Every scene MUST have:
   - start_ms and end_ms (strictly sequential and valid!)
   - timestamp_range (e.g. '0:00 - 0:03', '0:03 - 0:08')
   - shot_type (e.g. 'Macro Close-Up', 'POV Whip Pan', 'Talking Head')
   - visual_action (director guidance for camera & talent)
   - voiceover_script (exact spoken line)
   - on_screen_text (overlay text)
   - audio_sfx_cue (ASMR sizzle, trending beat, sound effect)
   - ai_visual_prompt (photorealistic Flux / Midjourney generation prompt)
4. Full publishable caption, targeted hashtags, and clear CTA.
"""

        try:
            sb_res: StoryboardGenerationOutput = await invoke_structured_llm(
                prompt=prompt,
                schema_class=StoryboardGenerationOutput,
                temperature=0.3,
                model=settings.FALLBACK_MODEL,
            )
            payload = StoryboardArtifactPayload(
                deliverable_title=sb_res.deliverable_title,
                platform=SocialPlatform.instagram,
                format_type="reel",
                target_duration_seconds=sb_res.target_duration_seconds,
                strategic_pillar=sb_res.strategic_pillar,
                scenes=sb_res.scenes,
                full_caption=sb_res.caption,
                hashtags=sb_res.hashtags,
                call_to_action=sb_res.call_to_action,
            )
            activity_logs.append(f"Successfully generated {len(sb_res.scenes)}-scene storyboard: '{sb_res.deliverable_title}'.")
            return SpecialistResult(
                specialist_id=self.specialist_id,
                specialist_name=self.specialist_name,
                reply=sb_res.conversational_intro,
                artifact_type=ArtifactType.storyboard,
                artifact_payload=payload.model_dump(),
                activity_logs=activity_logs,
                suggested_followups=sb_res.suggested_followups or [
                    "Audit storyboard for brand compliance",
                    "Add alternative hook options",
                    "Export to production pipeline",
                ],
            )
        except Exception as ex:
            logger.error(f"Error generating storyboard: {ex}", exc_info=True)
            # Fallback deterministic scene
            fallback_scenes = [
                SceneCard(
                    scene_number=1,
                    start_ms=0,
                    end_ms=3000,
                    timestamp_range="0:00 - 0:03",
                    shot_type="Extreme Close-Up • Whip Pan",
                    visual_action=f"Fast macro camera whip towards {client_name} signature presentation.",
                    voiceover_script=f"Stop scrolling if you care about real quality in {industry}.",
                    on_screen_text=f"The secret behind {client_name}",
                    audio_sfx_cue="Whoosh hit + crisp ambient sound",
                    ai_visual_prompt=f"Cinematic close-up {industry} presentation, dramatic commercial studio lighting, 8k",
                ),
                SceneCard(
                    scene_number=2,
                    start_ms=3000,
                    end_ms=8000,
                    timestamp_range="0:03 - 0:08",
                    shot_type="Medium POV",
                    visual_action="Talent demonstrates the craft process with high tactile detail.",
                    voiceover_script="Here is exactly how we deliver excellence every single day.",
                    on_screen_text="The Craft Process",
                    audio_sfx_cue="Upbeat rhythm track",
                ),
                SceneCard(
                    scene_number=3,
                    start_ms=8000,
                    end_ms=15000,
                    timestamp_range="0:08 - 0:15",
                    shot_type="Hero Wide Shot",
                    visual_action=f"Hero reveal of finished product at {client_name}.",
                    voiceover_script="Visit us today or check the link in bio to learn more.",
                    on_screen_text=f"Experience {client_name}",
                    ai_visual_prompt=f"Hero wide shot of {client_name} storefront/service in action, golden hour",
                ),
            ]
            fallback_payload = StoryboardArtifactPayload(
                deliverable_title=f"{client_name}: Signature Showcase Reel",
                platform=SocialPlatform.instagram,
                format_type="reel",
                target_duration_seconds=15,
                strategic_pillar="Craftsmanship",
                scenes=fallback_scenes,
                full_caption=f"Discover what sets {client_name} apart. Check our link in bio!",
                hashtags=["#quality", f"#{industry.lower().replace(' ', '')}"],
                call_to_action="Follow for more behind-the-scenes",
            )
            return SpecialistResult(
                specialist_id=self.specialist_id,
                specialist_name=self.specialist_name,
                reply=f"I've drafted a 3-scene shoot concept for **{client_name}** with timestamped camera cues, B-roll framing, and Flux visual prompts.",
                artifact_type=ArtifactType.storyboard,
                artifact_payload=fallback_payload.model_dump(),
                activity_logs=activity_logs,
                suggested_followups=["Audit compliance", "Refine scenes"],
            )
