import datetime

from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies.auth import get_current_user
from app.schemas.price import HistoricalPriceResponse, PriceLookupResponse, StockSearchResult
from app.services.price import fetch_historical_price, lookup_ticker, normalize_ticker, search_stocks

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
