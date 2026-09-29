import React from 'react';
import { TelemetryFrame } from '../types/telemetry';

interface TireMonitorProps {
  telemetry: TelemetryFrame | null;
}

export const TireMonitor: React.FC<TireMonitorProps> = ({ telemetry }) => {
  const susp = telemetry?.suspension_height || { fl: 0, fr: 0, rl: 0, rr: 0 };
  const slip = telemetry?.slip_ratio || { fl: 0, fr: 0, rl: 0, rr: 0 };
  const load = telemetry?.vertical_load || { fl: 0, fr: 0, rl: 0, rr: 0 };

  const renderWheel = (
    pos: string,
    suspVal: number,
    slipVal: number,
    loadVal: number
  ) => {
    // Height visual bar
    const suspBar = Math.min(100, Math.max(10, (suspVal / 0.15) * 100));

    return (
      <div className="wheel-box">
        <div className="wheel-title">{pos}</div>
        <div className="wheel-grid">
          <div>
            <div className="text-[10px] text-slate-500">LOAD</div>
            <div className="font-mono text-xs text-slate-200">{Math.round(loadVal)} N</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500">SLIP</div>
            <div className={`font-mono text-xs ${Math.abs(slipVal) > 0.1 ? 'text-amber-400 font-bold' : 'text-slate-300'}`}>
              {(slipVal * 100).toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Suspension travel bar */}
        <div className="mt-2">
          <div className="flex justify-between text-[9px] text-slate-500 mb-0.5">
            <span>TRAVEL</span>
            <span>{(suspVal * 1000).toFixed(0)} mm</span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded overflow-hidden">
            <div
              className="h-full bg-cyan-400 transition-all duration-75"
              style={{ width: `${suspBar}%` }}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="card">
      <div className="card-header">CHASSIS & CORNER DYNAMICS</div>

      <div className="chassis-grid">
        {renderWheel('FRONT LEFT', susp.fl, slip.fl, load.fl)}
        {renderWheel('FRONT RIGHT', susp.fr, slip.fr, load.fr)}
        {renderWheel('REAR LEFT', susp.rl, slip.rl, load.rl)}
        {renderWheel('REAR RIGHT', susp.rr, slip.rr, load.rr)}
      </div>

      {/* G-Force Vector Box */}
      <div className="g-force-bar">
        <div className="g-cell">
          <div className="stat-label">LATERAL G (SWAY)</div>
          <div className="font-mono text-sm text-cyan-300 font-bold">
            {telemetry ? `${telemetry.sway.toFixed(2)} G` : '0.00 G'}
          </div>
        </div>
        <div className="g-cell">
          <div className="stat-label">LONGITUDINAL G (SURGE)</div>
          <div className="font-mono text-sm text-amber-300 font-bold">
            {telemetry ? `${telemetry.surge.toFixed(2)} G` : '0.00 G'}
          </div>
        </div>
      </div>
    </div>
  );
};
