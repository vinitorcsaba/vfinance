from datetime import datetime

from sqlalchemy import Column, Float, ForeignKey, Integer, String, Table, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

# Junction tables with target_percentage
stock_allocation_groups = Table(
    "stock_allocation_groups",
    Base.metadata,
    Column("stock_holding_id", Integer, ForeignKey("stock_holdings.id", ondelete="CASCADE"), primary_key=True),
    Column("allocation_group_id", Integer, ForeignKey("allocation_groups.id", ondelete="CASCADE"), primary_key=True),
    Column("target_percentage", Float, nullable=False),
)

manual_allocation_groups = Table(
    "manual_allocation_groups",
    Base.metadata,
    Column("manual_holding_id", Integer, ForeignKey("manual_holdings.id", ondelete="CASCADE"), primary_key=True),
    Column("allocation_group_id", Integer, ForeignKey("allocation_groups.id", ondelete="CASCADE"), primary_key=True),
    Column("target_percentage", Float, nullable=False),
)


class AllocationGroup(Base):
    __tablename__ = "allocation_groups"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    color: Mapped[str | None] = mapped_column(String(7))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
