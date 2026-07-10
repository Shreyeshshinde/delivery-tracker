import uuid
from datetime import date

from pydantic import BaseModel

from app.models.rate_card import OrderType, SurchargeType
from app.models.order import PaymentType


class RateCardCreate(BaseModel):
    zone_from_id: uuid.UUID
    zone_to_id: uuid.UUID
    order_type: OrderType
    base_fee: float
    rate_per_kg: float
    effective_from: date
    effective_to: date


class RateCardOut(RateCardCreate):
    id: uuid.UUID

    class Config:
        from_attributes = True


class CODSurchargeConfigCreate(BaseModel):
    order_type: OrderType
    surcharge_type: SurchargeType
    value: float


class CODSurchargeConfigOut(CODSurchargeConfigCreate):
    id: uuid.UUID

    class Config:
        from_attributes = True


class RateCalculationRequest(BaseModel):
    pickup_pincode: str
    drop_pincode: str
    length_cm: float
    breadth_cm: float
    height_cm: float
    actual_weight_kg: float
    order_type: OrderType
    payment_type: PaymentType


class RateCalculationResponse(BaseModel):
    pickup_zone_id: uuid.UUID
    pickup_zone_name: str
    drop_zone_id: uuid.UUID
    drop_zone_name: str
    volumetric_weight_kg: float
    billable_weight_kg: float
    base_fee: float
    weight_charge: float
    cod_surcharge: float
    total_charge: float 