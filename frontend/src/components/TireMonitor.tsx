import React from 'react';
import { TelemetryFrame } from '../types/telemetry';

interface TireMonitorProps {
  telemetry: TelemetryFrame | null;
}

export const TireMonitor: React.FC<TireMonitorProps> = React.memo(({ telemetry }) => {
  const susp = telemetry?.suspension_height || { fl: 0, fr: 0, rl: 0, rr: 0 };
  const slip = telemetry?.slip_ratio || { fl: 0, fr: 0, rl: 0, rr: 0 };
  const load = telemetry?.vertical_load || { fl: 0, fr: 0, rl: 0, rr: 0 };
  const camber = telemetry?.camber_rad || { fl: 0, fr: 0, rl: 0, rr: 0 };
  const slipAngle = telemetry?.slip_angle || { fl: 0, fr: 0, rl: 0, rr: 0 };

  const renderWheel = (
    pos: string,
    suspVal: number,
    slipVal: number,
    loadVal: number,
    camberVal: number,
    slipAngleVal: number
  ) => {
    // Travel visual bar (0 - 150mm)
    const suspBar = Math.min(100, Math.max(10, (suspVal / 0.15) * 100));
    const absSlip = Math.abs(slipVal);
    const camberDeg = (camberVal * (180 / Math.PI)).toFixed(1);

    // Dynamic grip state
    let stateBorder = 'border-slate-800';
    let slipColor = 'text-slate-300';
    let statusBadge = null;

    if (absSlip > 0.15) {
      stateBorder = 'border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.4)]';
      slipColor = 'text-red-400 font-bold';
      statusBadge = <span className="text-[8px] bg-red-600 text-white px-1 rounded animate-pulse">LOCK/SPIN</span>;
    } else if (absSlip > 0.08) {
      stateBorder = 'border-amber-500/80 shadow-[0_0_8px_rgba(245,158,11,0.3)]';
      slipColor = 'text-amber-400 font-bold';
      statusBadge = <span className="text-[8px] bg-amber-600 text-white px-1 rounded">SLIP</span>;
    }

    return (
      <div className={`wheel-box border transition-all duration-100 ${stateBorder}`}>
        <div className="flex justify-between items-center mb-1">
          <span className="wheel-title m-0 text-slate-300">{pos}</span>
          {statusBadge}
        </div>

        <div className="wheel-grid">
          <div>
            <div className="text-[9px] text-slate-500 font-mono">LOAD</div>
            <div className="font-mono text-xs text-slate-200">{Math.round(loadVal)} N</div>
          </div>
          <div>
            <div className="text-[9px] text-slate-500 font-mono">SLIP RATIO</div>
            <div className={`font-mono text-xs ${slipColor}`}>
              {(slipVal * 100).toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-[9px] text-slate-500 font-mono">CAMBER</div>
            <div className="font-mono text-[11px] text-slate-300">{camberDeg}°</div>
          </div>
          <div>
            <div className="text-[9px] text-slate-500 font-mono">SLIP ANGLE</div>
            <div className="font-mono text-[11px] text-cyan-400">{slipAngleVal.toFixed(1)}°</div>
          </div>
        </div>

        {/* Suspension travel bar */}
        <div className="mt-2">
          <div className="flex justify-between text-[9px] text-slate-500 mb-0.5">
            <span>TRAVEL</span>
            <span className="font-mono text-slate-400">{(suspVal * 1000).toFixed(0)} mm</span>
          </div>
          <div className="w-full h-1.5 bg-slate-900 rounded overflow-hidden border border-slate-800">
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
      <div className="card-header">CHASSIS & FOUR-WHEEL DYNAMICS</div>

      <div className="chassis-grid">
        {renderWheel('FRONT LEFT', susp.fl, slip.fl, load.fl, camber.fl, slipAngle.fl)}
        {renderWheel('FRONT RIGHT', susp.fr, slip.fr, load.fr, camber.fr, slipAngle.fr)}
        {renderWheel('REAR LEFT', susp.rl, slip.rl, load.rl, camber.rl, slipAngle.rl)}
        {renderWheel('REAR RIGHT', susp.rr, slip.rr, load.rr, camber.rr, slipAngle.rr)}
      </div>
    </div>
  );
});

TireMonitor.displayName = 'TireMonitor';
