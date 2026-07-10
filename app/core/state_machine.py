from fastapi import HTTPException

from app.models.order import OrderStatus

# Only these transitions are legal. Anything else is rejected before it
# ever touches the database — this is what makes status_history trustworthy.
ORDER_TRANSITIONS = {
    OrderStatus.CREATED: [OrderStatus.ASSIGNED],
    OrderStatus.ASSIGNED: [OrderStatus.PICKED_UP],
    OrderStatus.PICKED_UP: [OrderStatus.IN_TRANSIT],
    OrderStatus.IN_TRANSIT: [OrderStatus.OUT_FOR_DELIVERY],
    OrderStatus.OUT_FOR_DELIVERY: [OrderStatus.DELIVERED, OrderStatus.FAILED],
    OrderStatus.FAILED: [OrderStatus.RESCHEDULED],
    OrderStatus.RESCHEDULED: [OrderStatus.ASSIGNED],
    OrderStatus.DELIVERED: [],  # terminal state, no transitions out
}


def validate_transition(current_status: OrderStatus, new_status: OrderStatus) -> None:
    allowed = ORDER_TRANSITIONS.get(current_status, [])
    if new_status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Cannot transition order from '{current_status.value}' to "
                f"'{new_status.value}'. Allowed next states: "
                f"{[s.value for s in allowed] or 'none (terminal state)'}"
            ),
        )