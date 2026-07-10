import uuid
from datetime import date
from typing import Optional

from pydantic import BaseModel


class RescheduleRequestIn(BaseModel):
    new_date: date
    reason: Optional[str] = None


class RescheduleRequestOut(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID
    requested_date: date
    reason: Optional[str] = None

    class Config:
        from_attributes = True