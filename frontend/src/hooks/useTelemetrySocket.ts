import { useState, useEffect, useRef, useCallback } from 'react';
import { TelemetryFrame } from '../types/telemetry';

export interface UseTelemetrySocketReturn {
  telemetry: TelemetryFrame | null;
  isConnected: boolean;
  fps: number;
  totalPackets: number;
  isDemoMode: boolean;
  setDemoMode: (val: boolean | ((prev: boolean) => boolean)) => void;
  reconnect: () => void;
}

export function useTelemetrySocket(
  url: string = 'ws://localhost:8000/ws/telemetry'
): UseTelemetrySocketReturn {
  const [telemetry, setTelemetry] = useState<TelemetryFrame | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(0);
  const [totalPackets, setTotalPackets] = useState<number>(0);
  const [isDemoMode, setDemoMode] = useState<boolean>(false);

  const socketRef = useRef<WebSocket | null>(null);
  const frameCountRef = useRef<number>(0);
  const totalPacketsRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(performance.now());
  const reconnectTimeoutRef = useRef<number | undefined>(undefined);
  const manualConnectTrigger = useRef<number>(0);

  // Client-side 60 Hz Demo Simulation state
  const demoSimRef = useRef({
    time: 0,
    lapCount: 1,
    lapStart: performance.now(),
    bestLapMs: 78450,
  });

  const reconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
    }
    manualConnectTrigger.current += 1;
  }, []);

  // Demo Mode 60 Hz Generator
  useEffect(() => {
    if (!isDemoMode) return;

    let animId: number;
    let lastTick = performance.now();

    const generateDemoFrame = (): TelemetryFrame => {
      const sim = demoSimRef.current;
      sim.time += 0.0166;
      const t = sim.time;

      const phase = t % 15.0; // 15-second dynamic loop
      let speed_kmh = 100;
      let throttle = 0;
      let brake = 0;
      let steer = 0;
      let surge = 0;
      let sway = 0;
      let gear = 3;
      let gear_name = '3';
      let engine_rpm = 7000;
      const heave = Math.sin(t * 12.0) * 0.15;

      if (phase < 7.0) {
        // Acceleration phase
        const p = phase / 7.0;
        speed_kmh = 100.0 + p * 210.0;
        throttle = 1.0;
        brake = 0.0;
        steer = 0.02 * Math.sin(t * 2.5);
        surge = 1.3 * (1.0 - p * 0.4);
        sway = 0.15 * Math.sin(t * 3.0);
        gear = Math.min(8, Math.floor(2 + p * 6));
        gear_name = gear.toString();
        engine_rpm = 6200 + ((p * 6) % 1.0) * 6800;
      } else if (phase < 9.5) {
        // Heavy Braking phase
        const p = (phase - 7.0) / 2.5;
        speed_kmh = Math.max(65.0, 310.0 - p * 240.0);
        throttle = 0.0;
        brake = Math.max(0.1, 1.0 - p * 0.2);
        steer = 0.04;
        surge = -3.8 * (1.0 - p * 0.3);
        sway = 0.05;
        gear = Math.max(2, Math.floor(8 - p * 6));
        gear_name = gear.toString();
        engine_rpm = 9600 - p * 3400;
      } else {
        // High-G Cornering phase
        const p = (phase - 9.5) / 5.5;
        speed_kmh = 70.0 + p * 75.0;
        throttle = 0.35 + p * 0.55;
        brake = 0.0;
        steer = 0.38 * Math.sin(p * Math.PI);
        sway = 2.6 * Math.sin(p * Math.PI);
        surge = 0.45;
        gear = speed_kmh < 115 ? 3 : 4;
        gear_name = gear.toString();
        engine_rpm = 7400 + p * 3600;
      }

      const lap_time_ms = Math.floor(performance.now() - sim.lapStart);
      if (lap_time_ms > 82000) {
        sim.lapCount += 1;
        sim.lapStart = performance.now();
      }

      const speed_mph = speed_kmh * 0.621371;
      const speed_ms = speed_kmh / 3.6;

      // Tire dynamic loads and slip
      const baseLoad = 3500;
      const latShift = sway * 750;
      const longShift = surge * 600;

      const slipMag = Math.abs(steer) * 0.18 + Math.abs(sway) * 0.05;

      return {
        identifier: 'DEMO_F1',
        size: 328,
        speed_kmh: Math.round(speed_kmh * 10) / 10,
        speed_mph: Math.round(speed_mph * 10) / 10,
        speed_ms,
        is_abs_enabled: true,
        is_abs_in_action: brake > 0.85,
        is_tc_in_action: throttle > 0.8 && speed_kmh < 120,
        is_tc_enabled: true,
        is_in_pit: false,
        is_engine_limiter_on: engine_rpm > 13200,
        heave,
        sway,
        surge,
        lap_time_ms,
        last_lap_ms: 79120,
        best_lap_ms: sim.bestLapMs,
        lap_count: sim.lapCount,
        throttle,
        brake,
        clutch: 0,
        engine_rpm: Math.round(engine_rpm),
        steer,
        gear,
        gear_name,
        cg_height: 0.28,
        wheel_angular_speed: { fl: speed_ms * 3.1, fr: speed_ms * 3.1, rl: speed_ms * 3.1, rr: speed_ms * 3.1 },
        slip_angle: { fl: steer * 8.5, fr: steer * 8.5, rl: sway * 1.5, rr: sway * 1.5 },
        slip_angle_contact_patch: { fl: steer * 7.8, fr: steer * 7.8, rl: sway * 1.4, rr: sway * 1.4 },
        slip_ratio: {
          fl: brake > 0.8 ? 0.12 : 0.02,
          fr: brake > 0.8 ? 0.11 : 0.02,
          rl: throttle > 0.85 ? 0.08 : 0.01,
          rr: throttle > 0.85 ? 0.09 : 0.01,
        },
        tyre_slip: { fl: slipMag, fr: slipMag, rl: slipMag * 0.7, rr: slipMag * 0.7 },
        nd_slip: { fl: 0.05, fr: 0.05, rl: 0.04, rr: 0.04 },
        vertical_load: {
          fl: Math.max(500, baseLoad - latShift + longShift),
          fr: Math.max(500, baseLoad + latShift + longShift),
          rl: Math.max(500, baseLoad - latShift - longShift),
          rr: Math.max(500, baseLoad + latShift - longShift),
        },
        lateral_load: { fl: latShift, fr: latShift, rl: latShift * 0.8, rr: latShift * 0.8 },
        self_aligning_torque: { fl: steer * 40, fr: steer * 40, rl: 0, rr: 0 },
        tyre_dirty_level: { fl: 0.02, fr: 0.01, rl: 0.03, rr: 0.02 },
        camber_rad: { fl: -0.052, fr: 0.052, rl: -0.026, rr: 0.026 },
        tyre_radius: { fl: 0.33, fr: 0.33, rl: 0.34, rr: 0.34 },
        tyre_loaded_radius: { fl: 0.31, fr: 0.31, rl: 0.32, rr: 0.32 },
        suspension_height: {
          fl: Math.max(0.02, 0.055 - longShift * 0.000015 - latShift * 0.00001),
          fr: Math.max(0.02, 0.055 - longShift * 0.000015 + latShift * 0.00001),
          rl: Math.max(0.02, 0.065 + longShift * 0.000015 - latShift * 0.00001),
          rr: Math.max(0.02, 0.065 + longShift * 0.000015 + latShift * 0.00001),
        },
        car_position_normalized: ((sim.time % 90.0) / 90.0),
        car_slope: surge * 0.05,
        car_coordinates: [0, 0, 0],
      };
    };

    const tick = () => {
      const now = performance.now();
      if (now - lastTick >= 16) { // ~60 Hz
        lastTick = now;
        const frame = generateDemoFrame();
        setTelemetry(frame);
        frameCountRef.current += 1;
        totalPacketsRef.current += 1;

        const elapsed = now - lastTimeRef.current;
        if (elapsed >= 1000) {
          setFps(Math.round((frameCountRef.current * 1000) / elapsed));
          setTotalPackets(totalPacketsRef.current);
          frameCountRef.current = 0;
          lastTimeRef.current = now;
        }
      }
      animId = requestAnimationFrame(tick);
    };

    setIsConnected(true);
    animId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isDemoMode]);

  // Real WebSocket Connection
  useEffect(() => {
    if (isDemoMode) {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      return;
    }

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
            totalPacketsRef.current += 1;

            // Decouple packet counter re-renders: only update state every second alongside FPS
            const now = performance.now();
            const elapsed = now - lastTimeRef.current;
            if (elapsed >= 1000) {
              setFps(Math.round((frameCountRef.current * 1000) / elapsed));
              setTotalPackets(totalPacketsRef.current);
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
          reconnectTimeoutRef.current = window.setTimeout(connect, 2000);
        };

        ws.onerror = (error) => {
          console.debug('WebSocket encounter:', error);
          ws.close();
        };
      } catch (err) {
        console.error('Failed to initialize WebSocket:', err);
        reconnectTimeoutRef.current = window.setTimeout(connect, 2000);
      }
    }

    connect();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [url, isDemoMode, manualConnectTrigger.current]);

  return {
    telemetry,
    isConnected,
    fps,
    totalPackets,
    isDemoMode,
    setDemoMode,
    reconnect,
  };
}
