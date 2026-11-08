from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.campaign_intelligence.orchestration.graph import run_campaign_pipeline
from app.campaign_intelligence.orchestration.state import CampaignState
from app.campaign_intelligence.schemas.campaign import CampaignBrief
from app.campaign_intelligence.schemas.deliverables import DeliverablePlan
from app.campaign_intelligence.schemas.quality import QualityEvaluation
from app.campaign_intelligence.schemas.strategy import CampaignStrategy
from app.core.database import get_db
from app.core.llm import invoke_structured_llm
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

    # 1. Construct CampaignBrief
    campaign_id = uuid.uuid4()
    brief = CampaignBrief(
        campaign_id=campaign_id,
        client_id=client_id,
        agency_id=agency_id,
        name=f"{client.business_name} - {payload.period_month}/{payload.period_year} Plan",
        objective=payload.objective,
        period_month=payload.period_month,
        period_year=payload.period_year,
        custom_instructions=payload.custom_brief,
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

        deliverables_formatted.append({
            "day_number": idx + 1,
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
            else f"{client.business_name} - {payload.period_month}/{payload.period_year} Plan"
        ),
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
    suggested_period_month: int | None = None
    suggested_period_year: int | None = None
    is_ready_to_generate: bool = False


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
    """Conversational intake copilot helping users formulate and refine their campaign brief."""
    client = await get_client_for_agency(client_id, agency_id, db)

    # 1. Fetch brand profile if available
    bp_result = await db.execute(
        select(BrandProfile)
        .where(BrandProfile.client_id == client_id)
        .order_by(BrandProfile.version.desc())
    )
    brand_profile = bp_result.scalars().first()

    brand_voice = brand_profile.brand_voice if brand_profile and brand_profile.brand_voice else "Professional and authentic"
    pillars = brand_profile.content_pillars if brand_profile and brand_profile.content_pillars else []

    # 2. Format message history
    formatted_convo = "\n".join([f"{m.role.upper()}: {m.content}" for m in payload.messages])

    prompt = f"""You are the AgencyOS Campaign Director Copilot, an elite creative director and campaign strategist assisting an agency team to design their next monthly social media campaign sprint.

Client Context:
- Client Business: {client.business_name}
- Industry: {client.industry or 'General Business'}
- Brand Voice: {brand_voice}
- Established Content Pillars: {', '.join(pillars) if pillars else 'None specified'}

CONVERSATION HISTORY (Most recent messages at the bottom):
{formatted_convo}

YOUR BEHAVIOR & INTERVIEWING RULES:
1. Multi-turn Memory & Proactivity:
   - Act as an engaging, proactive creative partner, NOT a robotic one-way walkie-talkie.
   - Actively reference and synthesize the user's previous answers in this conversation history.
   - If the user provides a brief or general idea (e.g. "I want to do a summer fitness challenge" or "launch our new SaaS feature"), DO NOT immediately jump to generation. Instead, validate their idea enthusiastically and ask 1 to 2 smart, strategic follow-up questions to drill down on:
     a) Target sub-audience or demographic persona
     b) Core offer, hook, discount, or unique value proposition
     c) Tone or format preferences (e.g. high-energy Reels, educational carousels, founder-led b-roll)
2. Collaborative Brainstorming:
   - Proactively suggest 1-2 sharp creative angles or content hooks suited for {client.business_name}'s brand voice ({brand_voice}).
3. Readiness Determination (`is_ready_to_generate`):
   - Set `is_ready_to_generate = True` ONLY when:
     * The user explicitly tells you to proceed/generate (e.g., "let's generate", "create it", "looks good go ahead", "run it"), OR
     * The conversation has covered the core objective, target audience/offer, and key direction in sufficient depth.
   - In all early conversational discovery turns, keep `is_ready_to_generate = False`.
4. Structured Outputs:
   - Always synthesize the evolving strategy into `suggested_objective` (1 crisp sentence) and `suggested_custom_brief` (2-3 sentences capturing audience, themes, and guardrails) based on everything discussed so far.
   - Keep your conversational reply punchy, insightful, and natural (2-4 sentences plus your proactive questions).
5. STRICT LANGUAGE POLICY - ENGLISH EXCLUSIVELY:
   - You MUST communicate, think, and respond ONLY in the English language.
   - Even if the user communicates or prompts in another language (such as Hindi, Hinglish, Spanish, French, German, etc.), you must understand their intent, but your response, questions, suggested angles, and brief drafts MUST ALWAYS BE WRITTEN 100% IN ENGLISH. Never output in any language other than English.
"""

    try:
        output: ChatBriefLLMOutput = await invoke_structured_llm(
            prompt=prompt,
            schema_class=ChatBriefLLMOutput,
            temperature=0.7,
            model="openai/gpt-oss-20b",
        )
        return ChatBriefResponse(
            reply=output.reply,
            suggested_objective=output.suggested_objective,
            suggested_custom_brief=output.suggested_custom_brief,
            suggested_period_month=payload.period_month or date.today().month,
            suggested_period_year=payload.period_year or date.today().year,
            is_ready_to_generate=output.is_ready_to_generate,
        )
    except Exception:
        return ChatBriefResponse(
            reply=f"I'm ready to help you plan {client.business_name}'s campaign! What is the primary objective or theme you have in mind for this sprint?",
            suggested_period_month=payload.period_month or date.today().month,
            suggested_period_year=payload.period_year or date.today().year,
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
        # Create Deliverable
        deliv = Deliverable(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            title=item.get("title") or f"Day {item.get('day_number', 1)}: {item.get('hook', 'Deliverable')[:50]}",
            deliverable_type=dtype,
            platform=item.get("platform", "instagram"),
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

