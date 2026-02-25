from datetime import date as Date
from typing import Optional

from pydantic import BaseModel, Field


class TransactionCreate(BaseModel):
    """Schema for creating a new transaction."""

    date: Date
    shares: float
    price_per_share: float
    notes: Optional[str] = None


class TransactionUpdate(BaseModel):
    """Schema for updating an existing transaction."""

    date: Optional[Date] = None
    price_per_share: Optional[float] = Field(None, gt=0)
    notes: Optional[str] = None


class TransactionRead(BaseModel):
    """Schema for reading transaction data."""

    id: int
    holding_id: int
    date: Date
    shares: float
    price_per_share: float
    notes: Optional[str]
    value_ron: Optional[float] = None
    value_eur: Optional[float] = None
    value_usd: Optional[float] = None

    model_config = {"from_attributes": True}
