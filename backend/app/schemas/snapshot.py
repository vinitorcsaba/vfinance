from datetime import datetime

from pydantic import BaseModel


class SnapshotItemRead(BaseModel):
    id: int
    holding_type: str
    ticker: str | None
    name: str
    labels: str | None
    shares: float | None
    price: float | None
    value: float
    currency: str
    value_ron: float

    model_config = {"from_attributes": True}


class SnapshotRead(BaseModel):
    id: int
    taken_at: datetime
    total_value_ron: float
    exported_to_sheets: bool
    sheets_url: str | None
    items: list[SnapshotItemRead]

    model_config = {"from_attributes": True}


class SnapshotSummary(BaseModel):
    """Lightweight snapshot without items, used in list endpoint."""

    id: int
    taken_at: datetime
    total_value_ron: float
    exported_to_sheets: bool
    sheets_url: str | None
    item_count: int

    model_config = {"from_attributes": True}
