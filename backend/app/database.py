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
    import logging
    from pathlib import Path
    from alembic import command
    from alembic.config import Config
    from sqlalchemy import text, inspect
    from app.services.spaces import is_spaces_configured, download_user_db

    logger = logging.getLogger(__name__)
    db_path = Path(get_user_db_path(email))

    # If DB doesn't exist locally, try to download from cloud
    if not db_path.exists() and is_spaces_configured():
        download_user_db(email)

    # Run Alembic migrations to create or update schema
    engine = get_user_engine(email)
    db_url = str(engine.url)

    try:
        # Create Alembic config programmatically
        # Find alembic.ini - try multiple locations
        backend_dir = Path(__file__).parent.parent  # backend/app -> backend
        alembic_ini_path = backend_dir / "alembic.ini"

        if not alembic_ini_path.exists():
            # Fallback: try relative to cwd
            alembic_ini_path = Path("alembic.ini") if "backend" in os.getcwd() else Path("backend/alembic.ini")

        logger.info(f"Using alembic.ini at: {alembic_ini_path}")

        alembic_cfg = Config(str(alembic_ini_path))
        alembic_cfg.set_main_option("sqlalchemy.url", db_url)

        # Suppress Alembic output to avoid cluttering logs
        alembic_cfg.attributes["configure_logger"] = False

        # Run migrations to head
        command.upgrade(alembic_cfg, "head")
        logger.info(f"Successfully migrated database for user {email}")
    except Exception as e:
        # Fall back to manual schema updates if migrations fail
        logger.warning(f"Alembic migration failed for user {email}: {e}")
        logger.info("Attempting manual schema updates...")

        # Create tables if they don't exist
        Base.metadata.create_all(bind=engine)

        # Manually add missing columns and tables if needed
        try:
            inspector = inspect(engine)
            table_names = inspector.get_table_names()

            with engine.begin() as conn:
                # Add missing columns to snapshot_items
                if "snapshot_items" in table_names:
                    columns = [col["name"] for col in inspector.get_columns("snapshot_items")]

                    if "value_eur" not in columns:
                        logger.info("Adding value_eur column to snapshot_items")
                        conn.execute(text("ALTER TABLE snapshot_items ADD COLUMN value_eur FLOAT NOT NULL DEFAULT 0.0"))
                        conn.execute(text("UPDATE snapshot_items SET value_eur = value_ron / 5.0 WHERE value_eur = 0.0"))

                    if "value_usd" not in columns:
                        logger.info("Adding value_usd column to snapshot_items")
                        conn.execute(text("ALTER TABLE snapshot_items ADD COLUMN value_usd FLOAT NOT NULL DEFAULT 0.0"))
                        conn.execute(text("UPDATE snapshot_items SET value_usd = value_ron / 4.5 WHERE value_usd = 0.0"))

                # Add missing columns to snapshots
                if "snapshots" in table_names:
                    columns = [col["name"] for col in inspector.get_columns("snapshots")]

                    if "total_value_eur" not in columns:
                        logger.info("Adding total_value_eur column to snapshots")
                        conn.execute(text("ALTER TABLE snapshots ADD COLUMN total_value_eur FLOAT NOT NULL DEFAULT 0.0"))
                        conn.execute(text("""
                            UPDATE snapshots SET total_value_eur = (
                                SELECT COALESCE(SUM(value_eur), 0.0)
                                FROM snapshot_items
                                WHERE snapshot_items.snapshot_id = snapshots.id
                            )
                        """))

                    if "total_value_usd" not in columns:
                        logger.info("Adding total_value_usd column to snapshots")
                        conn.execute(text("ALTER TABLE snapshots ADD COLUMN total_value_usd FLOAT NOT NULL DEFAULT 0.0"))
                        conn.execute(text("""
                            UPDATE snapshots SET total_value_usd = (
                                SELECT COALESCE(SUM(value_usd), 0.0)
                                FROM snapshot_items
                                WHERE snapshot_items.snapshot_id = snapshots.id
                            )
                        """))

                # Create transactions table if missing
                if "transactions" not in table_names:
                    logger.info("Creating transactions table")
                    conn.execute(text("""
                        CREATE TABLE transactions (
                            id INTEGER PRIMARY KEY,
                            holding_id INTEGER NOT NULL,
                            date DATE NOT NULL,
                            shares FLOAT NOT NULL,
                            price_per_share FLOAT NOT NULL,
                            notes TEXT,
                            FOREIGN KEY (holding_id) REFERENCES stock_holdings (id)
                        )
                    """))

            logger.info(f"Manual schema updates completed for user {email}")
        except Exception as schema_error:
            logger.error(f"Failed to apply manual schema updates for user {email}: {schema_error}", exc_info=True)


def get_db():
    """
    Deprecated: This will be removed. Use get_user_db() with email context instead.
    Kept temporarily for migration compatibility.
    """
    # This is a placeholder - will be replaced by user-specific DBs
    raise RuntimeError("get_db() is deprecated - use get_user_db() with user email")
