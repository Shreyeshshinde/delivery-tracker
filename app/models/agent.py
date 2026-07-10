from sqlalchemy import Boolean, ForeignKey, Integer, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDMixin


class Agent(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "agents"

    user_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True)
    current_zone_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("zones.id"), nullable=True)
    current_lat: Mapped[float] = mapped_column(Numeric(9, 6), nullable=True)
    current_lng: Mapped[float] = mapped_column(Numeric(9, 6), nullable=True)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    active_order_count: Mapped[int] = mapped_column(Integer, default=0)