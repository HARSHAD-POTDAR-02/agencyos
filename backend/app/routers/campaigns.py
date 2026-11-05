from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
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
    ConvertToTasksResponse,
    DeliverableCreate,
    DeliverableOut,
    GeneratePlanRequest,
)
from app.services.ai_planner_service import generate_campaign_plan
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
    """Generate an AI-powered 30-day campaign plan for a client respecting brand voice and contracts."""
    client = await get_client_for_agency(client_id, agency_id, db)

    # 1. Fetch confirmed or latest brand profile
    bp_result = await db.execute(
        select(BrandProfile)
        .where(BrandProfile.client_id == client_id)
        .order_by(BrandProfile.version.desc())
    )
    brand_profile = bp_result.scalars().first()

    # 2. Fetch active contracts & scopes
    contracts_result = await db.execute(
        select(Contract).where(Contract.client_id == client_id, Contract.status == "active")
    )
    contracts = contracts_result.scalars().all()
    contract_ids = [c.id for c in contracts]

    scopes: list[ScopeItem] = []
    if contract_ids:
        scopes_result = await db.execute(
            select(ScopeItem).where(ScopeItem.contract_id.in_(contract_ids))
        )
        scopes = list(scopes_result.scalars().all())

    # 3. Generate structured AI plan
    plan = await generate_campaign_plan(
        client=client,
        brand_profile=brand_profile,
        scopes=scopes,
        period_month=payload.period_month,
        period_year=payload.period_year,
        objective=payload.objective,
        custom_brief=payload.custom_brief,
    )

    # 4. Save campaign
    campaign = Campaign(
        id=uuid.uuid4(),
        client_id=client_id,
        name=plan.get("campaign_name", f"{client.business_name} - {payload.period_month}/{payload.period_year} Plan"),
        period_month=payload.period_month,
        period_year=payload.period_year,
        objective=plan.get("objective") or payload.objective,
        status=CampaignStatus.planning,
        ai_plan_draft=plan,
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return CampaignOut.model_validate(campaign)


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
        # Create Deliverable
        deliv = Deliverable(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            title=item.get("title") or f"Day {item.get('day_number', 1)}: {item.get('hook', 'Deliverable')[:50]}",
            deliverable_type=item.get("deliverable_type", "reel"),
            platform=item.get("platform", "instagram"),
            status=DeliverableStatus.not_started,
        )
        db.add(deliv)
        await db.flush()
        deliverables_created += 1

        # Create production workflow tasks for this deliverable
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

