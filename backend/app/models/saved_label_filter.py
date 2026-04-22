from datetime import datetime

from sqlalchemy import String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SavedLabelFilter(Base):
    __tablename__ = "saved_label_filters"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    label_ids: Mapped[str] = mapped_column(Text, nullable=False)  # JSON array of ints
    filter_mode: Mapped[str] = mapped_column(String(3), nullable=False, default="AND")
    chart_mode: Mapped[str] = mapped_column(String(10), nullable=False, default="holding")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
