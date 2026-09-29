import asyncio
from backend.src.config import settings
from backend.src.listener import TelemetryListener
from backend.tests.mock_ac_server import MockAssettoCorsaServer


async def _run_udp_ingestion():
    test_port = 9998
    settings.ac_host = "127.0.0.1"
    settings.ac_port = test_port
    settings.handshake_interval_sec = 0.2

    # 1. Start Mock Assetto Corsa Server
    mock_server = MockAssettoCorsaServer(host="127.0.0.1", port=test_port, tick_rate_hz=30)
    mock_task = asyncio.create_task(mock_server.start())

    # 2. Start Listener
    queue = asyncio.Queue(maxsize=100)
    listener = TelemetryListener(queue)
    await listener.start()

    # Allow time for handshake and packet stream
    telemetry_item = None
    for _ in range(30):
        await asyncio.sleep(0.1)
        if not queue.empty():
            telemetry_item = await queue.get()
            break

    # 3. Clean shutdown
    await listener.stop()
    mock_server.stop()
    mock_task.cancel()
    try:
        await mock_task
    except asyncio.CancelledError:
        pass

    # 4. Assertions
    assert telemetry_item is not None, "Listener failed to receive any telemetry frames from mock server"
    assert telemetry_item.size == 328
    assert telemetry_item.speed_kmh > 0
    assert listener.metrics["packets_received"] > 0
    assert listener.metrics["packets_decoded"] > 0
    assert listener.metrics["decode_errors"] == 0


def test_end_to_end_udp_ingestion():
    """Integration test verifying full handshake -> mock broadcast -> listener unpack loop."""
    asyncio.run(_run_udp_ingestion())
