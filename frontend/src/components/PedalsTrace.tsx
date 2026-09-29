import React from 'react';
import { TelemetryFrame } from '../types/telemetry';

interface PedalsTraceProps {
  telemetry: TelemetryFrame | null;
}

export const PedalsTrace: React.FC<PedalsTraceProps> = ({ telemetry }) => {
  const throttle = telemetry ? Math.min(100, Math.max(0, telemetry.throttle * 100)) : 0;
  const brake = telemetry ? Math.min(100, Math.max(0, telemetry.brake * 100)) : 0;
  const clutch = telemetry ? Math.min(100, Math.max(0, telemetry.clutch * 100)) : 0;
  const steer = telemetry ? telemetry.steer : 0;

  return (
    <div className="card">
      <div className="card-header">DRIVER INPUTS</div>
      
      <div className="pedals-grid">
        {/* Clutch */}
        <div className="pedal-column">
          <div className="pedal-track">
            <div
              className="pedal-fill bg-cyan-500 shadow-[0_0_12px_#06b6d4]"
              style={{ height: `${clutch}%` }}
            />
          </div>
          <div className="stat-unit">CLT</div>
          <div className="font-mono text-xs">{clutch.toFixed(0)}%</div>
        </div>

        {/* Brake */}
        <div className="pedal-column">
          <div className="pedal-track">
            <div
              className="pedal-fill bg-red-500 shadow-[0_0_12px_#ef4444]"
              style={{ height: `${brake}%` }}
            />
          </div>
          <div className="stat-unit text-red-400 font-bold">BRK</div>
          <div className="font-mono text-xs text-red-400">{brake.toFixed(0)}%</div>
        </div>

        {/* Throttle */}
        <div className="pedal-column">
          <div className="pedal-track">
            <div
              className="pedal-fill bg-emerald-400 shadow-[0_0_12px_#10b981]"
              style={{ height: `${throttle}%` }}
            />
          </div>
          <div className="stat-unit text-emerald-400 font-bold">THR</div>
          <div className="font-mono text-xs text-emerald-400">{throttle.toFixed(0)}%</div>
        </div>
      </div>

      {/* Steering Dial Gauge */}
      <div className="steering-box">
        <div className="stat-label">STEERING ANGLE</div>
        <div className="steer-bar-container">
          <div className="steer-center-mark" />
          <div
            className="steer-indicator"
            style={{
              left: `${Math.min(95, Math.max(5, 50 + steer * 45))}%`,
            }}
          />
        </div>
        <div className="font-mono text-xs text-slate-400 mt-1">
          {steer > 0 ? `+${(steer * 100).toFixed(1)}°` : `${(steer * 100).toFixed(1)}°`}
        </div>
      </div>
    </div>
  );
};
