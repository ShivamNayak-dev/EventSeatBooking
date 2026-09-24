import json
from collections import defaultdict
from typing import Dict, Set

from fastapi import WebSocket


class ConnectionManager:
    """Tracks active WebSocket connections per event so seat updates can be
    broadcast only to clients currently viewing that event's seat map."""

    def __init__(self) -> None:
        self.active: Dict[int, Set[WebSocket]] = defaultdict(set)

    async def connect(self, event_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active[event_id].add(websocket)

    def disconnect(self, event_id: int, websocket: WebSocket) -> None:
        self.active[event_id].discard(websocket)
        if not self.active[event_id]:
            self.active.pop(event_id, None)

    async def broadcast(self, event_id: int, message: dict) -> None:
        dead = []
        for ws in self.active.get(event_id, set()):
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(event_id, ws)


manager = ConnectionManager()
