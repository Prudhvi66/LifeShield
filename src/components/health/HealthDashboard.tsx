import React, { useState } from 'react';
import {
  Activity,
  Sparkles,
  Bluetooth,
  TrendingUp,
  Download,
  CheckCircle2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { StorageService } from '../../services/storageService';

import { BluetoothPairingModal } from './BluetoothPairingModal';

export const HealthDashboard: React.FC = () => {
  const { vitals, user, historicalTrends } = useApp();
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');
  const [exportMessage, setExportMessage] = useState(false);
  const [bleModalOpen, setBleModalOpen] = useState(false);

  const handleExport = () => {
    const dataStr = StorageService.exportAllUserData();
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lifeshield_health_analytics_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportMessage(true);
    setTimeout(() => setExportMessage(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <span className="p-2 rounded-2xl bg-sky-500/15 text-sky-400 border border-sky-500/30">
              <Activity className="w-7 h-7" />
            </span>
            Health Analytics & Baseline
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Continuous physiological telemetry analyzed against your learned baseline boundaries.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Time Range Selector */}
          <div className="bg-slate-900 border border-slate-800 p-1 rounded-2xl flex items-center gap-1">
            {(['24h', '7d', '30d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  timeRange === range
                    ? 'bg-sky-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {range === '24h' ? '24 Hours' : range === '7d' ? '7 Days' : '30 Days'}
              </button>
            ))}
          </div>

          <button
            onClick={() => setBleModalOpen(true)}
            className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-md transition-colors cursor-pointer"
          >
            <Bluetooth className="w-4 h-4" />
            <span>Connect Smartwatch</span>
          </button>

          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-xs font-bold border border-slate-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {exportMessage && (
        <div className="p-3.5 bg-emerald-950/80 border border-emerald-500/50 rounded-2xl text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Health records successfully exported locally as encrypted JSON.</span>
        </div>
      )}

      {/* Personalized Baseline Comparison Box */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-sky-500/15 text-sky-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Personalized Baseline Intelligence</h2>
              <p className="text-xs text-slate-400">Learned from {user.baseline.calibratedDays} days of on-device sensor data</p>
            </div>
          </div>
          <span className="text-[11px] font-mono bg-sky-950/80 border border-sky-800/60 text-sky-300 px-3 py-1 rounded-full self-start sm:self-auto">
            100% On-Device Learned Pattern
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          
          {/* Average Resting Heart Rate */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-1">
            <span className="text-slate-400 block text-[11px]">Your average resting heart rate</span>
            <span className="text-2xl font-black text-white">{user.baseline.restingHeartRate} BPM</span>
            <p className="text-[10px] text-slate-400">
              Your usual range: <strong className="text-sky-300">{user.baseline.restingHeartRate - 4}–{user.baseline.restingHeartRate + 6} BPM</strong>
            </p>
          </div>

          {/* SpO2 Minimum Floor */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-1">
            <span className="text-slate-400 block text-[11px]">SpO₂ Normal Floor</span>
            <span className="text-2xl font-black text-white">{user.baseline.normalSpO2Min}%</span>
            <p className="text-[10px] text-slate-400">
              Current: <strong className="text-emerald-400">{vitals.spO2}% (Optimal)</strong>
            </p>
          </div>

          {/* Temperature Range */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-1">
            <span className="text-slate-400 block text-[11px]">Usual Body Temp Range</span>
            <span className="text-2xl font-black text-white">
              {user.baseline.normalTempRange[0]}–{user.baseline.normalTempRange[1]}°C
            </span>
            <p className="text-[10px] text-slate-400">
              Current: <strong className="text-slate-200">{vitals.bodyTemperature}°C</strong>
            </p>
          </div>

          {/* Typical Activity Target */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-1">
            <span className="text-slate-400 block text-[11px]">Typical Daily Movement</span>
            <span className="text-2xl font-black text-white">{user.baseline.typicalDailySteps.toLocaleString()}</span>
            <p className="text-[10px] text-slate-400">
              Pace today: <strong className="text-purple-300">{Math.round((vitals.stepsCount / user.baseline.typicalDailySteps) * 100)}%</strong>
            </p>
          </div>

        </div>
      </div>

      {/* Hourly Timeline Chart */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-sky-400" />
            Heart Rate & Baseline Deviations ({timeRange.toUpperCase()})
          </h3>
          <span className="text-xs text-slate-400 font-mono">Continuous Telemetry</span>
        </div>

        <div className="h-44 w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-end justify-between gap-2 overflow-x-auto">
          {historicalTrends.map((pt, idx) => {
            const heightPercent = Math.min(100, Math.max(20, ((pt.heartRate - 50) / 70) * 100));
            const isHigh = pt.heartRate > 85;

            return (
              <div key={idx} className="flex-1 min-w-[36px] flex flex-col items-center gap-1 group">
                <div className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity font-mono">
                  {pt.heartRate}
                </div>
                <div
                  className={`w-full rounded-t-xl transition-all duration-300 ${
                    isHigh
                      ? 'bg-gradient-to-t from-amber-600 to-rose-500 group-hover:brightness-125'
                      : 'bg-gradient-to-t from-sky-600 to-sky-400 group-hover:brightness-125'
                  }`}
                  style={{ height: `${heightPercent}%` }}
                />
                <span className="text-[10px] text-slate-400 font-mono mt-1">{pt.timeLabel}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sensor Diagnostic Strip */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bluetooth className="w-5 h-5 text-sky-400" />
            <h3 className="text-base font-bold text-white">Hardware Telemetry Status</h3>
          </div>
          <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-3 py-1 rounded-full">
            ● Active Telemetry
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-1">
            <span className="text-slate-400 font-medium">Smart Wearable</span>
            <p className="text-slate-200 font-bold">{user.wearableConnected.deviceName}</p>
            <p className="text-[11px] text-slate-400">Battery: {user.wearableConnected.batteryPercent}% • BLE Protocol</p>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-1">
            <span className="text-slate-400 font-medium">Smartphone Motion Sensors</span>
            <p className="text-slate-200 font-bold">3-Axis Accelerometer + Gyro</p>
            <p className="text-[11px] text-slate-400">Fall Detection Pipeline Active (50Hz)</p>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-1">
            <span className="text-slate-400 font-medium">GPS Geolocation</span>
            <p className="text-slate-200 font-bold">High Precision Receiver</p>
            <p className="text-[11px] text-slate-400">Accuracy ±15m • Local Cache Only</p>
          </div>
        </div>
      </div>

      {/* Bluetooth Smartwatch Pairing Modal */}
      <BluetoothPairingModal
        isOpen={bleModalOpen}
        onClose={() => setBleModalOpen(false)}
      />
    </div>
  );
};
