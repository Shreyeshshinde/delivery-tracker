from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDMixin
from app.models.order import OrderStatus


class StatusHistory(Base, UUIDMixin, TimestampMixin):
    """
    Append-only. Never UPDATE a row here — every status change is a new
    INSERT with who did it and when. This table is the real audit trail;
    orders.current_status is just a cached pointer to the latest row.
    """
    __tablename__ = "status_history"

    order_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("orders.id"), index=True)
    status: Mapped[OrderStatus] = mapped_column()
    actor_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    actor_role: Mapped[str] = mapped_column(String(20))
    note: Mapped[str] = mapped_column(Text, nullable=True)