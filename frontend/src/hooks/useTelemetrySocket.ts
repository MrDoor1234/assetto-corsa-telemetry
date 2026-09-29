import { useState, useEffect, useRef } from 'react';
import { TelemetryFrame } from '../types/telemetry';

export interface UseTelemetrySocketReturn {
  telemetry: TelemetryFrame | null;
  isConnected: boolean;
  fps: number;
  totalPackets: number;
}

export function useTelemetrySocket(url: string = 'ws://localhost:8000/ws/telemetry'): UseTelemetrySocketReturn {
  const [telemetry, setTelemetry] = useState<TelemetryFrame | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(0);
  const [totalPackets, setTotalPackets] = useState<number>(0);

  const socketRef = useRef<WebSocket | null>(null);
  const frameCountRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(performance.now());

  useEffect(() => {
    let reconnectTimeout: number | undefined;

    function connect() {
      try {
        const ws = new WebSocket(url);
        socketRef.current = ws;

        ws.onopen = () => {
          setIsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const data: TelemetryFrame = JSON.parse(event.data);
            setTelemetry(data);
            frameCountRef.current += 1;
            setTotalPackets((prev) => prev + 1);

            const now = performance.now();
            const elapsed = now - lastTimeRef.current;
            if (elapsed >= 1000) {
              setFps(Math.round((frameCountRef.current * 1000) / elapsed));
              frameCountRef.current = 0;
              lastTimeRef.current = now;
            }
          } catch (err) {
            console.error('Failed to parse telemetry frame:', err);
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
          setFps(0);
          reconnectTimeout = window.setTimeout(connect, 2000);
        };

        ws.onerror = (error) => {
          console.debug('WebSocket encounter:', error);
          ws.close();
        };
      } catch (err) {
        console.error('Failed to initialize WebSocket:', err);
        reconnectTimeout = window.setTimeout(connect, 2000);
      }
    }

    connect();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (socketRef.current) socketRef.current.close();
    };
  }, [url]);

  return { telemetry, isConnected, fps, totalPackets };
}
