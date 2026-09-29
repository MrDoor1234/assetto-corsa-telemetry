"""
FastAPI Main Application & Telemetry Ingestion Hub.

Coordinates:
- Asynchronous UDP Assetto Corsa listener
- WebSocket broadcast pipeline for real-time frontend
- InfluxDB time-series batch logging
- REST health check and metrics endpoints
"""

import asyncio
from contextlib import asynccontextmanager
import logging
import time
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from backend.src.config import settings
from backend.src.listener import TelemetryListener
from backend.src.broadcaster import TelemetryBroadcaster
from backend.src.database import InfluxTelemetryWriter

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("telemetry.main")

# Global pipeline singletons
telemetry_queue: asyncio.Queue = None
listener: TelemetryListener = None
broadcaster: TelemetryBroadcaster = None
db_writer: InfluxTelemetryWriter = None
start_time = 0.0


@asynccontextmanager
async def lifespan(app: FastAPI):
    global telemetry_queue, listener, broadcaster, db_writer, start_time
    start_time = time.time()
    logger.info("Initializing Assetto Corsa Telemetry Pipeline...")

    # 1. Initialize Decoupled In-Memory Buffer
    telemetry_queue = asyncio.Queue(maxsize=settings.queue_maxsize)

    # 2. Initialize Components
    listener = TelemetryListener(telemetry_queue)
    broadcaster = TelemetryBroadcaster(telemetry_queue, broadcast_rate_hz=settings.broadcast_rate_hz)
    db_writer = InfluxTelemetryWriter(telemetry_queue, batch_size=settings.influx_batch_size)

    # 3. Start Asynchronous Pipeline Workers
    await listener.start()
    await broadcaster.start()
    await db_writer.start()

    logger.info("Telemetry Pipeline fully operational.")
    yield

    # Shutdown
    logger.info("Shutting down Telemetry Pipeline...")
    await listener.stop()
    await broadcaster.stop()
    await db_writer.stop()
    logger.info("Pipeline stopped cleanly.")


app = FastAPI(
    title="Assetto Corsa High-Throughput Telemetry API",
    description="Real-time UDP telemetry pipeline, InfluxDB logging, and WebSocket broadcaster.",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for React UI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint for container probes and status monitoring."""
    uptime_sec = round(time.time() - start_time, 1) if start_time > 0 else 0
    return {
        "status": "healthy",
        "service": "assetto-corsa-telemetry-backend",
        "uptime_sec": uptime_sec,
    }


@app.get("/metrics")
async def get_metrics():
    """Engineering metrics endpoint showing throughput, drop rates, and latencies."""
    now = time.time()
    last_pkt = listener.metrics.get("last_packet_time", 0.0)
    packet_age_ms = round((now - last_pkt) * 1000, 1) if last_pkt > 0 else None

    return {
        "network": {
            "packets_received": listener.metrics["packets_received"],
            "packets_decoded": listener.metrics["packets_decoded"],
            "bytes_received": listener.metrics["bytes_received"],
            "decode_errors": listener.metrics["decode_errors"],
            "queue_overflow_drops": listener.metrics["queue_overflow_drops"],
            "last_packet_age_ms": packet_age_ms,
            "handshakes_sent": listener.metrics["handshakes_sent"],
        },
        "broadcaster": {
            "connected_clients": broadcaster.metrics["connected_clients"],
            "messages_broadcasted": broadcaster.metrics["messages_broadcasted"],
            "broadcast_errors": broadcaster.metrics["broadcast_errors"],
        },
        "database": {
            "is_connected": db_writer.metrics["is_connected"],
            "points_written": db_writer.metrics["points_written"],
            "batches_flushed": db_writer.metrics["batches_flushed"],
            "write_errors": db_writer.metrics["write_errors"],
        },
        "queue": {
            "current_size": telemetry_queue.qsize() if telemetry_queue else 0,
            "max_size": settings.queue_maxsize,
        },
    }


@app.websocket("/ws/telemetry")
async def telemetry_websocket(websocket: WebSocket):
    """High-frequency WebSocket endpoint streaming live RTCarInfo telemetry."""
    await broadcaster.connect(websocket)
    try:
        while True:
            # Keep connection open and receive any client control commands
            data = await websocket.receive_text()
            # Can handle client ping/commands here if needed
    except WebSocketDisconnect:
        broadcaster.disconnect(websocket)
    except Exception as e:
        logger.debug(f"WebSocket client error: {e}")
        broadcaster.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.src.main:app", host=settings.host, port=settings.port, reload=True)
