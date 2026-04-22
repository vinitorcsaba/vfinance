from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class SavedLabelFilterCreate(BaseModel):
    name: str = Field(max_length=100)
    label_ids: list[int]
    filter_mode: Literal["AND", "OR"] = "AND"


class SavedLabelFilterUpdate(BaseModel):
    name: str = Field(max_length=100)


class SavedLabelFilterResponse(BaseModel):
    id: int
    name: str
    label_ids: list[int]
    filter_mode: str
    created_at: datetime
