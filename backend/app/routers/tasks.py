from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies import get_current_user, require_agency_member
from app.models.campaign import Campaign
from app.models.client import Client
from app.models.deliverable import Deliverable, DeliverableStatus
from app.models.task import Task, TaskStatus
from app.models.user import Membership, User
from app.schemas.task import TaskCreate, TaskOut, TaskUpdate
from app.services.tenant_service import assert_deliverable_belongs_to_agency

router = APIRouter(tags=["tasks"])


@router.post(
    "/agencies/{agency_id}/deliverables/{deliverable_id}/tasks",
    response_model=TaskOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_task(
    agency_id: uuid.UUID,
    deliverable_id: uuid.UUID,
    payload: TaskCreate,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> TaskOut:
    """Create a task for a deliverable."""
    await assert_deliverable_belongs_to_agency(deliverable_id, agency_id, db)
    task = Task(
        id=uuid.uuid4(),
        deliverable_id=deliverable_id,
        **payload.model_dump(),
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return TaskOut.model_validate(task)


@router.get("/agencies/{agency_id}/tasks", response_model=list[TaskOut])
async def list_agency_tasks(
    agency_id: uuid.UUID,
    task_status: TaskStatus | None = Query(None, alias="status"),
    assignee_id: uuid.UUID | None = Query(None),
    client_id: uuid.UUID | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=500),
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> list[TaskOut]:
    """
    List all tasks for an agency, with optional filters:
    - status
    - assignee_id
    - client_id (filters by client's campaigns/deliverables)
    """
    query = (
        select(Task)
        .join(Deliverable, Task.deliverable_id == Deliverable.id)
        .join(Campaign, Deliverable.campaign_id == Campaign.id)
        .join(Client, Campaign.client_id == Client.id)
        .where(Client.agency_id == agency_id)
    )
    if task_status is not None:
        query = query.where(Task.status == task_status)
    if assignee_id is not None:
        query = query.where(Task.assignee_id == assignee_id)
    if client_id is not None:
        query = query.where(Campaign.client_id == client_id)

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    tasks = result.scalars().all()
    return [TaskOut.model_validate(t) for t in tasks]


@router.patch("/agencies/{agency_id}/tasks/{task_id}", response_model=TaskOut)
async def update_task(
    agency_id: uuid.UUID,
    task_id: uuid.UUID,
    payload: TaskUpdate,
    _: Membership = Depends(require_agency_member),
    db: AsyncSession = Depends(get_db),
) -> TaskOut:
    """Update a task's status, assignee, or other fields."""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")
    # Verify task belongs to agency
    await assert_deliverable_belongs_to_agency(task.deliverable_id, agency_id, db)

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(task, field, value)

    # Synchronize parent Deliverable status when task status changes
    if "status" in update_data:
        status_map = {
            TaskStatus.backlog: DeliverableStatus.not_started,
            TaskStatus.todo: DeliverableStatus.not_started,
            TaskStatus.in_progress: DeliverableStatus.in_production,
            TaskStatus.internal_review: DeliverableStatus.internal_review,
            TaskStatus.client_review: DeliverableStatus.client_review,
            TaskStatus.changes_requested: DeliverableStatus.changes_requested,
            TaskStatus.approved: DeliverableStatus.approved,
            TaskStatus.done: DeliverableStatus.approved,
        }
        if task.status in status_map:
            deliv_res = await db.execute(
                select(Deliverable).where(Deliverable.id == task.deliverable_id)
            )
            deliverable = deliv_res.scalar_one_or_none()
            if deliverable:
                deliverable.status = status_map[task.status]

    await db.commit()
    await db.refresh(task)
    return TaskOut.model_validate(task)
