"""
Assetto Corsa UDP Telemetry Simulator (Mock Server).

Emulates the Assetto Corsa UDP telemetry broadcast on 127.0.0.1:9996.
Allows development, integration testing, and UI rendering benchmarks
without needing the game running.
"""

import asyncio
import math
import socket
import struct
import sys
import time
from typing import Set, Tuple

# Handle import when run directly or as a module
try:
    from backend.src.unpacker import (
        RT_CAR_INFO_FORMAT,
        RT_CAR_INFO_SIZE,
        HANDSHAKE_FORMAT,
        OperationId,
        pack_rt_car_info,
    )
except ImportError:
    import os
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
    from backend.src.unpacker import (
        RT_CAR_INFO_FORMAT,
        RT_CAR_INFO_SIZE,
        HANDSHAKE_FORMAT,
        OperationId,
        pack_rt_car_info,
    )


class MockAssettoCorsaServer:
    def __init__(self, host: str = "127.0.0.1", port: int = 9996, tick_rate_hz: int = 60):
        self.host = host
        self.port = port
        self.tick_rate_hz = tick_rate_hz
        self.interval = 1.0 / tick_rate_hz
        self.subscribers: Set[Tuple[str, int]] = set()
        self.is_running = False
        self.transport: asyncio.DatagramTransport = None

        # Car physics simulation state
        self.sim_time = 0.0
        self.lap_count = 1
        self.current_lap_start = time.time()
        self.best_lap_ms = 78450

    def get_simulated_telemetry_bytes(self) -> bytes:
        """Simulate dynamic car physics along a virtual lap."""
        self.sim_time += self.interval
        t = self.sim_time

        # Simulate a 90-second lap cycle
        lap_cycle = (t % 90.0) / 90.0
        lap_time_ms = int((time.time() - self.current_lap_start) * 1000)

        # Dynamic track sectors: straights vs braking vs corners
        # Cycle: [0..0.4: Main Straight], [0.4..0.55: Heavy Braking & Hairpin],
        #        [0.55..0.75: Acceleration S-Curves], [0.75..0.9: Sweeper], [0.9..1.0: Final chicane]
        phase = t % 15.0  # repeating 15s sequence for visible dynamic changes

        if phase < 7.0:
            # Acceleration phase (Straights)
            progress = phase / 7.0
            speed_kmh = 100.0 + progress * 210.0  # 100 -> 310 km/h
            throttle = 1.0
            brake = 0.0
            steer = 0.02 * math.sin(t * 2.0)
            surge = 1.2 * (1.0 - progress * 0.5)  # Longitudinal accel
            sway = 0.1 * math.sin(t * 3.0)
            gear = min(8, int(2 + progress * 6))  # 2nd up to 8th gear
            engine_rpm = 6000.0 + ((progress * 6) % 1.0) * 7000.0
        elif phase < 9.5:
            # Heavy Braking phase
            progress = (phase - 7.0) / 2.5
            speed_kmh = max(65.0, 310.0 - progress * 240.0)  # 310 -> 70 km/h
            throttle = 0.0
            brake = 1.0 - progress * 0.2
            steer = 0.05
            surge = -3.8 * (1.0 - progress * 0.3)  # Heavy deceleration
            sway = 0.0
            gear = max(2, int(8 - progress * 6))  # Downshifting to 2nd
            engine_rpm = 9500.0 - progress * 3500.0
        else:
            # Cornering phase
            progress = (phase - 9.5) / 5.5
            speed_kmh = 70.0 + progress * 70.0  # 70 -> 140 km/h
            throttle = 0.4 + progress * 0.5
            brake = 0.0
            steer = 0.35 * math.sin(progress * math.pi)
            sway = 2.4 * math.sin(progress * math.pi)  # High lateral Gs
            surge = 0.4
            gear = 3 if speed_kmh < 110 else 4
            engine_rpm = 7500.0 + progress * 3500.0

        # Tyre & suspension dynamics
        fl_susp = 0.08 + 0.02 * math.sin(t * 20.0) + (surge * -0.01) + (sway * 0.015)
        fr_susp = 0.08 + 0.02 * math.sin(t * 20.0 + 1) + (surge * -0.01) - (sway * 0.015)
        rl_susp = 0.09 + 0.015 * math.sin(t * 18.0) + (surge * 0.01) + (sway * 0.015)
        rr_susp = 0.09 + 0.015 * math.sin(t * 18.0 + 1) + (surge * 0.01) - (sway * 0.015)

        # Pack synthetic RTCarInfo struct
        return pack_rt_car_info(
            speed_kmh=round(speed_kmh, 1),
            engine_rpm=round(engine_rpm, 0),
            gear=gear,
            throttle=round(throttle, 2),
            brake=round(brake, 2),
            clutch=0.0,
            steer=round(steer, 3),
            lap_time_ms=lap_time_ms,
            lap_count=self.lap_count,
            car_pos_norm=round(lap_cycle, 4),
        )

    def datagram_received(self, data: bytes, addr: Tuple[str, int]):
        """Handle incoming handshake subscriptions."""
        if len(data) >= 12:
            try:
                ident, ver, op = struct.unpack(HANDSHAKE_FORMAT, data[:12])
                if op == OperationId.SUBSCRIBE_UPDATE:
                    if addr not in self.subscribers:
                        print(f"[MOCK AC] Client subscribed from {addr} (ident={ident}, ver={ver})")
                        self.subscribers.add(addr)
                elif op == OperationId.DISMISS:
                    if addr in self.subscribers:
                        print(f"[MOCK AC] Client dismissed from {addr}")
                        self.subscribers.remove(addr)
            except Exception as e:
                print(f"[MOCK AC] Error unpacking handshake from {addr}: {e}")

    async def broadcast_loop(self):
        """Broadcast 60 Hz telemetry frames to all active subscribers."""
        print(f"[MOCK AC] Server listening on {self.host}:{self.port} at {self.tick_rate_hz} Hz...")
        while self.is_running:
            if self.subscribers:
                payload = self.get_simulated_telemetry_bytes()
                for sub in list(self.subscribers):
                    try:
                        self.transport.sendto(payload, sub)
                    except Exception as e:
                        print(f"[MOCK AC] Failed to send to {sub}: {e}")
                        self.subscribers.discard(sub)
            await asyncio.sleep(self.interval)

    async def start(self):
        self.is_running = True
        loop = asyncio.get_running_loop()

        class Protocol(asyncio.DatagramProtocol):
            def __init__(self, parent):
                self.parent = parent

            def connection_made(self, transport):
                self.parent.transport = transport

            def datagram_received(self, data, addr):
                self.parent.datagram_received(data, addr)

        await loop.create_datagram_endpoint(
            lambda: Protocol(self),
            local_addr=(self.host, self.port),
        )
        await self.broadcast_loop()

    def stop(self):
        self.is_running = False
        if self.transport:
            self.transport.close()


if __name__ == "__main__":
    server = MockAssettoCorsaServer()
    try:
        asyncio.run(server.start())
    except KeyboardInterrupt:
        print("\n[MOCK AC] Stopping server.")
        server.stop()
