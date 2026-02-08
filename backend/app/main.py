from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import Base, engine
from app.routers.holdings import router as holdings_router
from app.routers.portfolio import router as portfolio_router
from app.routers.prices import router as prices_router
from app.routers.snapshots import router as snapshots_router
from app.routers.backup import router as backup_router
from app.services.spaces import download_db
import app.models  # noqa: F401 — register ORM models with Base.metadata


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Restore DB from cloud before creating tables (so create_all is a no-op if DB exists)
    download_db()
    # Startup: ensure all tables exist (idempotent, works alongside Alembic)
    Base.metadata.create_all(bind=engine)
    yield
    # Shutdown


app = FastAPI(title="VFinance", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(holdings_router)
app.include_router(portfolio_router)
app.include_router(prices_router)
app.include_router(snapshots_router)
app.include_router(backup_router)


@app.get("/api/v1/health")
def health():
    return {"status": "ok"}


# Serve built frontend in production
frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")
