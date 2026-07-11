import uuid
from typing import List

from pydantic import BaseModel


class ZoneCreate(BaseModel):
    name: str


class ZoneOut(BaseModel):
    id: uuid.UUID
    name: str

    class Config:
        from_attributes = True


class ZonePincodesIn(BaseModel):
    pincodes: List[str]


class ZonePincodeOut(BaseModel):
    id: uuid.UUID
    zone_id: uuid.UUID
    pincode: str

    class Config:
        from_attributes = True