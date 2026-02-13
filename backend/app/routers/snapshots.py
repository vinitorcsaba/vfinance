from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.dependencies.auth import get_user_db
from app.dependencies.auth import get_current_user
from app.models.snapshot import Snapshot
from app.models.user import User
from app.schemas.snapshot import SnapshotRead, SnapshotSummary
from app.services.sheets import export_snapshot_to_sheets
from app.services.snapshot import create_snapshot

router = APIRouter(prefix="/api/v1/snapshots", tags=["snapshots"], dependencies=[Depends(get_current_user)])


@router.post("", response_model=SnapshotRead, status_code=201)
def take_snapshot(db: Session = Depends(get_user_db)):
    """Create a point-in-time snapshot of the current portfolio."""
    return create_snapshot(db)


@router.get("", response_model=list[SnapshotSummary])
def list_snapshots(db: Session = Depends(get_user_db)):
    """List all snapshots ordered by most recent first."""
    snapshots = db.query(Snapshot).order_by(Snapshot.taken_at.desc()).all()
    return [
        SnapshotSummary(
            id=s.id,
            taken_at=s.taken_at,
            total_value_ron=s.total_value_ron,
            exported_to_sheets=s.exported_to_sheets,
            sheets_url=s.sheets_url,
            item_count=len(s.items),
        )
        for s in snapshots
    ]


@router.get("/{snapshot_id}", response_model=SnapshotRead)
def get_snapshot(snapshot_id: int, db: Session = Depends(get_user_db)):
    """Get a single snapshot with all its items."""
    snapshot = db.get(Snapshot, snapshot_id)
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return snapshot


@router.post("/{snapshot_id}/export")
def export_snapshot(snapshot_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_user_db)):
    """Export a snapshot to the user's Google Sheets."""
    if not user.google_refresh_token:
        raise HTTPException(status_code=400, detail="Google Sheets not connected")

    snapshot = db.get(Snapshot, snapshot_id)
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    url = export_snapshot_to_sheets(snapshot, user)
    snapshot.exported_to_sheets = True
    snapshot.sheets_url = url
    db.commit()

    return {"sheets_url": url}


@router.delete("/{snapshot_id}", status_code=204)
def delete_snapshot(snapshot_id: int, db: Session = Depends(get_user_db)):
    """Delete a snapshot and all its items."""
    snapshot = db.get(Snapshot, snapshot_id)
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    db.delete(snapshot)
    db.commit()
