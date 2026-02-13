import json
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.dependencies.auth import get_user_db
from app.dependencies.auth import get_current_user
from app.models.snapshot import Snapshot
from app.models.user import User
from app.schemas.snapshot import ChartDataPoint, ChartDataResponse, SnapshotRead, SnapshotSummary
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


@router.get("/chart-data", response_model=ChartDataResponse)
def get_chart_data(
    labels: list[str] = Query(default=[]),
    range: str = Query(default="all", pattern="^(3m|6m|1y|all)$"),
    db: Session = Depends(get_user_db),
):
    """
    Get portfolio value chart data over time.

    Returns time-series data points with optional label filtering.
    If labels are specified, only holdings matching those labels are included in the value calculation.
    Must be defined before /{snapshot_id} to avoid FastAPI parsing 'chart-data' as an integer.
    """
    # Calculate cutoff date based on range
    cutoff_date = None
    if range == "3m":
        cutoff_date = datetime.now() - timedelta(days=90)
    elif range == "6m":
        cutoff_date = datetime.now() - timedelta(days=180)
    elif range == "1y":
        cutoff_date = datetime.now() - timedelta(days=365)

    # Fetch snapshots within range
    query = db.query(Snapshot).order_by(Snapshot.taken_at.asc())
    if cutoff_date:
        query = query.filter(Snapshot.taken_at >= cutoff_date)
    snapshots = query.all()

    points = []
    for snapshot in snapshots:
        if not labels:
            # No filter - use total value
            total_value = snapshot.total_value_ron
        else:
            # Filter by labels - sum value_ron of matching items
            total_value = 0.0
            for item in snapshot.items:
                # Parse labels from JSON
                item_labels = []
                if item.labels:
                    try:
                        parsed = json.loads(item.labels)
                        if isinstance(parsed, list):
                            item_labels = [label["name"] for label in parsed if isinstance(label, dict) and "name" in label]
                    except json.JSONDecodeError:
                        # Fallback for old comma-separated format
                        item_labels = [name.strip() for name in item.labels.split(",") if name.strip()]

                # Check if item has ALL requested labels (AND logic)
                if all(label in item_labels for label in labels):
                    total_value += item.value_ron

        points.append(ChartDataPoint(
            date=snapshot.taken_at.isoformat(),
            total_ron=total_value,
        ))

    return ChartDataResponse(points=points, labels_applied=labels)


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
