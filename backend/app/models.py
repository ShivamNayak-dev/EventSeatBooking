import datetime

from sqlalchemy import (
    Column, Integer, String, ForeignKey, DateTime, Numeric, UniqueConstraint, Boolean
)
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_admin = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    bookings = relationship("Booking", back_populates="user")


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    venue = Column(String(200), nullable=False)
    event_time = Column(DateTime, nullable=False)
    rows = Column(Integer, nullable=False, default=6)
    cols = Column(Integer, nullable=False, default=8)
    price = Column(Numeric(10, 2), nullable=False, default=0)

    seats = relationship("Seat", back_populates="event", cascade="all, delete-orphan")


class Seat(Base):
    __tablename__ = "seats"
    __table_args__ = (UniqueConstraint("event_id", "row_label", "col_number", name="uq_seat_position"),)

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    row_label = Column(String(5), nullable=False)
    col_number = Column(Integer, nullable=False)
    label = Column(String(10), nullable=False)

    event = relationship("Event", back_populates="seats")
    booking = relationship("Booking", back_populates="seat", uselist=False)


class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = (UniqueConstraint("seat_id", name="uq_booking_seat"),)

    id = Column(Integer, primary_key=True, index=True)
    seat_id = Column(Integer, ForeignKey("seats.id"), nullable=False)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(20), nullable=False, default="confirmed")
    booked_at = Column(DateTime, default=datetime.datetime.utcnow)

    seat = relationship("Seat", back_populates="booking")
    user = relationship("User", back_populates="bookings")
