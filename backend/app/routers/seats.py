from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app import models, schemas, auth
from app.database import get_db
from app.redis_client import redis_client, seat_lock_key
from app.config import settings
from app.websocket_manager import manager

router = APIRouter(tags=["seats"])


def _seat_status(seat: models.Seat, current_user_id: int | None) -> schemas.SeatOut:
    if seat.booking is not None:
        status_val = "booked"
        locked_by_me = False
    else:
        lock_owner = redis_client.get(seat_lock_key(seat.id))
        if lock_owner is not None:
            status_val = "locked"
            locked_by_me = current_user_id is not None and str(current_user_id) == lock_owner
        else:
            status_val = "available"
            locked_by_me = False

    return schemas.SeatOut(
        id=seat.id,
        row_label=seat.row_label,
        col_number=seat.col_number,
        label=seat.label,
        status=status_val,
        locked_by_me=locked_by_me,
    )


@router.get("/events/{event_id}/seats", response_model=schemas.SeatMapOut)
def get_seat_map(event_id: int, db: Session = Depends(get_db)):
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    seats = (
        db.query(models.Seat)
        .filter(models.Seat.event_id == event_id)
        .order_by(models.Seat.row_label, models.Seat.col_number)
        .all()
    )
    return schemas.SeatMapOut(
        event=event, seats=[_seat_status(s, None) for s in seats]
    )


@router.post("/seats/{seat_id}/lock", response_model=schemas.LockResponse)
async def lock_seat(
    seat_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    seat = db.query(models.Seat).filter(models.Seat.id == seat_id).first()
    if not seat:
        raise HTTPException(status_code=404, detail="Seat not found")
    if seat.booking is not None:
        raise HTTPException(status_code=409, detail="Seat already booked")

    key = seat_lock_key(seat_id)
    # SET ... NX EX is atomic: only one concurrent request can win the lock.
    acquired = redis_client.set(
        key, str(current_user.id), nx=True, ex=settings.SEAT_LOCK_TTL_SECONDS
    )
    if not acquired:
        owner = redis_client.get(key)
        if owner == str(current_user.id):
            # Same user re-locking (e.g. page refresh) — refresh the TTL.
            redis_client.expire(key, settings.SEAT_LOCK_TTL_SECONDS)
            acquired = True
        else:
            raise HTTPException(status_code=409, detail="Seat is currently held by another user")

    await manager.broadcast(
        seat.event_id, {"type": "seat_locked", "seat_id": seat_id, "user_id": current_user.id}
    )
    return schemas.LockResponse(
        seat_id=seat_id, locked=True, expires_in_seconds=settings.SEAT_LOCK_TTL_SECONDS
    )


@router.delete("/seats/{seat_id}/lock")
async def release_seat(
    seat_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    seat = db.query(models.Seat).filter(models.Seat.id == seat_id).first()
    key = seat_lock_key(seat_id)
    owner = redis_client.get(key)
    if owner == str(current_user.id):
        redis_client.delete(key)
        if seat:
            await manager.broadcast(seat.event_id, {"type": "seat_released", "seat_id": seat_id})
    return {"released": True}


@router.websocket("/ws/events/{event_id}")
async def seat_updates_ws(websocket: WebSocket, event_id: int):
    await manager.connect(event_id, websocket)
    try:
        while True:
            # Clients don't need to send anything; this just keeps the
            # connection open and lets us detect disconnects.
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(event_id, websocket)
