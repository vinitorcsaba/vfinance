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


def take_monthly_snapshot_job():
    """
    Job function: create snapshots for all users.
    Scans the data directory for all user_*.db files and creates a snapshot for each.
    """
    logger.info("Running scheduled monthly snapshot job for all users")

    data_dir = Path("data")
    if not data_dir.exists():
        logger.warning("Data directory does not exist, no snapshots created")
        return

    # Find all user database files
    user_db_files = list(data_dir.glob("user_*.db"))
    logger.info(f"Found {len(user_db_files)} user databases")

    for db_file in user_db_files:
        email_prefix = extract_email_from_db_filename(db_file)
        if not email_prefix:
            logger.warning(f"Skipping {db_file.name}: unable to extract email")
            continue

        # Reconstruct email (append @gmail.com as default, since we need a valid email format)
        # This works because get_user_session only uses the prefix part anyway
        email = f"{email_prefix}@unknown.com"

        # Skip locked encrypted databases — scheduler cannot unlock them
        from app.database import is_db_encrypted, _db_keys
        if is_db_encrypted(str(db_file)) and email not in _db_keys:
            logger.info(f"Skipping monthly snapshot for {email_prefix}: database is locked")
            continue

        try:
            db = get_user_session(email)
            snapshot = create_snapshot(db)
            logger.info(f"Monthly snapshot created for {email_prefix}: ID={snapshot.id}, total={snapshot.total_value_ron:.2f} RON")
            db.close()
        except Exception as e:
            logger.error(f"Failed to create monthly snapshot for {email_prefix}: {e}")


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
