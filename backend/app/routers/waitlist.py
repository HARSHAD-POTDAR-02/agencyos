from __future__ import annotations

from collections import defaultdict
import time
import uuid
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

router = APIRouter(tags=["waitlist"])

# Simple in-memory IP rate limit: max 5 waitlist submissions per 60s per IP
_RATE_LIMIT_WINDOW_SEC = 60.0
_RATE_LIMIT_MAX_REQ = 5
_ip_hits: dict[str, list[float]] = defaultdict(list)


def _check_rate_limit(client_ip: str) -> None:
    now = time.monotonic()
    hits = [t for t in _ip_hits[client_ip] if now - t < _RATE_LIMIT_WINDOW_SEC]
    if len(hits) >= _RATE_LIMIT_MAX_REQ:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many waitlist requests. Please wait a minute and try again.",
        )
    hits.append(now)
    _ip_hits[client_ip] = hits


class WaitlistJoinRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=200)
    work_email: EmailStr
    agency_name: str = Field(..., min_length=2, max_length=255)
    role: str = Field(..., min_length=2, max_length=120)
    team_size: str = Field(..., min_length=1, max_length=60)
    active_retainers: str = Field(..., min_length=1, max_length=60)
    biggest_bottleneck: str | None = Field(None, max_length=2000)


class WaitlistJoinOut(BaseModel):
    status: str = "joined"
    id: str
    work_email: str


@router.post("/waitlist", response_model=WaitlistJoinOut, status_code=status.HTTP_201_CREATED)
async def join_waitlist(
    payload: WaitlistJoinRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> WaitlistJoinOut:
    """Persist an agency waitlist application to Postgres with IP rate limiting and email deduplication."""
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(client_ip)

    normalized_email = payload.work_email.strip().lower()

    existing = await db.execute(
        text("SELECT id FROM waitlist_leads WHERE work_email = :email LIMIT 1"),
        {"email": normalized_email},
    )
    row = existing.first()
    if row:
        return WaitlistJoinOut(status="already_joined", id=str(row[0]), work_email=normalized_email)

    lead_id = uuid.uuid4()
    await db.execute(
        text(
            """
            INSERT INTO waitlist_leads (
                id, full_name, work_email, agency_name, role, team_size, active_retainers, biggest_bottleneck
            ) VALUES (
                :id, :full_name, :work_email, :agency_name, :role, :team_size, :active_retainers, :biggest_bottleneck
            )
            """
        ),
        {
            "id": str(lead_id),
            "full_name": payload.full_name.strip(),
            "work_email": normalized_email,
            "agency_name": payload.agency_name.strip(),
            "role": payload.role.strip(),
            "team_size": payload.team_size.strip(),
            "active_retainers": payload.active_retainers.strip(),
            "biggest_bottleneck": (payload.biggest_bottleneck or "").strip() or None,
        },
    )
    await db.commit()
    return WaitlistJoinOut(id=str(lead_id), work_email=normalized_email)
