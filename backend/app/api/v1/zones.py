from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_roles, get_current_user
from app.db.session import get_db
from app.models.user import UserRole
from app.models.zone import Zone, ZonePincode
from app.schemas.zone import ZoneCreate, ZoneOut, ZonePincodesIn, ZonePincodeOut
from app.services.zone_detector import resolve_zone

router = APIRouter(prefix="/zones", tags=["zones"])


@router.post("", response_model=ZoneOut, status_code=201)
async def create_zone(
    payload: ZoneCreate,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_roles(UserRole.ADMIN)),
):
    zone = Zone(name=payload.name)
    db.add(zone)
    await db.commit()
    await db.refresh(zone)
    return zone


@router.get("", response_model=list[ZoneOut])
async def list_zones(
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    result = await db.scalars(select(Zone))
    return result.all()


@router.post("/{zone_id}/pincodes", response_model=list[ZonePincodeOut], status_code=201)
async def assign_pincodes_to_zone(
    zone_id: str,
    payload: ZonePincodesIn,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_roles(UserRole.ADMIN)),
):
    """
    Admin assigns a set of pincodes/areas to a zone. This is the explicit
    endpoint the spec calls out separately from zone creation.
    """
    created = []
    for pincode in payload.pincodes:
        mapping = ZonePincode(zone_id=zone_id, pincode=pincode)
        db.add(mapping)
        created.append(mapping)

    await db.commit()
    for m in created:
        await db.refresh(m)
    return created


@router.get("/lookup/{pincode}", response_model=ZoneOut)
async def lookup_zone_by_pincode(
    pincode: str,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Handy for testing zone_detector.py directly before Phase 3 wires it into orders."""
    return await resolve_zone(db, pincode)