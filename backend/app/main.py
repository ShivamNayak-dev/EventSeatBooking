import asyncio
import contextlib

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.redis_client import redis_client
from app.websocket_manager import manager
from app.routers import auth, events, seats, bookings

app = FastAPI(title="Seat Booking System", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(events.router)
app.include_router(seats.router)
app.include_router(bookings.router)


@app.get("/health")
def health():
    return {"status": "ok"}


async def expired_lock_listener():
    """
    Listens to Redis keyspace notifications for expired seat-lock keys and
    broadcasts a `seat_released` event so every connected client sees the
    seat go back to "available" the instant a 5-minute hold times out,
    instead of waiting for someone to manually refresh.

    Requires `notify-keyspace-events Ex` to be enabled on the Redis server
    (see docker-compose.yml). If it isn't enabled, the app still works
    correctly — clients simply fall back to re-fetching the seat map.
    """
    try:
        redis_client.config_set("notify-keyspace-events", "Ex")
    except Exception:
        return

    pubsub = redis_client.pubsub()
    pubsub.psubscribe("__keyevent@0__:expired")

    loop = asyncio.get_event_loop()
    while True:
        message = await loop.run_in_executor(None, pubsub.get_message, True, 1.0)
        if message and message.get("type") == "pmessage":
            expired_key: str = message["data"]
            if expired_key.startswith("lock:seat:"):
                seat_id = int(expired_key.split(":")[-1])
                # We don't know the event_id from the key alone in this MVP,
                # so we broadcast to all currently-open seat map connections.
                for event_id in list(manager.active.keys()):
                    await manager.broadcast(
                        event_id, {"type": "seat_released", "seat_id": seat_id}
                    )
        await asyncio.sleep(0)


@app.on_event("startup")
async def on_startup():
    Base.metadata.create_all(bind=engine)
    app.state.expiry_task = asyncio.create_task(expired_lock_listener())


@app.on_event("shutdown")
async def on_shutdown():
    task = getattr(app.state, "expiry_task", None)
    if task:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task
