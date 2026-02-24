import logging
import os
from pathlib import Path

import boto3
from botocore.exceptions import ClientError

from app.config import settings

logger = logging.getLogger(__name__)


def is_spaces_configured() -> bool:
    return all([
        settings.spaces_endpoint_url,
        settings.spaces_region,
        settings.spaces_bucket,
        settings.spaces_access_key,
        settings.spaces_secret_key,
    ])


def _get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.spaces_endpoint_url,
        region_name=settings.spaces_region,
        aws_access_key_id=settings.spaces_access_key,
        aws_secret_access_key=settings.spaces_secret_key,
    )


def download_user_db(email: str) -> bool:
    """
    Download a user's database from cloud storage.
    Returns True if downloaded, False if not found or failed.
    """
    if not is_spaces_configured():
        logger.info("Spaces not configured — skipping cloud DB download for %s", email)
        return False

    from app.database import get_user_db_path

    db_path = Path(get_user_db_path(email))
    db_path.parent.mkdir(parents=True, exist_ok=True)

    # Object key is the DB filename (e.g., "user_john_doe.db")
    object_key = os.path.basename(str(db_path))

    try:
        client = _get_s3_client()

        # Check if the object exists
        resp = client.list_objects_v2(
            Bucket=settings.spaces_bucket, Prefix=object_key, MaxKeys=1,
        )
        if resp.get("KeyCount", 0) == 0:
            logger.info("No cloud DB found for %s — will create fresh", email)
            return False

        client.download_file(settings.spaces_bucket, object_key, str(db_path))
        logger.info("Downloaded user DB from Spaces (%s → %s)", object_key, db_path)

        # Also download the meta JSON (encryption state) if it exists in Spaces.
        # Without it, an encrypted DB would be mistaken for plaintext on first login.
        from app.database import get_user_meta_path
        meta_path = Path(get_user_meta_path(email))
        meta_key = os.path.basename(str(meta_path))
        try:
            meta_resp = client.list_objects_v2(
                Bucket=settings.spaces_bucket, Prefix=meta_key, MaxKeys=1,
            )
            if meta_resp.get("KeyCount", 0) > 0:
                client.download_file(settings.spaces_bucket, meta_key, str(meta_path))
                logger.info("Downloaded user meta from Spaces (%s → %s)", meta_key, meta_path)
        except Exception:
            logger.warning("Could not download meta file for %s — will treat as unencrypted", email)

        return True
    except Exception:
        logger.exception("Failed to download user DB for %s — will create fresh", email)
        return False


def upload_db(db_path: str, object_key: str) -> int:
    """Upload a database file to Spaces. Returns file size in bytes."""
    if not is_spaces_configured():
        raise RuntimeError("Spaces is not configured")

    from pathlib import Path
    db_file = Path(db_path)
    if not db_file.exists():
        raise FileNotFoundError(f"DB file not found: {db_path}")

    client = _get_s3_client()
    client.upload_file(str(db_file), settings.spaces_bucket, object_key)
    size = db_file.stat().st_size
    logger.info("Uploaded DB to Spaces (%s/%s, %d bytes)", settings.spaces_bucket, object_key, size)
    return size
