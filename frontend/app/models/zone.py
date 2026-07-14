class ZonePincodePrefix(Base, UUIDMixin, TimestampMixin):
    """
    Coarser fallback for zone_pincodes: matches by leading digits instead of
    an exact 6-digit pincode. Lets a handful of rows (e.g. India's 9 postal
    regions, prefix='1' through '9') cover every real pincode in the
    country, rather than requiring one row per exact pincode.
    """
    __tablename__ = "zone_pincode_prefixes"

    zone_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("zones.id"))
    prefix: Mapped[str] = mapped_column(String(6), index=True)