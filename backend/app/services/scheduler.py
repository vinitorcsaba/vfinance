"""APScheduler-based task scheduler for automatic snapshots.

Runs in-process during app lifespan. Monthly snapshot job runs on the 1st
of each month at 00:05. Generous misfire grace time (24h) ensures missed
jobs run when the app next starts.
"""

import logging
import re
from pathlib import Path
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.database import get_user_session
from app.services.snapshot import create_snapshot

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()


def extract_email_from_db_filename(db_path: Path) -> str | None:
    """
    Extract email from database filename (user_{email_prefix}.db).
    Returns the sanitized email prefix, or None if pattern doesn't match.
    """
    match = re.match(r"user_(.+)\.db$", db_path.name)
    if match:
        # Reconstruct a valid email from the sanitized prefix
        # Note: This is a best-effort approach since the original email domain is lost
        # For the snapshot job, we just need a valid identifier to get the session
        return match.group(1)
    return None


def _snapshot_for_prefix(email_prefix: str) -> None:
    """Download (if needed), snapshot, and re-upload one user database."""
    from app.database import get_user_db_path, init_user_db, is_db_encrypted, _db_keys, invalidate_user_engine
    from app.services.spaces import is_spaces_configured, download_user_db, upload_user_db

    email = f"{email_prefix}@unknown.com"
    db_path = get_user_db_path(email)

    # Ensure DB is present locally — download from Spaces if missing
    if not Path(db_path).exists():
        if not download_user_db(email):
            logger.warning("Skipping %s: could not download from Spaces", email_prefix)
            return

    # Skip locked encrypted databases — scheduler cannot unlock them
    if is_db_encrypted(db_path) and email not in _db_keys:
        logger.info("Skipping %s: database is locked", email_prefix)
        return

    try:
        # Ensure schema is up to date before creating a session
        init_user_db(email)
        db = get_user_session(email)
        snapshot = create_snapshot(db)
        db.close()
        invalidate_user_engine(email)  # free connection pool after job
        logger.info("Monthly snapshot created for %s: ID=%s, total=%.2f RON",
                    email_prefix, snapshot.id, snapshot.total_value_ron)

        # Push updated database back to Spaces so the snapshot is persisted
        if is_spaces_configured():
            upload_user_db(email)
    except Exception:
        logger.exception("Failed to create monthly snapshot for %s", email_prefix)


def take_monthly_snapshot_job():
    """
    Job function: create snapshots for all users.

    When Spaces is configured (production): lists all user_*.db files from the
    bucket, downloads each one if not already local, creates the snapshot, then
    re-uploads the updated database so the snapshot is durably stored.

    When Spaces is not configured (local dev): scans the local data/ directory.
    """
    from app.services.spaces import is_spaces_configured, list_user_db_keys

    logger.info("Running scheduled monthly snapshot job for all users")

    if is_spaces_configured():
        # Production path: source of truth is Spaces
        db_keys = list_user_db_keys()
        logger.info("Found %d user databases in Spaces", len(db_keys))
        for object_key in db_keys:
            match = re.match(r"user_(.+)\.db$", object_key)
            if not match:
                logger.warning("Skipping unexpected key: %s", object_key)
                continue
            _snapshot_for_prefix(match.group(1))
    else:
        # Local dev path: scan data/ directory
        data_dir = Path("data")
        if not data_dir.exists():
            logger.warning("Data directory does not exist, no snapshots created")
            return
        user_db_files = list(data_dir.glob("user_*.db"))
        logger.info("Found %d user databases locally", len(user_db_files))
        for db_file in user_db_files:
            email_prefix = extract_email_from_db_filename(db_file)
            if not email_prefix:
                logger.warning("Skipping %s: unable to extract email", db_file.name)
                continue
            _snapshot_for_prefix(email_prefix)


def start_scheduler():
    """Start the background scheduler with monthly snapshot job."""
    # Run on 1st of each month at 00:05
    # misfire_grace_time=86400 (24h) means if the app wasn't running at trigger time,
    # the job will still run when the app next starts (within 24h of the trigger)
    scheduler.add_job(
        take_monthly_snapshot_job,
        trigger=CronTrigger(day=1, hour=0, minute=5),
        id="monthly_snapshot",
        name="Create monthly portfolio snapshot",
        replace_existing=True,
        misfire_grace_time=86400,
    )
    scheduler.start()
    logger.info("Scheduler started with monthly snapshot job")


def stop_scheduler():
    """Stop the background scheduler."""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Scheduler stopped")
