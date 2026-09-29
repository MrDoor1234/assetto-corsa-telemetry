"""Application configuration."""

import os
from pydantic import BaseModel


class Settings(BaseModel):
    # Assetto Corsa UDP Settings
    ac_host: str = os.getenv("AC_HOST", "127.0.0.1")
    ac_port: int = int(os.getenv("AC_PORT", "9996"))
    handshake_interval_sec: float = float(os.getenv("HANDSHAKE_INTERVAL_SEC", "2.0"))

    # Backend API & WebSocket Settings
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8000"))
    queue_maxsize: int = int(os.getenv("QUEUE_MAXSIZE", "1000"))
    broadcast_rate_hz: int = int(os.getenv("BROADCAST_RATE_HZ", "60"))

    # InfluxDB Settings
    influx_url: str = os.getenv("INFLUX_URL", "http://localhost:8086")
    influx_token: str = os.getenv("INFLUX_TOKEN", "supersecret-f1-telemetry-token")
    influx_org: str = os.getenv("INFLUX_ORG", "motorsport")
    influx_bucket: str = os.getenv("INFLUX_BUCKET", "telemetry")
    influx_batch_size: int = int(os.getenv("INFLUX_BATCH_SIZE", "50"))


settings = Settings()
