import json
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.dependencies.auth import get_user_db
from app.dependencies.auth import get_current_user
from app.models.holding import StockHolding
from app.models.snapshot import Snapshot
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.snapshot import ChartDataPoint, ChartDataResponse, ROIResponse, SnapshotRead, SnapshotSummary
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
            total_value_eur=s.total_value_eur,
            total_value_usd=s.total_value_usd,
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

    def get_item_label_names(item) -> list[str]:
        if not item.labels:
            return []
        try:
            parsed = json.loads(item.labels)
            if isinstance(parsed, list):
                return [lbl["name"] for lbl in parsed if isinstance(lbl, dict) and "name" in lbl]
        except json.JSONDecodeError:
            return [n.strip() for n in item.labels.split(",") if n.strip()]
        return []

    def item_matches(item) -> bool:
        if not labels:
            return True
        return any(lbl in get_item_label_names(item) for lbl in labels)

    def snapshot_value(snap):
        ron = sum(item.value_ron for item in snap.items if item_matches(item))
        eur = sum(item.value_eur for item in snap.items if item_matches(item))
        usd = sum(item.value_usd for item in snap.items if item_matches(item))
        return ron, eur, usd

    # Pre-compute first snapshot values and fetch all transactions for rolling ROI
    first_snap = snapshots[0] if snapshots else None
    first_val_ron = 0.0
    first_manual_ron: dict[str, float] = {}

    if first_snap:
        first_val_ron, _, _ = snapshot_value(first_snap)
        first_manual_ron = {
            item.name: item.value_ron
            for item in first_snap.items
            if item.holding_type == "manual" and item_matches(item)
        }

    # Fetch all transactions in range once for rolling ROI computation
    all_tx_rows = []
    if len(snapshots) > 1:
        all_tx_rows = (
            db.query(Transaction, StockHolding)
            .join(StockHolding, Transaction.holding_id == StockHolding.id)
            .filter(
                Transaction.date > first_snap.taken_at.date(),
                Transaction.date <= snapshots[-1].taken_at.date(),
            )
            .all()
        )

    points = []
    for i, snapshot in enumerate(snapshots):
        total_ron, total_eur, total_usd = snapshot_value(snapshot)

        # Rolling cash-flow-adjusted ROI from first snapshot to this one
        roi_percent: float | None = None
        if i == 0:
            roi_percent = 0.0
        elif first_val_ron != 0:
            # Stock cash flows up to this snapshot (strictly after first, up to current)
            stock_flows_ron = sum(
                tx.value_ron
                for tx, holding in all_tx_rows
                if tx.date <= snapshot.taken_at.date()
                and tx.value_ron is not None
                and (not labels or any(lbl in [l.name for l in holding.labels] for lbl in labels))
            )
            # Manual holding deltas from first snapshot to this one
            cur_manual_ron = {
                item.name: item.value_ron
                for item in snapshot.items
                if item.holding_type == "manual" and item_matches(item)
            }
            all_manual_names = set(first_manual_ron) | set(cur_manual_ron)
            manual_delta_ron = sum(
                cur_manual_ron.get(n, 0.0) - first_manual_ron.get(n, 0.0)
                for n in all_manual_names
            )
            net_flows = stock_flows_ron + manual_delta_ron
            roi_percent = round((total_ron - first_val_ron - net_flows) / first_val_ron * 100, 2)

        points.append(ChartDataPoint(
            date=snapshot.taken_at.isoformat(),
            total_ron=round(total_ron, 2),
            total_eur=round(total_eur, 2),
            total_usd=round(total_usd, 2),
            roi_percent=roi_percent,
        ))

    return ChartDataResponse(points=points, labels_applied=labels)


