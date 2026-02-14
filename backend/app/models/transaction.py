from datetime import date

from sqlalchemy import Date, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    holding_id: Mapped[int] = mapped_column(ForeignKey("stock_holdings.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    shares: Mapped[float] = mapped_column(Float, nullable=False)
    price_per_share: Mapped[float] = mapped_column(Float, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    holding: Mapped["StockHolding"] = relationship(back_populates="transactions")
