"""
Joystick: maps a set of held keys to a per-tick (Δlat, Δlng) displacement.

The Earth is not flat — longitude degree length shrinks toward the poles.
We compensate so WASD gives equal-distance movement in all directions.
"""

import math

from backend.walker import MAX_SPEED_MPS

_R = 6_371_000.0

_KEY_VECTORS: dict[str, tuple[float, float]] = {
    "w":     (1.0,  0.0),
    "arrowup": (1.0, 0.0),
    "s":     (-1.0, 0.0),
    "arrowdown": (-1.0, 0.0),
    "a":     (0.0, -1.0),
    "arrowleft": (0.0, -1.0),
    "d":     (0.0,  1.0),
    "arrowright": (0.0, 1.0),
}


def compute_delta(
    held_keys: set[str],
    lat: float,
    speed_mps: float,
    tick_s: float = 1.0,
) -> tuple[float, float]:
    """
    Return (Δlat, Δlng) for one tick given the currently held keys.
    Diagonal movement is normalised so speed stays constant.
    """
    speed_mps = min(speed_mps, MAX_SPEED_MPS)
    dy, dx = 0.0, 0.0
    for k in held_keys:
        vec = _KEY_VECTORS.get(k.lower())
        if vec:
            dy += vec[0]
            dx += vec[1]

    norm = math.sqrt(dy ** 2 + dx ** 2)
    if norm == 0:
        return (0.0, 0.0)

    dy /= norm
    dx /= norm

    step_m = speed_mps * tick_s
    delta_lat = math.degrees(step_m * dy / _R)
    cos_lat = math.cos(math.radians(lat))
    delta_lng = math.degrees(step_m * dx / (_R * cos_lat)) if cos_lat > 1e-9 else 0.0

    return (delta_lat, delta_lng)


def compute_delta_vector(
    vx: float,
    vy: float,
    lat: float,
    speed_mps: float,
    tick_s: float = 1.0,
) -> tuple[float, float]:
    """
    Return (Δlat, Δlng) from a continuous joystick vector (vx, vy) in [-1, 1].
    vy > 0 = north, vx > 0 = east. Magnitude scales speed proportionally.
    """
    speed_mps = min(speed_mps, MAX_SPEED_MPS)
    magnitude = math.sqrt(vx ** 2 + vy ** 2)
    if magnitude < 0.05:
        return (0.0, 0.0)

    magnitude = min(magnitude, 1.0)
    step_m = speed_mps * tick_s * magnitude
    delta_lat = math.degrees(step_m * vy / _R)
    cos_lat = math.cos(math.radians(lat))
    delta_lng = math.degrees(step_m * vx / (_R * cos_lat)) if cos_lat > 1e-9 else 0.0

    return (delta_lat, delta_lng)
