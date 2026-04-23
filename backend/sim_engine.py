"""
Simulation engine: manages the active movement mode and drives the device position.

Modes:
  idle       - no movement
  navigate   - walk to a single destination via OSRM route
  route      - walk through a sequence of waypoints (optional loop)
  joystick   - real-time WASD/arrow-key control
"""

import asyncio
import logging
from enum import Enum

from backend.device import DeviceSession
from backend.joystick import compute_delta, compute_delta_vector
from backend.osrm import get_walking_route
from backend.walker import DEFAULT_SPEED_MPS, walk_polyline
from backend.waypoints import Waypoint, build_full_polyline
from backend.ws import WSHub

logger = logging.getLogger(__name__)

TICK_S = 1.0


class Mode(str, Enum):
    idle = "idle"
    navigate = "navigate"
    route = "route"
    joystick = "joystick"


class SimulationEngine:
    def __init__(self, device: DeviceSession, hub: WSHub) -> None:
        self._device = device
        self._hub = hub
        self._task: asyncio.Task | None = None
        self._mode = Mode.idle
        self._lat: float = 0.0
        self._lng: float = 0.0
        self._speed_mps: float = DEFAULT_SPEED_MPS
        self._lock = asyncio.Lock()

    @property
    def mode(self) -> Mode:
        return self._mode

    @property
    def position(self) -> tuple[float, float]:
        return (self._lat, self._lng)

    def set_speed(self, kmh: float) -> None:
        from backend.walker import MAX_SPEED_MPS
        self._speed_mps = min(kmh / 3.6, MAX_SPEED_MPS)

    async def stop(self) -> None:
        async with self._lock:
            await self._cancel_task()
            self._mode = Mode.idle

    async def teleport(self, lat: float, lng: float) -> None:
        async with self._lock:
            await self._cancel_task()
            self._lat, self._lng = lat, lng
            self._mode = Mode.idle
        await self._push_position()

    async def navigate(self, dest_lat: float, dest_lng: float, speed_kmh: float | None = None) -> None:
        if speed_kmh is not None:
            self.set_speed(speed_kmh)
        route = await get_walking_route((self._lat, self._lng), (dest_lat, dest_lng))
        async with self._lock:
            await self._cancel_task()
            self._mode = Mode.navigate
            self._task = asyncio.create_task(self._run_walk(route, loop=False, dwells=None))

    async def start_route(
        self,
        waypoints: list[Waypoint],
        speed_kmh: float | None = None,
        loop: bool = False,
    ) -> None:
        if speed_kmh is not None:
            self.set_speed(speed_kmh)
        full_poly = await build_full_polyline(waypoints)
        dwells = [w.dwell_s for w in waypoints[1:]]
        async with self._lock:
            await self._cancel_task()
            self._mode = Mode.route
            self._task = asyncio.create_task(self._run_walk(full_poly, loop=loop, dwells=dwells))

    async def start_joystick(self, speed_kmh: float | None = None) -> None:
        if speed_kmh is not None:
            self.set_speed(speed_kmh)
        async with self._lock:
            await self._cancel_task()
            self._mode = Mode.joystick
            self._task = asyncio.create_task(self._run_joystick())

    # ── internal tasks ─────────────────────────────────────────────────────────

    async def _run_walk(
        self,
        polyline: list[tuple[float, float]],
        loop: bool,
        dwells: list[float] | None,
    ) -> None:
        try:
            while True:
                async for lat, lng in walk_polyline(polyline, self._speed_mps, TICK_S):
                    self._lat, self._lng = lat, lng
                    await self._push_position()
                    await self._device.set_location(lat, lng)

                if dwells:
                    await asyncio.sleep(dwells[-1] if dwells else 0)

                if not loop:
                    break
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            logger.error(f"Walk task error: {exc}")
        finally:
            if self._mode in (Mode.navigate, Mode.route):
                self._mode = Mode.idle

    async def _run_joystick(self) -> None:
        try:
            while True:
                await asyncio.sleep(TICK_S)
                # Prefer continuous vector (circle joystick) over discrete keys
                vx, vy = await self._hub.get_vector()
                if abs(vx) > 0.05 or abs(vy) > 0.05:
                    dlat, dlng = compute_delta_vector(vx, vy, self._lat, self._speed_mps, TICK_S)
                else:
                    keys = await self._hub.get_held_keys()
                    if not keys:
                        continue
                    dlat, dlng = compute_delta(keys, self._lat, self._speed_mps, TICK_S)
                self._lat += dlat
                self._lng += dlng
                await self._push_position()
                await self._device.set_location(self._lat, self._lng)
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            logger.error(f"Joystick task error: {exc}")

    async def _cancel_task(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await asyncio.wait_for(asyncio.shield(self._task), timeout=2.0)
            except (asyncio.CancelledError, asyncio.TimeoutError):
                pass
        self._task = None

    async def _push_position(self) -> None:
        await self._hub.broadcast({
            "type": "position",
            "lat": self._lat,
            "lng": self._lng,
            "mode": self._mode,
        })

    def state(self) -> dict:
        return {
            "mode": self._mode,
            "lat": self._lat,
            "lng": self._lng,
            "speed_kmh": round(self._speed_mps * 3.6, 2),
        }
