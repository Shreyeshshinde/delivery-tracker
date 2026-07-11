from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_roles, get_current_user
from app.db.session import get_db
from app.models.user import UserRole
from app.models.rate_card import RateCard, CODSurchargeConfig
from app.schemas.rate_card import (
    RateCardCreate, RateCardOut,
    CODSurchargeConfigCreate, CODSurchargeConfigOut,
    RateCalculationRequest, RateCalculationResponse,
)
from app.services.zone_detector import resolve_zone
from app.services.rate_engine import (
    calculate_volumetric_weight, calculate_billable_weight, calculate_charge,
)

router = APIRouter(tags=["rate-cards"])


@router.post("/rate-cards", response_model=RateCardOut, status_code=201)
async def create_rate_card(
    payload: RateCardCreate,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_roles(UserRole.ADMIN)),
):
    rate_card = RateCard(**payload.model_dump())
    db.add(rate_card)
    await db.commit()
    await db.refresh(rate_card)
    return rate_card


@router.get("/rate-cards", response_model=list[RateCardOut])
async def list_rate_cards(
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_roles(UserRole.ADMIN)),
):
    result = await db.scalars(select(RateCard))
    return result.all()


@router.post("/cod-surcharge", response_model=CODSurchargeConfigOut, status_code=201)
async def create_cod_surcharge(
    payload: CODSurchargeConfigCreate,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_roles(UserRole.ADMIN)),
):
    config = CODSurchargeConfig(**payload.model_dump())
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return config


@router.get("/cod-surcharge", response_model=list[CODSurchargeConfigOut])
async def list_cod_surcharges(
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_roles(UserRole.ADMIN)),
):
    result = await db.scalars(select(CODSurchargeConfig))
    return result.all()


@router.post("/rate-cards/calculate", response_model=RateCalculationResponse)
async def calculate_rate_preview(
    payload: RateCalculationRequest,
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """
    Preview endpoint: resolves zones from pincodes, computes volumetric/billable
    weight, and returns the itemized charge breakdown — the same calculation
    Phase 3's order creation flow will call before the customer confirms.
    """
    pickup_zone = await resolve_zone(db, payload.pickup_pincode)
    drop_zone = await resolve_zone(db, payload.drop_pincode)

    volumetric_weight = calculate_volumetric_weight(
        payload.length_cm, payload.breadth_cm, payload.height_cm
    )
    billable_weight = calculate_billable_weight(payload.actual_weight_kg, volumetric_weight)

    breakdown = await calculate_charge(
        db,
        zone_from_id=pickup_zone.id,
        zone_to_id=drop_zone.id,
        order_type=payload.order_type,
        payment_type=payload.payment_type,
        billable_weight_kg=billable_weight,
    )

    return RateCalculationResponse(
        pickup_zone_id=pickup_zone.id,
        pickup_zone_name=pickup_zone.name,
        drop_zone_id=drop_zone.id,
        drop_zone_name=drop_zone.name,
        volumetric_weight_kg=volumetric_weight,
        billable_weight_kg=billable_weight,
        **breakdown,
    )