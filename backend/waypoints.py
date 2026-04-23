"""
Multi-waypoint route: walk through a sequence of (lat, lng) stops,
optionally dwelling at each stop, then optionally looping.
"""

from dataclasses import dataclass, field

from backend.osrm import get_walking_route


@dataclass
class Waypoint:
    lat: float
    lng: float
    dwell_s: float = 5.0


async def build_full_polyline(
    waypoints: list[Waypoint],
) -> list[tuple[float, float]]:
    """
    Fetch OSRM segments between consecutive waypoints and stitch into one polyline.
    Dwell is handled by the simulation engine (not part of geometry).
    """
    if len(waypoints) < 2:
        return [(w.lat, w.lng) for w in waypoints]

    result: list[tuple[float, float]] = []
    for i in range(len(waypoints) - 1):
        a = waypoints[i]
        b = waypoints[i + 1]
        segment = await get_walking_route((a.lat, a.lng), (b.lat, b.lng))
        if result and segment and result[-1] == segment[0]:
            result.extend(segment[1:])
        else:
            result.extend(segment)

    return result
