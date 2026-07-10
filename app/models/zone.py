from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDMixin


class Zone(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "zones"

    name: Mapped[str] = mapped_column(String(100), unique=True)


class ZonePincode(Base, UUIDMixin, TimestampMixin):
    """
    Admin assigns pincodes/areas to a zone here. zone_detector.py
    looks up pickup/drop pincodes against this table to resolve zones.
    """
    __tablename__ = "zone_pincodes"

    zone_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("zones.id"))
    pincode: Mapped[str] = mapped_column(String(10), unique=True, index=True)