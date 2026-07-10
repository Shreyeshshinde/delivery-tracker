import uuid

from pydantic import BaseModel, EmailStr

from app.models.user import UserRole


class UserRegister(BaseModel):
    name: str
    email: EmailStr
    phone: str
    password: str
    role: UserRole = UserRole.CUSTOMER


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: uuid.UUID
    name: str
    email: EmailStr
    phone: str
    role: UserRole

    class Config:
        from_attributes = True


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut