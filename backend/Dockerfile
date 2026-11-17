# ==============================================================================
# AgencyOS Backend - Production Multi-Stage Dockerfile
# ==============================================================================

# Stage 1: Build & Dependencies
FROM python:3.11-slim AS builder

WORKDIR /build

# Install build dependencies for C-extensions (psycopg2, asyncpg, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# ------------------------------------------------------------------------------
# Stage 2: Production Runtime
# ------------------------------------------------------------------------------
FROM python:3.11-slim AS runner

WORKDIR /app

# Install runtime PostgreSQL client libraries and curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create unprivileged application user
RUN groupadd -g 1001 appgroup && \
    useradd -u 1001 -g appgroup -m -s /bin/bash appuser

# Copy installed python packages from builder
COPY --from=builder /root/.local /home/appuser/.local

# Ensure local user path is on PATH
ENV PATH=/home/appuser/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    APP_ENV=production \
    PORT=8000

# Copy application source code
COPY --chown=appuser:appgroup alembic.ini ./
COPY --chown=appuser:appgroup alembic ./alembic
COPY --chown=appuser:appgroup app ./app
COPY --chown=appuser:appgroup scripts ./scripts

# Ensure uploads directory exists and is writable
RUN mkdir -p /app/uploads && chown -R appuser:appgroup /app

USER appuser

EXPOSE 8000

# Container healthcheck using the liveness endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Production WSGI/ASGI entrypoint: Gunicorn orchestrating async Uvicorn workers
CMD ["gunicorn", "app.main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000", "--access-logfile", "-", "--error-logfile", "-"]
