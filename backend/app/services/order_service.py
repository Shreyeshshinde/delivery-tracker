from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.notification_service import enqueue_notification
from app.models.agent import Agent
from app.core.state_machine import validate_transition
from app.models.order import Order, OrderStatus
from app.models.status_history import StatusHistory
from app.models.user import User, UserRole
from app.schemas.order import OrderCreateRequest
from app.services.zone_detector import resolve_zone
from app.models.reschedule import RescheduleRequest
from app.services.rate_engine import (
    calculate_volumetric_weight,
    calculate_billable_weight,
    calculate_charge,
)


async def build_quote(db: AsyncSession, payload) -> dict:
    """
    Shared by the /orders/quote preview and /orders create endpoint,
    so the exact same calculation backs both what the customer sees
    before confirming and what actually gets charged.
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

    return {
        "pickup_zone": pickup_zone,
        "drop_zone": drop_zone,
        "volumetric_weight_kg": volumetric_weight,
        "billable_weight_kg": billable_weight,
        **breakdown,
    }


async def create_order(db: AsyncSession, payload: OrderCreateRequest, current_user: User) -> Order:
    """
    current_user.role == ADMIN and payload.customer_id set -> admin creates
    on behalf of a customer. Otherwise the order belongs to current_user.
    Either way, created_by_id records who actually submitted it, so the
    distinction stays auditable even when it's the same person.
    """
    if payload.customer_id is not None:
        if current_user.role != UserRole.ADMIN:
            raise HTTPException(
                status_code=403,
                detail="Only an admin can create an order on behalf of another customer",
            )
        customer_id = payload.customer_id
    else:
        customer_id = current_user.id

    quote = await build_quote(db, payload)

    order = Order(
        customer_id=customer_id,
        created_by_id=current_user.id,
        pickup_address=payload.pickup_address,
        drop_address=payload.drop_address,
        pickup_zone_id=quote["pickup_zone"].id,
        drop_zone_id=quote["drop_zone"].id,
        length_cm=payload.length_cm,
        breadth_cm=payload.breadth_cm,
        height_cm=payload.height_cm,
        actual_weight_kg=payload.actual_weight_kg,
        volumetric_weight_kg=quote["volumetric_weight_kg"],
        billable_weight_kg=quote["billable_weight_kg"],
        order_type=payload.order_type,
        payment_type=payload.payment_type,
        charge=quote["total_charge"],
        current_status=OrderStatus.CREATED,
    )
    db.add(order)
    await db.flush()  # get order.id before writing the history row

    history_row = StatusHistory(
        order_id=order.id,
        status=OrderStatus.CREATED,
        actor_id=current_user.id,
        actor_role=current_user.role.value,
        note="Order created" if payload.customer_id is None else "Order created by admin on behalf of customer",
    )
    db.add(history_row)

    await db.commit()
    await db.refresh(order)
    await enqueue_notification(db, order)
    return order

async def update_order_status(
    db: AsyncSession, order: Order, new_status: OrderStatus, actor: User, note: str | None
) -> Order:
    validate_transition(order.current_status, new_status)

    order.current_status = new_status
    history_row = StatusHistory(
        order_id=order.id,
        status=new_status,
        actor_id=actor.id,
        actor_role=actor.role.value,
        note=note,
    )
    db.add(history_row)

    if new_status == OrderStatus.FAILED and order.agent_id is not None:
        # Free the agent immediately so they're eligible for the next
        # auto-assignment — including this same order's eventual reschedule.
        agent = await db.get(Agent, order.agent_id)
        if agent is not None:
            agent.is_available = True
            agent.active_order_count = max(0, agent.active_order_count - 1)

    await db.commit()
    await db.refresh(order)

    await enqueue_notification(db, order)
    return order


async def reschedule_order(
    db: AsyncSession, order: Order, new_date, reason: str | None, actor: User
) -> Order:
    if order.current_status != OrderStatus.FAILED:
        raise HTTPException(
            status_code=400,
            detail=f"Can only reschedule a failed order, currently '{order.current_status.value}'",
        )

    reschedule_row = RescheduleRequest(
        order_id=order.id, requested_date=new_date, reason=reason
    )
    db.add(reschedule_row)

    validate_transition(order.current_status, OrderStatus.RESCHEDULED)
    order.current_status = OrderStatus.RESCHEDULED
    db.add(StatusHistory(
        order_id=order.id,
        status=OrderStatus.RESCHEDULED,
        actor_id=actor.id,
        actor_role=actor.role.value,
        note=f"Rescheduled for {new_date}" + (f" — {reason}" if reason else ""),
    ))

    await db.commit()
    await db.refresh(order)

    await enqueue_notification(db, order)
    return order