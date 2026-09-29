"""
WebSocket Telemetry Broadcast Manager.

Distributes decoded telemetry frames from the asyncio.Queue to connected
browser clients with minimal latency and automatic disconnect cleanup.
"""

import asyncio
import json
import logging
import time
from typing import Set
from fastapi import WebSocket
from backend.src.unpacker import RTCarInfo

logger = logging.getLogger("telemetry.broadcaster")


class TelemetryBroadcaster:
    def __init__(self, queue: asyncio.Queue, broadcast_rate_hz: int = 60):
        self.queue = queue
        self.broadcast_interval = 1.0 / broadcast_rate_hz
        self.active_connections: Set[WebSocket] = set()
        self.is_running = False
        self.broadcast_task: Optional[asyncio.Task] = None
        self.last_broadcast_time = 0.0

        self.metrics = {
            "connected_clients": 0,
            "messages_broadcasted": 0,
            "broadcast_errors": 0,
        }

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        self.metrics["connected_clients"] = len(self.active_connections)
        logger.info(f"WebSocket client connected. Total clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        self.metrics["connected_clients"] = len(self.active_connections)
        logger.info(f"WebSocket client disconnected. Total clients: {len(self.active_connections)}")

    async def start(self):
        self.is_running = True
        self.broadcast_task = asyncio.create_task(self._broadcast_loop())
        logger.info(f"Broadcaster started at target rate {1.0 / self.broadcast_interval:.0f} Hz.")

    async def _broadcast_loop(self):
        """Worker that drains the queue and fans out to WebSocket clients."""
        while self.is_running:
            try:
                # Wait for next telemetry frame
                telemetry: RTCarInfo = await self.queue.get()

                # If no clients are connected, don't waste CPU serializing JSON
                if not self.active_connections:
                    self.queue.task_done()
                    continue

                # Rate limiting to target broadcast rate
                now = time.time()
                if (now - self.last_broadcast_time) < self.broadcast_interval:
                    self.queue.task_done()
                    continue
                self.last_broadcast_time = now

                payload = json.dumps(telemetry.to_dict())
                self.queue.task_done()

                # Fan-out to all connected browser clients concurrently
                disconnected_clients = []
                for client in list(self.active_connections):
                    try:
                        await client.send_text(payload)
                        self.metrics["messages_broadcasted"] += 1
                    except Exception:
                        disconnected_clients.append(client)
                        self.metrics["broadcast_errors"] += 1

                for dead_client in disconnected_clients:
                    self.disconnect(dead_client)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Broadcaster worker error: {e}")
                await asyncio.sleep(0.01)

    async def stop(self):
        self.is_running = False
        if self.broadcast_task:
            self.broadcast_task.cancel()
        for client in list(self.active_connections):
            try:
                await client.close()
            except Exception:
                pass
        self.active_connections.clear()
        logger.info("Broadcaster stopped.")
