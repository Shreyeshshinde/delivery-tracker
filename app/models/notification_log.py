import enum

from sqlalchemy import Enum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDMixin


class NotificationChannel(str, enum.Enum):
    EMAIL = "email"
    SMS = "sms"


class NotificationStatus(str, enum.Enum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"
    RETRYING = "retrying"


class NotificationLog(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "notifications_log"

    order_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("orders.id"), index=True)
    channel: Mapped[NotificationChannel] = mapped_column(Enum(NotificationChannel))
    status: Mapped[NotificationStatus] = mapped_column(Enum(NotificationStatus), default=NotificationStatus.PENDING)
    attempts: Mapped[int] = mapped_column(Integer, default=0)