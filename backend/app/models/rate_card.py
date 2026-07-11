import enum
from datetime import date

from sqlalchemy import Date, Enum, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDMixin


class OrderType(str, enum.Enum):
    B2B = "b2b"
    B2C = "b2c"


class SurchargeType(str, enum.Enum):
    FLAT = "flat"
    PERCENT = "percent"


class RateCard(Base, UUIDMixin, TimestampMixin):
    """
    Rate cards are data, not code. Admins create new rows with a future
    effective_from date to schedule pricing changes without a deploy.
    The rate engine looks up the row where today falls in [effective_from, effective_to].
    """
    __tablename__ = "rate_cards"

    zone_from_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("zones.id"))
    zone_to_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("zones.id"))
    order_type: Mapped[OrderType] = mapped_column(Enum(OrderType))
    base_fee: Mapped[float] = mapped_column(Numeric(10, 2))
    rate_per_kg: Mapped[float] = mapped_column(Numeric(10, 2))
    effective_from: Mapped[date] = mapped_column(Date)
    effective_to: Mapped[date] = mapped_column(Date)


class CODSurchargeConfig(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "cod_surcharge_config"

    order_type: Mapped[OrderType] = mapped_column(Enum(OrderType))
    surcharge_type: Mapped[SurchargeType] = mapped_column(Enum(SurchargeType))
    value: Mapped[float] = mapped_column(Numeric(10, 2))