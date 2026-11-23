from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from enum import Enum
import json
import logging
import time
from typing import Any, Dict, Optional, Set
import uuid

from fastapi import WebSocket

try:
    import redis.asyncio as aioredis
    from redis.exceptions import ConnectionError as RedisConnectionError, RedisError
    HAS_REDIS = True
except ImportError:
    aioredis = None  # type: ignore
    RedisConnectionError = Exception  # type: ignore
    RedisError = Exception  # type: ignore
    HAS_REDIS = False

from app.core.config import settings

logger = logging.getLogger(__name__)


class AgencyWSEvent(str, Enum):
    """
    Standardized real-time events for AgencyOS multi-tenant websocket streaming.
    """
    # Core Deliverable & Review Flow
    DELIVERABLE_REVIEW_DECISION = "DELIVERABLE_REVIEW_DECISION"
    DELIVERABLE_STATUS_CHANGED = "DELIVERABLE_STATUS_CHANGED"
    PUBLICATION_COMPLETED = "PUBLICATION_COMPLETED"

    # Tasks & Pipeline Dependencies
    TASK_UPDATED = "TASK_UPDATED"
    PIPELINE_STAGE_UNLOCKED = "PIPELINE_STAGE_UNLOCKED"

    # Cortex Long-Term Memory
    MEMORY_REVIEW_QUEUED = "MEMORY_REVIEW_QUEUED"

    # Community Engagement
    ENGAGEMENT_ACTIVITY = "ENGAGEMENT_ACTIVITY"

    # Actionable Alerts & Badges
    NOTIFICATION_CREATED = "NOTIFICATION_CREATED"


