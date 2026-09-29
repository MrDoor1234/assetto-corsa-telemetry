import React from 'react';
import { useTelemetrySocket } from './hooks/useTelemetrySocket';
import { SpeedTachometer } from './components/SpeedTachometer';
import { PedalsTrace } from './components/PedalsTrace';
import { TireMonitor } from './components/TireMonitor';
import { TelemetryChart } from './components/TelemetryChart';
import { Activity, Radio, Gauge, Clock } from 'lucide-react';

export const App: React.FC = () => {
  const { telemetry, isConnected, fps, totalPackets } = useTelemetrySocket();

  const formatLapTime = (ms: number) => {
    if (!ms || ms <= 0) return '--:--.---';
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const millis = ms % 1000;
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
  };

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto flex flex-col gap-6">
      {/* Paddock Telemetry Header */}
      <header className="flex flex-wrap justify-between items-center bg-slate-900/80 border border-slate-800 p-4 rounded-xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Gauge className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wider text-white">
              ASSETTO CORSA <span className="text-cyan-400">LIVE TELEMETRY</span>
            </h1>
            <p className="text-xs text-slate-400 font-mono">
              High-Throughput UDP Ingestion & Trackside Pipeline
            </p>
          </div>
        </div>

        {/* Live System Diagnostics */}
        <div className="flex items-center gap-6 mt-3 sm:mt-0 font-mono text-xs">
          {/* Connection status */}
          <div className="flex items-center gap-2">
            <Radio className={`w-4 h-4 ${isConnected ? 'text-emerald-400 animate-pulse' : 'text-red-400'}`} />
            <span className={isConnected ? 'text-emerald-400 font-bold' : 'text-red-400'}>
              {isConnected ? `STREAMING (${fps} HZ)` : 'FEED OFFLINE'}
            </span>
          </div>

          {/* Packets count */}
          <div className="flex items-center gap-2 text-slate-400">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span>PKTS: <strong className="text-white">{totalPackets.toLocaleString()}</strong></span>
          </div>

          {/* Current Lap */}
          <div className="flex items-center gap-2 text-slate-400">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>LAP: <strong className="text-white">{telemetry?.lap_count ?? 1}</strong></span>
          </div>
        </div>
      </header>

      {/* Main Grid: Tachometer + Pedals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SpeedTachometer telemetry={telemetry} />
        </div>
        <div>
          <PedalsTrace telemetry={telemetry} />
        </div>
      </div>

      {/* Chassis Dynamics + Rolling Waveform */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div>
          <TireMonitor telemetry={telemetry} />
        </div>
        <div className="lg:col-span-2">
          <TelemetryChart telemetry={telemetry} />
        </div>
      </div>

      {/* Timing and Track Status Strip */}
      <footer className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card text-center">
          <div className="stat-label">CURRENT LAP TIME</div>
          <div className="font-mono text-xl font-bold text-slate-100 mt-1">
            {formatLapTime(telemetry?.lap_time_ms ?? 0)}
          </div>
        </div>
        <div className="card text-center">
          <div className="stat-label">LAST LAP TIME</div>
          <div className="font-mono text-xl font-bold text-slate-300 mt-1">
            {formatLapTime(telemetry?.last_lap_ms ?? 0)}
          </div>
        </div>
        <div className="card text-center">
          <div className="stat-label">BEST SESSION LAP</div>
          <div className="font-mono text-xl font-bold text-purple-400 mt-1">
            {formatLapTime(telemetry?.best_lap_ms ?? 0)}
          </div>
        </div>
        <div className="card text-center">
          <div className="stat-label">TRACK PROGRESSION</div>
          <div className="font-mono text-xl font-bold text-cyan-400 mt-1">
            {telemetry ? `${(telemetry.car_position_normalized * 100).toFixed(1)}%` : '0.0%'}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
