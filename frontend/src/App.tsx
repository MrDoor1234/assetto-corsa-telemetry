import React, { useState } from 'react';
import { useTelemetrySocket } from './hooks/useTelemetrySocket';
import { SpeedTachometer } from './components/SpeedTachometer';
import { PedalsTrace } from './components/PedalsTrace';
import { TireMonitor } from './components/TireMonitor';
import { FrictionCircle } from './components/FrictionCircle';
import { TelemetryChart } from './components/TelemetryChart';
import {
  Activity,
  Radio,
  Gauge,
  Clock,
  Zap,
  RotateCw,
  Settings,
  Database,
  ExternalLink,
  X,
  Key,
} from 'lucide-react';

export const App: React.FC = () => {
  const {
    telemetry,
    isConnected,
    isStreaming,
    fps,
    totalPackets,
    isDemoMode,
    setDemoMode,
    reconnect,
  } = useTelemetrySocket();

  const [unit, setUnit] = useState<'kmh' | 'mph'>('kmh');
  const [maxRpm, setMaxRpm] = useState<number>(13500);
  const [showInfluxModal, setShowInfluxModal] = useState<boolean>(false);

  const formatLapTime = (ms: number) => {
    if (!ms || ms <= 0) return '--:--.---';
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const millis = ms % 1000;
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
  };

  // Calculate live delta relative to best lap
  const currentLapMs = telemetry?.lap_time_ms ?? 0;
  const bestLapMs = telemetry?.best_lap_ms ?? 0;
  const carPos = telemetry?.car_position_normalized ?? 0;

  let deltaSec = 0;
  let hasValidDelta = false;
  if (bestLapMs > 0 && carPos > 0.05 && currentLapMs > 0) {
    const expectedElapsedAtPos = bestLapMs * carPos;
    deltaSec = (currentLapMs - expectedElapsedAtPos) / 1000;
    hasValidDelta = true;
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto flex flex-col gap-6 relative">
      {/* Paddock Telemetry Header */}
      <header className="flex flex-wrap justify-between items-center bg-slate-900/90 border border-slate-800 p-4 rounded-xl backdrop-blur-md gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Gauge className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wider text-white">
              ASSETTO CORSA <span className="text-cyan-400">RACE TELEMETRY</span>
            </h1>
            <p className="text-xs text-slate-400 font-mono">
              Trackside Ingestion Pipeline & Telemetry Cockpit
            </p>
          </div>
        </div>

        {/* Live Controls & Diagnostics Bar */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 font-mono text-xs">
          {/* Demo Mode Toggle */}
          <button
            onClick={() => setDemoMode((prev) => !prev)}
            className={`px-3 py-1.5 rounded-lg border font-bold flex items-center gap-1.5 transition-all ${
              isDemoMode
                ? 'bg-amber-500 text-black border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.5)]'
                : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-slate-300'
            }`}
            title="Toggle offline simulated physics generator"
          >
            <Zap className={`w-3.5 h-3.5 ${isDemoMode ? 'text-black fill-black' : 'text-amber-400'}`} />
            <span>{isDemoMode ? 'DEMO ACTIVE' : 'DEMO MODE'}</span>
          </button>

          {/* Unit Toggle */}
          <div className="flex bg-slate-800/80 rounded-lg p-0.5 border border-slate-700">
            <button
              onClick={() => setUnit('kmh')}
              className={`px-2.5 py-1 rounded font-bold transition-all ${
                unit === 'kmh'
                  ? 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              KM/H
            </button>
            <button
              onClick={() => setUnit('mph')}
              className={`px-2.5 py-1 rounded font-bold transition-all ${
                unit === 'mph'
                  ? 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              MPH
            </button>
          </div>

          {/* RPM Redline Presets */}
          <div className="hidden lg:flex items-center gap-1 bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1 text-slate-400">
            <Settings className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] text-slate-500">REDLINE:</span>
            <select
              value={maxRpm}
              onChange={(e) => setMaxRpm(Number(e.target.value))}
              className="bg-transparent text-slate-200 outline-none cursor-pointer font-bold"
            >
              <option value={8500} className="bg-slate-900 text-white">8,500 (GT3)</option>
              <option value={9200} className="bg-slate-900 text-white">9,200 (Cup)</option>
              <option value={13500} className="bg-slate-900 text-white">13,500 (Default)</option>
              <option value={15000} className="bg-slate-900 text-white">15,000 (F1 Turbo)</option>
              <option value={18000} className="bg-slate-900 text-white">18,000 (V10)</option>
            </select>
          </div>

          {/* InfluxDB Credentials Popover Button */}
          <button
            onClick={() => setShowInfluxModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-lg text-slate-300 transition-colors"
            title="View InfluxDB Login & Connection Details"
          >
            <Database className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline font-bold">INFLUXDB</span>
          </button>

          {/* Connection status badge */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-950/60 border border-slate-800">
            <Radio
              className={`w-3.5 h-3.5 ${
                !isConnected
                  ? 'text-red-400'
                  : isDemoMode
                  ? 'text-amber-400 animate-pulse'
                  : isStreaming
                  ? 'text-emerald-400 animate-pulse'
                  : 'text-cyan-400'
              }`}
            />
            <span
              className={`font-bold ${
                !isConnected
                  ? 'text-red-400'
                  : isDemoMode
                  ? 'text-amber-400'
                  : isStreaming
                  ? 'text-emerald-400'
                  : 'text-cyan-400'
              }`}
            >
              {!isConnected
                ? 'FEED OFFLINE'
                : isDemoMode
                ? `SIMULATING (${fps} HZ)`
                : isStreaming
                ? `STREAMING (${fps} HZ)`
                : 'STANDBY (WAITING FOR CAR)'}
            </span>
            {!isConnected && !isDemoMode && (
              <button
                onClick={reconnect}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
                title="Retry WebSocket Connection"
              >
                <RotateCw className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Packets count */}
          <div className="hidden sm:flex items-center gap-1.5 text-slate-400">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>PKTS: <strong className="text-white">{totalPackets.toLocaleString()}</strong></span>
          </div>

          {/* Current Lap */}
          <div className="flex items-center gap-1.5 text-slate-400">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>LAP: <strong className="text-white">{telemetry?.lap_count ?? 1}</strong></span>
          </div>
        </div>
      </header>

      {/* Standby Banner when connected to backend but AC has not driven yet */}
      {isConnected && !isStreaming && !isDemoMode && (
        <div className="bg-cyan-950/40 border border-cyan-800/60 text-cyan-200 px-4 py-2.5 rounded-lg flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping inline-block" />
            <span>
              <strong>PIPELINE CONNECTED:</strong> Listening on UDP 9996. Enter the cockpit and click <strong>Drive</strong> in Assetto Corsa to start telemetry streaming.
            </span>
          </div>
          <button
            onClick={() => setDemoMode(true)}
            className="text-amber-300 hover:text-amber-200 underline font-bold"
          >
            Launch Demo Mode Instead
          </button>
        </div>
      )}

      {/* Main Grid: Tachometer + Driver Inputs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SpeedTachometer telemetry={telemetry} unit={unit} maxRpm={maxRpm} />
        </div>
        <div>
          <PedalsTrace telemetry={telemetry} />
        </div>
      </div>

      {/* Chassis & Dynamics + G-G Friction Circle */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TireMonitor telemetry={telemetry} />
        </div>
        <div>
          <FrictionCircle telemetry={telemetry} />
        </div>
      </div>

      {/* Rolling Multi-Channel Telemetry Waveform */}
      <div>
        <TelemetryChart telemetry={telemetry} unit={unit} />
      </div>

      {/* Timing and Track Status Strip */}
      <footer className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="card text-center">
          <div className="stat-label">CURRENT LAP TIME</div>
          <div className="font-mono text-xl font-bold text-slate-100 mt-1">
            {formatLapTime(telemetry?.lap_time_ms ?? 0)}
          </div>
        </div>

        <div className="card text-center">
          <div className="stat-label">LIVE DELTA</div>
          <div
            className={`font-mono text-xl font-bold mt-1 ${
              hasValidDelta
                ? deltaSec <= 0
                  ? 'text-emerald-400'
                  : 'text-red-400'
                : 'text-slate-500'
            }`}
          >
            {hasValidDelta
              ? deltaSec <= 0
                ? `${deltaSec.toFixed(2)}s`
                : `+${deltaSec.toFixed(2)}s`
              : '--.--s'}
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

        <div className="card text-center col-span-2 sm:col-span-1">
          <div className="stat-label">TRACK PROGRESSION</div>
          <div className="font-mono text-xl font-bold text-cyan-400 mt-1">
            {telemetry ? `${(telemetry.car_position_normalized * 100).toFixed(1)}%` : '0.0%'}
          </div>
        </div>
      </footer>

      {/* InfluxDB Credentials Modal */}
      {showInfluxModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl relative font-chakra text-slate-100">
            <button
              onClick={() => setShowInfluxModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white tracking-wide">
                  InfluxDB v2 Login
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  Time-Series Database & Data Explorer
                </p>
              </div>
            </div>

            <div className="bg-slate-950/80 rounded-lg p-4 border border-slate-800 font-mono text-xs space-y-2 mb-5">
              <div className="flex justify-between items-center pb-1.5 border-b border-slate-800">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-purple-400" /> USERNAME
                </span>
                <span className="text-purple-300 font-bold select-all">admin</span>
              </div>

              <div className="flex justify-between items-center pb-1.5 border-b border-slate-800">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-purple-400" /> PASSWORD
                </span>
                <span className="text-amber-300 font-bold select-all">f1telemetryadmin123</span>
              </div>

              <div className="flex justify-between items-center pb-1.5 border-b border-slate-800">
                <span className="text-slate-500">ORGANIZATION</span>
                <span className="text-slate-200 select-all">motorsport</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-500">BUCKET</span>
                <span className="text-slate-200 select-all">telemetry</span>
              </div>
            </div>

            <div className="flex justify-between items-center gap-3">
              <a
                href="http://localhost:8086"
                target="_blank"
                rel="noreferrer"
                className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 text-xs transition-colors shadow-lg shadow-purple-600/30"
              >
                <span>OPEN INFLUXDB EXPLORER</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={() => setShowInfluxModal(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 px-4 rounded-lg text-xs transition-colors"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
