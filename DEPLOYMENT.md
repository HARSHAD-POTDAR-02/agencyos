# AgencyOS Production Deployment Guide

AgencyOS is a multi-tenant SaaS platform built for high-scale creative agencies, featuring an AI Campaign Studio, client approval portal, collaborative review, and automated Meta (Instagram & Facebook) publication engine.

---

## Architecture Overview

```
                          ┌───────────────────────────┐
                          │   Client / Browser        │
                          └─────────────┬─────────────┘
                                        │ HTTPS
                                        ▼
                          ┌───────────────────────────┐
                          │   Next.js 16 Frontend     │
                          │   (Standalone Node 20)    │
                          └─────────────┬─────────────┘
                                        │ JSON API
                                        ▼
                          ┌───────────────────────────┐
                          │   FastAPI Backend         │
                          │   (Gunicorn + Uvicorn)    │
                          └───┬───────────────────┬───┘
                              │                   │
                  PostgreSQL  │                   │ S3 Presigned URLs
                              ▼                   ▼
    ┌───────────────────────────┐       ┌───────────────────────────┐
    │   Neon Serverless Postgres│       │   Backblaze B2 Storage    │
    │   (PgBouncer Pooled)      │       │   (agencyos-bucket)       │
    └───────────────────────────┘       └───────────────────────────┘
```

- **Frontend**: Next.js 16 (App Router, Tailwind CSS, Partial Prerendering, Standalone Docker container).
- **Backend**: FastAPI with async SQLAlchemy 2.0 and Gunicorn worker supervisor.
- **Database**: Neon Serverless PostgreSQL with connection pooling (`-pooler`).
- **Object Storage**: Backblaze B2 (S3-compatible API, private bucket with 24-hour HTTPS presigned URLs).
- **Background Engine**: Autonomous leased scheduler with `FOR UPDATE SKIP LOCKED` distributed worker locks.

---

## Quickstart: Docker Compose Deployment

### 1. Configure Environment
Copy `.env.example` to `.env` in the repository root:
```bash
cp .env.example .env
```

Ensure your credentials are set:
```ini
# Neon PostgreSQL
DATABASE_URL=postgresql+asyncpg://neondb_owner:<password>@<neon-pooler-host>/neondb?ssl=require
SYNC_DATABASE_URL=postgresql://neondb_owner:<password>@<neon-pooler-host>/neondb?sslmode=require

# Backblaze B2
STORAGE_BACKEND=b2
B2_ENDPOINT=https://s3.us-east-005.backblazeb2.com
B2_KEY_ID=005<account-id>0000000001
B2_APPLICATION_KEY=<application-key>
B2_BUCKET_NAME=agencyos-bucket
B2_REGION=us-east-005

# JWT Secret
SECRET_KEY=<32-char-hex-secret>
```

### 2. Launch Services
```bash
docker compose -f docker-compose.prod.yml up --build -d
```

### 3. Seed Production Demo Data (Optional)
Run the idempotent enterprise seed script inside the backend container:
```bash
docker compose -f docker-compose.prod.yml exec backend python scripts/seed_production_demo.py
```

Demo Credentials created:
- **Admin**: `admin@agencyos.io` / `Admin1234!`
- **Strategist**: `director@agencyos.io` / `Director1234!`
- **Account Manager**: `manager@agencyos.io` / `Manager1234!`

---

## Cloud Platform Deployments

### Option A: Railway
1. **Create Project**: Connect your GitHub repository.
2. **Add Backend Service**:
   - Set root directory to `backend`.
   - Set build command to `pip install -r requirements.txt`.
   - Set start command to `gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:$PORT`.
   - Add environment variables from `backend/.env.example`.
3. **Add Frontend Service**:
   - Set root directory to `frontend`.
   - Set build command to `npm ci && npm run build`.
   - Set start command to `node .next/standalone/server.js` or `npm start`.
   - Set `NEXT_PUBLIC_API_URL` to your Railway backend URL.

### Option B: Render
1. Deploy `backend` as a **Web Service** (Docker or Python 3.11 environment).
   - Health check path: `/healthz`.
2. Deploy `frontend` as a **Web Service** (Node 20 environment).
   - Build command: `npm ci && npm run build`.
   - Start command: `node server.js` (from `.next/standalone`).

### Option C: Vercel (Frontend) + Cloud Run / AWS ECS (Backend)
1. Deploy the `frontend` folder directly to Vercel. Set `NEXT_PUBLIC_API_URL` in Vercel project settings.
2. Build and push `backend/Dockerfile` to AWS ECR or Google Artifact Registry, then run as a managed container.

---

## Pre-Flight Health Checks & Monitoring

The system exposes two standard health endpoints:

### 1. Liveness Probe: `GET /health`
Fast, lightweight check for reverse proxies and ingress controllers:
```json
{
  "status": "ok",
  "env": "production"
}
```

### 2. Readiness Probe: `GET /healthz`
Deep verification probe checking all system dependencies:
```json
{
  "status": "healthy",
  "environment": "production",
  "database": {
    "status": "healthy",
    "connected": true,
    "engine": "postgresql"
  },
  "storage": {
    "status": "healthy",
    "backend": "b2",
    "bucket": "agencyos-bucket",
    "remote_reachable": true
  },
  "scheduler": {
    "status": "running"
  }
}
```
*Returns HTTP 200 when ready; HTTP 503 if primary dependencies fail.*

---

## Production Security Checklist
- [x] Passwords hashed with `bcrypt` (work factor 12).
- [x] Multi-tenant isolation verified with tenant matching guards across all resources.
- [x] Database queries use parameterized SQLAlchemy statements.
- [x] Private Backblaze B2 bucket secured via 24-hour presigned HTTPS URLs (no public bucket exposure).
- [x] Non-root user execution inside Docker containers (`appuser` UID 1001, `nextjs` UID 1001).
- [x] Domain-agnostic constraints verified across all production code, seed scripts, and test suites.
