import logging

import boto3
from botocore.exceptions import ClientError

from app.config import settings

logger = logging.getLogger(__name__)

OBJECT_KEY = "vfinance.db"


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


def download_db() -> bool:
    """Download DB from Spaces on startup. Returns False if not configured or file missing."""
    if not is_spaces_configured():
        logger.info("Spaces not configured — skipping cloud DB download")
        return False

    db_path = settings.db_file_path
    db_path.parent.mkdir(parents=True, exist_ok=True)

    client = _get_s3_client()
    try:
        client.download_file(settings.spaces_bucket, OBJECT_KEY, str(db_path))
        logger.info("Downloaded DB from Spaces (%s/%s)", settings.spaces_bucket, OBJECT_KEY)
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "404":
            logger.info("No DB found in Spaces — starting fresh")
            return False
        raise


def upload_db() -> int:
    """Upload current DB to Spaces. Returns file size in bytes. Raises if not configured."""
    if not is_spaces_configured():
        raise RuntimeError("Spaces is not configured")

    db_path = settings.db_file_path
    if not db_path.exists():
        raise FileNotFoundError(f"DB file not found: {db_path}")

    client = _get_s3_client()
    client.upload_file(str(db_path), settings.spaces_bucket, OBJECT_KEY)
    size = db_path.stat().st_size
    logger.info("Uploaded DB to Spaces (%s/%s, %d bytes)", settings.spaces_bucket, OBJECT_KEY, size)
    return size
