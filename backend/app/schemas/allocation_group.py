from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class AllocationGroupCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    color: str | None = Field(None, pattern=r"^#[0-9a-fA-F]{6}$")


class AllocationGroupUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    color: str | None = Field(None, pattern=r"^#[0-9a-fA-F]{6}$")


class AllocationGroupRead(BaseModel):
    id: int
    name: str
    color: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AllocationMember(BaseModel):
    holding_type: Literal["stock", "manual"]
    holding_id: int
    target_percentage: float = Field(..., gt=0, le=100)


class AssignAllocations(BaseModel):
    members: list[AllocationMember]

    @model_validator(mode="after")
    def validate_percentages_sum_to_100(self):
        """Ensure target percentages sum to approximately 100%."""
        total = sum(member.target_percentage for member in self.members)
        # Allow small floating point tolerance
        if not (99.9 <= total <= 100.1):
            raise ValueError(f"Target percentages must sum to 100%, got {total:.2f}%")
        return self

    @model_validator(mode="after")
    def validate_unique_holdings(self):
        """Ensure no duplicate holdings in the allocation."""
        seen = set()
        for member in self.members:
            key = (member.holding_type, member.holding_id)
            if key in seen:
                raise ValueError(f"Duplicate holding: {member.holding_type} ID {member.holding_id}")
            seen.add(key)
        return self


class AllocationMemberRead(BaseModel):
    holding_type: Literal["stock", "manual"]
    holding_id: int
    holding_name: str
    target_percentage: float


class AllocationMemberAnalysis(BaseModel):
    holding_type: Literal["stock", "manual"]
    holding_id: int
    name: str
    ticker: str | None  # Only for stocks
    currency: str
    current_value: float  # In native currency
    current_percentage: float
    target_percentage: float
    target_value: float  # In native currency
    difference: float  # In native currency (positive = need to add, negative = need to reduce)


class AllocationGroupAnalysis(BaseModel):
    group_id: int
    group_name: str
    group_color: str | None
    total_value_ron: float
    total_value_display: float  # In display currency (optional)
    display_currency: str
    members: list[AllocationMemberAnalysis]
    fx_rates: dict[str, float]  # Currency code -> rate to RON
