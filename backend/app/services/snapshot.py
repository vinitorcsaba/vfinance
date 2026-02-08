from sqlalchemy.orm import Session

from app.models.snapshot import Snapshot, SnapshotItem
from app.services.portfolio import build_portfolio


def create_snapshot(db: Session) -> Snapshot:
    """Create a point-in-time snapshot of the current portfolio.

    Fetches live prices, captures all holdings as denormalized snapshot items,
    and stores the grand total in RON.
    """
    portfolio = build_portfolio(db)

    snapshot = Snapshot(
        total_value_ron=portfolio["grand_total_ron"],
    )

    for holding in portfolio["holdings"]:
        item = SnapshotItem(
            holding_type=holding["type"],
            name=holding["name"],
            shares=holding.get("shares"),
            price=holding.get("price"),
            value=holding["value"],
            currency=holding["currency"],
        )
        snapshot.items.append(item)

    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return snapshot