class WebSocketManager:
    """
    Agency-scoped WebSocket hub backed by Redis Pub/Sub for cross-process broadcasting
    with an in-memory TTL fallback for standalone/local development.
    """

    def __init__(self):
        # Local active connections scoped by agency_id
        self.active_connections: Dict[uuid.UUID, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()

        # In-memory TTL fallback dictionary for 30s single-use tickets
        # Format: ticket_str -> (value_str, expires_at_float)
        self._fallback_tickets: Dict[str, tuple[str, float]] = {}

        # Redis connection handle & fast-fail probe throttle
        self._redis: Optional[aioredis.Redis] = None
        self._redis_available: bool = False
        self._last_probe_time: float = 0.0
        self._probe_cooldown_seconds: float = 30.0

    async def get_redis(self) -> Optional[aioredis.Redis]:
        """Lazy-initialize and return async Redis client if reachable (with zero-lag cooldown fallback)."""
        if not HAS_REDIS or not settings.REDIS_URL:
            return None

        if self._redis is not None:
            return self._redis

        now = time.time()
        # If Redis recently failed to connect, instantly use local in-memory fallback without blocking 2s!
        if not self._redis_available and (now - self._last_probe_time < self._probe_cooldown_seconds):
            return None

        self._last_probe_time = now
        try:
            client = aioredis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_timeout=0.3,
                socket_connect_timeout=0.3,
            )
            # Fast ping probe
            await client.ping()
            self._redis = client
            self._redis_available = True
            logger.info("WebSocketManager successfully connected to Redis Pub/Sub: %s", settings.REDIS_URL)
            return self._redis
        except (RedisConnectionError, OSError, Exception) as e:
            self._redis = None
            self._redis_available = False
            logger.info("Redis is not running (%s). WebSocketManager running in local in-memory fallback mode.", e)
            return None

    # ──────────────────────────────────────────────────────────────────────────
    # Single-Use 30-Second Ticket Management
    # ──────────────────────────────────────────────────────────────────────────
    async def issue_ticket(self, user_id: uuid.UUID, agency_id: uuid.UUID, ttl_seconds: int = 30) -> str:
        """
        Issues a single-use random ticket stored in Redis (or in-memory fallback)
        valid for 30 seconds.
        """
        ticket = str(uuid.uuid4())
        value = f"{user_id}:{agency_id}"
        redis_client = await self.get_redis()

        if redis_client:
            try:
                await redis_client.setex(f"ws_ticket:{ticket}", ttl_seconds, value)
                return ticket
            except RedisError as e:
                logger.warning("Failed to store ticket in Redis: %s. Using in-memory fallback.", e)

        # In-memory TTL fallback
        now = time.time()
        self._purge_expired_tickets(now)
        self._fallback_tickets[ticket] = (value, now + ttl_seconds)
        return ticket

    async def consume_ticket(self, ticket: str) -> Optional[tuple[uuid.UUID, uuid.UUID]]:
        """
        Atomically validates and consumes the ticket via GETDEL (or in-memory pop).
        Returns (user_id, agency_id) if valid, or None if expired/not found.
        """
        if not ticket:
            return None

        redis_client = await self.get_redis()
        value: Optional[str] = None

        if redis_client:
            try:
                # Redis 6.2+ atomic GETDEL
                value = await redis_client.getdel(f"ws_ticket:{ticket}")
            except RedisError as e:
                logger.warning("Failed to getdel ticket from Redis: %s. Checking fallback.", e)
                value = None

        if value is None:
            # Check in-memory fallback
            now = time.time()
            if ticket in self._fallback_tickets:
                val, expires_at = self._fallback_tickets.pop(ticket)
                if now <= expires_at:
                    value = val

        if not value:
            return None

        try:
            parts = value.split(":")
            if len(parts) == 2:
                return uuid.UUID(parts[0]), uuid.UUID(parts[1])
        except (ValueError, TypeError):
            logger.error("Malformed ticket value in cache: %s", value)

        return None

    def _purge_expired_tickets(self, now: float) -> None:
        """Clean up expired tickets from in-memory dictionary."""
        expired = [k for k, (_, exp) in self._fallback_tickets.items() if exp < now]
        for k in expired:
            self._fallback_tickets.pop(k, None)

    # ──────────────────────────────────────────────────────────────────────────
    # Connection Management
    # ──────────────────────────────────────────────────────────────────────────
    async def connect(self, agency_id: uuid.UUID, websocket: WebSocket) -> None:
        """Register an accepted WebSocket into the agency's connection pool."""
        async with self._lock:
            if agency_id not in self.active_connections:
                self.active_connections[agency_id] = set()
            self.active_connections[agency_id].add(websocket)
        logger.debug("WS client connected for agency %s (total: %d)", agency_id, len(self.active_connections[agency_id]))

    async def disconnect(self, agency_id: uuid.UUID, websocket: WebSocket) -> None:
        """Remove a WebSocket connection from the agency's pool."""
        async with self._lock:
            if agency_id in self.active_connections:
                self.active_connections[agency_id].discard(websocket)
                if not self.active_connections[agency_id]:
                    del self.active_connections[agency_id]
        logger.debug("WS client disconnected for agency %s", agency_id)

    # ──────────────────────────────────────────────────────────────────────────
    # Broadcasting (Cross-Process Pub/Sub + Concurrent Fan-Out)
    # ──────────────────────────────────────────────────────────────────────────
    async def broadcast_to_agency(
        self,
        agency_id: uuid.UUID,
        event: AgencyWSEvent | str,
        data: Dict[str, Any],
    ) -> None:
        """
        Broadcasts a standardized event envelope to all active agency connections.
        Publishes to Redis for multi-worker fanout, with local concurrent fallback.
        """
        event_name = event.value if isinstance(event, AgencyWSEvent) else str(event)
        payload = {
            "event": event_name,
            "agency_id": str(agency_id),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": data,
        }

        redis_client = await self.get_redis()
        published_to_redis = False

        if redis_client:
            try:
                channel = f"agency_ws:{agency_id}"
                await redis_client.publish(channel, json.dumps(payload))
                published_to_redis = True
            except RedisError as e:
                logger.warning("Redis publish failed: %s. Falling back to local fanout.", e)

        # If Redis was not used or failed, fan out locally
        if not published_to_redis:
            await self._local_fanout(agency_id, payload)

    async def _local_fanout(self, agency_id: uuid.UUID, payload: Dict[str, Any]) -> None:
        """
        Concurrently sends payload to all local sockets in the agency pool
        and safely evicts dead/disconnected sockets in a single pass.
        """
        sockets: list[WebSocket] = []
        async with self._lock:
            if agency_id in self.active_connections:
                sockets = list(self.active_connections[agency_id])

        if not sockets:
            return

        # Concurrent broadcast across all agency sockets
        results = await asyncio.gather(
            *(ws.send_json(payload) for ws in sockets),
            return_exceptions=True,
        )

        # Evict dead sockets safely
        dead_sockets = []
        for ws, res in zip(sockets, results):
            if isinstance(res, Exception):
                dead_sockets.append(ws)

        if dead_sockets:
            async with self._lock:
                if agency_id in self.active_connections:
                    for ws in dead_sockets:
                        self.active_connections[agency_id].discard(ws)
                    if not self.active_connections[agency_id]:
                        del self.active_connections[agency_id]
            logger.debug("Pruned %d dead WebSocket connections for agency %s", len(dead_sockets), agency_id)

    # ──────────────────────────────────────────────────────────────────────────
    # Background Redis Pub/Sub Listener Task (Worker Lifespan)
    # ──────────────────────────────────────────────────────────────────────────
    async def run_redis_listener(self, stop_event: asyncio.Event) -> None:
        """
        Runs the Redis Pub/Sub listener loop with auto-reconnect and clean shutdown.
        Subscribes to 'agency_ws:*' and dispatches received messages locally.
        """
        logger.info("Starting Redis WebSocket Pub/Sub listener task...")
        if not HAS_REDIS:
            logger.info("Redis package not installed. Skipping Redis Pub/Sub listener task.")
            return
        while not stop_event.is_set():
            try:
                redis_client = await self.get_redis()
                if not redis_client:
                    # Redis not available yet, wait 30s before probing again
                    try:
                        await asyncio.sleep(30.0)
                    except asyncio.CancelledError:
                        break
                    continue

                pubsub = redis_client.pubsub()
                await pubsub.psubscribe("agency_ws:*")
                logger.info("Subscribed to Redis channel pattern 'agency_ws:*'")

                while not stop_event.is_set():
                    try:
                        # Non-blocking get_message with timeout to observe stop_event
                        message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                        if message and message.get("type") == "pmessage":
                            data_str = message.get("data")
                            if data_str:
                                payload = json.loads(data_str)
                                agency_str = payload.get("agency_id")
                                if agency_str:
                                    agency_id = uuid.UUID(agency_str)
                                    await self._local_fanout(agency_id, payload)
                    except asyncio.TimeoutError:
                        continue
                    except asyncio.CancelledError:
                        raise
                    except (RedisError, json.JSONDecodeError, Exception) as inner_err:
                        logger.warning("Error processing Redis pub/sub message: %s", inner_err)
                        await asyncio.sleep(0.5)

            except asyncio.CancelledError:
                logger.info("Redis WebSocket listener task received cancellation.")
                break
            except Exception as e:
                if stop_event.is_set():
                    break
                logger.warning("Redis Pub/Sub subscription dropped (%s). Reconnecting in 2s...", e)
                self._redis = None
                self._redis_available = False
                try:
                    await asyncio.sleep(2.0)
                except asyncio.CancelledError:
                    break

        logger.info("Redis WebSocket Pub/Sub listener terminated cleanly.")


# Singleton instance
ws_manager = WebSocketManager()
