"""
iOS device session via pymobiledevice3 tunneld (iOS 17+).

Requires:
  sudo pymobiledevice3 remote tunneld   (keep running in a separate terminal)

Usage:
  session = DeviceSession()
  await session.connect()           # call once at startup
  await session.set_location(lat, lng)
  await session.clear_location()
  await session.disconnect()        # call at shutdown
"""

import asyncio
import logging
from contextlib import AsyncExitStack

from pymobiledevice3.exceptions import TunneldConnectionError
from pymobiledevice3.services.dvt.instruments.dvt_provider import DvtProvider
from pymobiledevice3.services.dvt.instruments.location_simulation import LocationSimulation
from pymobiledevice3.tunneld.api import get_tunneld_devices

logger = logging.getLogger(__name__)

RECONNECT_DELAY = 3.0


class DeviceNotConnectedError(RuntimeError):
    pass


class DeviceSession:
    def __init__(self) -> None:
        self._rsd = None
        self._dvt = None
        self._sim: LocationSimulation | None = None
        self._stack = AsyncExitStack()
        self._lock = asyncio.Lock()
        self.connected = False

    async def connect(self, udid: str | None = None) -> None:
        """Connect to the first tunneld device (or the one matching udid)."""
        async with self._lock:
            await self._do_connect(udid)

    async def _do_connect(self, udid: str | None = None) -> None:
        try:
            devices = await get_tunneld_devices()
        except TunneldConnectionError:
            raise RuntimeError(
                "tunneld is not running. Start it with:\n"
                "  sudo pymobiledevice3 remote tunneld"
            )

        if not devices:
            raise RuntimeError(
                "No iOS device found via tunneld.\n"
                "Make sure your iPhone is connected via USB with Developer Mode enabled."
            )

        rsd = devices[0]
        if udid:
            match = next((d for d in devices if d.udid == udid), None)
            if match is None:
                raise RuntimeError(f"Device with UDID {udid} not found. Available: {[d.udid for d in devices]}")
            for d in devices:
                if d is not match:
                    await d.close()
            rsd = match
        else:
            for d in devices[1:]:
                await d.close()

        self._rsd = rsd
        stack = AsyncExitStack()
        dvt = await stack.enter_async_context(DvtProvider(rsd))
        sim = await stack.enter_async_context(LocationSimulation(dvt))
        self._stack = stack
        self._dvt = dvt
        self._sim = sim
        self.connected = True
        logger.info(f"Connected to device {rsd.udid} (iOS {rsd.product_version})")

    async def disconnect(self) -> None:
        async with self._lock:
            self.connected = False
            self._sim = None
            await self._stack.aclose()
            if self._rsd:
                await self._rsd.close()
                self._rsd = None
            logger.info("Device disconnected")

    async def set_location(self, lat: float, lng: float) -> None:
        if self._sim is None:
            raise DeviceNotConnectedError("No device connected")
        await self._sim.set(lat, lng)

    async def clear_location(self) -> None:
        if self._sim is None:
            return
        await self._sim.clear()

    def device_info(self) -> dict:
        if self._rsd is None:
            return {"connected": False}
        return {
            "connected": True,
            "udid": self._rsd.udid,
            "ios_version": self._rsd.product_version,
        }
