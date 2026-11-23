import asyncio
import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from starlette.testclient import TestClient

from app.main import app
from app.core.websockets import ws_manager, AgencyWSEvent
from tests.conftest import TestSessionLocal
from app.models.agency import Agency
from app.models.user import User, Membership
from app.core.security import hash_password, create_access_token


@pytest.mark.asyncio
async def test_ticket_issue_and_single_use_getdel():
    """
    Verifies that issue_ticket stores the ticket with 30s TTL,
    and consume_ticket atomically retrieves and deletes it (single use).
    """
    user_id = uuid.uuid4()
    agency_id = uuid.uuid4()

    ticket = await ws_manager.issue_ticket(user_id=user_id, agency_id=agency_id, ttl_seconds=30)
    assert ticket is not None
    assert len(ticket) == 36  # UUID string format

    # First consumption: valid
    auth_data = await ws_manager.consume_ticket(ticket)
    assert auth_data is not None
    ret_user_id, ret_agency_id = auth_data
    assert ret_user_id == user_id
    assert ret_agency_id == agency_id

    # Second consumption: must be None (already deleted by atomic GETDEL)
    second_attempt = await ws_manager.consume_ticket(ticket)
    assert second_attempt is None


@pytest.mark.asyncio
async def test_ticket_ttl_expiration():
    """
    Verifies that an expired ticket cannot be consumed.
    """
    user_id = uuid.uuid4()
    agency_id = uuid.uuid4()

    # Issue with 0 second TTL
    ticket = await ws_manager.issue_ticket(user_id=user_id, agency_id=agency_id, ttl_seconds=0)
    await asyncio.sleep(0.05)

    auth_data = await ws_manager.consume_ticket(ticket)
    assert auth_data is None


@pytest.mark.asyncio
async def test_ticket_http_endpoint_membership_validation():
    """
    Tests POST /api/v1/ws/ticket:
    - Rejects unauthenticated requests with 401.
    - Rejects users who are NOT members of the target agency with 403.
    - Successfully issues ticket for verified agency members with 200.
    """
    async with TestSessionLocal() as db:
        unique_id = uuid.uuid4().hex[:8]
        # 1. Create agency
        agency_id = uuid.uuid4()
        agency = Agency(
            id=agency_id,
            name=f"RealTime Agency {unique_id}",
            slug=f"rt-{unique_id}",
        )
        db.add(agency)

        # 2. Create user
        user_id = uuid.uuid4()
        user = User(
            id=user_id,
            email=f"ws_user_{unique_id}@agencyos.local",
            hashed_password=hash_password("Password123!"),
            full_name="RealTime Tester",
            is_active=True,
        )
        db.add(user)

        # 3. Create membership
        membership = Membership(
            id=uuid.uuid4(),
            user_id=user_id,
            agency_id=agency_id,
            role="owner",
        )
        db.add(membership)
        await db.commit()

        # Token for this user
        token = create_access_token(data={"sub": str(user_id)})

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Unauthenticated request -> 401
        unauth_res = await client.post("/ws/ticket", json={"agency_id": str(agency_id)})
        assert unauth_res.status_code == 401

        # 2. Non-member agency request -> 403
        foreign_agency_id = uuid.uuid4()
        forbidden_res = await client.post(
            "/ws/ticket",
            json={"agency_id": str(foreign_agency_id)},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert forbidden_res.status_code == 403
        assert "not an active member" in forbidden_res.json()["detail"]

        # 3. Valid membership request -> 200 with ticket
        valid_res = await client.post(
            "/ws/ticket",
            json={"agency_id": str(agency_id)},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert valid_res.status_code == 200
        res_data = valid_res.json()
        assert "ticket" in res_data
        assert res_data["expires_in"] == 30

        # Consume ticket once to verify validity
        ticket_val = res_data["ticket"]
        auth_data = await ws_manager.consume_ticket(ticket_val)
        assert auth_data == (user_id, agency_id)


def test_websocket_handshake_with_ticket():
    """
    Tests live WebSocket handshake using Starlette TestClient:
    - Rejects handshake without ticket or with invalid ticket (1008 Policy Violation).
    - Accepts handshake with valid ticket and receives broadcast events.
    """
    client = TestClient(app)
    agency_id = uuid.uuid4()
    user_id = uuid.uuid4()

    # 1. Handshake without ticket -> 1008
    with pytest.raises(Exception):
        with client.websocket_connect(f"/ws/agencies/{agency_id}") as ws:
            pass

    # 2. Handshake with bogus ticket -> 1008
    with pytest.raises(Exception):
        with client.websocket_connect(f"/ws/agencies/{agency_id}?ticket=bogus-ticket") as ws:
            pass

    # 3. Handshake with valid ticket
    loop = asyncio.get_event_loop()
    ticket = loop.run_until_complete(
        ws_manager.issue_ticket(user_id=user_id, agency_id=agency_id, ttl_seconds=30)
    )

    with client.websocket_connect(f"/ws/agencies/{agency_id}?ticket={ticket}") as websocket:
        # Ping/pong keepalive test
        websocket.send_text("ping")
        pong = websocket.receive_text()
        assert pong == "pong"

        # Broadcast test: send event to agency
        loop.run_until_complete(
            ws_manager.broadcast_to_agency(
                agency_id=agency_id,
                event=AgencyWSEvent.TASK_UPDATED,
                data={"task_id": "test-task-1", "status": "done"},
            )
        )

        # Receive broadcast event
        msg = websocket.receive_json()
        assert msg["event"] == "TASK_UPDATED"
        assert msg["agency_id"] == str(agency_id)
        assert msg["data"]["task_id"] == "test-task-1"
        assert msg["data"]["status"] == "done"
