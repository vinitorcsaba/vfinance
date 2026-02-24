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

# In-memory key store: email -> text password (lost on server restart by design)
_db_keys: dict[str, str] = {}


def get_user_db_path(email: str) -> str:
    """
    Generate database file path for a user based on their email.
    Uses email prefix (before @) as identifier, sanitized for filesystem.
    """
    prefix = email.split("@")[0]
    safe_prefix = re.sub(r"[^a-zA-Z0-9]", "_", prefix).lower()

    data_dir = Path("data")
    data_dir.mkdir(exist_ok=True)

    return str(data_dir / f"user_{safe_prefix}.db")


def is_db_encrypted(db_path: str) -> bool:
    """
    Returns True if the database file is SQLCipher-encrypted.
    Detection: try opening as plain SQLite — DatabaseError means encrypted.
    Returns False if file doesn't exist (new user, not yet encrypted).
    """
    if not Path(db_path).exists():
        return False
    import sqlite3 as _sqlite3
    try:
        conn = _sqlite3.connect(db_path)
        conn.execute("SELECT count(*) FROM sqlite_master")
        conn.close()
        return False
    except _sqlite3.DatabaseError:
        return True


def verify_db_key(db_path: str, password: str) -> bool:
    """Returns True if password opens the encrypted DB, False if wrong password."""
    try:
        import sqlcipher3.dbapi2 as sqlcipher
        escaped = password.replace("'", "''")
        conn = sqlcipher.connect(db_path)
        conn.execute(f"PRAGMA key = '{escaped}'")
        conn.execute("SELECT count(*) FROM sqlite_master")
        conn.close()
        return True
    except Exception as e:
        err = str(e).lower()
        if "file is not a database" in err or "notadb" in err or "sqlite_notadb" in err:
            return False
        raise


def invalidate_user_engine(email: str) -> None:
    """Dispose and remove cached engine (called on encryption state change)."""
    if email in _user_engines:
        try:
            _user_engines[email].dispose()
        except Exception:
            pass
        del _user_engines[email]


def get_user_engine(email: str):
    """Get or create SQLAlchemy engine for a user's database."""
    if email not in _user_engines:
        db_path = get_user_db_path(email)
        password = _db_keys.get(email)
        if password:
            import sqlcipher3.dbapi2 as sqlcipher
            escaped = password.replace("'", "''")

            def make_conn():
                conn = sqlcipher.connect(db_path)
                conn.execute(f"PRAGMA key = '{escaped}'")
                return conn

            engine = create_engine(
                "sqlite+pysqlite://",
                creator=make_conn,
                connect_args={"check_same_thread": False},
            )
        else:
            engine = create_engine(
                f"sqlite:///{db_path}",
                connect_args={"check_same_thread": False},
            )
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

    # If DB still doesn't exist: clear any stale cached engine
    if not db_path.exists():
        invalidate_user_engine(email)

    # Skip if DB is encrypted and key is not in memory yet
    if db_path.exists() and is_db_encrypted(str(db_path)) and email not in _db_keys:
        return  # DB is locked; migrations will run on unlock

    # Run Alembic migrations to create or update schema
    engine = get_user_engine(email)
    db_url = str(engine.url)

    try:
        backend_dir = Path(__file__).parent.parent  # backend/app -> backend
        alembic_ini_path = backend_dir / "alembic.ini"

        if not alembic_ini_path.exists():
            alembic_ini_path = Path("alembic.ini") if "backend" in os.getcwd() else Path("backend/alembic.ini")

        logger.info(f"Using alembic.ini at: {alembic_ini_path}")

        alembic_cfg = Config(str(alembic_ini_path))
        alembic_cfg.set_main_option("sqlalchemy.url", db_url)
        alembic_cfg.attributes["configure_logger"] = False

        command.upgrade(alembic_cfg, "head")
        logger.info(f"Successfully migrated database for user {email}")
    except Exception as e:
        logger.warning(f"Alembic migration failed for user {email}: {e}")
        logger.info("Attempting manual schema updates...")

        Base.metadata.create_all(bind=engine)

        try:
            inspector = inspect(engine)
            table_names = inspector.get_table_names()

            with engine.begin() as conn:
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
                            value_ron FLOAT,
                            value_eur FLOAT,
                            value_usd FLOAT,
                            FOREIGN KEY (holding_id) REFERENCES stock_holdings (id)
                        )
                    """))
                else:
                    tx_columns = [col["name"] for col in inspector.get_columns("transactions")]
                    if "value_ron" not in tx_columns:
                        logger.info("Adding value_ron column to transactions")
                        conn.execute(text("ALTER TABLE transactions ADD COLUMN value_ron FLOAT"))
                    if "value_eur" not in tx_columns:
                        logger.info("Adding value_eur column to transactions")
                        conn.execute(text("ALTER TABLE transactions ADD COLUMN value_eur FLOAT"))
                    if "value_usd" not in tx_columns:
                        logger.info("Adding value_usd column to transactions")
                        conn.execute(text("ALTER TABLE transactions ADD COLUMN value_usd FLOAT"))

            logger.info(f"Manual schema updates completed for user {email}")
        except Exception as schema_error:
            logger.error(f"Failed to apply manual schema updates for user {email}: {schema_error}", exc_info=True)


def get_db():
    """
    Deprecated: This will be removed. Use get_user_db() with email context instead.
    Kept temporarily for migration compatibility.
    """
    raise RuntimeError("get_db() is deprecated - use get_user_db() with user email")
