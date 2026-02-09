from fastapi import APIRouter, HTTPException, Query

from app.schemas.price import PriceLookupResponse, StockSearchResult
from app.services.price import lookup_ticker, search_stocks

router = APIRouter(prefix="/api/v1/prices", tags=["prices"])


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


@router.get("/search", response_model=list[StockSearchResult])
def price_search(q: str = Query(..., min_length=2, description="Search query")):
    """Search Yahoo Finance for stocks/ETFs matching a name or keyword."""
    return search_stocks(q)
