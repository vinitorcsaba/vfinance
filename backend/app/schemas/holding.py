from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class Currency(str, Enum):
    RON = "RON"
    EUR = "EUR"
    USD = "USD"


# --- Stock Holdings ---


class StockHoldingCreate(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=20)
    shares: float = Field(..., gt=0)
    display_name: str | None = Field(None, max_length=100)


class StockHoldingUpdate(BaseModel):
    ticker: str | None = Field(None, min_length=1, max_length=20)
    shares: float | None = Field(None, gt=0)
    display_name: str | None = Field(None, max_length=100)


class StockHoldingRead(BaseModel):
    id: int
    ticker: str
    shares: float
    currency: str | None
    display_name: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Manual Holdings ---


class ManualHoldingCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    value: float = Field(..., gt=0)
    currency: Currency = Currency.RON


class ManualHoldingUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    value: float | None = Field(None, gt=0)
    currency: Currency | None = None


class ManualHoldingRead(BaseModel):
    id: int
    name: str
    value: float
    currency: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
