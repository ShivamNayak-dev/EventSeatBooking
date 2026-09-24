from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models, schemas, auth
from app.database import get_db
from app.redis_client import redis_client, seat_lock_key
from app.websocket_manager import manager

router = APIRouter(prefix="/bookings", tags=["bookings"])


@router.post("", response_model=schemas.BookingOut, status_code=201)
async def create_booking(
    payload: schemas.BookingCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    seat = db.query(models.Seat).filter(models.Seat.id == payload.seat_id).first()
    if not seat:
        raise HTTPException(status_code=404, detail="Seat not found")

    key = seat_lock_key(seat.id)
    owner = redis_client.get(key)
    if owner != str(current_user.id):
        raise HTTPException(
            status_code=409,
            detail="You must hold an active lock on this seat before confirming it "
                   "(your hold may have expired — try selecting the seat again).",
        )

    booking = models.Booking(seat_id=seat.id, event_id=seat.event_id, user_id=current_user.id)
    db.add(booking)
    try:
        db.commit()
    except IntegrityError:
        # Defense-in-depth: even if two requests somehow both believed they
        # held the lock, the DB-level unique constraint on seat_id guarantees
        # only one booking can ever be committed for a given seat.
        db.rollback()
        raise HTTPException(status_code=409, detail="Seat was just booked by someone else")

    db.refresh(booking)
    redis_client.delete(key)

    await manager.broadcast(seat.event_id, {"type": "seat_booked", "seat_id": seat.id})
    return booking


@router.get("/me", response_model=list[schemas.BookingOut])
def my_bookings(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return (
        db.query(models.Booking)
        .filter(models.Booking.user_id == current_user.id)
        .order_by(models.Booking.booked_at.desc())
        .all()
    )
