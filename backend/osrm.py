"""
OSRM pedestrian routing.

Fetches a walking route from the public OSRM demo server.
Falls back to a straight line if OSRM is unavailable.
"""

import logging
from functools import lru_cache

import httpx

logger = logging.getLogger(__name__)

_OSRM_BASE = "https://router.project-osrm.org/route/v1/foot"
_TIMEOUT = 5.0


async def get_walking_route(
    origin: tuple[float, float],
    destination: tuple[float, float],
) -> list[tuple[float, float]]:
    """
    Return a pedestrian polyline from origin to destination as a list of (lat, lng).
    Falls back to a two-point straight line if OSRM fails.
    """
    try:
        return await _fetch_osrm(origin, destination)
    except Exception as exc:
        logger.warning(f"OSRM failed ({exc}), falling back to straight line")
        return [origin, destination]


async def _fetch_osrm(
    origin: tuple[float, float],
    destination: tuple[float, float],
) -> list[tuple[float, float]]:
    # OSRM coords are lng,lat
    o_lng, o_lat = origin[1], origin[0]
    d_lng, d_lat = destination[1], destination[0]
    url = f"{_OSRM_BASE}/{o_lng},{o_lat};{d_lng},{d_lat}"
    params = {"overview": "full", "geometries": "geojson", "steps": "false"}

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()

    if data.get("code") != "Ok" or not data.get("routes"):
        raise ValueError(f"OSRM returned no route: {data.get('code')}")

    coords = data["routes"][0]["geometry"]["coordinates"]
    # GeoJSON is [lng, lat] — flip to (lat, lng)
    return [(c[1], c[0]) for c in coords]
