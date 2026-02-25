from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, Field

from app.schemas.label import LabelRead


class Currency(str, Enum):
    RON = "RON"
    EUR = "EUR"
    USD = "USD"


# --- Stock Holdings ---


class StockHoldingCreate(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=20)
    shares: float = Field(..., gt=0)
    currency: Currency | None = None
    display_name: str | None = Field(None, max_length=100)
    # Optional initial transaction fields (default: today's date + current live price)
    transaction_date: date | None = None
    transaction_price: float | None = Field(None, gt=0)


class StockHoldingUpdate(BaseModel):
    ticker: str | None = Field(None, min_length=1, max_length=20)
    shares: float | None = Field(None, gt=0)
    currency: Currency | None = None
    display_name: str | None = Field(None, max_length=100)


class StockAddShares(BaseModel):
    shares: float = Field(..., description="Number of shares to add (negative to remove)")


class ManualAddValue(BaseModel):
    value: float = Field(..., gt=0)


class StockHoldingRead(BaseModel):
    id: int
    ticker: str
    shares: float
    currency: str | None
    display_name: str | None
    labels: list[LabelRead] = []
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
    labels: list[LabelRead] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
