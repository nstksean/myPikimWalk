"""
WebSocket hub: broadcast position updates and receive joystick key events.
"""

import asyncio
import json
import logging
from typing import TYPE_CHECKING

from fastapi import WebSocket

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


class WSHub:
    def __init__(self) -> None:
        self._clients: set[WebSocket] = set()
        self._joystick_keys: set[str] = set()
        self._joystick_lock = asyncio.Lock()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._clients.add(ws)

    def disconnect(self, ws: WebSocket) -> None:
        self._clients.discard(ws)

    async def broadcast(self, data: dict) -> None:
        dead: set[WebSocket] = set()
        msg = json.dumps(data)
        for ws in list(self._clients):
            try:
                await ws.send_text(msg)
            except Exception:
                dead.add(ws)
        self._clients -= dead

    async def handle_incoming(self, ws: WebSocket) -> None:
        """Read messages from a single connected client (joystick key events)."""
        try:
            async for text in ws.iter_text():
                try:
                    msg = json.loads(text)
                    if msg.get("type") == "keys":
                        async with self._joystick_lock:
                            self._joystick_keys = set(k.lower() for k in msg.get("keys", []))
                except json.JSONDecodeError:
                    pass
        except Exception:
            pass

    async def get_held_keys(self) -> set[str]:
        async with self._joystick_lock:
            return set(self._joystick_keys)


hub = WSHub()
