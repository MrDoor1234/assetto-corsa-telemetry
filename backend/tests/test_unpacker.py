import pytest
import struct
from backend.src.unpacker import (
    RT_CAR_INFO_SIZE,
    HANDSHAKE_SIZE,
    OperationId,
    pack_handshake,
    unpack_rt_car_info,
    pack_rt_car_info,
    gear_index_to_str,
)


def test_struct_sizes():
    """Verify strictly packed byte counts required by Assetto Corsa UDP protocol."""
    assert RT_CAR_INFO_SIZE == 328
    assert HANDSHAKE_SIZE == 12


def test_pack_handshake():
    """Verify handshake serialization structure."""
    packet = pack_handshake(identifier=1, version=1, operation_id=OperationId.SUBSCRIBE_UPDATE)
    assert len(packet) == 12
    ident, ver, op = struct.unpack("<3i", packet)
    assert ident == 1
    assert ver == 1
    assert op == OperationId.SUBSCRIBE_UPDATE


def test_gear_translation():
    """Verify integer to gear mapping."""
    assert gear_index_to_str(0) == "R"
    assert gear_index_to_str(1) == "N"
    assert gear_index_to_str(2) == "1"
    assert gear_index_to_str(6) == "5"
    assert gear_index_to_str(8) == "7"


def test_unpack_rt_car_info_accuracy():
    """Verify full unpack precision on synthetic telemetry frame."""
    raw_packet = pack_rt_car_info(
        speed_kmh=298.5,
        engine_rpm=12400.0,
        gear=7,  # 6th gear in sim (7 - 1 = 6)
        throttle=0.98,
        brake=0.0,
        clutch=0.0,
        steer=-0.04,
        lap_time_ms=62150,
        lap_count=18,
        car_pos_norm=0.72,
    )

    info = unpack_rt_car_info(raw_packet)

    assert info.size == 328
    assert abs(info.speed_kmh - 298.5) < 0.05
    assert abs(info.engine_rpm - 12400.0) < 0.5
    assert info.gear == 7
    assert info.gear_name == "6"
    assert abs(info.throttle - 0.98) < 0.01
    assert info.brake == 0.0
    assert info.lap_time_ms == 62150
    assert info.lap_count == 18
    assert abs(info.car_position_normalized - 0.72) < 0.01
    assert info.is_abs_enabled is True
    assert info.is_in_pit is False

    # Check 4-wheel array unpacking
    assert isinstance(info.wheel_angular_speed.fl, float)
    assert isinstance(info.suspension_height.rr, float)

    # Check dictionary serialization
    d = info.to_dict()
    assert d["gear_name"] == "6"
    assert "fl" in d["wheel_angular_speed"]


def test_truncated_packet_error():
    """Verify that corrupt or truncated UDP packets are safely rejected."""
    corrupt_data = b"short_packet_bytes"
    with pytest.raises(ValueError) as excinfo:
        unpack_rt_car_info(corrupt_data)
    assert "Packet size mismatch" in str(excinfo.value)
