from datetime import date

from sqlalchemy import Date, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDMixin


class RescheduleRequest(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "reschedule_requests"

    order_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("orders.id"), index=True)
    requested_date: Mapped[date] = mapped_column(Date)
    reason: Mapped[str] = mapped_column(Text, nullable=True)