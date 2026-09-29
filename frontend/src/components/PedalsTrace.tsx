import React, { useRef, useEffect, useState } from 'react';
import { TelemetryFrame } from '../types/telemetry';

interface PedalsTraceProps {
  telemetry: TelemetryFrame | null;
}

export const PedalsTrace: React.FC<PedalsTraceProps> = React.memo(({ telemetry }) => {
  const throttle = telemetry ? Math.min(100, Math.max(0, telemetry.throttle * 100)) : 0;
  const brake = telemetry ? Math.min(100, Math.max(0, telemetry.brake * 100)) : 0;
  const clutch = telemetry ? Math.min(100, Math.max(0, telemetry.clutch * 100)) : 0;
  const steer = telemetry ? telemetry.steer : 0;
  const steerDegrees = steer * 180; // approximate steering angle in degrees

  const [peakBrake, setPeakBrake] = useState<number>(0);
  const peakDecayTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (brake > peakBrake) {
      setPeakBrake(brake);
      if (peakDecayTimer.current) clearTimeout(peakDecayTimer.current);
      peakDecayTimer.current = window.setTimeout(() => {
        setPeakBrake(0);
      }, 1500);
    }
  }, [brake, peakBrake]);

  const isAbsActive = telemetry?.is_abs_in_action ?? false;
  const isTcActive = telemetry?.is_tc_in_action ?? false;

  return (
    <div className="card flex flex-col justify-between">
      <div className="flex justify-between items-center mb-2">
        <span className="card-header m-0">DRIVER INPUTS</span>
        <div className="flex gap-2">
          {isAbsActive && (
            <span className="px-1.5 py-0.5 bg-red-600/80 text-white font-mono text-[9px] font-bold rounded animate-pulse">
              ABS ACTIVE
            </span>
          )}
          {isTcActive && (
            <span className="px-1.5 py-0.5 bg-emerald-600/80 text-white font-mono text-[9px] font-bold rounded animate-pulse">
              TC CUT
            </span>
          )}
        </div>
      </div>
      
      <div className="pedals-grid my-auto">
        {/* Clutch */}
        <div className="pedal-column">
          <div className="pedal-track">
            <div
              className="pedal-fill bg-cyan-500 shadow-[0_0_12px_#06b6d4]"
              style={{ height: `${clutch}%` }}
            />
          </div>
          <div className="stat-unit">CLT</div>
          <div className="font-mono text-xs text-slate-300">{clutch.toFixed(0)}%</div>
        </div>

        {/* Brake */}
        <div className="pedal-column relative">
          <div className={`pedal-track relative ${isAbsActive ? 'ring-2 ring-red-500 shadow-[0_0_15px_#ef4444]' : ''}`}>
            {/* Peak Brake Hold Line */}
            {peakBrake > 5 && (
              <div
                className="absolute left-0 right-0 h-0.5 bg-amber-400 z-10 shadow-[0_0_6px_#f59e0b] pointer-events-none transition-all duration-300"
                style={{ bottom: `${peakBrake}%` }}
              />
            )}
            <div
              className={`pedal-fill ${isAbsActive ? 'bg-red-400 shadow-[0_0_16px_#ef4444]' : 'bg-red-500 shadow-[0_0_12px_#ef4444]'}`}
              style={{ height: `${brake}%` }}
            />
          </div>
          <div className="stat-unit text-red-400 font-bold">BRK</div>
          <div className="font-mono text-xs text-red-400">{brake.toFixed(0)}%</div>
        </div>

        {/* Throttle */}
        <div className="pedal-column relative">
          <div className={`pedal-track ${isTcActive ? 'ring-2 ring-emerald-400 shadow-[0_0_15px_#10b981]' : ''}`}>
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
      <div className="steering-box mt-3">
        <div className="flex justify-between items-center text-xs">
          <span className="stat-label">STEERING</span>
          <span className="font-mono text-xs text-cyan-400 font-bold">
            {steerDegrees >= 0 ? `+${steerDegrees.toFixed(1)}°` : `${steerDegrees.toFixed(1)}°`}
          </span>
        </div>

        <div className="steer-bar-container">
          <div className="steer-center-mark" />
          <div
            className="steer-indicator"
            style={{
              left: `${Math.min(95, Math.max(5, 50 + steer * 45))}%`,
            }}
          />
        </div>

        <div className="flex justify-between text-[9px] font-mono text-slate-500 mt-1">
          <span>-90° (L)</span>
          <span>CENTER</span>
          <span>+90° (R)</span>
        </div>
      </div>
    </div>
  );
});

PedalsTrace.displayName = 'PedalsTrace';
