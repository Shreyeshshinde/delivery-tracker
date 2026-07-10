from datetime import date

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.rate_card import RateCard, CODSurchargeConfig, OrderType, SurchargeType
from app.models.order import PaymentType


def calculate_volumetric_weight(length_cm: float, breadth_cm: float, height_cm: float) -> float:
    return round((length_cm * breadth_cm * height_cm) / 5000, 2)


def calculate_billable_weight(actual_weight_kg: float, volumetric_weight_kg: float) -> float:
    return max(actual_weight_kg, volumetric_weight_kg)


async def get_active_rate_card(
    db: AsyncSession, zone_from_id, zone_to_id, order_type: OrderType
) -> RateCard:
    today = date.today()
    rate_card = await db.scalar(
        select(RateCard).where(
            RateCard.zone_from_id == zone_from_id,
            RateCard.zone_to_id == zone_to_id,
            RateCard.order_type == order_type,
            RateCard.effective_from <= today,
            RateCard.effective_to >= today,
        )
    )
    if rate_card is None:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No active rate card for this zone pair and order type "
                f"({order_type.value}) as of {today}. Ask an admin to configure one."
            ),
        )
    return rate_card


async def get_cod_surcharge(db: AsyncSession, order_type: OrderType) -> float:
    config = await db.scalar(
        select(CODSurchargeConfig).where(CODSurchargeConfig.order_type == order_type)
    )
    if config is None:
        return 0.0
    return float(config.value)


async def calculate_charge(
    db: AsyncSession,
    zone_from_id,
    zone_to_id,
    order_type: OrderType,
    payment_type: PaymentType,
    billable_weight_kg: float,
) -> dict:
    rate_card = await get_active_rate_card(db, zone_from_id, zone_to_id, order_type)

    base_fee = float(rate_card.base_fee)
    weight_charge = round(billable_weight_kg * float(rate_card.rate_per_kg), 2)

    cod_surcharge = 0.0
    if payment_type == PaymentType.COD:
        config = await db.scalar(
            select(CODSurchargeConfig).where(CODSurchargeConfig.order_type == order_type)
        )
        if config is not None:
            if config.surcharge_type == SurchargeType.FLAT:
                cod_surcharge = float(config.value)
            else:  # PERCENT
                cod_surcharge = round((base_fee + weight_charge) * float(config.value) / 100, 2)

    total_charge = round(base_fee + weight_charge + cod_surcharge, 2)

    return {
        "base_fee": base_fee,
        "weight_charge": weight_charge,
        "cod_surcharge": cod_surcharge,
        "total_charge": total_charge,
    }