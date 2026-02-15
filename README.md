# VFinance

A modern, mobile-responsive portfolio tracker web application for managing investments in BET Index (Bucharest Stock Exchange) and international stocks.

## Features

- 📱 **Fully Mobile Responsive** - Optimized for all screen sizes from phones to desktops
- 📊 **Portfolio Tracking** - Track stocks and manual holdings with real-time price updates
- 🏷️ **Label System** - Organize holdings with custom labels and colors
- 📈 **Portfolio Charts** - Visualize allocation by holding, currency, or label
- 📸 **Snapshots** - Automatic monthly snapshots with historical value tracking
- 🔄 **Multi-Currency** - Support for RON, EUR, and USD with live conversion
- 📑 **Google Sheets Export** - Export snapshots to your Google Drive
- 🔍 **Stock Search** - Search by company name or ticker symbol
- 📅 **Transaction History** - Track buy/sell transactions for each holding
- 👤 **User Isolation** - Per-user databases with Google OAuth authentication

## Tech Stack

### Backend
- **FastAPI** - Modern Python web framework
- **SQLAlchemy** - ORM with Alembic migrations
- **SQLite** - Per-user database files
- **yfinance** - Real-time stock price data
- **APScheduler** - Automated monthly snapshots

### Frontend
- **React 18** - Modern UI framework
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool
- **Tailwind CSS v4** - Utility-first styling
- **Shadcn/ui** - Beautiful, accessible components
- **Recharts** - Interactive charts
- **Radix UI** - Headless UI primitives

## Quick Start

### Prerequisites
- Python 3.9+
- Node.js 18+
- Git

### Backend Setup

```bash
# Create and activate virtual environment (Windows)
python -m venv venv
venv\Scripts\activate

# Install dependencies
pip install -r backend/requirements.txt

# Run migrations
python -m alembic -c backend/alembic.ini upgrade head

# Start backend server
uvicorn backend.app.main:app --reload
```

Server runs at `http://localhost:8000`

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend runs at `http://localhost:5173`

### Docker

```bash
# Build image
docker build -t vfinance .

# Run container
docker run -p 8000:8000 -v vfinance-data:/app/data vfinance
```

## Environment Variables

Create a `.env` file in the project root:

```env
SECRET_KEY=your-secret-key-here
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

Frontend build-time variable:
```env
VITE_GOOGLE_CLIENT_ID=your-google-client-id
```

## Project Structure

```
vfinance/
├── backend/
│   ├── alembic/          # Database migrations
│   ├── app/
│   │   ├── models/       # SQLAlchemy ORM models
│   │   ├── schemas/      # Pydantic schemas
│   │   ├── routers/      # API endpoints
│   │   └── services/     # Business logic
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/        # Page components
│   │   ├── components/   # Reusable components
│   │   ├── api/          # API client functions
│   │   └── types/        # TypeScript types
│   ├── package.json
│   └── vite.config.ts
├── data/                 # Per-user SQLite databases (gitignored)
├── CLAUDE.md            # AI assistant instructions
├── PLAN.md              # Implementation plan
└── mobile-responsiveness-plan.md
```

## Mobile Responsiveness

The app is fully responsive with:
- **Phone (<640px)**: Single-column layouts, card-based views, icon-only buttons
- **Tablet (640-768px)**: Multi-column grids, optimized table layouts
- **Desktop (>768px)**: Full table views, multi-column dashboards

Tested on: iPhone SE (375px), iPad (768px), Desktop (1024px+)

## API Documentation

Interactive API docs available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Development

```bash
# Run backend tests
pytest

# Frontend linting
cd frontend && npm run lint

# Frontend type check
cd frontend && npm run build
```

## Deployment

Configured for Digital Ocean App Platform with automatic deployments:
- Pre-deploy migrations via `.do/app.yaml`
- Automatic builds on git push
- Environment variables configured in DO dashboard

## Documentation

- `CLAUDE.md` - Comprehensive project documentation for AI assistants
- `PLAN.md` - Feature implementation roadmap
- `mobile-responsiveness-plan.md` - Mobile optimization implementation plan
- `responsive-vs-pwa-analysis.md` - Cost analysis: Responsive vs PWA

## License

MIT
