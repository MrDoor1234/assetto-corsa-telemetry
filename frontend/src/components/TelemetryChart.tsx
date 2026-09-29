import React, { useEffect, useRef } from 'react';
import { TelemetryFrame } from '../types/telemetry';

interface TelemetryChartProps {
  telemetry: TelemetryFrame | null;
}

interface DataPoint {
  speed: number;
  throttle: number;
  brake: number;
}

export const TelemetryChart: React.FC<TelemetryChartProps> = ({ telemetry }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const historyRef = useRef<DataPoint[]>([]);
  const maxPoints = 250; // Rolling window of ~4-5 seconds at 60Hz

  useEffect(() => {
    if (telemetry) {
      historyRef.current.push({
        speed: telemetry.speed_kmh,
        throttle: telemetry.throttle,
        brake: telemetry.brake,
      });
      if (historyRef.current.length > maxPoints) {
        historyRef.current.shift();
      }
    }
  }, [telemetry]);

  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;

      // Clear background
      ctx.fillStyle = '#080a0e';
      ctx.fillRect(0, 0, width, height);

      // Draw subtle grid lines
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      for (let y = 0; y <= height; y += height / 4) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const points = historyRef.current;
      if (points.length < 2) {
        animId = requestAnimationFrame(render);
        return;
      }

      const dx = width / (maxPoints - 1);
      const startX = width - (points.length - 1) * dx;

      // 1. Draw Brake Trace (Red Area)
      ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(startX, height);
      for (let i = 0; i < points.length; i++) {
        const x = startX + i * dx;
        const y = height - points[i].brake * (height * 0.85);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(startX + (points.length - 1) * dx, height);
      ctx.closePath();
      ctx.fill();

      // 2. Draw Throttle Trace (Green Line)
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < points.length; i++) {
        const x = startX + i * dx;
        const y = height - points[i].throttle * (height * 0.85);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // 3. Draw Speed Trace (Cyan Line, 0-350 km/h)
      ctx.strokeStyle = '#00f2fe';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i < points.length; i++) {
        const x = startX + i * dx;
        const normSpeed = Math.min(1.0, points[i].speed / 350.0);
        const y = height - normSpeed * (height * 0.9);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-2">
        <div className="card-header m-0">LIVE ROLLING TELEMETRY WAVEFORM (60 HZ)</div>
        <div className="flex gap-4 text-xs font-mono">
          <span className="flex items-center gap-1.5 text-cyan-400">
            <span className="w-2.5 h-0.5 bg-cyan-400 rounded-full inline-block" /> SPEED (350 KM/H MAX)
          </span>
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-2.5 h-0.5 bg-emerald-400 rounded-full inline-block" /> THROTTLE
          </span>
          <span className="flex items-center gap-1.5 text-red-400">
            <span className="w-2.5 h-0.5 bg-red-400 rounded-full inline-block" /> BRAKE
          </span>
        </div>
      </div>

      <div className="relative w-full h-44 rounded-lg overflow-hidden border border-slate-800">
        <canvas
          ref={canvasRef}
          width={1000}
          height={200}
          className="w-full h-full block"
        />
      </div>
    </div>
  );
};
