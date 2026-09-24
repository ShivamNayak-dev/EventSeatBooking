import redis

from app.config import settings

redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)


def seat_lock_key(seat_id: int) -> str:
    return f"lock:seat:{seat_id}"