@router.get("/roi", response_model=ROIResponse)
def get_roi(
    range: str = Query(default="all", pattern="^(3m|6m|1y|all)$"),
    labels: list[str] = Query(default=[]),
    db: Session = Depends(get_user_db),
):
    """
    Calculate cash-flow-adjusted ROI for the given date range.

    Formula: (end_value - start_value - net_cash_flows) / start_value
    net_cash_flows = stock transactions (buys positive, sells negative) + manual holding value deltas.
    If labels are specified, only holdings matching all those labels (AND logic) are included.
    Must be defined before /{snapshot_id} to avoid FastAPI parsing 'roi' as an integer.
    """
    def item_matches_labels(item, required: list[str]) -> bool:
        if not required:
            return True
        item_labels = []
        if item.labels:
            try:
                parsed = json.loads(item.labels)
                item_labels = [l["name"] for l in parsed if isinstance(l, dict) and "name" in l]
            except json.JSONDecodeError:
                item_labels = [n.strip() for n in item.labels.split(",") if n.strip()]
        return any(lbl in item_labels for lbl in required)

    # Compute cutoff date based on range
    cutoff_date = None
    if range == "3m":
        cutoff_date = datetime.now() - timedelta(days=90)
    elif range == "6m":
        cutoff_date = datetime.now() - timedelta(days=180)
    elif range == "1y":
        cutoff_date = datetime.now() - timedelta(days=365)

    # Fetch snapshots ascending
    query = db.query(Snapshot).order_by(Snapshot.taken_at.asc())
    if cutoff_date:
        query = query.filter(Snapshot.taken_at >= cutoff_date)
    snapshots = query.all()

    if len(snapshots) < 2:
        return ROIResponse(snapshot_count=len(snapshots), range=range)

    first_snap = snapshots[0]
    last_snap = snapshots[-1]

    # --- Start / end portfolio values (from snapshots — all historical) ---
    if not labels:
        start_value_ron = first_snap.total_value_ron
        start_value_eur = first_snap.total_value_eur
        start_value_usd = first_snap.total_value_usd
        end_value_ron = last_snap.total_value_ron
        end_value_eur = last_snap.total_value_eur
        end_value_usd = last_snap.total_value_usd
    else:
        start_value_ron = sum(item.value_ron for item in first_snap.items if item_matches_labels(item, labels))
        start_value_eur = sum(item.value_eur for item in first_snap.items if item_matches_labels(item, labels))
        start_value_usd = sum(item.value_usd for item in first_snap.items if item_matches_labels(item, labels))
        end_value_ron = sum(item.value_ron for item in last_snap.items if item_matches_labels(item, labels))
        end_value_eur = sum(item.value_eur for item in last_snap.items if item_matches_labels(item, labels))
        end_value_usd = sum(item.value_usd for item in last_snap.items if item_matches_labels(item, labels))

    # --- Stock cash flows ---
    # Use > (strictly after) the first snapshot date so transactions already
    # captured in start_value are not double-counted as new cash inflows.
    tx_rows = (
        db.query(Transaction, StockHolding)
        .join(StockHolding, Transaction.holding_id == StockHolding.id)
        .filter(
            Transaction.date > first_snap.taken_at.date(),
            Transaction.date <= last_snap.taken_at.date(),
        )
        .all()
    )

    stock_cash_flows_ron = 0.0
    stock_cash_flows_eur = 0.0
    stock_cash_flows_usd = 0.0
    for tx, holding in tx_rows:
        if labels:
            holding_label_names = [l.name for l in holding.labels]
            if not any(lbl in holding_label_names for lbl in labels):
                continue
        if tx.value_ron is not None:
            stock_cash_flows_ron += tx.value_ron
            stock_cash_flows_eur += tx.value_eur or 0.0
            stock_cash_flows_usd += tx.value_usd or 0.0
        else:
            # Legacy row without stored values: skip (cannot determine historical rate)
            pass

    # --- Manual holding cash flows (snapshot deltas — always historical) ---
    def manual_values_from_snap(snap):
        """Extract {name: (value_ron, value_eur, value_usd)} for manual holdings."""
        result = {}
        for item in snap.items:
            if item.holding_type == "manual" and item_matches_labels(item, labels):
                result[item.name] = (item.value_ron, item.value_eur, item.value_usd)
        return result

    first_manual = manual_values_from_snap(first_snap)
    last_manual = manual_values_from_snap(last_snap)
    all_manual_names = set(first_manual) | set(last_manual)

    manual_cash_flows_ron = sum(
        last_manual.get(n, (0.0, 0.0, 0.0))[0] - first_manual.get(n, (0.0, 0.0, 0.0))[0]
        for n in all_manual_names
    )
    manual_cash_flows_eur = sum(
        last_manual.get(n, (0.0, 0.0, 0.0))[1] - first_manual.get(n, (0.0, 0.0, 0.0))[1]
        for n in all_manual_names
    )
    manual_cash_flows_usd = sum(
        last_manual.get(n, (0.0, 0.0, 0.0))[2] - first_manual.get(n, (0.0, 0.0, 0.0))[2]
        for n in all_manual_names
    )

    net_cash_flows_ron = round(stock_cash_flows_ron + manual_cash_flows_ron, 2)
    net_cash_flows_eur = round(stock_cash_flows_eur + manual_cash_flows_eur, 2)
    net_cash_flows_usd = round(stock_cash_flows_usd + manual_cash_flows_usd, 2)

    absolute_gain_ron = round(end_value_ron - start_value_ron - net_cash_flows_ron, 2)
    absolute_gain_eur = round(end_value_eur - start_value_eur - net_cash_flows_eur, 2)
    absolute_gain_usd = round(end_value_usd - start_value_usd - net_cash_flows_usd, 2)
    roi_percent = round(absolute_gain_ron / start_value_ron * 100, 4) if start_value_ron != 0 else None

    return ROIResponse(
        period_start=first_snap.taken_at,
        period_end=last_snap.taken_at,
        start_value_ron=round(start_value_ron, 2),
        start_value_eur=round(start_value_eur, 2),
        start_value_usd=round(start_value_usd, 2),
        end_value_ron=round(end_value_ron, 2),
        end_value_eur=round(end_value_eur, 2),
        end_value_usd=round(end_value_usd, 2),
        net_cash_flows_ron=net_cash_flows_ron,
        net_cash_flows_eur=net_cash_flows_eur,
        net_cash_flows_usd=net_cash_flows_usd,
        stock_cash_flows_ron=round(stock_cash_flows_ron, 2),
        stock_cash_flows_eur=round(stock_cash_flows_eur, 2),
        stock_cash_flows_usd=round(stock_cash_flows_usd, 2),
        absolute_gain_ron=absolute_gain_ron,
        absolute_gain_eur=absolute_gain_eur,
        absolute_gain_usd=absolute_gain_usd,
        roi_percent=roi_percent,
        snapshot_count=len(snapshots),
        range=range,
    )


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
