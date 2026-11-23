from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
import logging

logger = logging.getLogger(__name__)

from app.core.config import settings
from app.core.database import async_engine, Base, AsyncSessionLocal
from app.services.scheduler_coordinator import run_scheduler_worker
from app.routers import (
    agencies,
    analytics,
    approvals,
    auth,
    campaigns,
    clients,
    deliverables,
    engagement,
    operational_workflows,
    portal,
    publishing,
    review,
    social,
    tasks,
    cortex,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Auto-create tables on startup only for local SQLite databases.
    # Remote PostgreSQL (Neon) uses pre-provisioned schemas / migrations.
    if "sqlite" in str(async_engine.url):
        async with async_engine.begin() as conn:
            from app import models as _models  # noqa: F401
            await conn.run_sync(Base.metadata.create_all)
    # Ensure upload directory exists
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)

    # Start background scheduler worker
    scheduler_stop_event = asyncio.Event()
    scheduler_task = asyncio.create_task(
        run_scheduler_worker(AsyncSessionLocal, stop_event=scheduler_stop_event)
    )
    app.state.scheduler_task = scheduler_task
    app.state.scheduler_stop_event = scheduler_stop_event

    yield

    # Stop scheduler background worker on shutdown
    scheduler_stop_event.set()
    scheduler_task.cancel()
    try:
        await scheduler_task
    except (asyncio.CancelledError, Exception):
        pass

    # Dispose the engine on shutdown
    await async_engine.dispose()


app = FastAPI(
    title="AgencyOS API",
    description="Multi-tenant SaaS backend for social media agencies.",
    version="1.0.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled server exception on %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": f"Internal Server Error: {str(exc)}"},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        },
    )

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(auth.router)
app.include_router(agencies.router)
app.include_router(clients.router)
app.include_router(campaigns.router)
app.include_router(tasks.router)
app.include_router(approvals.router)
app.include_router(deliverables.router)
app.include_router(portal.router)
app.include_router(social.router)
app.include_router(publishing.router)
app.include_router(analytics.router)
app.include_router(engagement.router)
app.include_router(review.router)
app.include_router(operational_workflows.router)
app.include_router(cortex.router)

# ---------------------------------------------------------------------------
# Static file serving for uploads
# ---------------------------------------------------------------------------
upload_path = Path(settings.UPLOAD_DIR)
upload_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(upload_path)), name="uploads")


# ---------------------------------------------------------------------------
# Health checks
# ---------------------------------------------------------------------------
@app.get("/health", tags=["meta"])
async def health_check() -> dict:
    """Lightweight liveness probe."""
    return {"status": "ok", "env": settings.APP_ENV}


@app.get("/healthz", tags=["meta"])
async def readiness_health_check(request: Request, response: Response) -> dict:
    """
    Comprehensive readiness check verifying database connectivity,
    object storage availability, and background scheduler worker status.
    Returns HTTP 200 when ready, HTTP 503 if primary dependencies fail.
    """
    db_status = "healthy"
    db_details = {}
    try:
        async with async_engine.connect() as conn:
            res = await conn.execute(text("SELECT 1"))
            val = res.scalar()
            db_details["connected"] = (val == 1)
            db_details["engine"] = "postgresql" if "postgresql" in str(async_engine.url) else "sqlite"
    except Exception as e:
        db_status = "unhealthy"
        db_details["connected"] = False
        db_details["error"] = str(e)

    storage_status = "healthy"
    storage_details = {}
    try:
        from app.services.storage_service import (
            _get_boto3_client,
            _get_bucket_name,
            is_remote_storage_active,
        )
        if is_remote_storage_active():
            storage_details["backend"] = settings.STORAGE_BACKEND
            storage_details["bucket"] = _get_bucket_name()
            s3 = _get_boto3_client()
            if s3:
                # Test connectivity to B2 / S3
                await asyncio.to_thread(s3.head_bucket, Bucket=_get_bucket_name())
                storage_details["remote_reachable"] = True
            else:
                storage_status = "degraded"
                storage_details["remote_reachable"] = False
        else:
            storage_details["backend"] = "local"
            storage_details["upload_dir_exists"] = Path(settings.UPLOAD_DIR).is_dir()
    except Exception as e:
        storage_status = "degraded"
        storage_details["remote_reachable"] = False
        storage_details["error"] = str(e)

    scheduler_task = getattr(request.app.state, "scheduler_task", None)
    scheduler_running = scheduler_task is not None and not scheduler_task.done()
    scheduler_status = "running" if scheduler_running else "stopped"

    overall_healthy = (db_status == "healthy")
    if not overall_healthy:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {
        "status": "healthy" if overall_healthy else "unhealthy",
        "environment": settings.APP_ENV,
        "database": {
            "status": db_status,
            **db_details,
        },
        "storage": {
            "status": storage_status,
            **storage_details,
        },
        "scheduler": {
            "status": scheduler_status,
        },
    }
