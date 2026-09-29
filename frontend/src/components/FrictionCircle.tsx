import React, { useEffect, useRef } from 'react';
import { TelemetryFrame } from '../types/telemetry';

interface FrictionCircleProps {
  telemetry: TelemetryFrame | null;
}

interface GPoint {
  x: number;
  y: number;
  alpha: number;
}

export const FrictionCircle: React.FC<FrictionCircleProps> = React.memo(({ telemetry }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const trailRef = useRef<GPoint[]>([]);
  const peakLatRef = useRef<number>(0);
  const peakLongRef = useRef<number>(0);

  const sway = telemetry?.sway ?? 0;   // Lateral (+ is right, - is left)
  const surge = telemetry?.surge ?? 0; // Longitudinal (+ is accel, - is braking)

  // Track peaks
  if (Math.abs(sway) > peakLatRef.current) {
    peakLatRef.current = Math.min(5.0, Math.round(Math.abs(sway) * 100) / 100);
  }
  if (Math.abs(surge) > peakLongRef.current) {
    peakLongRef.current = Math.min(5.0, Math.round(Math.abs(surge) * 100) / 100);
  }

  useEffect(() => {
    // Add current point to trail
    trailRef.current.push({ x: sway, y: surge, alpha: 1.0 });
    if (trailRef.current.length > 25) {
      trailRef.current.shift();
    }
  }, [sway, surge]);

  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width;
      const height = canvas.height;
      const cx = width / 2;
      const cy = height / 2;
      const maxG = 4.0;
      const radius = Math.min(cx, cy) - 15 * dpr;

      ctx.clearRect(0, 0, width, height);

      // Background radial gradient
      const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      bgGrad.addColorStop(0, '#090d16');
      bgGrad.addColorStop(1, '#05070a');
      ctx.fillStyle = bgGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      // Draw concentric G circles (1G, 2G, 3G, 4G)
      const rings = [1.0, 2.0, 3.0, 4.0];
      rings.forEach((g) => {
        const r = (g / maxG) * radius;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = g === 2.0 ? 'rgba(56, 189, 248, 0.3)' : 'rgba(30, 41, 59, 0.8)';
        ctx.lineWidth = 1 * dpr;
        ctx.stroke();

        // Label
        ctx.fillStyle = 'rgba(100, 116, 139, 0.7)';
        ctx.font = `${8 * dpr}px 'JetBrains Mono', monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(`${g}G`, cx + r - 10 * dpr, cy - 3 * dpr);
      });

      // Axis Crosshairs
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.6)';
      ctx.lineWidth = 1 * dpr;
      ctx.setLineDash([3 * dpr, 3 * dpr]);
      // X-axis (Lateral)
      ctx.beginPath();
      ctx.moveTo(cx - radius, cy);
      ctx.lineTo(cx + radius, cy);
      ctx.stroke();
      // Y-axis (Longitudinal)
      ctx.beginPath();
      ctx.moveTo(cx, cy - radius);
      ctx.lineTo(cx, cy + radius);
      ctx.stroke();
      ctx.setLineDash([]);

      // Axis labels
      ctx.font = `${7 * dpr}px 'Chakra Petch', sans-serif`;
      ctx.fillStyle = '#64748b';
      ctx.fillText('BRAKE', cx, cy + radius + 11 * dpr);
      ctx.fillText('ACCEL', cx, cy - radius - 5 * dpr);
      ctx.textAlign = 'left';
      ctx.fillText('L', cx - radius - 8 * dpr, cy + 3 * dpr);
      ctx.textAlign = 'right';
      ctx.fillText('R', cx + radius + 10 * dpr, cy + 3 * dpr);

      // Draw trailing path
      const trail = trailRef.current;
      if (trail.length > 1) {
        for (let i = 0; i < trail.length - 1; i++) {
          const p1 = trail[i];
          const p2 = trail[i + 1];
          const x1 = cx + (p1.x / maxG) * radius;
          const y1 = cy - (p1.y / maxG) * radius;
          const x2 = cx + (p2.x / maxG) * radius;
          const y2 = cy - (p2.y / maxG) * radius;
          const alpha = (i / trail.length) * 0.7;

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = `rgba(0, 242, 254, ${alpha})`;
          ctx.lineWidth = 2 * dpr;
          ctx.stroke();
        }
      }

      // Draw current G-Ball
      const ballX = cx + (Math.max(-maxG, Math.min(maxG, sway)) / maxG) * radius;
      const ballY = cy - (Math.max(-maxG, Math.min(maxG, surge)) / maxG) * radius;

      // Glow
      const glow = ctx.createRadialGradient(ballX, ballY, 0, ballX, ballY, 12 * dpr);
      glow.addColorStop(0, 'rgba(0, 242, 254, 0.9)');
      glow.addColorStop(0.5, 'rgba(0, 242, 254, 0.4)');
      glow.addColorStop(1, 'rgba(0, 242, 254, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(ballX, ballY, 12 * dpr, 0, Math.PI * 2);
      ctx.fill();

      // Solid core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ballX, ballY, 3.5 * dpr, 0, Math.PI * 2);
      ctx.fill();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [sway, surge]);

  const currentTotalG = Math.sqrt(sway * sway + surge * surge).toFixed(2);

  return (
    <div className="card flex flex-col justify-between">
      <div className="flex justify-between items-center mb-1">
        <span className="card-header m-0">G-G FRICTION CIRCLE</span>
        <span className="font-mono text-xs font-bold text-cyan-400">
          {currentTotalG} G
        </span>
      </div>

      <div className="flex justify-center items-center my-1 relative">
        <canvas
          ref={canvasRef}
          width={180}
          height={180}
          className="w-44 h-44 block"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 text-center pt-1 border-t border-slate-800">
        <div>
          <div className="text-[10px] text-slate-500 font-mono">PEAK LATERAL</div>
          <div className="font-mono text-xs text-cyan-300 font-bold">
            {peakLatRef.current.toFixed(2)} G
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 font-mono">PEAK LONG</div>
          <div className="font-mono text-xs text-amber-300 font-bold">
            {peakLongRef.current.toFixed(2)} G
          </div>
        </div>
      </div>
    </div>
  );
});

FrictionCircle.displayName = 'FrictionCircle';
