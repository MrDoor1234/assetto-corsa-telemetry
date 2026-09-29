"""
Asynchronous UDP Telemetry Ingestion Client for Assetto Corsa.

Handles:
1. Two-way binary handshake subscription to the Assetto Corsa server (port 9996).
2. High-throughput non-blocking datagram receipt.
3. Fast RTCarInfo struct unpacking.
4. Non-blocking queue injection with drop-oldest overflow strategy.
"""

import asyncio
import logging
import time
from typing import Optional, Tuple
from backend.src.config import settings
from backend.src.unpacker import (
    RTCarInfo,
    pack_handshake,
    unpack_rt_car_info,
    OperationId,
    RT_CAR_INFO_SIZE,
)

logger = logging.getLogger("telemetry.listener")


class TelemetryListenerProtocol(asyncio.DatagramProtocol):
    def __init__(self, queue: asyncio.Queue, metrics: dict):
        self.queue = queue
        self.metrics = metrics
        self.transport: Optional[asyncio.DatagramTransport] = None

    def connection_made(self, transport: asyncio.DatagramTransport):
        self.transport = transport
        logger.info("UDP transport opened successfully.")

    def datagram_received(self, data: bytes, addr: Tuple[str, int]):
        self.metrics["packets_received"] += 1
        self.metrics["bytes_received"] += len(data)
        self.metrics["last_packet_time"] = time.time()

        if len(data) < RT_CAR_INFO_SIZE:
            self.metrics["dropped_short_packets"] += 1
            return

        try:
            telemetry: RTCarInfo = unpack_rt_car_info(data)
            self.metrics["packets_decoded"] += 1

            # High-throughput non-blocking queue push:
            # If the consumer is busy, drop oldest to ensure zero visualization lag
            if self.queue.full():
                try:
                    self.queue.get_nowait()
                    self.metrics["queue_overflow_drops"] += 1
                except asyncio.QueueEmpty:
                    pass
            self.queue.put_nowait(telemetry)

        except Exception as e:
            self.metrics["decode_errors"] += 1
            logger.debug(f"Packet unpack error: {e}")

    def error_received(self, exc: Exception):
        logger.warning(f"UDP socket error received: {exc}")

    def connection_lost(self, exc: Optional[Exception]):
        logger.info("UDP transport connection closed.")


class TelemetryListener:
    def __init__(self, queue: asyncio.Queue):
        self.queue = queue
        self.is_running = False
        self.transport: Optional[asyncio.DatagramTransport] = None
        self.protocol: Optional[TelemetryListenerProtocol] = None
        self.handshake_task: Optional[asyncio.Task] = None

        self.metrics = {
            "packets_received": 0,
            "packets_decoded": 0,
            "bytes_received": 0,
            "decode_errors": 0,
            "dropped_short_packets": 0,
            "queue_overflow_drops": 0,
            "last_packet_time": 0.0,
            "handshakes_sent": 0,
        }

    async def start(self):
        """Bind local UDP socket and initiate heartbeat handshake loop."""
        self.is_running = True
        loop = asyncio.get_running_loop()

        # Bind to ephemeral local port for receiving replies from AC
        self.transport, self.protocol = await loop.create_datagram_endpoint(
            lambda: TelemetryListenerProtocol(self.queue, self.metrics),
            local_addr=("0.0.0.0", 0),
        )
        logger.info(f"Telemetry listener started. Target AC server: {settings.ac_host}:{settings.ac_port}")
        self.handshake_task = asyncio.create_task(self._handshake_heartbeat_loop())

    async def _handshake_heartbeat_loop(self):
        """Periodically send subscription packet to keep telemetry stream alive."""
        handshake_packet = pack_handshake(identifier=1, version=1, operation_id=OperationId.SUBSCRIBE_UPDATE)
        target_addr = (settings.ac_host, settings.ac_port)

        while self.is_running:
            if self.transport and not self.transport.is_closing():
                try:
                    self.transport.sendto(handshake_packet, target_addr)
                    self.metrics["handshakes_sent"] += 1
                except Exception as e:
                    logger.warning(f"Failed to send handshake to {target_addr}: {e}")
            await asyncio.sleep(settings.handshake_interval_sec)

    async def stop(self):
        """Unsubscribe and cleanly shut down UDP transport."""
        self.is_running = False
        if self.handshake_task:
            self.handshake_task.cancel()

        if self.transport and not self.transport.is_closing():
            try:
                # Send DISMISS packet
                dismiss_packet = pack_handshake(identifier=1, version=1, operation_id=OperationId.DISMISS)
                self.transport.sendto(dismiss_packet, (settings.ac_host, settings.ac_port))
            except Exception:
                pass
            self.transport.close()
        logger.info("Telemetry listener stopped.")
