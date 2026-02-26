from datetime import date

from pydantic import BaseModel


class PriceLookupResponse(BaseModel):
    ticker: str
    price: float
    currency: str
    name: str | None = None


class StockSearchResult(BaseModel):
    ticker: str
    name: str
    exchange: str
    type: str


class HistoricalPriceResponse(BaseModel):
    ticker: str
    date: date
    price: float | None
    currency: str | None = None


class BenchmarkPoint(BaseModel):
    date: str
    price: float


class BenchmarkResponse(BaseModel):
    ticker: str
    currency: str | None = None
    points: list[BenchmarkPoint]
