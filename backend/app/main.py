import asyncio
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

import jwt
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.services.spaces import is_spaces_configured, upload_user_db
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


# Paths that handle their own uploads or don't mutate user data
_BACKUP_SKIP_PREFIXES = (
    "/api/v1/auth/",
    "/api/v1/backup/",
    "/api/v1/encryption/",
)


@app.middleware("http")
async def auto_backup_middleware(request: Request, call_next):
    """
    After any successful mutating request to data endpoints, upload the user's
    database to Spaces in a background thread so no change is ever lost.
    """
    response = await call_next(request)

    if (
        request.method in ("POST", "PUT", "PATCH", "DELETE")
        and response.status_code < 300
        and is_spaces_configured()
        and not any(request.url.path.startswith(p) for p in _BACKUP_SKIP_PREFIXES)
    ):
        token = request.cookies.get("session")
        if token:
            try:
                payload = jwt.decode(token, settings.auth_secret_key, algorithms=["HS256"])
                email: str | None = payload.get("sub")
                if email and "@" in email:
                    loop = asyncio.get_running_loop()
                    loop.run_in_executor(None, upload_user_db, email)
            except Exception:
                pass  # Best-effort — never block the response

    return response


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
