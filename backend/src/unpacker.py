"""
Assetto Corsa UDP Binary Struct Unpacker.

Handles unpacking of the RTCarInfo (328 bytes) telemetry payload and
packing of handshake requests.
"""

from dataclasses import dataclass, asdict
import struct
from typing import Dict, Any, Tuple

# Assetto Corsa RTCarInfo Struct Format (Little-endian, packed with no padding)
# 4s  : identifier (e.g. b'%   ' or b'a\x00\x00\x00')
# I   : size (328)
# 3f  : speedKmh, speedMph, speedMs
# 8B  : isAbsEnabled, isAbsInAction, isTcInAction, isTcEnabled, isInPit, isEngineLimiterOn, unkA, unkB
# 3f  : heave, sway, surge (G-forces)
# 4I  : lapTime, lastLap, bestLap, lapCount
# 5f  : throttle, brake, clutch, engineRPM, steer
# I   : gear (0=R, 1=N, 2=1st, 3=2nd...)
# f   : cgHeight
# 56f : 14 arrays of 4 floats each (FL, FR, RL, RR)
# 2f  : carPositionNormalized, carSlope
# 3f  : carCoordinates (X, Y, Z)
RT_CAR_INFO_FORMAT = "<4sI3f8B3f4I5fIf56f2f3f"
RT_CAR_INFO_SIZE = struct.calcsize(RT_CAR_INFO_FORMAT)
assert RT_CAR_INFO_SIZE == 328, f"Expected struct size 328, got {RT_CAR_INFO_SIZE}"

HANDSHAKE_FORMAT = "<3i"
HANDSHAKE_SIZE = struct.calcsize(HANDSHAKE_FORMAT)


class OperationId:
    HANDSHAKE = 0
    SUBSCRIBE_UPDATE = 1
    SUBSCRIBE_SPOT = 2
    DISMISS = 3


@dataclass
class FourWheelArray:
    fl: float
    fr: float
    rl: float
    rr: float

    def to_dict(self) -> Dict[str, float]:
        return {"fl": self.fl, "fr": self.fr, "rl": self.rl, "rr": self.rr}


@dataclass
class RTCarInfo:
    identifier: str
    size: int
    speed_kmh: float
    speed_mph: float
    speed_ms: float
    is_abs_enabled: bool
    is_abs_in_action: bool
    is_tc_in_action: bool
    is_tc_enabled: bool
    is_in_pit: bool
    is_engine_limiter_on: bool
    heave: float
    sway: float
    surge: float
    lap_time_ms: int
    last_lap_ms: int
    best_lap_ms: int
    lap_count: int
    throttle: float
    brake: float
    clutch: float
    engine_rpm: float
    steer: float
    gear: int
    gear_name: str
    cg_height: float
    wheel_angular_speed: FourWheelArray
    slip_angle: FourWheelArray
    slip_angle_contact_patch: FourWheelArray
    slip_ratio: FourWheelArray
    tyre_slip: FourWheelArray
    nd_slip: FourWheelArray
    vertical_load: FourWheelArray
    lateral_load: FourWheelArray
    self_aligning_torque: FourWheelArray
    tyre_dirty_level: FourWheelArray
    camber_rad: FourWheelArray
    tyre_radius: FourWheelArray
    tyre_loaded_radius: FourWheelArray
    suspension_height: FourWheelArray
    car_position_normalized: float
    car_slope: float
    car_coordinates: Tuple[float, float, float]

    def to_dict(self) -> Dict[str, Any]:
        """Convert telemetry struct to clean dictionary for JSON/WebSocket serialization."""
        d = asdict(self)
        # Convert nested dataclasses
        for k, v in d.items():
            if isinstance(v, FourWheelArray):
                d[k] = v.to_dict()
        return d


def gear_index_to_str(gear: int) -> str:
    """Map Assetto Corsa gear integer to human-readable string."""
    if gear == 0:
        return "R"
    elif gear == 1:
        return "N"
    else:
        return str(gear - 1)


def pack_handshake(identifier: int = 1, version: int = 1, operation_id: int = OperationId.SUBSCRIBE_UPDATE) -> bytes:
    """Create a 12-byte handshake packet to subscribe/dismiss Assetto Corsa telemetry feed."""
    return struct.pack(HANDSHAKE_FORMAT, identifier, version, operation_id)


