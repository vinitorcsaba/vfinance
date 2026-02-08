from fastapi import APIRouter, HTTPException

from app.services.spaces import is_spaces_configured, upload_db

router = APIRouter(prefix="/api/v1/backup", tags=["backup"])


@router.get("/status")
def backup_status():
    return {"configured": is_spaces_configured()}


@router.post("/upload")
def backup_upload():
    if not is_spaces_configured():
        raise HTTPException(status_code=400, detail="Cloud backup is not configured")
    try:
        size = upload_db()
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"message": "Database uploaded to cloud", "size_bytes": size}
