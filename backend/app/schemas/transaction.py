from datetime import date

from pydantic import BaseModel


class TransactionCreate(BaseModel):
    """Schema for creating a new transaction."""

    date: date
    shares: float
    price_per_share: float
    notes: str | None = None


class TransactionRead(BaseModel):
    """Schema for reading transaction data."""

    id: int
    holding_id: int
    date: date
    shares: float
    price_per_share: float
    notes: str | None
    value_ron: float | None = None
    value_eur: float | None = None
    value_usd: float | None = None

    model_config = {"from_attributes": True}
