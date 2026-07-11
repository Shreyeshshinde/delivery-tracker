from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.zone import Zone, ZonePincode


async def resolve_zone(db: AsyncSession, pincode: str) -> Zone:
    """
    Simple version: pincode -> zone lookup table.
    (Documented in the design write-up as a deliberate scoping choice;
    polygon-based geo zones are the "next step" if time allows.)
    """
    mapping = await db.scalar(
        select(ZonePincode).where(ZonePincode.pincode == pincode)
    )
    if mapping is None:
        raise HTTPException(
            status_code=404,
            detail=f"No zone is configured for pincode '{pincode}'. Ask an admin to assign it.",
        )

    zone = await db.get(Zone, mapping.zone_id)
    if zone is None:
        raise HTTPException(status_code=500, detail="Zone mapping is broken — zone not found")
    return zone