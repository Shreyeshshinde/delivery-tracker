import uuid
from app.services.assignment_engine import auto_assign_order, manual_assign_order
from app.schemas.agent import AssignAgentRequest
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.order_service import reschedule_order
from app.schemas.reschedule import RescheduleRequestIn
from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.order import Order
from app.models.status_history import StatusHistory
from app.models.user import User, UserRole
from app.schemas.order import (
    OrderQuoteRequest, OrderQuoteResponse,
    OrderCreateRequest, OrderOut,
    OrderStatusUpdateRequest, StatusHistoryOut,
)
from app.services.order_service import build_quote, create_order, update_order_status

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post("/quote", response_model=OrderQuoteResponse)
async def quote_order(
    payload: OrderQuoteRequest,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """
    Preview only — no DB write. This is what the customer sees before
    confirming. Reuses the exact same calculation the real order will use.
    """
    quote = await build_quote(db, payload)
    return OrderQuoteResponse(
        pickup_zone_name=quote["pickup_zone"].name,
        drop_zone_name=quote["drop_zone"].name,
        volumetric_weight_kg=quote["volumetric_weight_kg"],
        billable_weight_kg=quote["billable_weight_kg"],
        base_fee=quote["base_fee"],
        weight_charge=quote["weight_charge"],
        cod_surcharge=quote["cod_surcharge"],
        total_charge=quote["total_charge"],
    )


@router.post("", response_model=OrderOut, status_code=201)
async def create_order_endpoint(
    payload: OrderCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    The actual confirm-and-create step. Charge is recalculated server-side
    from the same rate engine — never trusts a charge value from the client.
    """
    order = await create_order(db, payload, current_user)
    return order

@router.post("/{order_id}/auto-assign", response_model=OrderOut)
async def auto_assign(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    order = await db.get(Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    return await auto_assign_order(db, order, current_user)


@router.post("/{order_id}/assign", response_model=OrderOut)
async def manual_assign(
    order_id: uuid.UUID,
    payload: AssignAgentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    order = await db.get(Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    return await manual_assign_order(db, order, payload.agent_id, current_user)

@router.get("/{order_id}", response_model=OrderOut)
async def get_order(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = await db.get(Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    if current_user.role == UserRole.CUSTOMER and order.customer_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only view your own orders")

    return order


@router.get("/{order_id}/timeline", response_model=list[StatusHistoryOut])
async def get_order_timeline(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = await db.get(Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    if current_user.role == UserRole.CUSTOMER and order.customer_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only view your own orders")

    result = await db.scalars(
        select(StatusHistory)
        .where(StatusHistory.order_id == order_id)
        .order_by(StatusHistory.created_at.asc())
    )
    return result.all()


@router.patch("/{order_id}/status", response_model=OrderOut)
async def update_status(
    order_id: uuid.UUID,
    payload: OrderStatusUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.AGENT, UserRole.ADMIN)),
):
    """
    Agent updates their own delivery's status. Admin can update any order
    (used later for admin override too, in Phase 6).
    State machine in core/state_machine.py enforces legal transitions only.
    """
    order = await db.get(Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    updated_order = await update_order_status(
        db, order, payload.new_status, current_user, payload.note
    )
    return updated_order

@router.post("/{order_id}/reschedule", response_model=OrderOut)
async def reschedule_order_endpoint(
    order_id: uuid.UUID,
    payload: RescheduleRequestIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = await db.get(Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    if current_user.role == UserRole.CUSTOMER and order.customer_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only reschedule your own orders")

    return await reschedule_order(db, order, payload.new_date, payload.reason, current_user)