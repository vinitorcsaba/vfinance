import json
from datetime import datetime

from pydantic import BaseModel, field_validator


class LabelInSnapshot(BaseModel):
    """Label data captured in snapshot (name + color)."""
    name: str
    color: str | None = None


class ChartDataPoint(BaseModel):
    """Single data point for portfolio value chart."""
    date: str  # ISO date string
    total_ron: float
    total_eur: float
    total_usd: float


class ChartDataResponse(BaseModel):
    """Response for chart data endpoint."""
    points: list[ChartDataPoint]
    labels_applied: list[str]  # Label names that were used to filter


class SnapshotItemRead(BaseModel):
    id: int
    holding_type: str
    ticker: str | None
    name: str
    labels: list[LabelInSnapshot]
    shares: float | None
    price: float | None
    value: float
    currency: str
    value_ron: float
    value_eur: float
    value_usd: float

    model_config = {"from_attributes": True}

    @field_validator("labels", mode="before")
    @classmethod
    def parse_labels_json(cls, v):
        """Parse labels from JSON string to list of label objects."""
        if v is None or v == "":
            return []
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                return parsed if isinstance(parsed, list) else []
            except json.JSONDecodeError:
                # Fallback for old comma-separated format
                return [{"name": name.strip(), "color": None} for name in v.split(",") if name.strip()]
        return v


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
