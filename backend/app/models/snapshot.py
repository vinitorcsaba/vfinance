from datetime import datetime

from sqlalchemy import Boolean, Float, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Snapshot(Base):
    __tablename__ = "snapshots"

    id: Mapped[int] = mapped_column(primary_key=True)
    taken_at: Mapped[datetime] = mapped_column(server_default=func.now())
    total_value_ron: Mapped[float] = mapped_column(Float, nullable=False)
    total_value_eur: Mapped[float] = mapped_column(Float, nullable=False)
    total_value_usd: Mapped[float] = mapped_column(Float, nullable=False)
    exported_to_sheets: Mapped[bool] = mapped_column(Boolean, default=False)
    sheets_url: Mapped[str | None] = mapped_column(Text)

    items: Mapped[list["SnapshotItem"]] = relationship(
        back_populates="snapshot", cascade="all, delete-orphan"
    )


class SnapshotItem(Base):
    __tablename__ = "snapshot_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    snapshot_id: Mapped[int] = mapped_column(ForeignKey("snapshots.id"), nullable=False)
    holding_type: Mapped[str] = mapped_column(String(10), nullable=False)  # "stock" or "manual"
    ticker: Mapped[str | None] = mapped_column(String(20))  # Ticker symbol (null for manual holdings)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    labels: Mapped[str | None] = mapped_column(Text)  # JSON string of label names
    shares: Mapped[float | None] = mapped_column(Float)
    price: Mapped[float | None] = mapped_column(Float)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    value_ron: Mapped[float] = mapped_column(Float, nullable=False)  # Value converted to RON
    value_eur: Mapped[float] = mapped_column(Float, nullable=False)  # Value converted to EUR
    value_usd: Mapped[float] = mapped_column(Float, nullable=False)  # Value converted to USD

    snapshot: Mapped["Snapshot"] = relationship(back_populates="items")
