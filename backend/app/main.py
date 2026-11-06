from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.database import async_engine, Base
from app.routers import (
    agencies,
    approvals,
    auth,
    campaigns,
    clients,
    deliverables,
    portal,
    publishing,
    social,
    tasks,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Dev-only: create all tables on startup if they don't exist.
    # Production should use Alembic migrations instead.
    if settings.APP_ENV == "development":
        async with async_engine.begin() as conn:
            # Import all models to ensure they are registered on metadata
            import app.models  # noqa: F401
            await conn.run_sync(Base.metadata.create_all)
    # Ensure upload directory exists
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    yield
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
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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

# ---------------------------------------------------------------------------
# Static file serving for uploads
# ---------------------------------------------------------------------------
upload_path = Path(settings.UPLOAD_DIR)
upload_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(upload_path)), name="uploads")


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health", tags=["meta"])
async def health_check() -> dict:
    """Liveness probe."""
    return {"status": "ok", "env": settings.APP_ENV}
