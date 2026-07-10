from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import Agent
from app.models.order import Order, OrderStatus
from app.models.status_history import StatusHistory
from app.models.user import User


async def _lock_agent_atomically(db: AsyncSession, agent_id) -> bool:
    """
    The core concurrency-safety fix: this is a single atomic UPDATE with a
    WHERE clause checking is_available=true. If two requests race to grab
    the same agent, only one UPDATE actually matches a row (rowcount=1);
    the loser gets rowcount=0 and must pick a different agent. No SELECT
    followed by a separate UPDATE — that gap is exactly where race
    conditions live.
    """
    result = await db.execute(
        update(Agent)
        .where(Agent.id == agent_id, Agent.is_available == True)  # noqa: E712
        .values(is_available=False)
    )
    return result.rowcount == 1


def _score_agent(agent: Agent) -> float:
    """
    Higher is better. Right now this is a simple load-balancing score
    (fewer active orders = more attractive candidate); current_lat/lng
    are already on the Agent model so a real distance term can be added
    here later without changing the calling code.
    """
    return 1.0 / (1 + agent.active_order_count)


async def _write_assignment(
    db: AsyncSession, order: Order, agent: Agent, actor: User, note: str
) -> Order:
    order.agent_id = agent.id
    order.current_status = OrderStatus.ASSIGNED
    agent.active_order_count += 1

    db.add(StatusHistory(
        order_id=order.id,
        status=OrderStatus.ASSIGNED,
        actor_id=actor.id,
        actor_role=actor.role.value,
        note=note,
    ))

    await db.commit()
    await db.refresh(order)
    return order


async def auto_assign_order(db: AsyncSession, order: Order, actor: User) -> Order:
    if order.current_status not in (OrderStatus.CREATED, OrderStatus.RESCHEDULED):
        raise HTTPException(
            status_code=400,
            detail=f"Order must be 'created' or 'rescheduled' to auto-assign, currently '{order.current_status.value}'",
        )

    candidates = await db.scalars(
        select(Agent).where(
            Agent.current_zone_id == order.pickup_zone_id,
            Agent.is_available == True,  # noqa: E712
        )
    )
    candidates = sorted(candidates.all(), key=_score_agent, reverse=True)

    if not candidates:
        raise HTTPException(
            status_code=404,
            detail="No available agents in the pickup zone right now",
        )

    # Try candidates in score order; atomic lock means we only ever
    # succeed once even if another request is racing for the same agent.
    for agent in candidates:
        locked = await _lock_agent_atomically(db, agent.id)
        if locked:
            await db.refresh(agent)  # picks up is_available=False just set
            return await _write_assignment(db, order, agent, actor, note="Auto-assigned")

    raise HTTPException(
        status_code=409,
        detail="All candidate agents were taken by a concurrent request — please retry",
    )


async def manual_assign_order(db: AsyncSession, order: Order, agent_id, actor: User) -> Order:
    if order.current_status not in (OrderStatus.CREATED, OrderStatus.RESCHEDULED):
        raise HTTPException(
            status_code=400,
            detail=f"Order must be 'created' or 'rescheduled' to assign, currently '{order.current_status.value}'",
        )

    agent = await db.get(Agent, agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found")

    locked = await _lock_agent_atomically(db, agent.id)
    if not locked:
        raise HTTPException(
            status_code=409,
            detail="This agent was just taken by another order — pick a different agent or retry",
        )

    await db.refresh(agent)
    return await _write_assignment(db, order, agent, actor, note="Manually assigned by admin")