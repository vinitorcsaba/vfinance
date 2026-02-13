import json
from sqlalchemy.orm import Session

from app.models.snapshot import Snapshot, SnapshotItem
from app.services.portfolio import build_portfolio


def _convert_to_all_currencies(value: float, currency: str, fx_rates: dict[str, float]) -> dict[str, float]:
    """Convert a value from its native currency to RON, EUR, and USD.

    Args:
        value: The amount in native currency
        currency: The native currency code (RON, EUR, or USD)
        fx_rates: Exchange rates dict like {"RON": 1.0, "EUR": 5.0, "USD": 4.5}
                  where each rate is the amount of RON per unit of that currency

    Returns:
        Dict with keys "ron", "eur", "usd" containing converted values
    """
    # First convert to RON (base currency)
    rate_to_ron = fx_rates.get(currency, 1.0)
    value_ron = round(value * rate_to_ron, 2)

    # Then convert RON to EUR and USD
    value_eur = round(value_ron / fx_rates["EUR"], 2)
    value_usd = round(value_ron / fx_rates["USD"], 2)

    return {
        "ron": value_ron,
        "eur": value_eur,
        "usd": value_usd,
    }


def create_snapshot(db: Session) -> Snapshot:
    """Create a point-in-time snapshot of the current portfolio.

    Fetches live prices, captures all holdings as denormalized snapshot items,
    and stores the grand total and all currency conversions at this point in time.
    """
    portfolio = build_portfolio(db)
    fx_rates = portfolio["fx_rates"]

    snapshot = Snapshot(
        total_value_ron=portfolio["grand_total_ron"],
    )

    for holding in portfolio["holdings"]:
        # Convert labels list to JSON string with full label objects (name + color)
        labels = holding.get("labels", [])
        labels_json = json.dumps(labels) if labels else None

        # Calculate values in all three currencies at this point in time
        converted = _convert_to_all_currencies(
            holding["value"],
            holding["currency"],
            fx_rates
        )

        item = SnapshotItem(
            holding_type=holding["type"],
            ticker=holding.get("ticker"),
            name=holding["name"],
            labels=labels_json,
            shares=holding.get("shares"),
            price=holding.get("price"),
            value=holding["value"],
            currency=holding["currency"],
            value_ron=converted["ron"],
            value_eur=converted["eur"],
            value_usd=converted["usd"],
        )
        snapshot.items.append(item)

    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return snapshot
