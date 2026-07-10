import uuid
from typing import Optional

from pydantic import BaseModel


class AgentProfileCreate(BaseModel):
    current_zone_id: uuid.UUID


class AgentLocationUpdate(BaseModel):
    lat: float
    lng: float


class AgentAvailabilityUpdate(BaseModel):
    is_available: bool


class AgentOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    current_zone_id: Optional[uuid.UUID] = None
    current_lat: Optional[float] = None
    current_lng: Optional[float] = None
    is_available: bool
    active_order_count: int

    class Config:
        from_attributes = True


class AssignAgentRequest(BaseModel):
    agent_id: uuid.UUID