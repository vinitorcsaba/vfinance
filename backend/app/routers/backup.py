import os
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException

from app.database import get_user_db_path, get_user_meta_path
from app.dependencies.auth import get_current_user, get_user_email_from_token
from app.services.spaces import is_spaces_configured, upload_db

router = APIRouter(prefix="/api/v1/backup", tags=["backup"], dependencies=[Depends(get_current_user)])


@router.get("/status")
def backup_status():
    return {"configured": is_spaces_configured()}


@router.post("/upload")
def backup_upload(email: str = Depends(get_user_email_from_token)):
    """Upload the authenticated user's database to cloud storage."""
    if not is_spaces_configured():
        raise HTTPException(status_code=400, detail="Cloud backup is not configured")

    db_path = get_user_db_path(email)
    object_key = os.path.basename(db_path)

    try:
        size = upload_db(db_path=db_path, object_key=object_key)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    # Also upload the meta JSON so encryption state is preserved across deployments
    meta_path = get_user_meta_path(email)
    if Path(meta_path).exists():
        meta_key = os.path.basename(meta_path)
        upload_db(db_path=meta_path, object_key=meta_key)

    return {"message": "Database uploaded to cloud", "size_bytes": size}
