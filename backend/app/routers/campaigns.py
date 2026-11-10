from __future__ import annotations

import logging
import re
import uuid
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

logger = logging.getLogger(__name__)

from app.campaign_intelligence.orchestration.graph import run_campaign_pipeline
from app.campaign_intelligence.orchestration.state import CampaignState
from app.campaign_intelligence.schemas.campaign import CampaignBrief
from app.campaign_intelligence.schemas.deliverables import DeliverablePlan
from app.campaign_intelligence.schemas.quality import QualityEvaluation
from app.campaign_intelligence.schemas.strategy import CampaignStrategy
from app.campaign_intelligence.tools.date_utils import (
    extract_date_range_from_text,
    extract_format_and_count_from_text,
    sanitize_date_year,
)
from app.core.config import settings
from app.core.database import get_db
from app.core.llm import get_llm, invoke_structured_llm
from app.dependencies import require_agency_member
from app.models.brand_profile import BrandProfile
from app.models.campaign import Campaign, CampaignStatus
from app.models.client import Client, ClientStatus
from app.models.contract import Contract, ScopeItem
from app.models.deliverable import Deliverable, DeliverableStatus
from app.models.task import Task, TaskPriority, TaskStatus
from app.models.user import Membership
from app.schemas.campaign import (
    CampaignCreate,
    CampaignOut,
    ChatBriefRequest,
    ChatBriefResponse,
    ConvertToTasksResponse,
    DeliverableCreate,
    DeliverableOut,
    GeneratePlanRequest,
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
        extracted = extract_date_range_from_text(text_to_scan, default_year=default_year)
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
        custom_brief=payload.custom_brief,
        deliverable_preferences=final_prefs or [],
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
  * PROVIDE FULL, PRODUCTION-READY SCENE-BY-SCENE SCRIPTS with exact timestamped beats:
    - 0:00 - 0:03 [The Arrest / Hook]: Visual framing, on-screen text, audio cue.
    - 0:03 - 0:10 [Tension / Problem]: Creator movement, b-roll angle, spoken line.
    - 0:10 - 0:22 [The Payoff / Value]: Proof, demo, screen share, or visual transformation.
    - 0:22 - 0:30 [Call to Action]: Clean off-ramp, caption prompt, comment keyword trigger.
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


@router.post(
    "/agencies/{agency_id}/clients/{client_id}/campaigns/chat-brief",
    response_model=ChatBriefResponse,
    status_code=status.HTTP_200_OK,
)
async def chat_brief_endpoint(
    agency_id: uuid.UUID,
    client_id: uuid.UUID,
    payload: ChatBriefRequest,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> ChatBriefResponse:
    """Conversational intake copilot and specialist agents helping users formulate and refine their campaign brief."""
    client = await get_client_for_agency(client_id, agency_id, db)

    # 1. Resolve active agent profile
    target_agent_id = payload.agent_id if (payload.agent_id and payload.agent_id in AGENT_SPECS) else "director"
    agent_spec = AGENT_SPECS[target_agent_id]

    # 2. Extract conversation history & user texts early (preventing any forward reference errors)
    curr_dt = date.today()
    ref_year = payload.period_year or curr_dt.year
    ref_month = payload.period_month or curr_dt.month

    user_texts = [m.content for m in payload.messages if m.role == "user"]
    combined_user_text = " ".join(user_texts)
    latest_user_text = user_texts[-1] if user_texts else ""
    has_explicit_year = bool(re.search(r"\b20\d{2}\b", combined_user_text))

    formatted_convo_parts = []
    for m in payload.messages:
        if m.role == "user":
            formatted_convo_parts.append(f"USER: {m.content}")
        else:
            sender_name = m.agent_name or AGENT_SPECS.get(m.agent_id or "director", {}).get("name", "Campaign Director")
            formatted_convo_parts.append(f"{sender_name.upper()}: {m.content}")
    formatted_convo = "\n".join(formatted_convo_parts)

    # 3. Fetch brand profile if available & extract dynamic brand attributes
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

    # Completely dynamic location retrieval from database without hardcoding
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
"""

    try:
        output: ChatBriefLLMOutput = await invoke_structured_llm(
            prompt=prompt,
            schema_class=ChatBriefLLMOutput,
            temperature=0.7,
            model=settings.GROQ_MODEL,
        )

        extracted = extract_date_range_from_text(combined_user_text, default_year=ref_year)
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

        return ChatBriefResponse(
            reply=reply_text,
            agent_id=target_agent_id,
            agent_name=agent_spec["name"],
            suggested_objective=output.suggested_objective,
            suggested_custom_brief=output.suggested_custom_brief,
            suggested_deliverable_preferences=final_deliverable_prefs,
            suggested_period_month=final_month,
            suggested_period_year=final_year,
            suggested_start_date=final_start_date,
            suggested_end_date=final_end_date,
            suggested_duration_days=final_duration_days,
            is_ready_to_generate=output.is_ready_to_generate,
        )
    except Exception as ex:
        logger.error(f"Structured LLM failed in chat_brief_endpoint ({ex}). Initiating contextual recovery...")
        extracted = extract_date_range_from_text(combined_user_text, default_year=ref_year)
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

        # Contextual LLM recovery fallback: Answer the user's specific request directly instead of a canned greeting
        fallback_reply = ""
        if user_texts:
            latest_msg = user_texts[-1]
            try:
                from langchain_core.messages import HumanMessage
                raw_llm = get_llm(temperature=0.7, model=settings.GROQ_MODEL, max_tokens=1000)
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
            suggested_period_month=p_month,
            suggested_period_year=p_year,
            suggested_start_date=start_date_str,
            suggested_end_date=end_date_str,
            suggested_duration_days=dur_days,
            suggested_deliverable_preferences=extracted_fmts,
            is_ready_to_generate=False,
        )


@router.post(
    "/agencies/{agency_id}/campaigns/{campaign_id}/convert-to-tasks",
    response_model=ConvertToTasksResponse,
    status_code=status.HTTP_200_OK,
)
async def convert_campaign_to_tasks(
    agency_id: uuid.UUID,
    campaign_id: uuid.UUID,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> ConvertToTasksResponse:
    """Convert an approved AI campaign plan's deliverables into concrete pipeline deliverables and tasks."""
    campaign = await assert_campaign_belongs_to_agency(campaign_id, agency_id, db)

    if not campaign.ai_plan_draft or "deliverables" not in campaign.ai_plan_draft:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Campaign does not have an AI plan draft to convert.",
        )

    deliverables_data = campaign.ai_plan_draft.get("deliverables", [])
    deliverables_created = 0
    tasks_created = 0

    for item in deliverables_data:
        dtype = (item.get("deliverable_type") or "reel").lower()
        planned_dt: date | None = None
        if item.get("scheduled_date"):
            try:
                planned_dt = datetime.strptime(item["scheduled_date"], "%Y-%m-%d").date()
            except Exception:
                pass

        # Create Deliverable with explicit planned_date
        deliv = Deliverable(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            title=item.get("title") or f"Day {item.get('day_number', 1)}: {item.get('hook', 'Deliverable')[:50]}",
            deliverable_type=dtype,
            platform=item.get("platform", "instagram"),
            planned_date=planned_dt,
            status=DeliverableStatus.not_started,
        )
        db.add(deliv)
        await db.flush()
        deliverables_created += 1

        # Create polymorphic production workflow tasks for this deliverable
        if "carousel" in dtype:
            task_stages = [
                ("Copywriting: Slide Decks & Framework", "copywriting", TaskStatus.todo, TaskPriority.high),
                ("Visual Design & Slide Layout", "design", TaskStatus.backlog, TaskPriority.medium),
                ("Graphic QA & Slide Export", "qa", TaskStatus.backlog, TaskPriority.medium),
                ("Internal & Client Review", "approval", TaskStatus.backlog, TaskPriority.low),
            ]
        elif "graphic" in dtype or "image" in dtype:
            task_stages = [
                ("Copywriting: Headline & Caption", "copywriting", TaskStatus.todo, TaskPriority.high),
                ("Graphic Asset & Creative Design", "design", TaskStatus.backlog, TaskPriority.medium),
                ("Internal & Client Review", "approval", TaskStatus.backlog, TaskPriority.low),
            ]
        elif "text" in dtype or "post" in dtype:
            task_stages = [
                ("Copywriting: Narrative & Hooks", "copywriting", TaskStatus.todo, TaskPriority.high),
                ("Internal & Client Review", "approval", TaskStatus.backlog, TaskPriority.low),
            ]
        else:
            task_stages = [
                ("Scripting: Hook & Concept", "scripting", TaskStatus.todo, TaskPriority.high),
                ("Video Shooting / Asset Prep", "filming", TaskStatus.backlog, TaskPriority.medium),
                ("Video Editing & Sound Sync", "editing", TaskStatus.backlog, TaskPriority.medium),
                ("Internal & Client Review", "approval", TaskStatus.backlog, TaskPriority.low),
            ]

        for stage_title, stage_type, stage_status, stage_priority in task_stages:
            t = Task(
                id=uuid.uuid4(),
                deliverable_id=deliv.id,
                title=f"{stage_title} ({deliv.title[:30]})",
                task_type=stage_type,
                status=stage_status,
                priority=stage_priority,
                due_date=planned_dt,
            )
            db.add(t)
            tasks_created += 1

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
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Delete a campaign and cascade delete its deliverables and tasks."""
    campaign = await assert_campaign_belongs_to_agency(campaign_id, agency_id, db)

    # Explicitly cascade delete deliverables and tasks for SQLite compatibility
    deliv_res = await db.execute(
        select(Deliverable.id).where(Deliverable.campaign_id == campaign_id)
    )
    deliv_ids = list(deliv_res.scalars().all())
    if deliv_ids:
        await db.execute(delete(Task).where(Task.deliverable_id.in_(deliv_ids)))
        await db.execute(delete(Deliverable).where(Deliverable.campaign_id == campaign_id))

    await db.delete(campaign)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

