import logging
import sys
import traceback
from contextlib import asynccontextmanager
from pathlib import Path

# Ensure all app loggers emit to stdout so DO runtime logs capture them
logging.basicConfig(
    level=logging.INFO,
    stream=sys.stdout,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.routers.allocation_groups import router as allocation_groups_router
from app.routers.auth import router as auth_router
from app.routers.holdings import router as holdings_router
from app.routers.labels import router as labels_router
from app.routers.portfolio import router as portfolio_router
from app.routers.prices import router as prices_router
from app.routers.snapshots import router as snapshots_router
from app.routers.backup import router as backup_router
from app.routers.encryption import router as encryption_router
from app.services.scheduler import start_scheduler, stop_scheduler
import app.models  # noqa: F401 — register ORM models


logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan handler.

    Note: With per-user databases, each user's DB is created on their first login.
    No global database initialization needed at startup.
    """
    if not settings.auth_secret_key:
        logger.warning("AUTH_SECRET_KEY is not set — sessions will use an empty signing key!")

    logger.info("VFinance started with per-user database architecture")

    # Start background scheduler for monthly snapshots
    start_scheduler()

    yield

    # Shutdown
    stop_scheduler()
    logger.info("VFinance shutting down")


app = FastAPI(title="VFinance", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exc()
    msg = f"UNHANDLED 500 on {request.method} {request.url.path}: {exc}\n{tb}"
    # Print directly to stdout — guaranteed visible in DO runtime logs
    print(msg, flush=True)
    logger.error(msg)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


app.include_router(allocation_groups_router)
app.include_router(auth_router)
app.include_router(holdings_router)
app.include_router(labels_router)
app.include_router(portfolio_router)
app.include_router(prices_router)
app.include_router(snapshots_router)
app.include_router(backup_router)
app.include_router(encryption_router)


@app.get("/api/v1/health")
def health():
    return {"status": "ok"}


# Serve built frontend in production
frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")
