import logging
from collections import defaultdict

import yfinance as yf
from sqlalchemy.orm import Session

from app.models.holding import ManualHolding, StockHolding
from app.services.price import PriceResult, fetch_batch_prices, _cache

logger = logging.getLogger(__name__)

FX_PAIRS = {"EUR": "EURRON=X", "USD": "USDRON=X"}


def _fetch_fx_rates() -> dict[str, float]:
    """Fetch FX rates to RON. Returns dict like {"RON": 1.0, "EUR": 5.08, "USD": 4.32}."""
    rates: dict[str, float] = {"RON": 1.0}
    for currency, ticker in FX_PAIRS.items():
        cached = _cache.get(ticker)
        if cached:
            rates[currency] = cached.price
            continue
        try:
            t = yf.Ticker(ticker)
            rate = t.fast_info["last_price"]
            rates[currency] = round(rate, 4)
            _cache.set(ticker, PriceResult(ticker=ticker, price=rates[currency], currency="RON"))
        except Exception:
            logger.warning("Failed to fetch FX rate %s, using fallback", ticker, exc_info=True)
            # Fallback rates (approximate, better than failing)
            fallback = {"EUR": 5.0, "USD": 4.5}
            rates[currency] = fallback.get(currency, 1.0)
    return rates


def build_portfolio(db: Session) -> dict:
    """Build the full portfolio overview with live prices and FX conversion."""
    stocks = db.query(StockHolding).all()
    manuals = db.query(ManualHolding).all()

    # Fetch prices for all stock tickers
    tickers = [s.ticker for s in stocks]
    prices = fetch_batch_prices(tickers)

    # Fetch FX rates
    fx_rates = _fetch_fx_rates()

    holdings = []
    currency_sums: dict[str, float] = defaultdict(float)

    # Process stock holdings
    for stock in stocks:
        price_data = prices.get(stock.ticker)
        if not price_data:
            logger.warning("No price for %s, skipping from portfolio", stock.ticker)
            continue
        value = round(stock.shares * price_data.price, 2)
        currency = price_data.currency
        rate = fx_rates.get(currency, 1.0)
        value_ron = round(value * rate, 2)
        currency_sums[currency] += value

        holdings.append({
            "id": stock.id,
            "type": "stock",
            "name": stock.display_name or stock.ticker,
            "ticker": stock.ticker,
            "shares": stock.shares,
            "price": price_data.price,
            "value": value,
            "currency": currency,
            "value_ron": value_ron,
        })

    # Process manual holdings
    for manual in manuals:
        currency = manual.currency
        rate = fx_rates.get(currency, 1.0)
        value_ron = round(manual.value * rate, 2)
        currency_sums[currency] += manual.value

        holdings.append({
            "id": manual.id,
            "type": "manual",
            "name": manual.name,
            "ticker": None,
            "shares": None,
            "price": None,
            "value": manual.value,
            "currency": currency,
            "value_ron": value_ron,
        })

    # Build currency totals
    currency_totals = []
    grand_total_ron = 0.0
    for currency, total in sorted(currency_sums.items()):
        rate = fx_rates.get(currency, 1.0)
        total_ron = round(total * rate, 2)
        grand_total_ron += total_ron
        currency_totals.append({
            "currency": currency,
            "total": round(total, 2),
            "total_ron": total_ron,
        })

    return {
        "holdings": holdings,
        "currency_totals": currency_totals,
        "grand_total_ron": round(grand_total_ron, 2),
        "fx_rates": fx_rates,
    }
