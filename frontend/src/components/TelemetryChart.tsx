import React, { useEffect, useRef, useState } from 'react';
import { TelemetryFrame } from '../types/telemetry';

interface TelemetryChartProps {
  telemetry: TelemetryFrame | null;
  unit?: 'kmh' | 'mph';
}

interface DataPoint {
  speed: number;
  throttle: number;
  brake: number;
  steer: number;
  rpm: number;
  sway: number;
}

export const TelemetryChart: React.FC<TelemetryChartProps> = React.memo(({ telemetry, unit = 'kmh' }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Channel toggles
  const [activeChannels, setActiveChannels] = useState({
    speed: true,
    throttle: true,
    brake: true,
    steer: false,
    rpm: false,
    sway: false,
  });

  const channelsRef = useRef(activeChannels);
  channelsRef.current = activeChannels;

  // Circular Ring Buffer for O(1) zero-allocation performance
  const capacity = 300;
  const bufferRef = useRef<DataPoint[]>([]);
  const headRef = useRef<number>(0);
  const countRef = useRef<number>(0);

  // Initialize fixed buffer
  if (bufferRef.current.length === 0) {
    bufferRef.current = new Array(capacity).fill(null).map(() => ({
      speed: 0,
      throttle: 0,
      brake: 0,
      steer: 0,
      rpm: 0,
      sway: 0,
    }));
  }

  useEffect(() => {
    if (telemetry) {
      const idx = headRef.current;
      const speedVal = unit === 'mph' ? telemetry.speed_mph : telemetry.speed_kmh;
      bufferRef.current[idx] = {
        speed: speedVal,
        throttle: telemetry.throttle,
        brake: telemetry.brake,
        steer: telemetry.steer,
        rpm: telemetry.engine_rpm,
        sway: telemetry.sway,
      };
      headRef.current = (idx + 1) % capacity;
      if (countRef.current < capacity) {
        countRef.current += 1;
      }
    }
  }, [telemetry, unit]);

  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();

      // Handle HiDPI resize dynamically
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
      }

      const width = rect.width;
      const height = rect.height;

      ctx.save();
      ctx.scale(dpr, dpr);

      // Clear background
      ctx.fillStyle = '#080a0e';
      ctx.fillRect(0, 0, width, height);

      // Subtle horizontal grid lines & scale labels
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillStyle = '#475569';

      for (let p = 0.25; p <= 1; p += 0.25) {
        const y = height - p * (height * 0.85);
        ctx.beginPath();
        ctx.moveTo(35, y);
        ctx.lineTo(width, y);
        ctx.stroke();

        ctx.textAlign = 'right';
        ctx.fillText(`${Math.round(p * 100)}%`, 30, y + 3);
      }

      const count = countRef.current;
      if (count < 2) {
        ctx.restore();
        animId = requestAnimationFrame(render);
        return;
      }

      const dx = (width - 40) / (capacity - 1);
      const startX = 35 + (capacity - count) * dx;
      const buffer = bufferRef.current;
      const head = headRef.current;
      const startIdx = (head - count + capacity) % capacity;

      const channels = channelsRef.current;

      // Helper to read circular buffer in chronological order
      const getPoint = (i: number): DataPoint => {
        return buffer[(startIdx + i) % capacity];
      };

      // 1. Draw Brake Trace (Red Area & Line)
      if (channels.brake) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(startX, height);
        for (let i = 0; i < count; i++) {
          const pt = getPoint(i);
          const x = startX + i * dx;
          const y = height - pt.brake * (height * 0.85);
          ctx.lineTo(x, y);
        }
        ctx.lineTo(startX + (count - 1) * dx, height);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        for (let i = 0; i < count; i++) {
          const pt = getPoint(i);
          const x = startX + i * dx;
          const y = height - pt.brake * (height * 0.85);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // 2. Draw Throttle Trace (Green Line)
      if (channels.throttle) {
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
          const pt = getPoint(i);
          const x = startX + i * dx;
          const y = height - pt.throttle * (height * 0.85);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // 3. Draw Steering Trace (Yellow Line, normalized -1 to +1 centered at 50%)
      if (channels.steer) {
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
          const pt = getPoint(i);
          const x = startX + i * dx;
          const y = height / 2 - pt.steer * (height * 0.4);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // 4. Draw Sway / Lateral G (Purple Line, -4G to +4G centered at 50%)
      if (channels.sway) {
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
          const pt = getPoint(i);
          const x = startX + i * dx;
          const y = height / 2 - (pt.sway / 4.0) * (height * 0.4);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // 5. Draw RPM Trace (Amber Line, 0-15000 RPM)
      if (channels.rpm) {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
          const pt = getPoint(i);
          const x = startX + i * dx;
          const normRpm = Math.min(1.0, pt.rpm / 15000.0);
          const y = height - normRpm * (height * 0.85);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // 6. Draw Speed Trace (Cyan Line, max 350 km/h or 220 mph)
      if (channels.speed) {
        const maxSpeed = unit === 'mph' ? 220.0 : 350.0;
        ctx.strokeStyle = '#00f2fe';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
          const pt = getPoint(i);
          const x = startX + i * dx;
          const normSpeed = Math.min(1.0, pt.speed / maxSpeed);
          const y = height - normSpeed * (height * 0.88);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [unit]);

  const toggleChannel = (key: keyof typeof activeChannels) => {
    setActiveChannels((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="card">
      <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
        <div className="card-header m-0">LIVE TELEMETRY WAVEFORM (60 HZ)</div>

        {/* Interactive Channel Toggles */}
        <div className="flex flex-wrap gap-2 text-xs font-mono">
          <button
            onClick={() => toggleChannel('speed')}
            className={`px-2 py-0.5 rounded border transition-colors flex items-center gap-1.5 ${
              activeChannels.speed
                ? 'bg-cyan-950/60 border-cyan-500/80 text-cyan-300'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
            SPEED
          </button>

          <button
            onClick={() => toggleChannel('throttle')}
            className={`px-2 py-0.5 rounded border transition-colors flex items-center gap-1.5 ${
              activeChannels.throttle
                ? 'bg-emerald-950/60 border-emerald-500/80 text-emerald-300'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            THROTTLE
          </button>

          <button
            onClick={() => toggleChannel('brake')}
            className={`px-2 py-0.5 rounded border transition-colors flex items-center gap-1.5 ${
              activeChannels.brake
                ? 'bg-red-950/60 border-red-500/80 text-red-300'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
            BRAKE
          </button>

          <button
            onClick={() => toggleChannel('steer')}
            className={`px-2 py-0.5 rounded border transition-colors flex items-center gap-1.5 ${
              activeChannels.steer
                ? 'bg-yellow-950/60 border-yellow-500/80 text-yellow-300'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
            STEERING
          </button>

          <button
            onClick={() => toggleChannel('rpm')}
            className={`px-2 py-0.5 rounded border transition-colors flex items-center gap-1.5 ${
              activeChannels.rpm
                ? 'bg-amber-950/60 border-amber-500/80 text-amber-300'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            RPM
          </button>

          <button
            onClick={() => toggleChannel('sway')}
            className={`px-2 py-0.5 rounded border transition-colors flex items-center gap-1.5 ${
              activeChannels.sway
                ? 'bg-purple-950/60 border-purple-500/80 text-purple-300'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
            LATERAL G
          </button>
        </div>
      </div>

      <div ref={containerRef} className="relative w-full h-44 rounded-lg overflow-hidden border border-slate-800">
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
        />
      </div>
    </div>
  );
});

TelemetryChart.displayName = 'TelemetryChart';
