import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.agent import Agent
from app.models.user import User, UserRole
from app.schemas.agent import (
    AgentProfileCreate, AgentOut, AgentLocationUpdate, AgentAvailabilityUpdate,
)

router = APIRouter(prefix="/agents", tags=["agents"])


@router.post("/me", response_model=AgentOut, status_code=201)
async def create_my_agent_profile(
    payload: AgentProfileCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.AGENT)),
):
    existing = await db.scalar(select(Agent).where(Agent.user_id == current_user.id))
    if existing:
        raise HTTPException(status_code=400, detail="Agent profile already exists for this user")

    agent = Agent(user_id=current_user.id, current_zone_id=payload.current_zone_id)
    db.add(agent)
    await db.commit()
    await db.refresh(agent)
    return agent


@router.get("/me", response_model=AgentOut)
async def get_my_agent_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.AGENT)),
):
    agent = await db.scalar(select(Agent).where(Agent.user_id == current_user.id))
    if agent is None:
        raise HTTPException(status_code=404, detail="No agent profile yet — create one at POST /agents/me")
    return agent


@router.patch("/me/location", response_model=AgentOut)
async def update_my_location(
    payload: AgentLocationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.AGENT)),
):
    agent = await db.scalar(select(Agent).where(Agent.user_id == current_user.id))
    if agent is None:
        raise HTTPException(status_code=404, detail="No agent profile yet")

    agent.current_lat = payload.lat
    agent.current_lng = payload.lng
    await db.commit()
    await db.refresh(agent)
    return agent


@router.patch("/me/availability", response_model=AgentOut)
async def update_my_availability(
    payload: AgentAvailabilityUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.AGENT)),
):
    agent = await db.scalar(select(Agent).where(Agent.user_id == current_user.id))
    if agent is None:
        raise HTTPException(status_code=404, detail="No agent profile yet")

    agent.is_available = payload.is_available
    await db.commit()
    await db.refresh(agent)
    return agent


@router.get("", response_model=list[AgentOut])
async def list_agents(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_roles(UserRole.ADMIN)),
):
    """Admin visibility into every agent's current load and availability."""
    result = await db.scalars(select(Agent))
    return result.all()