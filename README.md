# AgencyOS

A workflow and delivery-management platform for social media agencies.

## Quick Start (Local Dev)

### 1. Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for PostgreSQL + MinIO)
- [Python 3.11+](https://www.python.org/)
- [Node.js 20+](https://nodejs.org/)

### 2. Start Infrastructure (Database + File Storage)
```bash
docker-compose up -d
```

This starts:
- **PostgreSQL 16** on `localhost:5432`
- **pgAdmin** (DB GUI) on `http://localhost:5050` (admin@agencyos.local / admin)
- **MinIO** (S3-compatible storage) on `http://localhost:9000`, console on `http://localhost:9001`

### 3. Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate      # Windows
# source venv/bin/activate # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Copy env file
copy .env.example .env
# Edit .env and add your GROQ_API_KEY

# Run database migrations
alembic upgrade head

# Start the API server
uvicorn app.main:app --reload --port 8000
```

API docs available at: http://localhost:8000/docs

### 4. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

Frontend available at: http://localhost:3000

---

## Project Structure

```
agencyos/
├── backend/          # FastAPI + SQLAlchemy backend
├── frontend/         # Next.js + TypeScript frontend
├── docker-compose.yml
└── README.md
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router) + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Backend | FastAPI (Python 3.11) |
| ORM | SQLAlchemy 2 + Alembic |
| Database | PostgreSQL 16 |
| AI | LangGraph + Groq |
| Auth | JWT + bcrypt (python-jose + passlib) |
| File Storage | MinIO (local) / S3-compatible |

## User Roles

| Role | Description |
|------|-------------|
| `owner` | Agency owner — full access |
| `account_manager` | Manages assigned clients |
| `strategist` | Plans campaigns and creates briefs |
| `designer` | Sees assigned tasks and uploads work |
| `client` | Reviews and approves deliverables only |
