import os
import re
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    pass


# Cache of user engines to avoid recreating them
_user_engines: dict[str, any] = {}


def get_user_db_path(email: str) -> str:
    """
    Generate database file path for a user based on their email.
    Uses email prefix (before @) as identifier, sanitized for filesystem.
    """
    # Extract prefix before @ and sanitize (remove dots, lowercase)
    prefix = email.split("@")[0]
    # Replace non-alphanumeric with underscore
    safe_prefix = re.sub(r"[^a-zA-Z0-9]", "_", prefix).lower()

    # Ensure data directory exists
    data_dir = Path("data")
    data_dir.mkdir(exist_ok=True)

    return str(data_dir / f"user_{safe_prefix}.db")


def get_user_engine(email: str):
    """Get or create SQLAlchemy engine for a user's database."""
    if email not in _user_engines:
        db_path = get_user_db_path(email)
        db_url = f"sqlite:///{db_path}"
        engine = create_engine(db_url, connect_args={"check_same_thread": False})
        _user_engines[email] = engine
    return _user_engines[email]


def get_user_session(email: str) -> Session:
    """Create a database session for a specific user."""
    engine = get_user_engine(email)
    SessionLocal = sessionmaker(bind=engine)
    return SessionLocal()


def init_user_db(email: str):
    """
    Initialize a user's database.
    - Checks if DB exists in cloud storage and downloads it
    - If not in cloud, creates tables locally
    - Runs Alembic migrations to ensure schema is up to date
    Should be called on login to ensure user's DB is available.
    """
    from pathlib import Path
    from alembic import command
    from alembic.config import Config
    from app.services.spaces import is_spaces_configured, download_user_db

    db_path = Path(get_user_db_path(email))

    # If DB doesn't exist locally, try to download from cloud
    if not db_path.exists() and is_spaces_configured():
        download_user_db(email)

    # Run Alembic migrations to create or update schema
    engine = get_user_engine(email)
    db_url = str(engine.url)

    # Create Alembic config programmatically
    # Find alembic.ini relative to this file's directory
    import sys
    if "backend" in os.getcwd():
        # Running from backend directory (production)
        alembic_ini = "alembic.ini"
    else:
        # Running from project root (local dev)
        alembic_ini = "backend/alembic.ini"

    alembic_cfg = Config(alembic_ini)
    alembic_cfg.set_main_option("sqlalchemy.url", db_url)

    # Run migrations to head
    command.upgrade(alembic_cfg, "head")


def get_db():
    """
    Deprecated: This will be removed. Use get_user_db() with email context instead.
    Kept temporarily for migration compatibility.
    """
    # This is a placeholder - will be replaced by user-specific DBs
    raise RuntimeError("get_db() is deprecated - use get_user_db() with user email")
