"""
myPikminGps backend — FastAPI server.

Start (requires sudo for iOS 17+ tunnel):
  sudo /path/to/.venv/bin/python -m backend.main

Prerequisites:
  sudo pymobiledevice3 remote tunneld   (keep running in another terminal)
"""

import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, HTTPException, Query, WebSocket
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator

from backend.device import DeviceNotConnectedError, DeviceSession
from backend.sim_engine import SimulationEngine
from backend.walker import MAX_SPEED_MPS
from backend.waypoints import Waypoint
from backend.ws import WSHub, hub

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

_device = DeviceSession()
_engine: SimulationEngine | None = None

MAX_SPEED_KMH = MAX_SPEED_MPS * 3.6  # ≈ 5.0


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _engine
    _engine = SimulationEngine(_device, hub)
    try:
        await _device.connect()
        logger.info("Device connected at startup")
    except Exception as exc:
        logger.warning(f"Could not connect to device at startup: {exc}")
        logger.warning("The server will still start — connect your iPhone and call POST /api/connect")
    yield
    await _device.clear_location()
    await _device.disconnect()


app = FastAPI(title="myPikminGps", lifespan=lifespan)

FRONTEND_DIR = Path(__file__).parent.parent / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")


# ── models ──────────────────────────────────────────────────────────────────

class LatLng(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class NavigateRequest(LatLng):
    speed_kmh: float = Field(default=3.5, ge=0.5, le=MAX_SPEED_KMH)


class RouteWaypoint(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    dwell_s: float = Field(default=5.0, ge=0.0)


class RouteRequest(BaseModel):
    waypoints: list[RouteWaypoint] = Field(min_length=2)
    speed_kmh: float = Field(default=3.5, ge=0.5, le=MAX_SPEED_KMH)
    loop: bool = False

    @field_validator("waypoints")
    @classmethod
    def at_least_two(cls, v: list) -> list:
        if len(v) < 2:
            raise ValueError("At least 2 waypoints required")
        return v


class SpeedRequest(BaseModel):
    speed_kmh: float = Field(ge=0.5, le=MAX_SPEED_KMH)


# ── helpers ──────────────────────────────────────────────────────────────────

def _engine_or_503() -> SimulationEngine:
    if _engine is None:
        raise HTTPException(503, "Engine not initialised")
    return _engine


def _require_device() -> SimulationEngine:
    eng = _engine_or_503()
    if not _device.connected:
        raise HTTPException(503, "No iOS device connected. Call POST /api/connect first.")
    return eng


# ── routes ───────────────────────────────────────────────────────────────────

@app.get("/")
async def index():
    """Serve the frontend."""
    from fastapi.responses import FileResponse
    index_path = FRONTEND_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return {"status": "ok", "hint": "frontend/index.html not found"}


@app.get("/api/status")
async def status():
    eng = _engine_or_503()
    return {**eng.state(), **_device.device_info()}


@app.post("/api/connect")
async def connect(udid: Annotated[str | None, Query()] = None):
    """(Re-)connect to a tunneld device. Optional ?udid= to target a specific device."""
    try:
        await _device.connect(udid)
        if _engine:
            pass  # engine already references the same device session
        return _device.device_info()
    except RuntimeError as exc:
        raise HTTPException(503, str(exc))


@app.post("/api/teleport")
async def teleport(body: LatLng):
    eng = _require_device()
    try:
        await eng.teleport(body.lat, body.lng)
        return {"ok": True, "lat": body.lat, "lng": body.lng}
    except DeviceNotConnectedError as exc:
        raise HTTPException(503, str(exc))


@app.post("/api/navigate")
async def navigate(body: NavigateRequest):
    eng = _require_device()
    try:
        await eng.navigate(body.lat, body.lng, body.speed_kmh)
        return {"ok": True, "mode": "navigate", "dest": {"lat": body.lat, "lng": body.lng}}
    except DeviceNotConnectedError as exc:
        raise HTTPException(503, str(exc))


@app.post("/api/route")
async def start_route(body: RouteRequest):
    eng = _require_device()
    waypoints = [Waypoint(w.lat, w.lng, w.dwell_s) for w in body.waypoints]
    try:
        await eng.start_route(waypoints, body.speed_kmh, body.loop)
        return {"ok": True, "mode": "route", "waypoints": len(waypoints), "loop": body.loop}
    except DeviceNotConnectedError as exc:
        raise HTTPException(503, str(exc))


@app.post("/api/joystick/start")
async def joystick_start(body: SpeedRequest | None = None):
    eng = _require_device()
    speed = body.speed_kmh if body else 3.5
    try:
        await eng.start_joystick(speed)
        return {"ok": True, "mode": "joystick"}
    except DeviceNotConnectedError as exc:
        raise HTTPException(503, str(exc))


@app.post("/api/stop")
async def stop():
    eng = _engine_or_503()
    await eng.stop()
    return {"ok": True, "mode": "idle"}


@app.post("/api/speed")
async def set_speed(body: SpeedRequest):
    eng = _engine_or_503()
    eng.set_speed(body.speed_kmh)
    return {"ok": True, "speed_kmh": body.speed_kmh}


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await hub.connect(ws)
    try:
        await hub.handle_incoming(ws)
    finally:
        hub.disconnect(ws)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=False)
