from datetime import datetime

from sqlalchemy import Column, ForeignKey, Integer, String, Table, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

# Junction tables
stock_holding_labels = Table(
    "stock_holding_labels",
    Base.metadata,
    Column("stock_holding_id", Integer, ForeignKey("stock_holdings.id", ondelete="CASCADE"), primary_key=True),
    Column("label_id", Integer, ForeignKey("labels.id", ondelete="CASCADE"), primary_key=True),
)

manual_holding_labels = Table(
    "manual_holding_labels",
    Base.metadata,
    Column("manual_holding_id", Integer, ForeignKey("manual_holdings.id", ondelete="CASCADE"), primary_key=True),
    Column("label_id", Integer, ForeignKey("labels.id", ondelete="CASCADE"), primary_key=True),
)


class Label(Base):
    __tablename__ = "labels"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    color: Mapped[str | None] = mapped_column(String(7))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
