from pydantic import BaseModel


class PriceLookupResponse(BaseModel):
    ticker: str
    price: float
    currency: str
    name: str | None = None
