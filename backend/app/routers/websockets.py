from __future__ import annotations

import logging
import uuid
from typing import Optional

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.websockets import ws_manager
from app.dependencies import get_current_user
from app.models.user import Membership, User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ws", tags=["websockets"])


class WSTicketRequest(BaseModel):
    agency_id: uuid.UUID


class WSTicketResponse(BaseModel):
    ticket: str
    expires_in: int = 30


@router.post("/ticket", response_model=WSTicketResponse)
async def create_ws_ticket(
    payload: WSTicketRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WSTicketResponse:
    """
    Issues a short-lived (30s) single-use ticket for establishing an authenticated
    WebSocket connection without leaking access JWTs in URLs or query strings.
    Validates that the user is an active member of the target agency.
    """
    # 1. Verify agency membership
    membership_res = await db.execute(
        select(Membership).where(
            Membership.user_id == current_user.id,
            Membership.agency_id == payload.agency_id,
        )
    )
    membership = membership_res.scalar_one_or_none()
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You are not an active member of this agency workspace.",
        )

    # 2. Issue 30-second ticket
    ticket = await ws_manager.issue_ticket(
        user_id=current_user.id,
        agency_id=payload.agency_id,
        ttl_seconds=30,
    )

    return WSTicketResponse(ticket=ticket, expires_in=30)


@router.websocket("/agencies/{agency_id}")
async def agency_websocket_endpoint(
    websocket: WebSocket,
    agency_id: uuid.UUID,
    ticket: Optional[str] = Query(None),
):
    """
    Dedicated authenticated real-time stream for agency-scoped events.
    Requires a valid, unconsumed 30-second single-use ticket issued via POST /ws/ticket.
    """
    if not ticket:
        logger.warning("Rejected WS connection to agency %s: missing ticket query parameter.", agency_id)
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Missing single-use ticket")
        return

    # Atomic consumption of ticket via GETDEL (or in-memory pop)
    auth_data = await ws_manager.consume_ticket(ticket)
    if not auth_data:
        logger.warning("Rejected WS connection to agency %s: ticket invalid or expired.", agency_id)
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid or expired ticket")
        return

    user_id, ticket_agency_id = auth_data
    if ticket_agency_id != agency_id:
        logger.warning("Rejected WS connection: ticket agency %s does not match requested %s.", ticket_agency_id, agency_id)
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Ticket agency mismatch")
        return

    # Accept connection and register in agency pool
    await websocket.accept()
    await ws_manager.connect(agency_id, websocket)

    try:
        # Keepalive loop: listen for ping from client, reply with pong
        while True:
            msg = await websocket.receive_text()
            if msg == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        logger.debug("Client disconnected normally from agency %s WS stream.", agency_id)
    except Exception as e:
        logger.debug("Exception in WS stream for agency %s: %s", agency_id, e)
    finally:
        await ws_manager.disconnect(agency_id, websocket)
