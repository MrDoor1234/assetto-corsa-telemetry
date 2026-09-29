import React from 'react';
import { TelemetryFrame } from '../types/telemetry';

interface SpeedTachometerProps {
  telemetry: TelemetryFrame | null;
  unit?: 'kmh' | 'mph';
  maxRpm?: number;
}

export const SpeedTachometer: React.FC<SpeedTachometerProps> = React.memo(({
  telemetry,
  unit = 'kmh',
  maxRpm = 13500,
}) => {
  const speed = telemetry
    ? Math.round(unit === 'mph' ? telemetry.speed_mph : telemetry.speed_kmh)
    : 0;
  const gear = telemetry ? telemetry.gear_name : 'N';
  const rpm = telemetry ? Math.round(telemetry.engine_rpm) : 0;
  const rpmPercent = Math.min(100, Math.max(0, (rpm / maxRpm) * 100));
  const isShiftWarning = rpmPercent >= 95;

  // 15 F1 Shift LEDs: 5 Green, 5 Red, 5 Purple
  const totalLeds = 15;
  const activeLeds = Math.round((rpmPercent / 100) * totalLeds);

  return (
    <div className={`card transition-colors duration-100 ${isShiftWarning ? 'ring-1 ring-purple-500/50' : ''}`}>
      {/* Shift Light Strip */}
      <div className="shift-lights">
        {Array.from({ length: totalLeds }).map((_, i) => {
          let ledColor = 'bg-emerald-500 shadow-[0_0_8px_#10b981]';
          if (i >= 5 && i < 10) ledColor = 'bg-red-500 shadow-[0_0_8px_#ef4444]';
          if (i >= 10) ledColor = 'bg-purple-500 shadow-[0_0_12px_#a855f7] animate-pulse';

          const isActive = i < activeLeds;
          return (
            <div
              key={i}
              className={`h-3 flex-1 rounded-sm transition-all duration-75 ${
                isActive ? ledColor : 'bg-slate-800 opacity-40'
              }`}
            />
          );
        })}
      </div>

      {/* Main Cluster Display */}
      <div className="cluster-main">
        {/* Speed Readout */}
        <div className="stat-box text-center">
          <div className="stat-label">SPEED</div>
          <div className="stat-value text-cyan-400">{speed}</div>
          <div className="stat-unit">{unit === 'mph' ? 'MPH' : 'KM / H'}</div>
        </div>

        {/* Center Gear Indicator */}
        <div className={`gear-display relative ${isShiftWarning ? 'border-purple-400 shadow-[0_0_30px_rgba(168,85,247,0.4)]' : ''}`}>
          <div className="gear-text">{gear}</div>
          <div className="gear-label">GEAR</div>
          {isShiftWarning && (
            <span className="absolute -top-2 px-1.5 py-0.5 bg-purple-600 text-white font-mono text-[9px] font-bold rounded animate-bounce">
              SHIFT
            </span>
          )}
        </div>

        {/* RPM Readout */}
        <div className="stat-box text-center">
          <div className="stat-label">TACHOMETER</div>
          <div className={`stat-value ${isShiftWarning ? 'text-purple-400' : 'text-amber-400'}`}>
            {rpm}
          </div>
          <div className="stat-unit">RPM (MAX {maxRpm.toLocaleString()})</div>
        </div>
      </div>

      {/* Status Flags */}
      <div className="flags-bar">
        <span className={`flag ${telemetry?.is_in_pit ? 'flag-active-amber' : 'flag-idle'}`}>
          PIT LANE
        </span>
        <span className={`flag ${telemetry?.is_abs_in_action ? 'flag-active-cyan' : 'flag-idle'}`}>
          ABS
        </span>
        <span className={`flag ${telemetry?.is_tc_in_action ? 'flag-active-emerald' : 'flag-idle'}`}>
          TC
        </span>
        <span className={`flag ${telemetry?.is_engine_limiter_on ? 'flag-active-red' : 'flag-idle'}`}>
          LIMITER
        </span>
      </div>
    </div>
  );
});

SpeedTachometer.displayName = 'SpeedTachometer';
