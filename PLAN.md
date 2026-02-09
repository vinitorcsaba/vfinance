# vfinance MVP — Portfolio Tracker Web App

## Context

vfinance is currently a single Python script (`tracker.py`) that fetches BET Index stock prices via yfinance. The goal is to evolve it into a full portfolio tracker web app for local usage that:

- Tracks international and Romanian stock holdings (ticker + shares → live value)
- Supports manual holdings (e.g., real estate) with user-provided values
- Exports portfolio snapshots to Google Sheets (manual + automatic monthly)
- Is web-only for MVP but mobile-friendly (future React Native / PWA possible)

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Backend | **FastAPI** (Python) | Natural extension of existing yfinance code, async, auto-generated API docs |
| Database | **SQLite** via SQLAlchemy + Alembic | Zero config for local usage, swap to Postgres later with one connection string change |
| Frontend | **React + Vite + TypeScript** | Fast builds, clean separation from API, future mobile code sharing |
| UI | **Shadcn/ui + Tailwind CSS** | Owned components, responsive out of the box |
| Charts | **Recharts** | Lightweight React charting |
| Sheets Export | **gspread** + Google Service Account | No OAuth flow needed for single-user local app |
| Scheduling | **APScheduler 3.x** | In-process cron, cross-platform, no external deps |

## Data Model

**`stock_holdings`** — ticker (unique), shares (float), display_name, timestamps

**`manual_holdings`** — name, value, currency (RON/EUR/USD), timestamps

**`snapshots`** — taken_at, total_value_ron, exported_to_sheets flag, sheets_url

**`snapshot_items`** — FK to snapshot, denormalized holding data (type, name, shares, price, value, currency)

Snapshots denormalize intentionally — they preserve point-in-time data even if holdings are later deleted.

## API Endpoints (`/api/v1`)

| Endpoint | Purpose |
|----------|---------|
| `CRUD /holdings/stocks` | Add/edit/delete stock holdings (ticker + shares) |
| `CRUD /holdings/manual` | Add/edit/delete manual holdings (name + value + currency) |
| `GET /portfolio` | Dashboard: all holdings with live prices, totals by currency, total in RON |
| `GET /prices/lookup?ticker=X` | Validate ticker + get current price (for add form) |
| `POST /snapshots` | Create point-in-time snapshot |
| `GET /snapshots` | List snapshot history |
| `POST /export/sheets` | One-click: snapshot + export to Google Sheets |

The `/portfolio` endpoint is the only one that calls Yahoo Finance (batch fetch via `yfinance.download()`). All CRUD endpoints are pure DB ops.

## Project Structure

```
vfinance/
├── backend/
│   ├── requirements.txt
│   ├── alembic.ini + alembic/
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, lifespan (scheduler)
│   │   ├── config.py            # pydantic-settings
│   │   ├── database.py          # SQLAlchemy engine + session
│   │   ├── models/              # ORM models (holding.py, snapshot.py)
│   │   ├── schemas/             # Pydantic schemas
│   │   ├── routers/             # API routes (holdings, portfolio, snapshots)
│   │   └── services/            # Business logic (price, sheets, scheduler)
│   └── tracker.py               # Original script preserved
├── frontend/
│   ├── src/
│   │   ├── api/                 # API client functions
│   │   ├── components/          # HoldingForm, HoldingsTable, PortfolioSummary, Chart
│   │   ├── pages/               # Dashboard.tsx
│   │   └── types/               # TypeScript interfaces
│   └── vite.config.ts           # Proxy /api → localhost:8000
├── data/                        # SQLite DB (gitignored)
├── .env.example
└── README.md
```

## Implementation Tickets

| # | Title | Priority | Description |
|---|-------|----------|-------------|
| 1 | Project scaffolding | High | Create monorepo structure, install deps (FastAPI, React+Vite+TS, Tailwind, Shadcn/ui), configure Vite proxy, minimal health endpoint |
| 2 | Database setup + ORM models | High | SQLAlchemy models for all 4 tables, Alembic init + first migration, pydantic-settings config |
| 3 | Holdings CRUD API | High | All 8 REST endpoints for stock + manual holdings with Pydantic validation |
| 4 | Price service (yfinance wrapper) | High | Batch price fetching, single-ticker lookup, 60s in-memory cache, graceful error handling |
| 5 | Portfolio dashboard API | High | `/portfolio` endpoint: fetch prices, calculate values, aggregate totals by currency, convert to RON via FX rates |
| 6 | Frontend — Holdings management UI | High | Add/edit/delete forms for stock + manual holdings, responsive table, ticker validation |
| 7 | Frontend — Dashboard page | High | Portfolio summary card, Recharts pie chart, holdings table, refresh button, React Query for data fetching |
| 8 | Snapshot creation + history API | Medium | Snapshot endpoints (create, list, get), denormalized point-in-time records |
| 9 | Google Sheets export | Medium | gspread + service account auth, export snapshot as new worksheet, one-click export button in UI |
| 10 | Automatic monthly export | Low | APScheduler cron job (last day of month, 18:00), runs in-process during app lifespan |
| 11 | Polish + dev experience | Low | README with setup guide, single launch script (run.bat), .env.example, error handling UI |

## Phase 2 — UX Improvements & Features

| # | Ticket | Title | Priority | Description |
|---|--------|-------|----------|-------------|
| 12 | FIN-13 | DigitalOcean Spaces cloud backup | Medium | Backup SQLite DB to DO Spaces on snapshot creation, download on startup if local DB missing |
| 13 | FIN-14 | Handle Spaces 403 on missing object | Medium | Gracefully handle 403 errors from DO Spaces when object doesn't exist |
| 14 | FIN-15 | Currency field on stock holding dialog | Medium | Show auto-fetched currency as editable dropdown in stock dialog; no migration needed |
| 15 | FIN-16 | Add shares/value to existing holdings | Medium | "+" button on holding rows to increment shares/value instead of editing; new API endpoints |
| 16 | FIN-17 | Labels system for holdings | Medium | ✅ Create/assign labels for categorization; new Label model + junction tables; migration required |
| 17 | FIN-18 | Dashboard currency selector and grouping | Medium | ✅ Choose display currency for totals/charts, group by currency toggle; frontend-only |
| 18 | FIN-22 | Allocation chart by currency/label + more colors | Medium | ✅ Pie chart view modes (by holding / by currency), label filtering on chart, expanded color palette (16 colors); frontend-only |
| 19 | FIN-23 | Stock search by name | Medium | ✅ Search stocks by company name via yfinance Search API; dropdown results in add-stock dialog with keyboard navigation; auto-fills ticker/currency/name |
| 20 | FIN-25 | Dashboard improvements | Medium | ✅ Ticker on pie chart, AND label filter, remove Type column, better label highlight states, filtered total display, custom legend with percentages; frontend-only |

Implementation order: FIN-15 → FIN-16 → FIN-17 → FIN-18 → FIN-22 → FIN-23 → FIN-25 (sequenced to avoid merge conflicts in shared files).

## Key Design Decisions

- **Service Account** (not OAuth) for Google Sheets — download JSON key once, share sheet with service account email, done
- **In-memory price cache** (60s TTL) — no Redis, keeps it simple for single-user local usage
- **APScheduler in-process** — runs only while the app is running; manual export is always available as fallback
- **FastAPI serves built frontend** — `npm run build` → FastAPI mounts `dist/` as static files → single `uvicorn` command runs everything
