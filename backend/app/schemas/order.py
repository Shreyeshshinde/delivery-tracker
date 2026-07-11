import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.order import OrderType, PaymentType, OrderStatus


class OrderQuoteRequest(BaseModel):
    pickup_pincode: str
    drop_pincode: str
    length_cm: float
    breadth_cm: float
    height_cm: float
    actual_weight_kg: float
    order_type: OrderType
    payment_type: PaymentType


class OrderQuoteResponse(BaseModel):
    pickup_zone_name: str
    drop_zone_name: str
    volumetric_weight_kg: float
    billable_weight_kg: float
    base_fee: float
    weight_charge: float
    cod_surcharge: float
    total_charge: float


class OrderCreateRequest(BaseModel):
    # Only used when an admin creates an order for a customer.
    # Customers creating their own order leave this null.
    customer_id: Optional[uuid.UUID] = None

    pickup_address: str
    drop_address: str
    pickup_pincode: str
    drop_pincode: str
    length_cm: float
    breadth_cm: float
    height_cm: float
    actual_weight_kg: float
    order_type: OrderType
    payment_type: PaymentType


class OrderOut(BaseModel):
    id: uuid.UUID
    customer_id: uuid.UUID
    created_by_id: uuid.UUID
    pickup_address: str
    drop_address: str
    pickup_zone_id: uuid.UUID
    drop_zone_id: uuid.UUID
    length_cm: float
    breadth_cm: float
    height_cm: float
    actual_weight_kg: float
    volumetric_weight_kg: float
    billable_weight_kg: float
    order_type: OrderType
    payment_type: PaymentType
    charge: float
    agent_id: Optional[uuid.UUID] = None
    current_status: OrderStatus
    created_at: datetime

    class Config:
        from_attributes = True


class OrderStatusUpdateRequest(BaseModel):
    new_status: OrderStatus
    note: Optional[str] = None


class StatusHistoryOut(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID
    status: OrderStatus
    actor_id: uuid.UUID
    actor_role: str
    note: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True