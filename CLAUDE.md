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

**Database**: SQLite at `data/vfinance.db` (gitignored). SQLAlchemy ORM + Alembic migrations in `backend/alembic/`. The `data/` directory is created automatically. Config via `pydantic-settings` in `backend/app/config.py`, reads from `.env`.

**ORM Models** (in `backend/app/models/`):
- `StockHolding` — ticker (unique), shares (float), currency, display_name, timestamps; has `labels` relationship
- `ManualHolding` — name, value (float), currency (RON/EUR/USD), timestamps; has `labels` relationship
- `Label` — name (unique, max 50), color (hex, nullable), created_at; linked via junction tables
- `Snapshot` — taken_at, total_value_ron, exported_to_sheets, sheets_url; has `items` relationship
- `SnapshotItem` — FK to snapshot, holding_type, ticker (nullable), name, labels (JSON string), shares, price, value, currency, value_ron
- `User` — google_id, email, name, picture_url, google_access_token, google_refresh_token, sheets_spreadsheet_id, timestamps

**Alembic**: Config in `backend/alembic.ini`, `env.py` reads DB URL from `app.config.settings`. Run migrations from project root: `python -m alembic -c backend/alembic.ini upgrade head`

**Key directories**:
- `backend/app/models/` — SQLAlchemy ORM models
- `backend/app/schemas/` — Pydantic request/response schemas
- `backend/app/routers/` — FastAPI route handlers (`holdings`, `portfolio`, `snapshots`, `labels`, `prices`)
- `backend/app/services/` — Business logic (price fetching, sheets export, scheduler)
- `frontend/src/` — React app, `@/` alias maps to `src/`

**Labels system** (FIN-17): `Label` model with junction tables (`stock_holding_labels`, `manual_holding_labels`). Labels router provides CRUD at `/api/v1/labels` and assignment at `/api/v1/holdings/stocks/{id}/labels` and `/api/v1/holdings/manual/{id}/labels`. Holdings eagerly load labels via `lazy="selectin"`. Frontend has `LabelManager` (collapsible CRUD section on Holdings page) and `LabelAssignPopover` (per-row label assignment).

**Currency selector** (FIN-18): Dashboard has a currency dropdown that converts all displayed values from RON to the selected currency using `fx_rates` from the portfolio API. A "Group" toggle groups the holdings table by native currency with subtotal rows. Both preferences persist in `localStorage`.

**Allocation chart modes** (FIN-22): Dashboard pie chart has a "By Holding" / "By Currency" / "By Label" toggle. Currency mode aggregates holdings by currency with a fixed color palette. Label mode aggregates holdings by their labels, splitting value proportionally for holdings with multiple labels. When label filter is active, chart shows only selected labels. Label color palette expanded to 16 preset colors shown in an 8-column grid.

**Dashboard improvements** (FIN-25): Pie chart shows ticker symbols instead of full names for stocks. Label filter uses AND logic (holdings must match all selected labels). Type column removed from holdings table. Selected label badges have ring + scale highlighting; unselected ones go grayscale. Filtered total shown below chart when labels are active. Custom color-coded legend with percentages replaces Recharts default Legend.

**Google Sheets export via user OAuth** (FIN-31): Replaced service-account-based export with user's own Google OAuth credentials. Progressive consent flow: "Connect Google Sheets" button triggers `google.accounts.oauth2.initCodeClient()` requesting `spreadsheets` + `drive.file` scopes. Backend exchanges auth code for access/refresh tokens stored on User. Auto-creates "VFinance Snapshots" spreadsheet in user's Drive on first export. Token auto-refresh via `google.oauth2.credentials.Credentials`. Auth endpoints: `POST /connect-sheets`, `POST /disconnect-sheets`. `UserResponse` includes `sheets_connected: bool`.

**Stock search by name** (FIN-23): The "Add Stock" dialog accepts company names (e.g. "Banca Transilvania") in addition to ticker symbols. The search button triggers `yfinance.Search()` for name queries or direct ticker lookup for exact symbols. Results appear in a dropdown with keyboard navigation (arrows + Enter/Escape). Selecting a result auto-fills ticker, currency, and display name. Backend endpoint: `GET /api/v1/prices/search?q=...` returns `list[StockSearchResult]`.

**Snapshot deletion**: Snapshots can be deleted via trash icon button with confirmation dialog. Backend endpoint: `DELETE /api/v1/snapshots/{id}` (returns 204). Cascade deletes all snapshot items. Frontend uses `AlertDialog` component for confirmation popup.

**Digital Ocean deployment**: `.do/app.yaml` configures automatic deployments with PRE_DEPLOY job that runs `alembic upgrade head` before each deployment. Dockerfile CMD also includes migrations as fallback. Environment variables: `VITE_GOOGLE_CLIENT_ID` (build-time), `SECRET_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (runtime).

**UI stack**: Shadcn/ui components + Tailwind CSS v4 (uses `@tailwindcss/vite` plugin, not PostCSS). Path alias `@/*` → `src/*` configured in both `vite.config.ts` and `tsconfig.json`.

## Conventions

- Backend imports use `backend.app.*` when running from project root, but `app.*` within backend code (see `database.py` importing `app.config`)
- CORS allows `localhost:5173` only — production same-origin requests bypass CORS
- Snapshots denormalize holding data intentionally to preserve point-in-time records
- SQLite `check_same_thread=False` is set since FastAPI is async
