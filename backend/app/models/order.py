import enum

from sqlalchemy import Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDMixin
from app.models.rate_card import OrderType


class PaymentType(str, enum.Enum):
    PREPAID = "prepaid"
    COD = "cod"


class OrderStatus(str, enum.Enum):
    CREATED = "created"
    ASSIGNED = "assigned"
    PICKED_UP = "picked_up"
    IN_TRANSIT = "in_transit"
    OUT_FOR_DELIVERY = "out_for_delivery"
    DELIVERED = "delivered"
    FAILED = "failed"
    RESCHEDULED = "rescheduled"


class Order(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "orders"

    customer_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_by_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    # created_by_id differs from customer_id when an admin creates the order
    # on the customer's behalf — keeps that distinction auditable.

    pickup_address: Mapped[str] = mapped_column(Text)
    drop_address: Mapped[str] = mapped_column(Text)
    pickup_zone_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("zones.id"))
    drop_zone_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("zones.id"))

    length_cm: Mapped[float] = mapped_column(Numeric(8, 2))
    breadth_cm: Mapped[float] = mapped_column(Numeric(8, 2))
    height_cm: Mapped[float] = mapped_column(Numeric(8, 2))
    actual_weight_kg: Mapped[float] = mapped_column(Numeric(8, 2))
    volumetric_weight_kg: Mapped[float] = mapped_column(Numeric(8, 2))
    billable_weight_kg: Mapped[float] = mapped_column(Numeric(8, 2))

    order_type: Mapped[OrderType] = mapped_column(Enum(OrderType))
    payment_type: Mapped[PaymentType] = mapped_column(Enum(PaymentType))
    charge: Mapped[float] = mapped_column(Numeric(10, 2))

    agent_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=True)
    current_status: Mapped[OrderStatus] = mapped_column(Enum(OrderStatus), default=OrderStatus.CREATED)
    # current_status is a denormalized "latest" pointer only.
    # status_history is the source of truth for the audit trail.