from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class SavedLabelFilterCreate(BaseModel):
    name: str = Field(max_length=100)
    label_ids: list[int]
    filter_mode: Literal["AND", "OR"] = "AND"
    chart_mode: Literal["holding", "currency", "label"] = "holding"


class SavedLabelFilterUpdate(BaseModel):
    name: str = Field(max_length=100)


class SavedLabelFilterResponse(BaseModel):
    id: int
    name: str
    label_ids: list[int]
    filter_mode: str
    chart_mode: str
    created_at: datetime