def unpack_rt_car_info(data: bytes) -> RTCarInfo:
    """Unpack raw 328-byte UDP packet into a strongly-typed RTCarInfo instance."""
    if len(data) < RT_CAR_INFO_SIZE:
        raise ValueError(f"Packet size mismatch: expected at least {RT_CAR_INFO_SIZE} bytes, got {len(data)}")

    unpacked = struct.unpack(RT_CAR_INFO_FORMAT, data[:RT_CAR_INFO_SIZE])

    raw_ident = unpacked[0].decode("ascii", errors="ignore").strip("\x00")
    size = unpacked[1]
    speed_kmh = round(unpacked[2], 2)
    speed_mph = round(unpacked[3], 2)
    speed_ms = round(unpacked[4], 2)

    is_abs_enabled = bool(unpacked[5])
    is_abs_in_action = bool(unpacked[6])
    is_tc_in_action = bool(unpacked[7])
    is_tc_enabled = bool(unpacked[8])
    is_in_pit = bool(unpacked[9])
    is_engine_limiter_on = bool(unpacked[10])
    # unpacked[11], unpacked[12] are reserved bytes

    heave = round(unpacked[13], 3)
    sway = round(unpacked[14], 3)
    surge = round(unpacked[15], 3)

    lap_time_ms = unpacked[16]
    last_lap_ms = unpacked[17]
    best_lap_ms = unpacked[18]
    lap_count = unpacked[19]

    throttle = round(max(0.0, min(1.0, unpacked[20])), 3)
    brake = round(max(0.0, min(1.0, unpacked[21])), 3)
    clutch = round(max(0.0, min(1.0, unpacked[22])), 3)
    engine_rpm = round(unpacked[23], 1)
    steer = round(unpacked[24], 3)
    gear = unpacked[25]
    cg_height = round(unpacked[26], 4)

    # 14 4-wheel arrays start at index 27
    idx = 27
    arrays = []
    for _ in range(14):
        arrays.append(FourWheelArray(
            fl=round(unpacked[idx], 4),
            fr=round(unpacked[idx + 1], 4),
            rl=round(unpacked[idx + 2], 4),
            rr=round(unpacked[idx + 3], 4),
        ))
        idx += 4

    car_pos_norm = round(unpacked[idx], 4)
    car_slope = round(unpacked[idx + 1], 4)
    car_coords = (
        round(unpacked[idx + 2], 3),
        round(unpacked[idx + 3], 3),
        round(unpacked[idx + 4], 3),
    )

    return RTCarInfo(
        identifier=raw_ident,
        size=size,
        speed_kmh=speed_kmh,
        speed_mph=speed_mph,
        speed_ms=speed_ms,
        is_abs_enabled=is_abs_enabled,
        is_abs_in_action=is_abs_in_action,
        is_tc_in_action=is_tc_in_action,
        is_tc_enabled=is_tc_enabled,
        is_in_pit=is_in_pit,
        is_engine_limiter_on=is_engine_limiter_on,
        heave=heave,
        sway=sway,
        surge=surge,
        lap_time_ms=lap_time_ms,
        last_lap_ms=last_lap_ms,
        best_lap_ms=best_lap_ms,
        lap_count=lap_count,
        throttle=throttle,
        brake=brake,
        clutch=clutch,
        engine_rpm=engine_rpm,
        steer=steer,
        gear=gear,
        gear_name=gear_index_to_str(gear),
        cg_height=cg_height,
        wheel_angular_speed=arrays[0],
        slip_angle=arrays[1],
        slip_angle_contact_patch=arrays[2],
        slip_ratio=arrays[3],
        tyre_slip=arrays[4],
        nd_slip=arrays[5],
        vertical_load=arrays[6],
        lateral_load=arrays[7],
        self_aligning_torque=arrays[8],
        tyre_dirty_level=arrays[9],
        camber_rad=arrays[10],
        tyre_radius=arrays[11],
        tyre_loaded_radius=arrays[12],
        suspension_height=arrays[13],
        car_position_normalized=car_pos_norm,
        car_slope=car_slope,
        car_coordinates=car_coords,
    )


def pack_rt_car_info(
    speed_kmh: float = 245.5,
    engine_rpm: float = 11200.0,
    gear: int = 5,
    throttle: float = 1.0,
    brake: float = 0.0,
    clutch: float = 0.0,
    steer: float = 0.02,
    lap_time_ms: int = 45230,
    lap_count: int = 12,
    car_pos_norm: float = 0.45,
) -> bytes:
    """Helper to pack a synthetic RTCarInfo packet (used for unit tests and mock server)."""
    ident = b"a\x00\x00\x00"
    size = 328
    speed_mph = speed_kmh * 0.621371
    speed_ms = speed_kmh / 3.6
    flags = (1, 0, 0, 1, 0, 0, 0, 0)
    g_forces = (0.05, 0.12, 1.45)
    laps = (lap_time_ms, 78400, 77890, lap_count)
    inputs = (throttle, brake, clutch, engine_rpm, steer)
    gear_val = gear
    cg_height = 0.35

    # 14 4-wheel float arrays (56 floats)
    wheel_floats = []
    # 0: wheel_angular_speed
    wheel_floats.extend([speed_ms * 3.1] * 4)
    # 1: slip_angle
    wheel_floats.extend([0.01, -0.01, 0.005, -0.005])
    # 2..13: fill realistic defaults
    for _ in range(12):
        wheel_floats.extend([1.0, 1.0, 1.0, 1.0])

    pos_slope = (car_pos_norm, 0.01)
    coords = (120.45, 12.3, -450.2)

    return struct.pack(
        RT_CAR_INFO_FORMAT,
        ident,
        size,
        speed_kmh,
        speed_mph,
        speed_ms,
        *flags,
        *g_forces,
        *laps,
        *inputs,
        gear_val,
        cg_height,
        *wheel_floats,
        *pos_slope,
        *coords,
    )
