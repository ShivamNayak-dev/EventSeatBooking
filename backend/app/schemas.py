import datetime
from decimal import Decimal
from pydantic import BaseModel, EmailStr, ConfigDict


# ---------- Auth ----------
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: EmailStr


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------- Events ----------
class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    venue: str
    event_time: datetime.datetime
    rows: int
    cols: int
    price: Decimal


# ---------- Seats ----------
class SeatOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    row_label: str
    col_number: int
    label: str
    status: str  # "available" | "locked" | "booked"
    locked_by_me: bool = False


class SeatMapOut(BaseModel):
    event: EventOut
    seats: list[SeatOut]


# ---------- Locking ----------
class LockResponse(BaseModel):
    seat_id: int
    locked: bool
    expires_in_seconds: int


# ---------- Bookings ----------
class BookingCreate(BaseModel):
    seat_id: int


class BookingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    seat_id: int
    event_id: int
    status: str
    booked_at: datetime.datetime
