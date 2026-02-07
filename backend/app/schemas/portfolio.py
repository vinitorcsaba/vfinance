from pydantic import BaseModel


class HoldingDetail(BaseModel):
    id: int
    type: str  # "stock" or "manual"
    name: str
    ticker: str | None = None
    shares: float | None = None
    price: float | None = None
    value: float
    currency: str
    value_ron: float


class CurrencyTotal(BaseModel):
    currency: str
    total: float
    total_ron: float


class PortfolioResponse(BaseModel):
    holdings: list[HoldingDetail]
    currency_totals: list[CurrencyTotal]
    grand_total_ron: float
    fx_rates: dict[str, float]  # e.g. {"EUR": 5.08, "USD": 4.32, "RON": 1.0}
