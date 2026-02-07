# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VFinance is a portfolio tracker web app for BET Index (Bucharest Stock Exchange) and international stocks. It evolved from a single-file script (`tracker.py`) into a monorepo with a FastAPI backend and React frontend. See `PLAN.md` for the full implementation plan and ticket breakdown.

## Commands

### Backend
```bash
# Activate venv (Windows)
venv\Scripts\activate

# Install dependencies
pip install -r backend/requirements.txt

# Run backend dev server
uvicorn backend.app.main:app --reload

# Run from project root — module path is backend.app.main:app
```

### Frontend
```bash
cd frontend
npm install
npm run dev      # Dev server at localhost:5173 (proxies /api → localhost:8000)
npm run build    # TypeScript check + Vite build → frontend/dist/
npm run lint     # ESLint
```

### Docker (single-host production)
```bash
docker build -t vfinance .
docker run -p 8000:8000 -v vfinance-data:/app/data vfinance
```

## Architecture

**Monorepo**: `backend/` (Python/FastAPI) + `frontend/` (React/Vite/TypeScript)

**Single-process production**: FastAPI serves the built React SPA from `frontend/dist/` as static files. The `main.py` mounts `StaticFiles(directory=..., html=True)` at `/` — this must stay as the **last** mount so API routes take priority.

**API pattern**: All API routes live under `/api/v1`. Vite dev server proxies `/api` to `localhost:8000` so frontend code always uses relative paths like `/api/v1/...`.

**Database**: SQLite at `data/vfinance.db` (gitignored). SQLAlchemy ORM + Alembic migrations (not yet scaffolded). The `data/` directory is created automatically. Config via `pydantic-settings` in `backend/app/config.py`, reads from `.env`.

**Key directories**:
- `backend/app/models/` — SQLAlchemy ORM models
- `backend/app/schemas/` — Pydantic request/response schemas
- `backend/app/routers/` — FastAPI route handlers
- `backend/app/services/` — Business logic (price fetching, sheets export, scheduler)
- `frontend/src/` — React app, `@/` alias maps to `src/`

**UI stack**: Shadcn/ui components + Tailwind CSS v4 (uses `@tailwindcss/vite` plugin, not PostCSS). Path alias `@/*` → `src/*` configured in both `vite.config.ts` and `tsconfig.json`.

## Conventions

- Backend imports use `backend.app.*` when running from project root, but `app.*` within backend code (see `database.py` importing `app.config`)
- CORS allows `localhost:5173` only — production same-origin requests bypass CORS
- Snapshots denormalize holding data intentionally to preserve point-in-time records
- SQLite `check_same_thread=False` is set since FastAPI is async
