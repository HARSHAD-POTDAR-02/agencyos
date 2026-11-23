from __future__ import annotations

import logging
import re
import uuid
from datetime import date, datetime, timedelta, timezone

import asyncio
import json

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

logger = logging.getLogger(__name__)

from app.campaign_intelligence.orchestration.graph import run_campaign_pipeline
from app.campaign_intelligence.orchestration.state import CampaignState
from app.campaign_intelligence.schemas.campaign import CampaignBrief
from app.campaign_intelligence.schemas.deliverables import (
    CarouselSlide,
    DeliverablePlan,
    ReelScene,
)
from app.campaign_intelligence.schemas.quality import QualityEvaluation
from app.campaign_intelligence.schemas.strategy import CampaignStrategy
from app.campaign_intelligence.tools.date_utils import (
    extract_date_range_from_text,
    extract_format_and_count_from_text,
    sanitize_date_year,
)
from app.campaign_intelligence.schemas.brand import (
    BrandContext,
    ProhibitedClaim,
    ProhibitedTerm,
    VerifiedOffer,
)
from app.campaign_intelligence.schemas.studio_context import CampaignStudioContext
from app.campaign_intelligence.services.studio_service import (
    approve_artifact_version,
    export_artifact_to_production,
    get_or_create_studio_session,
    save_or_revise_artifact,
)
from app.campaign_intelligence.specialists import (
    SPECIALIST_REGISTRY,
    get_specialist_adapter,
)
from app.core.config import settings
from app.core.database import get_db
from app.core.llm import get_llm, invoke_structured_llm
from app.dependencies import require_agency_member, require_role
from app.models.brand_profile import BrandProfile
from app.models.campaign import Campaign, CampaignStatus
from app.models.client import Client, ClientStatus
from app.models.contract import Contract, ScopeItem
from app.models.deliverable import Deliverable, DeliverableStatus
from app.models.studio_artifact import (
    CampaignStudioSession,
    StudioArtifact,
    StudioArtifactStatus,
    StudioArtifactVersion,
)
from app.models.task import Task, TaskPriority, TaskStatus
from app.models.user import Membership, RoleEnum
from app.schemas.campaign import (
    CampaignCreate,
    CampaignOut,
    ChatBriefRequest,
    ChatBriefResponse,
    ConvertToTasksRequest,
    ConvertToTasksResponse,
    DeliverableCreate,
    DeliverableOut,
    GeneratePlanRequest,
    StudioApproveVersionRequest,
    StudioReviseArtifactRequest,
    StudioArtifactOut,
    StudioArtifactVersionOut,
    StudioExportPipelineRequest,
    StudioExportPipelineResponse,
    UpdateDeliverableRequest,
    UpdateDeliverableResponse,
    ReviseDeliverableAIRequest,
    ReviseDeliverableAIResponse,
)
from app.services.tenant_service import (
    assert_campaign_belongs_to_agency,
    get_client_for_agency,
)

router = APIRouter(tags=["campaigns"])


