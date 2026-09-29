"""
InfluxDB Time-Series Batch Ingestion Service.

Decouples high-frequency telemetry writes from the main network loop
by buffering points and executing non-blocking asynchronous batch flushes.
"""

import asyncio
import logging
import time
from typing import List, Optional, Any
from backend.src.config import settings
from backend.src.unpacker import RTCarInfo

logger = logging.getLogger("telemetry.database")

try:
    from influxdb_client import InfluxDBClient, Point
    from influxdb_client.client.write_api import SYNCHRONOUS, ASYNCHRONOUS
    INFLUX_AVAILABLE = True
except ImportError:
    INFLUX_AVAILABLE = False
    logger.warning("influxdb_client not installed. Database writes disabled.")


class InfluxTelemetryWriter:
    def __init__(self, queue: asyncio.Queue, batch_size: int = 50, flush_interval_sec: float = 1.0):
        self.queue = queue
        self.batch_size = batch_size
        self.flush_interval = flush_interval_sec
        self.client: Optional[Any] = None
        self.write_api: Optional[Any] = None
        self.is_running = False
        self.worker_task: Optional[asyncio.Task] = None
        self.buffer: List[Point] = []
        self.last_flush = time.time()

        self.metrics = {
            "points_written": 0,
            "batches_flushed": 0,
            "write_errors": 0,
            "is_connected": False,
        }

    def connect(self):
        """Initialize InfluxDB client connection."""
        if not INFLUX_AVAILABLE:
            return

        try:
            self.client = InfluxDBClient(
                url=settings.influx_url,
                token=settings.influx_token,
                org=settings.influx_org,
                timeout=3000,
            )
            # Use asynchronous non-blocking write API
            self.write_api = self.client.write_api(write_options=ASYNCHRONOUS)
            self.metrics["is_connected"] = True
            logger.info(f"Connected to InfluxDB at {settings.influx_url} (bucket={settings.influx_bucket})")
        except Exception as e:
            self.metrics["is_connected"] = False
            logger.warning(f"Could not connect to InfluxDB: {e}. Running in memory-only mode.")

    def record_to_point(self, telemetry: RTCarInfo) -> Any:
        """Convert RTCarInfo data into an indexed InfluxDB Point."""
        if not INFLUX_AVAILABLE:
            return None

        # Structure point with tags for quick filtering and fields for high-res telemetry
        point = (
            Point("car_telemetry")
            .tag("car_id", telemetry.identifier)
            .tag("gear", telemetry.gear_name)
            .field("speed_kmh", float(telemetry.speed_kmh))
            .field("engine_rpm", float(telemetry.engine_rpm))
            .field("throttle", float(telemetry.throttle))
            .field("brake", float(telemetry.brake))
            .field("clutch", float(telemetry.clutch))
            .field("steer", float(telemetry.steer))
            .field("surge_g", float(telemetry.surge))
            .field("sway_g", float(telemetry.sway))
            .field("heave_g", float(telemetry.heave))
            .field("lap_time_ms", int(telemetry.lap_time_ms))
            .field("lap_progress", float(telemetry.car_position_normalized))
            .field("suspension_fl", float(telemetry.suspension_height.fl))
            .field("suspension_fr", float(telemetry.suspension_height.fr))
            .field("suspension_rl", float(telemetry.suspension_height.rl))
            .field("suspension_rr", float(telemetry.suspension_height.rr))
        )
        return point

    async def start(self):
        self.connect()
        self.is_running = True
        self.worker_task = asyncio.create_task(self._batch_worker())
        logger.info("Database batch worker started.")

    async def _flush_buffer(self):
        """Flush buffered points to InfluxDB."""
        if not self.buffer or not self.write_api:
            self.buffer.clear()
            return

        batch_to_write = self.buffer.copy()
        self.buffer.clear()
        self.last_flush = time.time()

        try:
            self.write_api.write(
                bucket=settings.influx_bucket,
                org=settings.influx_org,
                record=batch_to_write,
            )
            self.metrics["points_written"] += len(batch_to_write)
            self.metrics["batches_flushed"] += 1
        except Exception as e:
            self.metrics["write_errors"] += 1
            logger.debug(f"InfluxDB batch write failed: {e}")

    async def _batch_worker(self):
        """Continuous consumer loop buffering telemetry points."""
        while self.is_running:
            try:
                # Drain incoming items from queue into buffer
                if self.queue:
                    while not self.queue.empty():
                        try:
                            telemetry: RTCarInfo = self.queue.get_nowait()
                            p = self.record_to_point(telemetry)
                            if p:
                                self.buffer.append(p)
                            self.queue.task_done()
                        except asyncio.QueueEmpty:
                            break

                now = time.time()
                # If buffer size exceeded or flush interval reached, flush
                if len(self.buffer) >= self.batch_size or (self.buffer and (now - self.last_flush) >= self.flush_interval):
                    await self._flush_buffer()

                await asyncio.sleep(0.05)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Database worker loop error: {e}")
                await asyncio.sleep(0.1)

    async def record_frame(self, telemetry: RTCarInfo):
        """Add telemetry frame to batch buffer."""
        if not self.metrics["is_connected"]:
            return
        p = self.record_to_point(telemetry)
        if p:
            self.buffer.append(p)

    async def stop(self):
        self.is_running = False
        if self.worker_task:
            self.worker_task.cancel()
        await self._flush_buffer()
        if self.client:
            self.client.close()
        logger.info("Database writer stopped.")
