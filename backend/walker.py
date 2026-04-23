"""
Walking engine: interpolates along a polyline at a given speed with jitter.

Yields (lat, lng) every tick_s seconds until the route is finished.
Purely computational — no I/O, easy to unit-test.
"""

import asyncio
import math
import random
from collections.abc import AsyncGenerator

# Earth radius metres
_R = 6_371_000.0

# Pikmin Bloom anti-detection limits
MAX_SPEED_MPS = 10.0 / 3.6    # 10 km/h hard cap (>5 km/h won't count as steps in Pikmin Bloom)
DEFAULT_SPEED_MPS = 3.5 / 3.6 # 3.5 km/h default (safe for step counting)
JITTER_FRACTION = 0.10         # ±10 % speed jitter
ARRIVAL_RADIUS_M = 3.0         # stop when within this distance of waypoint


def haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in metres."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 2 * _R * math.asin(math.sqrt(a))


def _bearing(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Initial bearing from point 1 to point 2, in radians."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dlam = math.radians(lng2 - lng1)
    x = math.sin(dlam) * math.cos(phi2)
    y = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(dlam)
    return math.atan2(x, y)


def _move(lat: float, lng: float, bearing: float, distance_m: float) -> tuple[float, float]:
    """Move `distance_m` metres from (lat, lng) along `bearing` (radians)."""
    d = distance_m / _R
    phi1 = math.radians(lat)
    lam1 = math.radians(lng)
    phi2 = math.asin(
        math.sin(phi1) * math.cos(d) + math.cos(phi1) * math.sin(d) * math.cos(bearing)
    )
    lam2 = lam1 + math.atan2(
        math.sin(bearing) * math.sin(d) * math.cos(phi1),
        math.cos(d) - math.sin(phi1) * math.sin(phi2),
    )
    return math.degrees(phi2), math.degrees(lam2)


async def walk_polyline(
    polyline: list[tuple[float, float]],
    speed_mps: float = DEFAULT_SPEED_MPS,
    tick_s: float = 1.0,
    jitter: float = JITTER_FRACTION,
) -> AsyncGenerator[tuple[float, float], None]:
    """
    Async generator that yields (lat, lng) positions every tick_s seconds
    as we walk along polyline at speed_mps with ±jitter speed noise.

    polyline: list of (lat, lng) pairs
    """
    speed_mps = min(speed_mps, MAX_SPEED_MPS)

    if not polyline:
        return

    cur_lat, cur_lng = polyline[0]
    yield (cur_lat, cur_lng)

    seg_idx = 1
    while seg_idx < len(polyline):
        target_lat, target_lng = polyline[seg_idx]

        dist = haversine(cur_lat, cur_lng, target_lat, target_lng)
        if dist < ARRIVAL_RADIUS_M:
            seg_idx += 1
            continue

        await asyncio.sleep(tick_s)

        effective_speed = speed_mps * (1.0 + random.uniform(-jitter, jitter))
        step_m = effective_speed * tick_s

        if step_m >= dist:
            cur_lat, cur_lng = target_lat, target_lng
            seg_idx += 1
        else:
            bearing = _bearing(cur_lat, cur_lng, target_lat, target_lng)
            cur_lat, cur_lng = _move(cur_lat, cur_lng, bearing, step_m)

        yield (cur_lat, cur_lng)