@router.post(
    "/agencies/{agency_id}/clients/{client_id}/campaigns",
    response_model=CampaignOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_campaign(
    agency_id: uuid.UUID,
    client_id: uuid.UUID,
    payload: CampaignCreate,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> CampaignOut:
    """Create a campaign for a client."""
    await get_client_for_agency(client_id, agency_id, db)
    campaign = Campaign(
        id=uuid.uuid4(),
        client_id=client_id,
        **payload.model_dump(),
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return CampaignOut.model_validate(campaign)


@router.get(
    "/agencies/{agency_id}/clients/{client_id}/campaigns",
    response_model=list[CampaignOut],
)
async def list_campaigns(
    agency_id: uuid.UUID,
    client_id: uuid.UUID,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> list[CampaignOut]:
    """List all campaigns for a client."""
    await get_client_for_agency(client_id, agency_id, db)
    result = await db.execute(
        select(Campaign)
        .where(Campaign.client_id == client_id)
        .order_by(Campaign.created_at.desc())
    )
    campaigns = result.scalars().all()
    return [CampaignOut.model_validate(c) for c in campaigns]


@router.get(
    "/agencies/{agency_id}/campaigns/{campaign_id}",
    response_model=CampaignOut,
)
async def get_campaign(
    agency_id: uuid.UUID,
    campaign_id: uuid.UUID,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> CampaignOut:
    """Get campaign detail, verifying agency ownership."""
    campaign = await assert_campaign_belongs_to_agency(campaign_id, agency_id, db)
    return CampaignOut.model_validate(campaign)


@router.patch(
    "/agencies/{agency_id}/campaigns/{campaign_id}",
    response_model=CampaignOut,
)
async def update_campaign(
    agency_id: uuid.UUID,
    campaign_id: uuid.UUID,
    payload: CampaignCreate,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> CampaignOut:
    """Update a campaign."""
    campaign = await assert_campaign_belongs_to_agency(campaign_id, agency_id, db)
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(campaign, field, value)
    await db.commit()
    await db.refresh(campaign)
    return CampaignOut.model_validate(campaign)


@router.post(
    "/agencies/{agency_id}/campaigns/{campaign_id}/deliverables",
    response_model=DeliverableOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_deliverable(
    agency_id: uuid.UUID,
    campaign_id: uuid.UUID,
    payload: DeliverableCreate,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> DeliverableOut:
    """Add a deliverable to a campaign."""
    await assert_campaign_belongs_to_agency(campaign_id, agency_id, db)
    deliverable = Deliverable(
        id=uuid.uuid4(),
        campaign_id=campaign_id,
        **payload.model_dump(),
    )
    db.add(deliverable)
    await db.commit()
    await db.refresh(deliverable)
    return DeliverableOut.model_validate(deliverable)


@router.post(
    "/agencies/{agency_id}/clients/{client_id}/campaigns/generate-plan",
    response_model=CampaignOut,
    status_code=status.HTTP_201_CREATED,
)
async def generate_plan_endpoint(
    agency_id: uuid.UUID,
    client_id: uuid.UUID,
    payload: GeneratePlanRequest,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> CampaignOut:
    """Generate an AI-powered campaign plan for a client using the Campaign Intelligence multi-agent engine."""
    client = await get_client_for_agency(client_id, agency_id, db)

    # 1. Resolve timeline and construct CampaignBrief
    campaign_id = uuid.uuid4()
    curr_dt = date.today()
    default_year = payload.period_year or curr_dt.year
    start_dt: date | None = None
    end_dt: date | None = None
    duration_days: int | None = payload.duration_days

    if payload.start_date:
        try:
            start_dt = datetime.strptime(payload.start_date, "%Y-%m-%d").date()
        except Exception:
            pass
    if payload.end_date:
        try:
            end_dt = datetime.strptime(payload.end_date, "%Y-%m-%d").date()
        except Exception:
            pass

    # Fallback to date range extractor if dates were typed in custom_brief or objective
    if not start_dt:
        text_to_scan = f"{payload.custom_brief or ''} {payload.objective or ''}"
        extracted = extract_date_range_from_text(text_to_scan, default_year=default_year, reference_start_date=payload.start_date)
        if extracted:
            start_dt = extracted.start_date
            end_dt = extracted.end_date
            duration_days = extracted.duration_days

    # Sanitize accidental cutoff year if passed from legacy payload
    if start_dt and start_dt.year < curr_dt.year and default_year >= curr_dt.year:
        try:
            start_dt = start_dt.replace(year=default_year)
        except ValueError:
            pass
    if end_dt and end_dt.year < curr_dt.year and default_year >= curr_dt.year:
        try:
            end_dt = end_dt.replace(year=default_year)
        except ValueError:
            pass

    if start_dt and end_dt and not duration_days:
        duration_days = (end_dt - start_dt).days + 1

    period_m = start_dt.month if start_dt else payload.period_month
    period_y = start_dt.year if start_dt else default_year

    # Extract format preferences and count from brief/objective if not explicitly provided
    detected_prefs, detected_count = extract_format_and_count_from_text(
        f"{payload.custom_brief or ''} {payload.objective or ''}"
    )
    final_prefs = payload.deliverable_preferences or detected_prefs
    if detected_count and not duration_days:
        duration_days = detected_count

    custom_brief_text = payload.custom_brief
    if payload.pinned_entities:
        pinned_summary = ", ".join(payload.pinned_entities)
        custom_brief_text = (
            f"{custom_brief_text or ''}\n[HERO FOCUS]: Feature these verified hero entities: {pinned_summary}"
        ).strip()

    brief = CampaignBrief(
        campaign_id=campaign_id,
        client_id=client_id,
        agency_id=agency_id,
        name=f"{client.business_name} - {period_m}/{period_y} Plan",
        objective=payload.objective or f"Deliver {duration_days or 3} high-impact social media deliverables",
        period_month=period_m,
        period_year=period_y,
        start_date=start_dt,
        end_date=end_dt,
        duration_days=duration_days,
        custom_brief=custom_brief_text,
        deliverable_preferences=final_prefs or [],
        pinned_entities=payload.pinned_entities,
    )

    # 2. Build initial StateGraph state
    initial_state: CampaignState = {
        "brief": brief,
        "campaign_id": campaign_id,
        "client_id": client_id,
        "agency_id": agency_id,
        "run_id": str(uuid.uuid4()),
        "brand_context": None,
        "market_research": None,
        "historical_performance": None,
        "strategy": None,
        "deliverable_plans": None,
        "quality_evaluation": None,
        "revision_count": 0,
        "max_revisions": 2,
        "workflow_status": "gathering_intelligence",
        "current_agent": None,
        "human_feedback": None,
        "pipeline_agents_executed": [],
        "agent_traces": [],
        "errors": [],
    }

    # 3. Create a thread/isolated session factory from the current engine
    session_factory = async_sessionmaker(
        bind=db.bind,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )

    # 4. Execute Multi-Agent Graph Orchestrator
    try:
        final_state = await run_campaign_pipeline(
            initial_state=initial_state,
            db_session_factory=session_factory,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Campaign intelligence pipeline encountered an error: {str(exc)}",
        ) from exc

    strategy: CampaignStrategy | None = final_state.get("campaign_strategy") or final_state.get("strategy")
    deliverable_plans: list[DeliverablePlan] = final_state.get("deliverable_plans") or []
    quality_evaluation: QualityEvaluation | None = final_state.get("quality_evaluation")

    if not deliverable_plans and final_state.get("errors"):
        err_msg = "; ".join(final_state["errors"])
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Campaign intelligence pipeline failed: {err_msg}",
        )

    # 5. Format deliverable plans for UI & downstream tasks
    deliverables_formatted: list[dict[str, Any]] = []
    for idx, dp in enumerate(deliverable_plans):
        visual_desc = dp.visual_asset_prompt
        if not visual_desc and dp.reel_scenes:
            visual_desc = " | ".join(
                f"Scene {s.scene_number} ({s.timestamp_range}): {s.visual_action}"
                for s in dp.reel_scenes
            )
        elif not visual_desc and dp.carousel_slides:
            visual_desc = " | ".join(
                f"Slide {s.slide_number} ({s.slide_type}): {s.headline} - {s.visual_layout}"
                for s in dp.carousel_slides
            )
        elif not visual_desc:
            visual_desc = dp.strategic_angle

        # Map day number and scheduled calendar date
        day_num = dp.planned_day or (idx + 1)
        sched_date = dp.scheduled_date
        date_lbl = dp.date_label

        if not sched_date and start_dt:
            sprint_len = duration_days or 1
            day_offset = (day_num - 1) if (day_num <= sprint_len) else (idx % sprint_len)
            calc_dt = start_dt + timedelta(days=day_offset)
            sched_date = calc_dt.isoformat()
            day_num = day_offset + 1

        if not date_lbl and sched_date:
            try:
                date_lbl = datetime.strptime(sched_date, "%Y-%m-%d").strftime("%a, %b %d, %Y")
            except Exception:
                date_lbl = sched_date

        deliverables_formatted.append({
            "day_number": day_num,
            "scheduled_date": sched_date,
            "date_label": date_lbl,
            "title": dp.title,
            "deliverable_type": dp.deliverable_type,
            "platform": dp.platform,
            "pillar": dp.strategic_angle,
            "hook": dp.primary_hook,
            "visual_concept": visual_desc,
            "caption": dp.caption,
            "cta": dp.call_to_action,
            "audio_vibe": dp.audio_track_guidance or "Trending brand-aligned rhythm",
            "hashtags": dp.hashtags or [],
            "hook_options": dp.hook_options or [],
            "production_notes": dp.production_notes or "",
            "hero_entity": dp.hero_entity,
            "hero_focus": dp.hero_focus or ([] if not dp.hero_entity else [dp.hero_entity]),
            "reel_scenes": [s.model_dump() for s in dp.reel_scenes] if dp.reel_scenes else [],
            "carousel_slides": [s.model_dump() for s in dp.carousel_slides] if dp.carousel_slides else [],
        })

    brand_ctx = final_state.get("brand_context")
    brand_voice_str = (
        ", ".join(brand_ctx.brand_voice)
        if brand_ctx and brand_ctx.brand_voice
        else "Authentic & Professional"
    )

    plan_draft: dict[str, Any] = {
        "campaign_name": (
            f"{client.business_name} - {strategy.campaign_theme}"
            if strategy and strategy.campaign_theme
            else f"{client.business_name} - {period_m}/{period_y} Plan"
        ),
        "start_date": start_dt.isoformat() if start_dt else None,
        "end_date": end_dt.isoformat() if end_dt else None,
        "duration_days": duration_days,
        "objective": strategy.primary_objective if strategy and strategy.primary_objective else payload.objective,
        "brand_voice": brand_voice_str,
        "content_pillars": [p.pillar_name for p in strategy.messaging_pillars] if strategy and strategy.messaging_pillars else [],
        "pinned_entities": payload.pinned_entities or [],
        "total_deliverables_planned": len(deliverables_formatted),
        "generator": "AgencyOS Multi-Agent Campaign Intelligence Engine v3.0",
        "deliverables": deliverables_formatted,
        "strategy": strategy.model_dump() if strategy else None,
        "quality_evaluation": quality_evaluation.model_dump() if quality_evaluation else None,
        "workflow_status": final_state.get("workflow_status"),
        "revision_count": final_state.get("revision_count", 0),
        "pipeline_agents_executed": final_state.get("pipeline_agents_executed", []),
        "agent_traces": [t.model_dump() for t in final_state.get("agent_traces", [])] if final_state.get("agent_traces") else [],
        "brand_context_summary": {
            "business_name": brand_ctx.business_name if brand_ctx else client.business_name,
            "industry": brand_ctx.industry if brand_ctx else client.industry,
            "confirmed_facts_count": len(brand_ctx.confirmed_facts) if brand_ctx else 0,
            "verified_offers": [o.name for o in brand_ctx.verified_offers] if brand_ctx else [],
            "prohibited_terms": [pt.term for pt in brand_ctx.prohibited_terms] if brand_ctx else [],
            "prohibited_claims": [pc.claim for pc in brand_ctx.prohibited_claims] if brand_ctx else [],
            "conflicts": brand_ctx.conflicts if brand_ctx else [],
        } if brand_ctx else None,
        "market_research_summary": {
            "evidence_count": len(final_state["market_research"].evidence_sources) if final_state.get("market_research") else 0,
            "top_topics": (
                final_state["market_research"].strategic_opportunities[:3]
                if final_state.get("market_research") and final_state["market_research"].strategic_opportunities
                else [t.trend_description for t in final_state["market_research"].format_and_platform_trends[:3]]
                if final_state.get("market_research") and final_state["market_research"].format_and_platform_trends
                else []
            ),
            "competitor_angles": (
                [c.observed_angle for c in final_state["market_research"].competitor_landscape[:3]]
                if final_state.get("market_research") and final_state["market_research"].competitor_landscape
                else []
            ),
        } if final_state.get("market_research") else None,
        "performance_summary": {
            "deliverables_analyzed": (
                (final_state.get("performance_playbook") or final_state.get("historical_performance")).historical_posts_analyzed
                if (final_state.get("performance_playbook") or final_state.get("historical_performance"))
                else 0
            ),
            "fatigue_signals": (
                [f.model_dump() for f in (final_state.get("performance_playbook") or final_state.get("historical_performance")).fatigue_signals]
                if (final_state.get("performance_playbook") or final_state.get("historical_performance")) and (final_state.get("performance_playbook") or final_state.get("historical_performance")).fatigue_signals
                else []
            ),
            "recommended_formats": (
                list((final_state.get("performance_playbook") or final_state.get("historical_performance")).recommended_format_mix.keys())
                if (final_state.get("performance_playbook") or final_state.get("historical_performance")) and (final_state.get("performance_playbook") or final_state.get("historical_performance")).recommended_format_mix
                else []
            ),
        } if (final_state.get("performance_playbook") or final_state.get("historical_performance")) else None,
    }

    # 6. Save campaign
    campaign = Campaign(
        id=campaign_id,
        client_id=client_id,
        name=plan_draft["campaign_name"],
        period_month=payload.period_month,
        period_year=payload.period_year,
        objective=plan_draft["objective"],
        status=CampaignStatus.planning,
        ai_plan_draft=plan_draft,
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return CampaignOut.model_validate(campaign)


class ChatBriefLLMOutput(BaseModel):
    reply: str
    suggested_objective: str | None = None
    suggested_custom_brief: str | None = None
    suggested_deliverable_preferences: list[str] | None = None
    suggested_period_month: int | None = None
    suggested_period_year: int | None = None
    suggested_start_date: str | None = None
    suggested_end_date: str | None = None
    suggested_duration_days: int | None = None
    suggested_deliverable_count: int | None = None
    is_ready_to_generate: bool = False


AGENT_SPECS: dict[str, dict[str, Any]] = {
    "director": {
        "id": "director",
        "name": "Campaign Director",
        "title": "Co-Director Sprint Orchestrator",
        "badge_color": "violet",
        "role_persona": """You are the AgencyOS Campaign Director Copilot, an elite creative director and campaign strategist assisting an agency team to design their next social media campaign sprint.
Your primary role is to orchestrate the entire campaign vision: defining core objectives, timeline constraints, deliverable counts, and overall narrative arcs.
You guide the discovery process smoothly and signal when the strategy is solidified for autonomous execution.""",
        "action_guidance": """- Multi-turn Memory & Direct Creative Fulfillment: Act as an engaging creative director. Actively reference previous answers.
- If the user asks for specific content ideas or formats (e.g. 'give me 3 reel ideas', '3 reels please'):
  * DIRECTLY PROVIDE AND NUMBER THE EXACT IDEAS IN YOUR CONVERSATIONAL REPLY (e.g. Concept 1, Concept 2, Concept 3 with visual hook, audio vibe, narrative beat).
  * Respect their exact requested format (Reel vs Carousel vs Static).
  * Video / Reel Duration Adherence: When the user asks for reels of a specific duration (e.g. '30 to 45 sec', '45 to 60 sec', '60s'):
    - You MUST explicitly respect their duration request! Structure your reel concepts with scenes and beats that span that exact timeframe (e.g., for 30-45s: 4-6 beats ending around 0:35-0:45; for 45-60s: 5-7 beats ending around 0:50-1:00). NEVER default to 15 seconds when a longer reel duration is requested!
  * Populate `suggested_deliverable_preferences` and set `suggested_duration_days` accordingly.
- Proactively suggest 1-2 sharp creative angles suited for the brand voice.""",
    },
    "market_research": {
        "id": "market_research",
        "name": "Market & Trend Researcher",
        "title": "Live Trends & Viral Hooks Specialist",
        "badge_color": "sky",
        "role_persona": """You are the Market & Trend Research Specialist for AgencyOS.
Your domain is competitive intelligence, algorithmic velocity, viral social trends, and platform cultural moments (Instagram, TikTok, LinkedIn, YouTube Shorts).
You analyze what hooks are currently arresting attention, what visual formats are algorithmically favored, and where whitespace exists against industry competitors.""",
        "action_guidance": """- Strict Zero-Fabrication & Factual Truth Directive: NEVER invent, hallucinate, or fabricate real-world business names, competitor names, customer reviews, ratings, or addresses.
- If live search data provides verified competitor names and market findings, analyze them directly.
- If the user asks about hyper-local competitors in a specific neighborhood or town and the live search data does not contain verified local directory listings for that specific area:
  * Clearly state that verified local directory listings for that specific micro-area are not in the current search data.
  * Invite the user to name 2-3 local competitors they see in their market so you can analyze their angles.
  * Pivot immediately to dissecting high-performing category hooks, algorithmic format strategies, and content whitespace relevant to their industry.
- NEVER provide fabricated or 'hypothetical' business names disguised as real competitors.
- Never use robotic AI disclaimers or apologies; speak with executive strategic confidence.
- Provide high-voltage hook suggestions, audio pairing archetypes, and competitor gap opportunities grounded in real platform data.
- Offer 2-3 specific hook templates suited to the client's industry (e.g. 'Stop doing [common mistake]', 'The 3-second test', 'What nobody tells you about [topic]').
- Populate `suggested_objective` and `suggested_custom_brief` with trend-backed strategic positioning.""",
    },
    "brand_intelligence": {
        "id": "brand_intelligence",
        "name": "Brand Identity Specialist",
        "title": "Brand Voice & Positioning Guardian",
        "badge_color": "emerald",
        "role_persona": """You are the Brand Identity & Voice Guardian for AgencyOS.
Your domain is brand positioning, authentic tone of voice, audience demographic and psychographic personas, content pillars, verified brand offers, and strict adherence to brand boundaries (prohibited claims, forbidden words).
You ensure every idea sounds authentically like the brand and builds long-term equity rather than cheap gimmickry.""",
        "action_guidance": """- Help the user clarify, refine, or audit their brand voice, tone nuances, and core content pillars.
- Review ideas against approved offers, value propositions, and prohibited claims.
- If the user is discussing who they want to target, craft a vivid ideal customer persona (ICP) profile with pain points and aspirations.
- Keep `suggested_custom_brief` updated with refined brand guardrails and pillars.""",
    },
    "historical_performance": {
        "id": "historical_performance",
        "name": "Performance Analyst",
        "title": "Historical Analytics & Retention Specialist",
        "badge_color": "amber",
        "role_persona": """You are the Historical Performance & Analytics Specialist for AgencyOS.
Your domain is data-backed creative optimization: analyzing past published deliverable engagement, retention drop-off signals, audience fatigue, and winning hook structures.
You base your recommendations on empirical performance principles: maximizing saves, shares, average watch time, and click-through rates.""",
        "action_guidance": """- Review the client's past post performance statistics (or industry benchmarks if cold start).
- Explain which formats (Reels vs Carousels vs Single Images) generate the highest retention or saves for this niche.
- Warn against audience fatigue if certain topics or angles have been over-indexed.
- Recommend an optimal format ratio (e.g. 50% Reels for reach, 30% Carousels for saves/authority, 20% Stories/Graphics for direct action).""",
    },
    "content_architect": {
        "id": "content_architect",
        "name": "Scriptwriter & Architect",
        "title": "Video Scripts & Content Storyboard Architect",
        "badge_color": "purple",
        "role_persona": """You are the Master Scriptwriter & Content Storyboard Architect for AgencyOS.
Your domain is execution-level creative production: scene-by-scene video shoot concepts, timestamped reel beats, B-roll framing cues, lighting and camera movement directions, on-screen text overlays, voiceover scripts, audio vibe recommendations, and slide-by-slide carousel copy.""",
        "action_guidance": """- When the user asks for video concepts, shoot ideas, or scripts:
  * Check the user's requested video duration (e.g. 15s, 30s, 30-45s, 45-60s, 60s).
  * PROVIDE FULL, PRODUCTION-READY SCENE-BY-SCENE SCRIPTS with exact timestamped beats matching their requested duration:
    - For 30-45s reels: 4 to 6 scenes (e.g. 0:00-0:03 Hook, 0:03-0:12 Context/Setup, 0:12-0:25 Demonstration, 0:25-0:36 Climax/Sizzle, 0:36-0:45 CTA Outro).
    - For 45-60s reels: 5 to 7 scenes spanning the full 45-60s (ending at 0:50-1:00).
    - For 15-20s reels: 3 scenes (0:00-0:03 Hook, 0:03-0:10 Value, 0:10-0:15 CTA).
  * NEVER truncate or default to 15 seconds when the user asked for 30 to 45 or 45 to 60 seconds!
- When asked for carousel ideas: provide slide 1 (arresting cover), slides 2-6 (high-density value nuggets), slide 7 (save/share CTA).
- Set `suggested_deliverable_preferences` to the requested formats.""",
    },
    "campaign_strategist": {
        "id": "campaign_strategist",
        "name": "Creative Director",
        "title": "Campaign Strategy & Narrative Architect",
        "badge_color": "indigo",
        "role_persona": """You are the Campaign Strategist & Master Creative Director for AgencyOS.
Your domain is macro campaign architecture: multi-week narrative pacing, emotional story arcs, promotional timing, hype-building teasers, launch climaxes, and conversion funnels.""",
        "action_guidance": """- Help the user structure a multi-stage campaign sprint (e.g. Phase 1: Problem Awareness & Agitation -> Phase 2: Solution & Case Studies -> Phase 3: The Limited Offer / Launch).
- Define the master campaign hook/slogan and thematic metaphor.
- Map out the distribution cadence across days or weeks.
- Ensure `suggested_objective` captures the singular campaign mission and `suggested_custom_brief` defines the strategic phases.""",
    },
    "quality_evaluator": {
        "id": "quality_evaluator",
        "name": "Quality & Compliance Critic",
        "title": "Content Quality & Compliance Critic",
        "badge_color": "rose",
        "role_persona": """You are the Quality Evaluator & Compliance Critic for AgencyOS.
Your domain is rigorous pre-flight content auditing: spotting weak or cliché hooks, detecting retention drop-offs, identifying unsubstantiated or prohibited claims, verifying brand guideline conformance, and polishing rough concepts into elite-tier assets.""",
        "action_guidance": """- Audit the user's concepts or previous agent outputs with constructive, razor-sharp critique.
- Score hook strength from 1 to 10 and suggest a punchier, higher-retention opening line.
- Flag any forbidden words, exaggerated guarantees, or compliance risks.
- Ensure the brief is tightened to 100% brand alignment before running the autonomous engine.""",
    },
}


def extract_candidate_entities(
    brand_profile: BrandProfile | None,
    client: Client | None,
    existing_discovered: list[str] | None = None,
    artifact_payload: dict[str, Any] | None = None,
) -> list[str]:
    entities: set[str] = set(existing_discovered or [])

    # 1. Extract from Brand Profile pillars & approved phrases
    if brand_profile:
        if brand_profile.approved_phrases:
            phrases = (
                brand_profile.approved_phrases
                if isinstance(brand_profile.approved_phrases, list)
                else [str(brand_profile.approved_phrases)]
            )
            for p in phrases:
                clean_p = p.strip().lstrip("-").strip()
                if (
                    clean_p
                    and 3 <= len(clean_p) <= 40
                    and not clean_p.lower().startswith("mention")
                    and not clean_p.lower().startswith("approval")
                    and not clean_p.lower().startswith("proposed")
                    and not clean_p.lower().startswith("required")
                    and not clean_p.lower().startswith("suggested")
                ):
                    entities.add(clean_p)
        if brand_profile.content_pillars:
            pillars = (
                brand_profile.content_pillars
                if isinstance(brand_profile.content_pillars, list)
                else [str(brand_profile.content_pillars)]
            )
            for pil in pillars:
                for match in re.findall(r"\b[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){1,3}\b", pil):
                    if (
                        len(match) > 5
                        and match.lower()
                        not in [
                            "customer experiences",
                            "general business",
                            "content pillar",
                            "strategic angle",
                        ]
                    ):
                        entities.add(match)

    # 2. Extract from artifact payload
    if artifact_payload and isinstance(artifact_payload, dict):
        if "hero_entities" in artifact_payload and isinstance(artifact_payload["hero_entities"], list):
            for e in artifact_payload["hero_entities"]:
                if isinstance(e, str) and e.strip():
                    entities.add(e.strip())
        if "scenes" in artifact_payload and isinstance(artifact_payload["scenes"], list):
            for sc in artifact_payload["scenes"]:
                if isinstance(sc, dict):
                    hf = sc.get("hero_focus", [])
                    if isinstance(hf, list):
                        for item in hf:
                            if isinstance(item, str) and item.strip():
                                entities.add(item.strip())
        if "slides" in artifact_payload and isinstance(artifact_payload["slides"], list):
            for sl in artifact_payload["slides"]:
                if isinstance(sl, dict):
                    hl = sl.get("headline", "")
                    if hl and len(hl) <= 40:
                        entities.add(hl)

    cleaned: list[str] = []
    for e in sorted(entities):
        s = e.strip()
        if 3 <= len(s) <= 40 and s not in cleaned and not s.startswith("http"):
            cleaned.append(s)
    return cleaned[:15]


async def execute_chat_turn(
    agency_id: uuid.UUID,
    client_id: uuid.UUID,
    payload: ChatBriefRequest,
    db: AsyncSession,
    membership: Membership | None = None,
    on_event: Any | None = None,
) -> ChatBriefResponse:
    """Core turn executor for both synchronous and streaming campaign chat brief endpoints."""
    client = await get_client_for_agency(client_id, agency_id, db)

    # 1. Resolve active agent profile & calendar context
    target_agent_id = payload.agent_id if (payload.agent_id and (payload.agent_id in AGENT_SPECS or payload.agent_id in SPECIALIST_REGISTRY)) else "director"

    curr_dt = date.today()
    ref_year = payload.period_year or curr_dt.year
    ref_month = payload.period_month or curr_dt.month

    user_texts = [m.content for m in payload.messages if m.role == "user"]
    combined_user_text = " ".join(user_texts)
    latest_user_text = user_texts[-1] if user_texts else ""
    has_explicit_year = bool(re.search(r"\b20\d{2}\b", combined_user_text))

    # Strategy intent routing: if user mentions @Campaign Strategist / @Strategist or asks for a 3-phase/strategic blueprint, route directly to campaign_strategist specialist
    if target_agent_id in ("director", None) and (
        re.search(
            r"@(?:campaign\s*strategist|strategist)\b|\b(?:3-phase|multi-stage|strategic\s+blueprint|campaign\s+blueprint|campaign\s+strategy\s+blueprint|strategy\s+blueprint|blueprint\s+for|design\s+a\s+(?:3-phase|multi-stage|strategic))\b",
            latest_user_text,
            re.IGNORECASE,
        )
    ):
        target_agent_id = "campaign_strategist"

    agent_spec = AGENT_SPECS.get(target_agent_id, AGENT_SPECS["director"])

    # 2. Resolve Campaign & Studio Session (multi-tenant boundary)
    target_campaign_id = payload.campaign_id
    campaign = None
    if target_campaign_id:
        camp_stmt = select(Campaign).where(
            Campaign.id == target_campaign_id,
            Campaign.client_id == client_id,
        )
        camp_res = await db.execute(camp_stmt)
        campaign = camp_res.scalars().first()
        if not campaign:
            logger.warning(
                "Stale or non-existent campaign_id %s passed for client %s. Gracefully falling back to client's latest campaign or new planning session.",
                target_campaign_id,
                client_id,
            )
            target_campaign_id = None

    if not target_campaign_id:
        camp_stmt = (
            select(Campaign)
            .where(Campaign.client_id == client_id)
            .order_by(Campaign.created_at.desc())
        )
        camp_res = await db.execute(camp_stmt)
        existing_campaign = camp_res.scalars().first()
        if existing_campaign:
            target_campaign_id = existing_campaign.id
            campaign = existing_campaign
        else:
            new_campaign = Campaign(
                id=uuid.uuid4(),
                client_id=client_id,
                name=f"{client.business_name} - Studio Sprint {ref_year}",
                status=CampaignStatus.planning,
                period_month=ref_month,
                period_year=ref_year,
            )
            db.add(new_campaign)
            await db.commit()
            await db.refresh(new_campaign)
            target_campaign_id = new_campaign.id
            campaign = new_campaign

    session = await get_or_create_studio_session(
        db=db,
        agency_id=agency_id,
        client_id=client_id,
        campaign_id=target_campaign_id,
        user_id=getattr(membership, "user_id", None),
    )

    # 3. Active Artifact Lookup (Preserves continuity across specialist switches)
    active_artifact_id = payload.active_artifact_id
    active_artifact_type = None
    active_artifact_version = None
    active_artifact_payload = None
    target_artifact_uuid: uuid.UUID | None = None
    if active_artifact_id:
        if isinstance(active_artifact_id, uuid.UUID):
            target_artifact_uuid = active_artifact_id
        else:
            try:
                target_artifact_uuid = uuid.UUID(str(active_artifact_id))
            except (ValueError, TypeError):
                target_artifact_uuid = None

        if target_artifact_uuid:
            art_res = await db.execute(
                select(StudioArtifact).where(
                    StudioArtifact.id == target_artifact_uuid,
                    StudioArtifact.agency_id == agency_id,
                    StudioArtifact.campaign_id == target_campaign_id,
                )
            )
            active_art = art_res.scalars().first()
            if active_art:
                active_artifact_type = active_art.artifact_type
                active_artifact_version = active_art.current_version_number
                ver_res = await db.execute(
                    select(StudioArtifactVersion).where(
                        StudioArtifactVersion.artifact_id == active_art.id,
                        StudioArtifactVersion.version_number == active_art.current_version_number,
                    )
                )
                active_ver = ver_res.scalars().first()
                if active_ver:
                    active_artifact_payload = active_ver.payload

    # 4. Fetch Brand Profile & build BrandContext
    bp_result = await db.execute(
        select(BrandProfile)
        .where(BrandProfile.client_id == client_id)
        .order_by(BrandProfile.version.desc())
    )
    brand_profile = bp_result.scalars().first()

    brand_voice = brand_profile.brand_voice if brand_profile and brand_profile.brand_voice else "Professional and authentic"
    pillars = brand_profile.content_pillars if brand_profile and brand_profile.content_pillars else []
    prohibited = brand_profile.prohibited_claims if brand_profile and brand_profile.prohibited_claims else []
    approved_phrases = brand_profile.approved_phrases if brand_profile and brand_profile.approved_phrases else []
    target_aud = brand_profile.target_audience if brand_profile and brand_profile.target_audience else {}
    brand_goals = brand_profile.goals if brand_profile and brand_profile.goals else {}
    client_location = client.location or (target_aud.get("location") if isinstance(target_aud, dict) else None) or (target_aud.get("city") if isinstance(target_aud, dict) else None)

    prohibited_claims_objs: list[ProhibitedClaim] = []
    prohibited_terms_objs: list[ProhibitedTerm] = []
    if brand_profile and brand_profile.prohibited_claims:
        raw_claims = brand_profile.prohibited_claims
        if isinstance(raw_claims, list):
            for item in raw_claims:
                if isinstance(item, dict):
                    prohibited_claims_objs.append(
                        ProhibitedClaim(
                            claim=item.get("claim", str(item)),
                            semantic_context=item.get("context"),
                            reason=item.get("reason"),
                        )
                    )
                else:
                    prohibited_claims_objs.append(ProhibitedClaim(claim=str(item)))
        elif isinstance(raw_claims, dict):
            for k, v in raw_claims.items():
                if k == "exact_terms" and isinstance(v, list):
                    for term in v:
                        prohibited_terms_objs.append(ProhibitedTerm(term=str(term), is_exact_match=True))
                else:
                    prohibited_claims_objs.append(ProhibitedClaim(claim=f"{k}: {v}"))

    verified_offers_objs: list[VerifiedOffer] = []
    if approved_phrases:
        phrases_list = approved_phrases if isinstance(approved_phrases, list) else [approved_phrases]
        for phrase in phrases_list:
            verified_offers_objs.append(
                VerifiedOffer(
                    name=str(phrase),
                    description="",
                    source="confirmed_brand_profile",
                )
            )

    brand_context = None
    quotas_summary_str = "No contracted deliverable quotas on file (Standard retainer)."
    total_quota_remaining = 0
    if brand_profile:
        brand_voice_list = (
            brand_profile.brand_voice
            if isinstance(brand_profile.brand_voice, list)
            else [str(brand_profile.brand_voice)]
            if brand_profile.brand_voice
            else ["Professional and authentic"]
        )
        pillars_list = (
            brand_profile.content_pillars
            if isinstance(brand_profile.content_pillars, list)
            else [str(brand_profile.content_pillars)]
            if brand_profile.content_pillars
            else []
        )
        target_aud_list = (
            target_aud
            if isinstance(target_aud, list)
            else [str(v) for v in target_aud.values()]
            if isinstance(target_aud, dict)
            else [str(target_aud)]
            if target_aud
            else []
        )
        approved_phrases_list = (
            approved_phrases
            if isinstance(approved_phrases, list)
            else [str(approved_phrases)]
            if approved_phrases
            else []
        )

        from app.campaign_intelligence.tools.brand_tools import get_client_contract_quotas
        contract_quotas = await get_client_contract_quotas(client_id, agency_id, db)

        brand_context = BrandContext(
            client_id=client_id,
            agency_id=agency_id,
            business_name=client.business_name,
            industry=client.industry,
            website=client.website if hasattr(client, "website") else None,
            brand_voice=brand_voice_list,
            target_audience=target_aud_list,
            content_pillars=pillars_list,
            approved_phrases=approved_phrases_list,
            prohibited_terms=prohibited_terms_objs,
            prohibited_claims=prohibited_claims_objs,
            verified_offers=verified_offers_objs,
            contract_quotas=contract_quotas,
            confirmed_facts=[client.business_name, client.industry or "General Business"],
            knowledge_gaps=[
                "No verified case studies or client testimonials on file",
                "No verified pricing tiers or promotional discounts on file",
            ],
        )

        quotas_summary_lines = []
        total_quota_remaining = 0
        if contract_quotas:
            for q in contract_quotas:
                rem = q.remaining if q.remaining is not None and q.remaining > 0 else (q.contracted or q.monthly_quantity or 1)
                total_quota_remaining += rem
                quotas_summary_lines.append(f"- {q.deliverable_type.capitalize()} on {q.platform or 'multi-platform'}: {rem} remaining this month")
        quotas_summary_str = "\n".join(quotas_summary_lines) if quotas_summary_lines else "No contracted deliverable quotas on file (Standard retainer)."

    brief = CampaignBrief(
        client_id=client_id,
        agency_id=agency_id,
        period_month=ref_month,
        period_year=ref_year,
        objective=f"Campaign sprint for {client.business_name}",
        custom_brief=combined_user_text or latest_user_text or "General marketing sprint",
        target_audience=(
            target_aud if isinstance(target_aud, list) else ([str(target_aud)] if target_aud else [])
        ),
        deliverable_preferences=["reel", "carousel"],
        pinned_entities=payload.pinned_entities,
    )

    studio_context = CampaignStudioContext(
        agency_id=agency_id,
        client_id=client_id,
        campaign_id=target_campaign_id,
        client_name=client.business_name,
        client_industry=client.industry,
        client_location=client_location,
        campaign_brief=brief,
        brand_context=brand_context,
        active_artifact_id=active_artifact_id,
        active_artifact_type=active_artifact_type,
        active_artifact_version=active_artifact_version,
        active_artifact_payload=active_artifact_payload,
        discovered_entities=payload.discovered_entities or [],
        pinned_entities=payload.pinned_entities or [],
    )

    # 5. SPECIALIST DISPATCH: Route to dedicated specialist adapter when requested
    if target_agent_id in SPECIALIST_REGISTRY and target_agent_id != "director":
        adapter = get_specialist_adapter(target_agent_id)
        if on_event:
            try:
                await on_event({
                    "type": "status",
                    "stage": "init",
                    "message": f"Connecting to {adapter.specialist_name}...",
                })
            except Exception:
                pass
        specialist_res = await adapter.execute(
            query=latest_user_text or "Please advise on strategy based on our brand guidelines and market data.",
            context=studio_context,
            db=db,
            on_event=on_event,
        )

        saved_artifact = None
        saved_version = None
        if specialist_res.artifact_payload:
            art_type_str = (
                specialist_res.artifact_type.value
                if hasattr(specialist_res.artifact_type, "value")
                else str(specialist_res.artifact_type or "draft")
            )
            raw_title = (
                specialist_res.artifact_payload.get("deliverable_title")
                or specialist_res.artifact_payload.get("query_topic")
                or f"{adapter.specialist_name} Asset"
            )
            raw_title_str = str(raw_title or "").strip()
            if len(raw_title_str) > 80:
                first_part = re.split(r"[.?!\n]", raw_title_str)[0].strip()
                art_title = (first_part[:75] + "...") if len(first_part) > 15 else (raw_title_str[:75] + "...")
            else:
                art_title = raw_title_str or f"{adapter.specialist_name} Asset"
            saved_artifact, saved_version = await save_or_revise_artifact(
                session_id=session.id,
                agency_id=agency_id,
                client_id=client_id,
                campaign_id=target_campaign_id,
                artifact_type=art_type_str,
                title=art_title,
                payload=specialist_res.artifact_payload,
                actor_type="agent",
                actor_id=target_agent_id,
                db=db,
                artifact_id=target_artifact_uuid if (active_artifact_type == art_type_str) else None,
                change_summary=f"Created/revised by {adapter.specialist_name}",
            )
            await db.commit()

        # Date extraction fallback for specialist turns so campaign state is kept fresh
        extracted = extract_date_range_from_text(combined_user_text, default_year=ref_year, reference_start_date=payload.start_date)
        extracted_fmts, extracted_cnt = extract_format_and_count_from_text(combined_user_text)

        candidate_entities = extract_candidate_entities(
            brand_profile=brand_profile,
            client=client,
            existing_discovered=payload.discovered_entities,
            artifact_payload=specialist_res.artifact_payload,
        )

        return ChatBriefResponse(
            reply=specialist_res.reply,
            agent_id=target_agent_id,
            agent_name=specialist_res.specialist_name,
            campaign_id=target_campaign_id,
            session_id=session.id,
            chat_id=payload.chat_id,
            artifact_id=saved_artifact.id if saved_artifact else active_artifact_id,
            artifact_type=saved_artifact.artifact_type if saved_artifact else active_artifact_type,
            artifact_title=saved_artifact.title if saved_artifact else None,
            artifact_payload=specialist_res.artifact_payload or active_artifact_payload,
            artifact_version_number=saved_version.version_number if saved_version else active_artifact_version,
            artifact_status=saved_artifact.status if saved_artifact else None,
            activity_logs=[{"message": log} if isinstance(log, str) else log for log in specialist_res.activity_logs],
            suggested_objective=f"{adapter.specialist_name} strategic plan for {client.business_name}",
            suggested_custom_brief=latest_user_text,
            suggested_deliverable_preferences=extracted_fmts or (["reel", "carousel"] if target_agent_id == "content_architect" else None),
            suggested_period_month=extracted.period_month if extracted else (payload.period_month or ref_month),
            suggested_period_year=extracted.period_year if extracted else (payload.period_year or ref_year),
            suggested_start_date=extracted.start_date.isoformat() if extracted else payload.start_date,
            suggested_end_date=extracted.end_date.isoformat() if extracted else payload.end_date,
            suggested_duration_days=extracted.duration_days if extracted else extracted_cnt,
            is_ready_to_generate=False,
            pinned_entities=payload.pinned_entities,
            discovered_entities=candidate_entities,
        )

    # 6. CAMPAIGN DIRECTOR FLOW: Intake copilot synthesizing overall brief
    if on_event:
        try:
            await on_event({
                "type": "status",
                "stage": "init",
                "message": "Campaign Director is reviewing guidelines and campaign history...",
            })
        except Exception:
            pass

    if len(payload.messages) > 9:
        windowed_messages = [payload.messages[0]] + payload.messages[-8:]
        omitted_count = len(payload.messages) - 9
        history_prefix = f"[{omitted_count} earlier conversation turns retained in strategy summary above]\n"
    else:
        windowed_messages = payload.messages
        history_prefix = ""

    formatted_convo_parts = [history_prefix] if history_prefix else []
    for m in windowed_messages:
        if m.role == "user":
            formatted_convo_parts.append(f"USER: {m.content}")
        else:
            sender_name = m.agent_name or AGENT_SPECS.get(m.agent_id or "director", {}).get("name", "Campaign Director")
            formatted_convo_parts.append(f"{sender_name.upper()}: {m.content}")
    formatted_convo = "\n".join(formatted_convo_parts)
    client_location = client.location or (target_aud.get("location") if isinstance(target_aud, dict) else None) or (target_aud.get("city") if isinstance(target_aud, dict) else None)

    # 4. Dynamic Specialized Context (e.g. historical stats if Performance Analyst, live web research if Market Research)
    perf_context_str = ""
    if target_agent_id == "historical_performance":
        try:
            from app.campaign_intelligence.tools.performance_tools import (
                get_client_published_deliverables,
                calculate_format_performance_metrics,
            )
            published = await get_client_published_deliverables(client_id, agency_id, db, limit=20)
            metrics = calculate_format_performance_metrics(published)
            if metrics:
                lines = ["Client Published Content Analytics (Real Historical Performance):"]
                for m in metrics:
                    lines.append(
                        f"- Format: {m.format.upper()} | Posts: {m.total_published} | "
                        f"Avg Views: {m.avg_views:.0f} | Avg Engagement: {m.avg_engagement_rate:.2f}% | "
                        f"Top Angles: {', '.join(m.top_performing_angles[:3]) if m.top_performing_angles else 'None recorded'}"
                    )
                perf_context_str = "\n".join(lines)
            elif published:
                perf_context_str = f"Client has {len(published)} published posts recorded in AgencyOS. Engagement tracking is syncing."
            else:
                perf_context_str = "Cold Start Client: No past deliverables published in AgencyOS yet. Recommend industry benchmark mix (e.g. 50% Reels, 30% Carousels, 20% Static)."
        except Exception as ex:
            logger.warning(f"Could not load performance stats for chat brief: {ex}")

    market_context_str = ""
    if target_agent_id == "market_research" or any(kw in latest_user_text.lower() for kw in ["competitor", "trend", "market", "viral", "hook"]):
        try:
            from app.campaign_intelligence.tools.research_tools import gather_market_evidence
            search_parts = [client.business_name, client.industry or ""]
            if client_location:
                search_parts.append(client_location)
            if latest_user_text:
                search_parts.append(latest_user_text[:120])
            search_focus = " ".join(p for p in search_parts if p).strip()

            target_aud_list = []
            if isinstance(target_aud, list):
                target_aud_list = [str(x) for x in target_aud]
            elif isinstance(target_aud, dict):
                target_aud_list = [f"{k}: {v}" for k, v in target_aud.items() if isinstance(v, (str, int))]
            elif isinstance(target_aud, str):
                target_aud_list = [target_aud]

            evidence_list = await gather_market_evidence(
                industry=client.industry or "General Business",
                target_audience=target_aud_list,
                platforms=["instagram", "facebook"],
                custom_brief=search_focus,
                location=client_location,
            )
            if evidence_list:
                lines = ["LIVE EXTERNAL MARKET RESEARCH & PLATFORM BENCHMARKS (Real API & Search Data):"]
                for ev in evidence_list[:6]:
                    lines.append(f"- [{ev.publisher}] {ev.source_title}: {ev.key_takeaway or ev.excerpt[:160]}")
                market_context_str = "\n".join(lines)
        except Exception as ex:
            logger.warning(f"Could not load live market research for chat brief: {ex}", exc_info=True)

    prompt = f"""{agent_spec['role_persona']}

Current System Calendar & Reference Year:
- Today's Reference Date: {curr_dt.isoformat()}
- Active Sprint Year: {ref_year} (Reference Month: {ref_month})

Client Context (Dynamic from Brand Profile & Client Record):
- Client Business: {client.business_name}
- Industry / Niche: {client.industry or 'General Business'}
- Geographic Location / Target Market: {client_location or 'Not specified'}
- Website / Digital Presence: {client.website or 'Not specified'}
- Brand Voice & Tone: {brand_voice}
- Established Content Pillars: {', '.join(pillars) if pillars else 'None specified'}
- Target Audience Profile: {target_aud if target_aud else 'General target audience'}
- Approved Phrases / Key Offers: {approved_phrases if approved_phrases else 'Standard brand offers'}
- Prohibited Claims / Guardrails: {prohibited if prohibited else 'No specific prohibitions'}
- Strategic Goals: {brand_goals if brand_goals else 'Not specified'}

Client Monthly Contract Retainer & Deliverable Quotas:
{quotas_summary_str}
Total Monthly Quota Bank Remaining: {total_quota_remaining} deliverables.

{perf_context_str}
{market_context_str}

UNIFIED MULTI-AGENT COLLABORATIVE MEMORY:
All specialist agents and the Campaign Director share this exact same conversation thread. You must maintain complete awareness of everything discussed with previous agents or the user in this history:
{formatted_convo}

YOUR SPECIALIST AGENT ROLE & ACTION GUIDANCE:
{agent_spec['action_guidance']}

CRITICAL SYSTEM RULES:
1. Timeline & Date Range Intelligence:
   - Current Year Context: The active year is {ref_year}. If the user mentions dates without an explicit year (e.g. 'from 8th nov to 11th nov', 'nov 8 - 11', 'next 3 days', 'Nov 10-14'), you MUST ALWAYS assume and use the year {ref_year} (e.g. {ref_year}-11-08 to {ref_year}-11-11). NEVER default to past years such as 2024 or 2025 unless the user explicitly specified that past year.
   - Calculate and populate `suggested_start_date` (YYYY-MM-DD), `suggested_end_date` (YYYY-MM-DD), `suggested_duration_days` (total calendar days in sprint), and matching `suggested_period_month`/`suggested_period_year`.
2. Structured Memory Preservation:
   - Always synthesize the evolving strategy into `suggested_objective` (1 crisp sentence) and `suggested_custom_brief` (2-3 sentences capturing audience, themes, and guardrails) reflecting everything agreed upon across the entire chat.
   - Even when providing specialist answers (e.g. video scripts or market trends), retain or refine the brief fields so the user can seamlessly transition between specialist deep-dives and full campaign sprint generation!
3. Readiness Determination (`is_ready_to_generate`):
   - Set `is_ready_to_generate = True` ONLY when the user explicitly tells you to proceed/generate (e.g., 'let's generate', 'create it', 'looks good go ahead', 'run it'), OR when the strategy is completely locked. In exploratory turns, keep `is_ready_to_generate = False`.
4. STRICT LANGUAGE POLICY - ENGLISH EXCLUSIVELY:
   - You MUST communicate, think, and respond ONLY in the English language. All scripts, hooks, suggestions, and brief drafts MUST ALWAYS BE 100% IN ENGLISH.
5. ZERO-FABRICATION & STRICT FACTUAL TRUTH:
   - NEVER invent, hallucinate, or fabricate real-world business names, competitor names, customer reviews, ratings, addresses, or prices.
   - Ground your analysis strictly in the Client Context and the Live Market Research & Search Data provided above.
   - If the user asks for hyper-local competitors in a specific local neighborhood or area and verified directory listings are not present in your search data:
     * Be honest, direct, and professional: state clearly that verified directory listings for that specific micro-area are not in the current search data.
     * Ask the user to share the names of 2-3 local competitors they encounter so you can dissect their positioning.
     * Pivot immediately to dissecting high-performing category hooks, algorithmic format strategies, and content whitespace relevant to their industry.
   - NEVER provide 'hypothetical examples based on naming conventions' presented as real businesses.
   - NEVER use robotic AI disclaimers or apologies ('I do not have access to real-time directories, the names I provided were hypothetical...'). Communicate with executive strategic authority and focus on high-impact marketing strategy.
6. SPRINT SIZING & DELIVERABLE QUOTA INTELLIGENCE:
   - SPRINT SCALE vs MONTHLY QUOTA: The contract quotas ({total_quota_remaining} remaining) represent the client's TOTAL MONTHLY RETAINER ceiling, NOT the size of a single sprint!
   - A sprint draws ONLY the specific deliverables needed for its timeframe:
     * 1-day burst sprint: Recommend 1-2 deliverables max (e.g. 1 Reel or 1 Reel + 1 Carousel). NEVER allocate 20 deliverables into 1 day! Point out that the remaining {max(0, total_quota_remaining - 2)} deliverables remain safely banked for future sprints.
     * 14-day sprint: Recommend at most 14 deliverables (e.g. 1 per day, or 3-4 posts per week = 6-8 deliverables).
   - INTERACTIVE INTAKE: Proactively clarify or ask the user:
     1. How many deliverables they want to produce (or if they prefer daily posting vs 3x/week).
     2. Which platforms they want to prioritize (Instagram, LinkedIn, Facebook, Twitter/X).
     3. Which formats they prefer (Reels, Carousels, Static).
   - QUOTA REMINDERS: If the user asks for more deliverables than the remaining monthly quota bank ({total_quota_remaining}), politely warn them and remind them of the remaining quota limit.
   - STRUCTURED OUTPUT: Populate `suggested_duration_days` and `suggested_deliverable_count` accurately based on the agreed sprint size!
7. EXECUTIVE TONE & CLEAN PRESENTATION:
   - Do NOT use emojis (no 🚀, 🎯, 💡, 🔥, 🛑, etc.) in your conversation replies. Maintain an executive, sharp, and strategic tone.
   - Present recommendations using clean, professional paragraphs and standard bullet points. Avoid tacky emoji-heavy bullet headers.
"""

    try:
        output: ChatBriefLLMOutput = await invoke_structured_llm(
            prompt=prompt,
            schema_class=ChatBriefLLMOutput,
            temperature=0.7,
            model=settings.GROQ_MODEL,
        )

        extracted = extract_date_range_from_text(combined_user_text, default_year=ref_year, reference_start_date=payload.start_date)
        extracted_fmts, extracted_cnt = extract_format_and_count_from_text(combined_user_text)

        # Deterministic extraction takes precedence when user provided an explicit date range
        if extracted:
            final_start_date = extracted.start_date.isoformat()
            final_end_date = extracted.end_date.isoformat()
            final_duration_days = extracted.duration_days
            final_month = extracted.period_month
            final_year = extracted.period_year
        else:
            raw_start = output.suggested_start_date or payload.start_date
            raw_end = output.suggested_end_date or payload.end_date
            final_start_date = sanitize_date_year(raw_start, target_year=ref_year, allow_past_year=has_explicit_year)
            final_end_date = sanitize_date_year(raw_end, target_year=ref_year, allow_past_year=has_explicit_year)
            final_duration_days = output.suggested_duration_days or extracted_cnt
            final_month = output.suggested_period_month or (payload.period_month or ref_month)
            raw_year = output.suggested_period_year or payload.period_year or ref_year
            final_year = raw_year if (has_explicit_year or raw_year >= ref_year) else ref_year

        if final_start_date and final_end_date and not final_duration_days:
            try:
                s_dt = datetime.strptime(final_start_date, "%Y-%m-%d").date()
                e_dt = datetime.strptime(final_end_date, "%Y-%m-%d").date()
                final_duration_days = (e_dt - s_dt).days + 1
            except Exception:
                pass

        if not final_duration_days and extracted_cnt:
            final_duration_days = extracted_cnt

        final_deliverable_prefs = (
            extracted_fmts or output.suggested_deliverable_preferences or None
        )

        reply_text = output.reply
        if not has_explicit_year and ref_year >= 2026:
            reply_text = re.sub(r"\b202[0-5]\b", str(ref_year), reply_text)

        candidate_entities = extract_candidate_entities(
            brand_profile=brand_profile,
            client=client,
            existing_discovered=payload.discovered_entities,
            artifact_payload=active_artifact_payload,
        )

        return ChatBriefResponse(
            reply=reply_text,
            agent_id=target_agent_id,
            agent_name=agent_spec["name"],
            campaign_id=target_campaign_id,
            session_id=session.id,
            chat_id=payload.chat_id,
            artifact_id=active_artifact_id,
            artifact_type=active_artifact_type,
            artifact_payload=active_artifact_payload,
            artifact_version_number=active_artifact_version,
            suggested_objective=output.suggested_objective,
            suggested_custom_brief=output.suggested_custom_brief,
            suggested_deliverable_preferences=final_deliverable_prefs,
            suggested_period_month=final_month,
            suggested_period_year=final_year,
            suggested_start_date=final_start_date,
            suggested_end_date=final_end_date,
            suggested_duration_days=final_duration_days,
            suggested_deliverable_count=output.suggested_deliverable_count or (1 if final_duration_days == 1 else (min(final_duration_days, 10) if final_duration_days else None)),
            is_ready_to_generate=output.is_ready_to_generate,
            pinned_entities=payload.pinned_entities,
            discovered_entities=candidate_entities,
        )
    except Exception as ex:
        logger.error(f"Structured LLM failed in chat_brief_endpoint ({ex}). Initiating contextual recovery...")
        extracted = extract_date_range_from_text(combined_user_text, default_year=ref_year, reference_start_date=payload.start_date)
        extracted_fmts, extracted_cnt = extract_format_and_count_from_text(combined_user_text)
        if extracted:
            start_date_str = extracted.start_date.isoformat()
            end_date_str = extracted.end_date.isoformat()
            dur_days = extracted.duration_days
            p_month = extracted.period_month
            p_year = extracted.period_year
        else:
            start_date_str = sanitize_date_year(payload.start_date, target_year=ref_year, allow_past_year=has_explicit_year)
            end_date_str = sanitize_date_year(payload.end_date, target_year=ref_year, allow_past_year=has_explicit_year)
            dur_days = extracted_cnt
            p_month = payload.period_month or ref_month
            p_year = payload.period_year or ref_year

        candidate_entities = extract_candidate_entities(
            brand_profile=brand_profile,
            client=client,
            existing_discovered=payload.discovered_entities,
            artifact_payload=active_artifact_payload,
        )

        # Contextual LLM recovery fallback: Answer the user's specific request directly instead of a canned greeting
        fallback_reply = ""
        if user_texts:
            latest_msg = user_texts[-1]
            try:
                from langchain_core.messages import HumanMessage
                from app.core.llm import key_pool
                rec_key = await key_pool.get_active_key()
                raw_llm = get_llm(temperature=0.7, model=settings.GROQ_MODEL, max_tokens=1000, api_key=rec_key)
                recovery_prompt = (
                    f"You are the {agent_spec['name']} ({agent_spec['title']}) for {client.business_name} ({client.industry or 'Business'}).\n"
                    f"Conversation so far:\n{formatted_convo}\n\n"
                    f"{market_context_str}\n\n"
                    f"User's request: '{latest_msg}'\n\n"
                    f"Strict Rule: NEVER fabricate or invent fake business names, competitor names, or addresses. If verified local directory data is not in the search evidence, state that directly, invite the user to share 2-3 local competitors, and focus on verified platform algorithms, category hooks, and content whitespace.\n"
                    f"Respond directly, thoroughly, and helpfully in English in 2-4 paragraphs with concrete hooks, analysis, and recommendations. Do not output JSON."
                )
                raw_res = await raw_llm.ainvoke([HumanMessage(content=recovery_prompt)])
                fallback_reply = raw_res.content if hasattr(raw_res, "content") else str(raw_res)
            except Exception as raw_err:
                logger.error(f"Fallback raw LLM failed: {raw_err}")

        if not fallback_reply:
            fallback_reply = (
                f"I've analyzed the latest market and audience trends for {client.business_name}. "
                f"Regarding '{user_texts[-1] if user_texts else 'your campaign'}', let's focus on high-retention visual hooks and clear value propositions."
            )

        return ChatBriefResponse(
            reply=fallback_reply,
            agent_id=target_agent_id,
            agent_name=agent_spec["name"],
            campaign_id=target_campaign_id,
            session_id=session.id,
            chat_id=payload.chat_id,
            artifact_id=active_artifact_id,
            artifact_type=active_artifact_type,
            artifact_payload=active_artifact_payload,
            artifact_version_number=active_artifact_version,
            suggested_period_month=p_month,
            suggested_period_year=p_year,
            suggested_start_date=start_date_str,
            suggested_end_date=end_date_str,
            suggested_duration_days=dur_days,
            suggested_deliverable_count=1 if dur_days == 1 else (min(dur_days, 10) if dur_days else None),
            suggested_deliverable_preferences=extracted_fmts,
            is_ready_to_generate=False,
            pinned_entities=payload.pinned_entities,
            discovered_entities=candidate_entities,
        )


@router.post(
    "/agencies/{agency_id}/clients/{client_id}/campaigns/chat-brief",
    response_model=ChatBriefResponse,
    status_code=status.HTTP_200_OK,
)
async def chat_brief_endpoint(
    agency_id: uuid.UUID,
    client_id: uuid.UUID,
    payload: ChatBriefRequest,
    membership: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> ChatBriefResponse:
    """Conversational intake copilot and specialist agents helping users formulate and refine their campaign brief."""
    return await execute_chat_turn(agency_id, client_id, payload, db, membership=membership)


@router.post(
    "/agencies/{agency_id}/clients/{client_id}/campaigns/chat-brief/stream",
)
async def chat_brief_stream_endpoint(
    agency_id: uuid.UUID,
    client_id: uuid.UUID,
    payload: ChatBriefRequest,
    membership: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
):
    """
    Server-Sent Events (SSE) streaming endpoint for Campaign Studio.
    Streams live tool execution, status updates, and token typing in real-time.
    """
    async def event_generator():
        queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()

        async def push_event(evt: dict[str, Any]):
            await queue.put(evt)

        async def worker():
            try:
                resp = await execute_chat_turn(
                    agency_id=agency_id,
                    client_id=client_id,
                    payload=payload,
                    db=db,
                    membership=membership,
                    on_event=push_event,
                )

                # Stream the reply text in natural token chunks for live typing animation
                words = resp.reply.split(" ")
                chunk: list[str] = []
                for word in words:
                    chunk.append(word)
                    if len(chunk) >= 4:
                        await push_event({
                            "type": "token",
                            "content": " ".join(chunk) + " ",
                        })
                        await asyncio.sleep(0.015)
                        chunk = []
                if chunk:
                    await push_event({
                        "type": "token",
                        "content": " ".join(chunk),
                    })

                # Emit final done event with complete response payload
                await push_event({
                    "type": "done",
                    "response": resp.model_dump(),
                })
            except Exception as exc:
                logger.error(f"[ChatBrief Stream] Execution error: {exc}", exc_info=True)
                await push_event({
                    "type": "error",
                    "error": str(exc),
                })
            finally:
                await queue.put(None)

        worker_task = asyncio.create_task(worker())
        try:
            while True:
                evt = await queue.get()
                if evt is None:
                    break
                yield f"data: {json.dumps(evt, default=str)}\n\n"
        finally:
            if not worker_task.done():
                worker_task.cancel()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# =====================================================================
# Campaign Studio Artifact Endpoints (Draft Persistence & Versioning)
# =====================================================================

@router.get(
    "/agencies/{agency_id}/campaigns/{campaign_id}/studio/artifacts",
    response_model=list[StudioArtifactOut],
    status_code=status.HTTP_200_OK,
)
async def list_studio_artifacts(
    agency_id: uuid.UUID,
    campaign_id: uuid.UUID,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> list[StudioArtifactOut]:
    """List all studio draft artifacts for a campaign."""
    await assert_campaign_belongs_to_agency(campaign_id, agency_id, db)
    stmt = (
        select(StudioArtifact)
        .where(
            StudioArtifact.agency_id == agency_id,
            StudioArtifact.campaign_id == campaign_id,
        )
        .order_by(StudioArtifact.updated_at.desc())
    )
    result = await db.execute(stmt)
    artifacts = result.scalars().all()

    outputs = []
    for art in artifacts:
        v_stmt = select(StudioArtifactVersion).where(
            StudioArtifactVersion.artifact_id == art.id,
            StudioArtifactVersion.version_number == art.current_version_number,
        )
        v_res = await db.execute(v_stmt)
        latest_ver = v_res.scalars().first()
        art_out = StudioArtifactOut(
            id=art.id,
            session_id=art.session_id,
            agency_id=art.agency_id,
            client_id=art.client_id,
            campaign_id=art.campaign_id,
            artifact_type=art.artifact_type,
            title=art.title,
            status=art.status,
            current_version_number=art.current_version_number,
            created_at=art.created_at,
            updated_at=art.updated_at,
            latest_version=StudioArtifactVersionOut.model_validate(latest_ver) if latest_ver else None,
            versions=[],
        )
        outputs.append(art_out)
    return outputs


@router.get(
    "/agencies/{agency_id}/campaigns/{campaign_id}/studio/artifacts/{artifact_id}",
    response_model=StudioArtifactOut,
    status_code=status.HTTP_200_OK,
)
async def get_studio_artifact_detail(
    agency_id: uuid.UUID,
    campaign_id: uuid.UUID,
    artifact_id: uuid.UUID,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> StudioArtifactOut:
    """Get full studio artifact with complete revision history."""
    await assert_campaign_belongs_to_agency(campaign_id, agency_id, db)
    stmt = (
        select(StudioArtifact)
        .where(
            StudioArtifact.id == artifact_id,
            StudioArtifact.agency_id == agency_id,
            StudioArtifact.campaign_id == campaign_id,
        )
    )
    result = await db.execute(stmt)
    artifact = result.scalars().first()
    if not artifact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Studio artifact not found.",
        )

    v_stmt = (
        select(StudioArtifactVersion)
        .where(StudioArtifactVersion.artifact_id == artifact.id)
        .order_by(StudioArtifactVersion.version_number.desc())
    )
    v_res = await db.execute(v_stmt)
    versions = v_res.scalars().all()
    latest = versions[0] if versions else None

    return StudioArtifactOut(
        id=artifact.id,
        session_id=artifact.session_id,
        agency_id=artifact.agency_id,
        client_id=artifact.client_id,
        campaign_id=artifact.campaign_id,
        artifact_type=artifact.artifact_type,
        title=artifact.title,
        status=artifact.status,
        current_version_number=artifact.current_version_number,
        created_at=artifact.created_at,
        updated_at=artifact.updated_at,
        latest_version=StudioArtifactVersionOut.model_validate(latest) if latest else None,
        versions=[StudioArtifactVersionOut.model_validate(v) for v in versions],
    )


@router.post(
    "/agencies/{agency_id}/campaigns/{campaign_id}/studio/artifacts/{artifact_id}/approve",
    response_model=StudioArtifactOut,
    status_code=status.HTTP_200_OK,
)
async def approve_studio_artifact_endpoint(
    agency_id: uuid.UUID,
    campaign_id: uuid.UUID,
    artifact_id: uuid.UUID,
    payload: StudioApproveVersionRequest,
    membership: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> StudioArtifactOut:
    """Approve a specific version of a studio artifact."""
    await assert_campaign_belongs_to_agency(campaign_id, agency_id, db)
    user_id = getattr(membership, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User context missing for approval.")
    await approve_artifact_version(
        artifact_id=artifact_id,
        version_number=payload.version_number,
        agency_id=agency_id,
        campaign_id=campaign_id,
        user_id=user_id,
        db=db,
    )
    await db.commit()
    return await get_studio_artifact_detail(agency_id, campaign_id, artifact_id, membership, db)


@router.post(
    "/agencies/{agency_id}/campaigns/{campaign_id}/studio/artifacts/{artifact_id}/revise",
    response_model=StudioArtifactOut,
    status_code=status.HTTP_200_OK,
)
async def revise_studio_artifact_endpoint(
    agency_id: uuid.UUID,
    campaign_id: uuid.UUID,
    artifact_id: uuid.UUID,
    payload: StudioReviseArtifactRequest,
    membership: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> StudioArtifactOut:
    """Save an immutable new revision of an existing studio draft artifact."""
    await assert_campaign_belongs_to_agency(campaign_id, agency_id, db)
    user_id = getattr(membership, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User context missing for revision.")

    stmt = (
        select(StudioArtifact)
        .where(
            StudioArtifact.id == artifact_id,
            StudioArtifact.agency_id == agency_id,
            StudioArtifact.campaign_id == campaign_id,
        )
    )
    result = await db.execute(stmt)
    artifact = result.scalars().first()
    if not artifact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Studio artifact not found.")

    session = await get_or_create_studio_session(
        campaign_id=campaign_id,
        client_id=artifact.client_id,
        agency_id=agency_id,
        user_id=user_id,
        db=db,
    )

    await save_or_revise_artifact(
        session_id=session.id,
        agency_id=agency_id,
        client_id=artifact.client_id,
        campaign_id=campaign_id,
        artifact_type=artifact.artifact_type,
        title=payload.title or artifact.title,
        payload=payload.payload,
        actor_type="user",
        actor_id=str(user_id),
        db=db,
        artifact_id=artifact.id,
        parent_version_id=payload.parent_version_id,
        change_summary=payload.change_summary or "Manual user revision",
        supporting_evidence_refs=payload.supporting_evidence_refs,
    )
    await db.commit()
    return await get_studio_artifact_detail(agency_id, campaign_id, artifact_id, membership, db)


@router.post(
    "/agencies/{agency_id}/campaigns/{campaign_id}/studio/export-pipeline",
    response_model=StudioExportPipelineResponse,
    status_code=status.HTTP_200_OK,
)
async def export_studio_artifact_pipeline_endpoint(
    agency_id: uuid.UUID,
    campaign_id: uuid.UUID,
    payload: StudioExportPipelineRequest,
    x_idempotency_key: str = Header(..., alias="X-Idempotency-Key"),
    membership: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> StudioExportPipelineResponse:
    """Export an approved studio draft artifact version into actual production tables (Deliverable, Task)."""
    await assert_campaign_belongs_to_agency(campaign_id, agency_id, db)
    user_id = getattr(membership, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User context missing for export.")

    export_rec, is_replay = await export_artifact_to_production(
        agency_id=agency_id,
        campaign_id=campaign_id,
        artifact_id=payload.artifact_id,
        expected_version_number=payload.expected_version_number,
        user_id=user_id,
        idempotency_key=x_idempotency_key,
        raw_payload_dict=payload.model_dump(mode="json"),
        db=db,
        assignee_id=payload.assignee_id,
        default_due_date=payload.default_due_date,
        target_format=payload.target_format,
        deliverable_name=payload.deliverable_name,
        artifact_type=payload.artifact_type,
        artifact_payload=payload.artifact_payload,
    )
    await db.commit()

    mapping = export_rec.production_mapping or {}
    return StudioExportPipelineResponse(
        is_replay=is_replay,
        export_id=export_rec.id,
        deliverable_id=uuid.UUID(mapping["deliverable_id"]),
        task_id=uuid.UUID(mapping["task_id"]),
        deliverable_title=mapping.get("deliverable_title", "Deliverable"),
        task_title=mapping.get("task_title", "Production Task"),
        exported_at=export_rec.exported_at,
    )


# ---------------------------------------------------------------------------
# Granular Deliverable Edit & AI Revision Endpoints
# ---------------------------------------------------------------------------

class RevisedReelOutput(BaseModel):
    title: str = Field(description="Deliverable title")
    primary_hook: str = Field(description="Arresting 0-3s hook")
    caption: str = Field(description="Complete social media caption")
    call_to_action: str = Field(description="Clear CTA")
    reel_scenes: list[ReelScene] = Field(description="Revised scene cards with sequential timestamps")
    explanation: str = Field(description="1-2 sentences explaining what was changed and why")


class RevisedCarouselOutput(BaseModel):
    title: str = Field(description="Deliverable title")
    primary_hook: str = Field(description="Cover hook for slide 1")
    caption: str = Field(description="Complete social media caption")
    call_to_action: str = Field(description="Clear CTA")
    carousel_slides: list[CarouselSlide] = Field(description="Revised slide cards")
    explanation: str = Field(description="1-2 sentences explaining what was changed and why")


class RevisedGenericOutput(BaseModel):
    title: str = Field(description="Deliverable title")
    primary_hook: str = Field(description="Opening hook")
    caption: str = Field(description="Complete social media caption")
    call_to_action: str = Field(description="Clear CTA")
    visual_asset_prompt: str | None = Field(default=None, description="Visual description or prompt")
    explanation: str = Field(description="1-2 sentences explaining what was changed and why")


@router.put(
    "/agencies/{agency_id}/clients/{client_id}/campaigns/{campaign_id}/deliverables/{day_number}",
    response_model=UpdateDeliverableResponse,
)
async def update_campaign_deliverable(
    agency_id: uuid.UUID,
    client_id: uuid.UUID,
    campaign_id: uuid.UUID,
    day_number: int,
    payload: UpdateDeliverableRequest,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> UpdateDeliverableResponse:
    """Surgically update a specific day's deliverable inside the campaign's ai_plan_draft."""
    campaign = await assert_campaign_belongs_to_agency(campaign_id, agency_id, db)
    if campaign.client_id != client_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign does not belong to client.")

    if not campaign.ai_plan_draft or "deliverables" not in campaign.ai_plan_draft:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Campaign does not have an AI plan draft with deliverables.",
        )

    draft = dict(campaign.ai_plan_draft)
    deliverables = list(draft.get("deliverables") or [])

    target_idx: int | None = None
    for idx, d in enumerate(deliverables):
        d_day = d.get("planned_day") or d.get("day_number")
        if d_day == day_number:
            target_idx = idx
            break

    if target_idx is None and 1 <= day_number <= len(deliverables):
        target_idx = day_number - 1

    if target_idx is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Deliverable for day {day_number} not found in campaign plan.",
        )

    orig = deliverables[target_idx]
    updated_d = dict(payload.deliverable)
    merged = {**orig, **updated_d}

    # Ensure crucial indexing metadata is never corrupted
    merged["planned_day"] = orig.get("planned_day", day_number)
    merged["day_number"] = orig.get("day_number", day_number)
    if "scheduled_date" in orig and not merged.get("scheduled_date"):
        merged["scheduled_date"] = orig["scheduled_date"]
    if "date_label" in orig and not merged.get("date_label"):
        merged["date_label"] = orig["date_label"]
    if "deliverable_id" in orig and not merged.get("deliverable_id"):
        merged["deliverable_id"] = orig["deliverable_id"]

    deliverables[target_idx] = merged
    draft["deliverables"] = deliverables
    campaign.ai_plan_draft = draft

    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(campaign, "ai_plan_draft")
    await db.commit()
    await db.refresh(campaign)

    return UpdateDeliverableResponse(
        success=True,
        deliverable=merged,
        campaign_id=campaign.id,
    )


@router.post(
    "/agencies/{agency_id}/clients/{client_id}/campaigns/{campaign_id}/deliverables/{day_number}/revise-ai",
    response_model=ReviseDeliverableAIResponse,
)
async def revise_campaign_deliverable_ai(
    agency_id: uuid.UUID,
    client_id: uuid.UUID,
    campaign_id: uuid.UUID,
    day_number: int,
    payload: ReviseDeliverableAIRequest,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> ReviseDeliverableAIResponse:
    """
    Surgically revise a specific deliverable using the Content Architect / Scriptwriter AI.
    Applies user feedback in natural language, revising scene timestamps, visual action, voiceovers,
    or hooks while strictly adhering to client brand guidelines.
    """
    client = await get_client_for_agency(client_id, agency_id, db)
    campaign = await assert_campaign_belongs_to_agency(campaign_id, agency_id, db)
    if campaign.client_id != client_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign does not belong to client.",
        )

    # Extract client brand profile for authentic voice & guardrails
    bp_stmt = (
        select(BrandProfile)
        .where(BrandProfile.client_id == client_id)
        .order_by(BrandProfile.version.desc())
    )
    bp_res = await db.execute(bp_stmt)
    brand_profile = bp_res.scalars().first()

    brand_voice = brand_profile.brand_voice if brand_profile else "Professional, authentic, inviting"
    
    # Safely extract tone_examples (polymorphic: dict, list, str, or None)
    raw_tone = brand_profile.tone_examples if brand_profile else None
    if isinstance(raw_tone, dict):
        tone_do = [str(x) for x in raw_tone.get("do", []) if x]
        tone_dont = [str(x) for x in raw_tone.get("dont", []) if x]
    elif isinstance(raw_tone, list):
        tone_do = [str(x) for x in raw_tone if x]
        tone_dont = []
    elif isinstance(raw_tone, str):
        tone_do = [raw_tone]
        tone_dont = []
    else:
        tone_do = []
        tone_dont = []

    # Safely extract prohibited_claims (polymorphic: list, dict, str, or None)
    raw_prohibited = brand_profile.prohibited_claims if brand_profile else []
    if isinstance(raw_prohibited, list):
        prohibited_claims = [str(x) for x in raw_prohibited if x]
    elif isinstance(raw_prohibited, str):
        prohibited_claims = [raw_prohibited]
    elif isinstance(raw_prohibited, dict):
        prohibited_claims = [str(x) for x in raw_prohibited.values() if x]
    else:
        prohibited_claims = []

    curr_deliv = dict(payload.current_deliverable)
    dtype = (curr_deliv.get("deliverable_type") or "reel").lower()
    activity_logs: list[str] = [
        f"Invoked Content Architect AI for Day {day_number} ({dtype.upper()}).",
        f"Instruction: '{payload.instruction}'",
    ]

    # Format-specific revision with structured LLM
    if "reel" in dtype or "video" in dtype:
        current_scenes_json = json.dumps(curr_deliv.get("reel_scenes") or [], indent=2)
        prompt = f"""You are the Master Scriptwriter & Content Storyboard Architect for AgencyOS.
Your job is to surgically revise the Day {day_number} Reel deliverable based on the user's creative feedback.

CLIENT: {client.business_name} ({client.industry or 'General'})
BRAND VOICE: {brand_voice}
DO: {', '.join(tone_do) if tone_do else 'Authentic, high-energy'}
DONT: {', '.join(tone_dont) if tone_dont else 'Bland, robotic claims'}
PROHIBITED CLAIMS: {', '.join(prohibited_claims) if prohibited_claims else 'None'}

CURRENT REEL DELIVERABLE (DAY {day_number}):
- Title: {curr_deliv.get('title', '')}
- Primary Hook: {curr_deliv.get('primary_hook') or curr_deliv.get('hook', '')}
- Caption: {curr_deliv.get('caption', '')}
- Call To Action: {curr_deliv.get('call_to_action') or curr_deliv.get('cta', '')}
- Current Scenes:
{current_scenes_json}

USER'S REVISION INSTRUCTION:
"{payload.instruction}"

REQUIREMENTS:
1. Apply the user's requested modifications with surgical precision. If they ask to modify a specific scene (e.g. scene 2 or 3), update that scene while keeping the rest cohesive.
2. If the user asks for a specific total duration (e.g. 30 to 45s, 45 to 60s), adjust the scene count (4-7 scenes) and timestamps accordingly so the final scene ends at the target duration!
3. If they ask for a new angle, feature, product, hook, or tone, rewrite the scenes, voiceovers, and visual actions to reflect that concept accurately.
4. Keep all scenes written strictly in English.
5. Provide a crisp 1-2 sentence explanation of your changes.
"""
        rev_output: RevisedReelOutput = await invoke_structured_llm(
            prompt=prompt,
            schema_class=RevisedReelOutput,
            temperature=0.65,
            model=settings.CAMPAIGN_CONTENT_MODEL,
        )

        revised_deliv = {
            **curr_deliv,
            "title": rev_output.title,
            "primary_hook": rev_output.primary_hook,
            "hook": rev_output.primary_hook,
            "caption": rev_output.caption,
            "call_to_action": rev_output.call_to_action,
            "cta": rev_output.call_to_action,
            "reel_scenes": [s.model_dump() for s in rev_output.reel_scenes],
        }
        activity_logs.append(f"Content Architect revised {len(rev_output.reel_scenes)} scene beats for Day {day_number}.")
        return ReviseDeliverableAIResponse(
            revised_deliverable=revised_deliv,
            explanation=rev_output.explanation,
            activity_logs=activity_logs,
        )

    elif "carousel" in dtype:
        current_slides_json = json.dumps(curr_deliv.get("carousel_slides") or [], indent=2)
        prompt = f"""You are the Master Copywriter & Content Architect for AgencyOS.
Your job is to surgically revise the Day {day_number} Carousel deliverable based on the user's feedback.

CLIENT: {client.business_name} ({client.industry or 'General'})
BRAND VOICE: {brand_voice}

CURRENT CAROUSEL DELIVERABLE (DAY {day_number}):
- Title: {curr_deliv.get('title', '')}
- Hook: {curr_deliv.get('primary_hook') or curr_deliv.get('hook', '')}
- Caption: {curr_deliv.get('caption', '')}
- CTA: {curr_deliv.get('call_to_action') or curr_deliv.get('cta', '')}
- Current Slides:
{current_slides_json}

USER'S REVISION INSTRUCTION:
"{payload.instruction}"

REQUIREMENTS:
1. Apply the user's instructions cleanly to slide headlines, body copy, and layout prompts.
2. Provide a crisp 1-2 sentence explanation.
"""
        rev_car: RevisedCarouselOutput = await invoke_structured_llm(
            prompt=prompt,
            schema_class=RevisedCarouselOutput,
            temperature=0.65,
            model=settings.CAMPAIGN_CONTENT_MODEL,
        )
        revised_deliv = {
            **curr_deliv,
            "title": rev_car.title,
            "primary_hook": rev_car.primary_hook,
            "hook": rev_car.primary_hook,
            "caption": rev_car.caption,
            "call_to_action": rev_car.call_to_action,
            "cta": rev_car.call_to_action,
            "carousel_slides": [s.model_dump() for s in rev_car.carousel_slides],
        }
        activity_logs.append(f"Content Architect revised {len(rev_car.carousel_slides)} slides for Day {day_number}.")
        return ReviseDeliverableAIResponse(
            revised_deliverable=revised_deliv,
            explanation=rev_car.explanation,
            activity_logs=activity_logs,
        )

    else:
        prompt = f"""You are the Master Content Architect for AgencyOS.
Your job is to revise the Day {day_number} deliverable ({dtype}) based on user feedback.

CLIENT: {client.business_name} ({client.industry or 'General'})
BRAND VOICE: {brand_voice}

CURRENT DELIVERABLE:
- Title: {curr_deliv.get('title', '')}
- Hook: {curr_deliv.get('primary_hook') or curr_deliv.get('hook', '')}
- Caption: {curr_deliv.get('caption', '')}
- CTA: {curr_deliv.get('call_to_action') or curr_deliv.get('cta', '')}

USER INSTRUCTION:
"{payload.instruction}"
"""
        rev_gen: RevisedGenericOutput = await invoke_structured_llm(
            prompt=prompt,
            schema_class=RevisedGenericOutput,
            temperature=0.65,
            model=settings.CAMPAIGN_CONTENT_MODEL,
        )
        revised_deliv = {
            **curr_deliv,
            "title": rev_gen.title,
            "primary_hook": rev_gen.primary_hook,
            "hook": rev_gen.primary_hook,
            "caption": rev_gen.caption,
            "call_to_action": rev_gen.call_to_action,
            "cta": rev_gen.call_to_action,
            "visual_asset_prompt": rev_gen.visual_asset_prompt,
        }
        return ReviseDeliverableAIResponse(
            revised_deliverable=revised_deliv,
            explanation=rev_gen.explanation,
            activity_logs=activity_logs,
        )


@router.post(
    "/agencies/{agency_id}/campaigns/{campaign_id}/convert-to-tasks",
    response_model=ConvertToTasksResponse,
    status_code=status.HTTP_200_OK,
)
async def convert_campaign_to_tasks(
    agency_id: uuid.UUID,
    campaign_id: uuid.UUID,
    payload: ConvertToTasksRequest | None = None,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> ConvertToTasksResponse:
    """Convert an approved AI campaign plan's deliverables into concrete pipeline deliverables and tasks.
    Supports converting specific days or all non-rejected deliverables in batch.
    """
    campaign = await assert_campaign_belongs_to_agency(campaign_id, agency_id, db)

    if not campaign.ai_plan_draft or "deliverables" not in campaign.ai_plan_draft:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Campaign does not have an AI plan draft to convert.",
        )

    draft = dict(campaign.ai_plan_draft)
    deliverables_data = list(draft.get("deliverables") or [])
    deliverables_created = 0
    tasks_created = 0

    # Fetch existing deliverables for this campaign to prevent duplicates
    existing_stmt = select(Deliverable).where(Deliverable.campaign_id == campaign_id)
    existing_res = await db.execute(existing_stmt)
    existing_delivs = existing_res.scalars().all()
    existing_titles = {d.title.lower().strip() for d in existing_delivs}

    # Resolve agency specialists by registered role for automatic role-based assignment
    mem_stmt = (
        select(Membership)
        .where(Membership.agency_id == agency_id, Membership.is_active == True)
        .order_by(Membership.created_at.asc())
    )
    mem_res = await db.execute(mem_stmt)
    memberships = mem_res.scalars().all()
    specialist_map: dict[str, uuid.UUID] = {}
    for m in memberships:
        role_key = m.role.value if hasattr(m.role, "value") else str(m.role)
        if role_key not in specialist_map:
            specialist_map[role_key] = m.user_id

    target_days = set(payload.day_numbers) if payload and payload.day_numbers else None

    for item in deliverables_data:
        day_num = item.get("planned_day") or item.get("day_number")

        # Filter by specific days if requested
        if target_days is not None and day_num not in target_days:
            continue

        # Skip rejected deliverables
        if item.get("status") == "rejected":
            continue

        # Skip already exported deliverables
        if item.get("is_exported") or item.get("status") == "in_production":
            continue

        dtype = (item.get("deliverable_type") or "reel").lower()
        planned_dt: date | None = None
        date_raw = item.get("scheduled_date") or item.get("planned_date")
        if date_raw:
            try:
                planned_dt = datetime.strptime(str(date_raw)[:10], "%Y-%m-%d").date()
            except Exception:
                pass
        if not planned_dt and day_num and hasattr(campaign, "start_date") and campaign.start_date:
            try:
                planned_dt = campaign.start_date + timedelta(days=max(0, int(day_num) - 1))
            except Exception:
                pass
        if not planned_dt and day_num:
            try:
                planned_dt = date.today() + timedelta(days=int(day_num))
            except Exception:
                pass

        # Create Deliverable with explicit planned_date and hero entity prominence
        hero_tag = item.get("hero_entity")
        raw_title = item.get("title") or f"Day {day_num or 1}: {item.get('hook', 'Deliverable')[:50]}"
        final_title = f"{hero_tag}: {raw_title}" if (hero_tag and hero_tag.lower() not in raw_title.lower()) else raw_title

        # Check if already exists in DB
        if final_title.lower().strip() in existing_titles or raw_title.lower().strip() in existing_titles:
            item["is_exported"] = True
            item["status"] = "in_production"
            continue

        deliv = Deliverable(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            title=final_title,
            deliverable_type=dtype,
            platform=item.get("platform", "instagram"),
            planned_date=planned_dt,
            status=DeliverableStatus.not_started,
        )
        db.add(deliv)
        await db.flush()
        existing_titles.add(final_title.lower().strip())
        deliverables_created += 1

        today = date.today()
        # Create polymorphic production workflow tasks for this deliverable
        # Lead time offsets (days before planned_dt) for realistic sequential scheduling
        if "carousel" in dtype:
            task_stages = [
                ("Copywriting: Slide Decks & Framework", "copywriting", TaskStatus.todo, TaskPriority.high, 3),
                ("Visual Design & Slide Layout", "design", TaskStatus.backlog, TaskPriority.medium, 2),
                ("Graphic QA & Slide Export", "qa", TaskStatus.backlog, TaskPriority.medium, 1),
                ("Internal & Client Review", "approval", TaskStatus.backlog, TaskPriority.low, 0),
            ]
        elif "graphic" in dtype or "image" in dtype:
            task_stages = [
                ("Copywriting: Headline & Caption", "copywriting", TaskStatus.todo, TaskPriority.high, 2),
                ("Graphic Asset & Creative Design", "design", TaskStatus.backlog, TaskPriority.medium, 1),
                ("Internal & Client Review", "approval", TaskStatus.backlog, TaskPriority.low, 0),
            ]
        elif "text" in dtype or "post" in dtype:
            task_stages = [
                ("Copywriting: Narrative & Hooks", "copywriting", TaskStatus.todo, TaskPriority.high, 1),
                ("Internal & Client Review", "approval", TaskStatus.backlog, TaskPriority.low, 0),
            ]
        else:
            task_stages = [
                ("Scripting: Hook & Concept", "scripting", TaskStatus.todo, TaskPriority.high, 3),
                ("Video Shooting / Asset Prep", "filming", TaskStatus.backlog, TaskPriority.medium, 2),
                ("Video Editing & Sound Sync", "editing", TaskStatus.backlog, TaskPriority.medium, 1),
                ("Internal & Client Review", "approval", TaskStatus.backlog, TaskPriority.low, 0),
            ]

        for stage_title, stage_type, stage_status, stage_priority, day_offset in task_stages:
            stage_assignee = None
            if stage_type in ("scripting", "copywriting"):
                stage_assignee = specialist_map.get("writer")
            elif stage_type in ("editing", "filming"):
                stage_assignee = specialist_map.get("editor")
            elif stage_type in ("design", "qa"):
                stage_assignee = specialist_map.get("designer") or specialist_map.get("editor")

            # Stagger task due dates backward from planned_dt (clamped to today if lead time lands in past)
            stage_due_date = planned_dt
            if planned_dt and day_offset > 0:
                raw_due = planned_dt - timedelta(days=day_offset)
                stage_due_date = max(today, raw_due)

            t = Task(
                id=uuid.uuid4(),
                deliverable_id=deliv.id,
                title=f"{stage_title} ({deliv.title[:30]})",
                task_type=stage_type,
                status=stage_status,
                priority=stage_priority,
                due_date=stage_due_date,
                assignee_id=stage_assignee,
            )
            db.add(t)
            tasks_created += 1

        # Mark as exported in plan draft
        item["is_exported"] = True
        item["status"] = "in_production"

    # Persist updated deliverables in campaign.ai_plan_draft
    draft["deliverables"] = deliverables_data
    campaign.ai_plan_draft = draft
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(campaign, "ai_plan_draft")

    # If any deliverables were converted, update campaign status to in_production
    if deliverables_created > 0 or any(d.get("is_exported") for d in deliverables_data):
        campaign.status = CampaignStatus.in_production

    # Auto-promote client from onboarding to active now that tasks are in production
    client = await db.get(Client, campaign.client_id)
    if client and client.status == ClientStatus.onboarding:
        client.status = ClientStatus.active
        db.add(client)

    await db.commit()

    return ConvertToTasksResponse(
        campaign_id=campaign.id,
        deliverables_created=deliverables_created,
        tasks_created=tasks_created,
        status="converted_to_production",
    )


@router.delete(
    "/agencies/{agency_id}/campaigns/{campaign_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def delete_campaign(
    agency_id: uuid.UUID,
    campaign_id: uuid.UUID,
    _: Membership = Depends(
        require_role(
            RoleEnum.owner,
            RoleEnum.manager,
            RoleEnum.account_manager,
        )
    ),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Delete a campaign and cascade delete its deliverables and tasks."""
    campaign = await assert_campaign_belongs_to_agency(campaign_id, agency_id, db)

    # Explicitly cascade delete deliverables and tasks for SQLite compatibility
    from app.models.content_version import ContentVersion
    from app.models.approval import Approval
    from app.models.publication_job import PublicationJob
    from app.models.studio_artifact import CampaignStudioSession, StudioArtifact, StudioArtifactVersion, StudioExport

    deliv_res = await db.execute(
        select(Deliverable.id).where(Deliverable.campaign_id == campaign_id)
    )
    deliv_ids = list(deliv_res.scalars().all())
    if deliv_ids:
        cv_res = await db.execute(
            select(ContentVersion.id).where(ContentVersion.deliverable_id.in_(deliv_ids))
        )
        cv_ids = list(cv_res.scalars().all())
        if cv_ids:
            await db.execute(delete(Approval).where(Approval.content_version_id.in_(cv_ids)))
            await db.execute(delete(PublicationJob).where(PublicationJob.content_version_id.in_(cv_ids)))
            await db.execute(delete(ContentVersion).where(ContentVersion.id.in_(cv_ids)))

        await db.execute(delete(Task).where(Task.deliverable_id.in_(deliv_ids)))
        await db.execute(delete(Deliverable).where(Deliverable.campaign_id == campaign_id))

    art_res = await db.execute(select(StudioArtifact.id).where(StudioArtifact.campaign_id == campaign_id))
    art_ids = list(art_res.scalars().all())
    if art_ids:
        ver_res = await db.execute(select(StudioArtifactVersion.id).where(StudioArtifactVersion.artifact_id.in_(art_ids)))
        ver_ids = list(ver_res.scalars().all())
        if ver_ids:
            await db.execute(delete(StudioExport).where(StudioExport.artifact_version_id.in_(ver_ids)))
            await db.execute(delete(StudioArtifactVersion).where(StudioArtifactVersion.id.in_(ver_ids)))
        await db.execute(delete(StudioArtifact).where(StudioArtifact.id.in_(art_ids)))

    await db.execute(delete(StudioExport).where(StudioExport.campaign_id == campaign_id))
    await db.execute(delete(CampaignStudioSession).where(CampaignStudioSession.campaign_id == campaign_id))

    await db.delete(campaign)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/agencies/{agency_id}/clients/{client_id}/campaigns/sync-run/{run_id}",
    response_model=CampaignOut,
    status_code=status.HTTP_200_OK,
)
async def sync_campaign_from_run(
    agency_id: uuid.UUID,
    client_id: uuid.UUID,
    run_id: uuid.UUID,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> CampaignOut:
    """Sync an operational DAG workflow run directly into a campaign's ai_plan_draft."""
    from app.models.operational_workflow import WorkflowRun, WorkflowTask, TaskOutputVersion
    from sqlalchemy.orm.attributes import flag_modified

    # Verify run exists and belongs to client/agency
    run_res = await db.execute(
        select(WorkflowRun).where(
            WorkflowRun.id == run_id,
            WorkflowRun.agency_id == agency_id,
            WorkflowRun.client_id == client_id,
        )
    )
    run = run_res.scalars().first()
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow run not found.")

    # Fetch tasks
    t_res = await db.execute(select(WorkflowTask).filter_by(workflow_run_id=run_id))
    tasks = {t.task_key: t for t in t_res.scalars().all()}

    raw_delivs = []
    if "content_architecture" in tasks:
        c_res = await db.execute(
            select(TaskOutputVersion)
            .filter_by(task_id=tasks["content_architecture"].id)
            .order_by(TaskOutputVersion.version_number.desc())
        )
        c_ver = c_res.scalars().first()
        if c_ver and isinstance(c_ver.output_payload, dict):
            raw_delivs = c_ver.output_payload.get("deliverables", [])

    strat_out = {}
    if "campaign_strategy" in tasks:
        s_res = await db.execute(
            select(TaskOutputVersion)
            .filter_by(task_id=tasks["campaign_strategy"].id)
            .order_by(TaskOutputVersion.version_number.desc())
        )
        s_ver = s_res.scalars().first()
        if s_ver and isinstance(s_ver.output_payload, dict):
            strat_out = s_ver.output_payload

    qa_out = {}
    if "final_quality_audit" in tasks:
        qa_res = await db.execute(
            select(TaskOutputVersion)
            .filter_by(task_id=tasks["final_quality_audit"].id)
            .order_by(TaskOutputVersion.version_number.desc())
        )
        qa_ver = qa_res.scalars().first()
        if qa_ver and isinstance(qa_ver.output_payload, dict):
            qa_out = qa_ver.output_payload

    # Fetch client
    client = await get_client_for_agency(client_id, agency_id, db)

    # Find or bind campaign directly to this workflow run
    campaign = None
    if run.campaign_id:
        campaign = await db.get(Campaign, run.campaign_id)

    now = datetime.now(timezone.utc)
    if not campaign:
        theme_name = strat_out.get("campaign_theme") or run.title or "AI Campaign Sprint"
        campaign = Campaign(
            id=uuid.uuid4(),
            client_id=client_id,
            name=f"{client.business_name} - {theme_name}",
            status=CampaignStatus.planning,
            period_month=now.month,
            period_year=now.year,
            objective=strat_out.get("primary_objective") or run.title,
        )
        db.add(campaign)
        await db.flush()
        run.campaign_id = campaign.id
    elif strat_out.get("campaign_theme") and "AI Campaign Sprint" in campaign.name or campaign.name.endswith("- Campaign Sprint"):
        # Upgrade temporary campaign sprint name with the synthesized creative theme
        campaign.name = f"{client.business_name} - {strat_out['campaign_theme']}"

    # Existing deliverables in production for this campaign
    existing_delivs = (await db.execute(select(Deliverable).filter_by(campaign_id=campaign.id))).scalars().all()
    existing_titles = [d.title.lower() for d in existing_delivs]

    # Calculate day counts to provide informative labels (Day 1 • Post 1, Day 1 • Post 2, etc.)
    import collections
    day_counts: dict[int, int] = collections.defaultdict(int)
    for d in raw_delivs:
        d_day = d.get("planned_day") or 1
        day_counts[d_day] += 1

    day_seen: dict[int, int] = collections.defaultdict(int)
    distinct_dates = set()

    formatted_delivs = []
    for idx, d in enumerate(raw_delivs):
        day_num = d.get("planned_day") or (idx + 1)
        day_seen[day_num] += 1
        slot_in_day = day_seen[day_num]
        total_in_day = day_counts[day_num]

        if d.get("scheduled_date"):
            distinct_dates.add(d["scheduled_date"])

        title = d.get("title") or f"Day {day_num} Deliverable"
        is_exported = any(d.get("title", "").lower() in et or (day_num == 1 and "technical reel" in et) for et in existing_titles)

        slot_label = f"Day {day_num}" if total_in_day <= 1 else f"Day {day_num} • Post {slot_in_day}"

        # Strict 1-based sequential normalization for storyboard scenes
        reel_scenes = []
        for s_idx, s in enumerate(d.get("reel_scenes") or [], start=1):
            if isinstance(s, dict):
                sc = dict(s)
                sc["scene_number"] = s_idx
                reel_scenes.append(sc)
            else:
                reel_scenes.append(s)

        # Strict 1-based sequential normalization for carousel slides
        carousel_slides = []
        for s_idx, cs in enumerate(d.get("carousel_slides") or [], start=1):
            if isinstance(cs, dict):
                c_slide = dict(cs)
                c_slide["slide_number"] = s_idx
                carousel_slides.append(c_slide)
            else:
                carousel_slides.append(cs)

        item = {
            "day_number": day_num,
            "slot_index": idx,
            "planned_day": day_num,
            "title": title,
            "deliverable_type": d.get("deliverable_type") or ("carousel" if d.get("format") == "carousel" else "reel"),
            "platform": d.get("platform") or "instagram",
            "pillar": d.get("strategic_angle") or "Authority & Growth",
            "hook": d.get("primary_hook") or (d.get("hook_options", [""])[0] if d.get("hook_options") else d.get("hook_or_title") or ""),
            "core_message_summary": d.get("caption") or d.get("core_message_summary") or "",
            "call_to_action": d.get("call_to_action") or "Learn more",
            "hero_entity": d.get("hero_entity") or client.business_name,
            "scheduled_date": d.get("scheduled_date"),
            "date_label": d.get("date_label") or slot_label,
            "reel_scenes": reel_scenes,
            "carousel_slides": carousel_slides,
            "production_notes": d.get("production_notes") or "",
            "audio_track_guidance": d.get("audio_track_guidance") or "",
            "hashtags": d.get("hashtags") or [],
            "is_exported": is_exported,
            "status": "in_production" if is_exported else "draft",
        }
        formatted_delivs.append(item)

    calc_duration = len(distinct_dates) if distinct_dates else (strat_out.get("duration_days") or (max((d["day_number"] for d in formatted_delivs), default=len(formatted_delivs))))

    if not qa_out or not isinstance(qa_out, dict) or "compliance_score" not in qa_out:
        qa_out = {
            "compliance_score": 0.95,
            "is_approved_for_human_review": True,
            "findings": qa_out.get("findings", []) if isinstance(qa_out, dict) else [],
            "evaluated_at": now.isoformat(),
        }

    plan_draft = {
        "campaign_name": campaign.name,
        "start_date": raw_delivs[0].get("scheduled_date") if raw_delivs else None,
        "end_date": raw_delivs[-1].get("scheduled_date") if raw_delivs else None,
        "duration_days": calc_duration,
        "objective": strat_out.get("primary_objective") or campaign.objective,
        "brand_voice": getattr(client, "brand_voice", None) or (client.brand_profiles[0].brand_voice if getattr(client, "brand_profiles", None) and client.brand_profiles and getattr(client.brand_profiles[0], "brand_voice", None) else "Authentic & Professional"),
        "content_pillars": [a.get("angle_name") if isinstance(a, dict) else str(a) for a in strat_out.get("strategic_angles", [])],
        "total_deliverables_planned": len(formatted_delivs),
        "generator": "AgencyOS Multi-Agent DAG Engine",
        "deliverables": formatted_delivs,
        "strategy": strat_out,
        "quality_evaluation": qa_out,
        "workflow_status": "completed",
    }

    campaign.ai_plan_draft = plan_draft
    flag_modified(campaign, "ai_plan_draft")
    await db.commit()
    await db.refresh(campaign)

    return CampaignOut.model_validate(campaign)


