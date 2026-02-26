import datetime

from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies.auth import get_current_user
from app.schemas.price import BenchmarkResponse, HistoricalPriceResponse, PriceLookupResponse, StockSearchResult
from app.services.price import fetch_benchmark_prices, fetch_historical_price, lookup_ticker, normalize_ticker, search_stocks

router = APIRouter(prefix="/api/v1/prices", tags=["prices"], dependencies=[Depends(get_current_user)])


@router.get("/lookup", response_model=PriceLookupResponse)
def price_lookup(ticker: str = Query(..., min_length=1, description="Stock ticker symbol")):
    """Validate a ticker and return its current price. Used by the add-stock form."""
    try:
        result = lookup_ticker(ticker)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return PriceLookupResponse(
        ticker=result.ticker,
        price=result.price,
        currency=result.currency,
        name=result.name,
    )


@router.get("/history", response_model=HistoricalPriceResponse)
def price_history(
    ticker: str = Query(..., min_length=1),
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
):
    """Return the closing price for a ticker on a specific date."""
    try:
        trade_date = datetime.date.fromisoformat(date)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid date format, expected YYYY-MM-DD")

    normalized = normalize_ticker(ticker)
    price = fetch_historical_price(normalized, trade_date)

    # Fetch currency from ticker info (best-effort)
    currency: str | None = None
    try:
        currency = lookup_ticker(normalized).currency
    except ValueError:
        pass

    return HistoricalPriceResponse(ticker=normalized, date=trade_date, price=price, currency=currency)


@router.get("/search", response_model=list[StockSearchResult])
def price_search(q: str = Query(..., min_length=2, description="Search query")):
    """Search Yahoo Finance for stocks/ETFs matching a name or keyword."""
    return search_stocks(q)


@router.get("/benchmark", response_model=BenchmarkResponse)
def price_benchmark(
    ticker: str = Query(..., min_length=1, description="Ticker symbol for benchmark comparison"),
    range: str = Query(default="all", pattern="^(3m|6m|1y|all)$"),
):
    """Get historical daily closing prices for a ticker to use as chart benchmark."""
    range_days = {"3m": 90, "6m": 180, "1y": 365, "all": None}
    days = range_days[range]

    normalized = normalize_ticker(ticker)
    today = datetime.date.today()
    period_start = (today - datetime.timedelta(days=days)) if days else None

    points = fetch_benchmark_prices(normalized, period_start, today)
    if not points:
        raise HTTPException(status_code=404, detail=f"No price data found for '{ticker}'")

    currency: str | None = None
    try:
        currency = lookup_ticker(normalized).currency
    except ValueError:
        pass

    return BenchmarkResponse(ticker=normalized, currency=currency, points=points)
