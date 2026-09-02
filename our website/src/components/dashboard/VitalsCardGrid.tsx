import React from 'react';
import {
  Heart,
  Droplets,
  Thermometer,
  Footprints,
  Moon,
  Wind,
  TrendingUp
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { EcgWaveform } from './EcgWaveform';

export const VitalsCardGrid: React.FC = () => {
  const { vitals, user } = useApp();

  const isHeartRateElevated = vitals.heartRate > user.baseline.restingHeartRate + 20 || vitals.heartRate > 105;
  const isSpO2Low = vitals.spO2 < user.baseline.normalSpO2Min;
  const isTempElevated = vitals.bodyTemperature > 37.8;
  const isHydrationLow = vitals.hydrationIndex < 45;

  const activityPercent = Math.min(100, Math.round((vitals.stepsCount / user.baseline.typicalDailySteps) * 100));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <span>Live Health Telemetry</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </h3>
        <span className="text-xs text-slate-400 font-mono">Real-time Stream</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* 1. ❤️ Heart Rate */}
        <div className="bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-rose-500/15 text-rose-400">
                <Heart className={`w-5 h-5 ${isHeartRateElevated ? 'animate-bounce' : 'animate-pulse'}`} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Heart Rate</h4>
                <p className="text-[11px] text-slate-400">Baseline: {user.baseline.restingHeartRate} BPM</p>
              </div>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                isHeartRateElevated
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              }`}
            >
              {isHeartRateElevated ? 'Elevated' : 'Normal'}
            </span>
          </div>

          <div className="flex items-baseline justify-between mb-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-white tabular-nums tracking-tight">{vitals.heartRate}</span>
              <span className="text-xs font-semibold text-slate-400">BPM</span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-sky-400" />
              {vitals.bloodPressureSys}/{vitals.bloodPressureDia} mmHg
            </span>
          </div>

          <EcgWaveform heartRate={vitals.heartRate} isAbnormal={isHeartRateElevated} />
        </div>

        {/* 2. 🫁 SpO₂ (Blood Oxygen) */}
        <div className="bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-sky-500/15 text-sky-400">
                <Wind className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">SpO₂ Oxygen</h4>
                <p className="text-[11px] text-slate-400">Target: {user.baseline.normalSpO2Min}%+</p>
              </div>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                isSpO2Low
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              }`}
            >
              {isSpO2Low ? 'Hypoxia Alert' : 'Normal'}
            </span>
          </div>

          <div className="flex items-baseline justify-between mb-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-white tabular-nums tracking-tight">{vitals.spO2}</span>
              <span className="text-xs font-semibold text-slate-400">%</span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              Resp: {vitals.respirationRate} bpm
            </span>
          </div>

          <div className="space-y-1.5 pt-2">
            <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isSpO2Low ? 'bg-rose-500' : 'bg-gradient-to-r from-sky-500 to-emerald-400'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, vitals.spO2))}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>90% Min Safe</span>
              <span>100% Saturation</span>
            </div>
          </div>
        </div>

        {/* 3. 🌡 Body Temperature */}
        <div className="bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400">
                <Thermometer className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Body Temperature</h4>
                <p className="text-[11px] text-slate-400">Range: 36.2 - 37.2°C</p>
              </div>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                isTempElevated
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              }`}
            >
              {isTempElevated ? 'Elevated' : 'Normal'}
            </span>
          </div>

          <div className="flex items-baseline justify-between mb-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-white tabular-nums tracking-tight">{vitals.bodyTemperature}</span>
              <span className="text-xs font-semibold text-slate-400">°C</span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              ({((vitals.bodyTemperature * 9) / 5 + 32).toFixed(1)}°F)
            </span>
          </div>

          <div className="p-2.5 bg-slate-950/70 rounded-xl border border-slate-800/80 text-[11px] text-slate-300 flex items-center justify-between">
            <span>Thermal Status:</span>
            <span className="font-semibold text-slate-200">
              {vitals.bodyTemperature > 38.0 ? 'Heat Strain / Fever' : 'Optimal Homeostasis'}
            </span>
          </div>
        </div>

        {/* 4. 🏃 Physical Activity & Steps */}
        <div className="bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400">
                <Footprints className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Daily Activity</h4>
                <p className="text-[11px] text-slate-400">Goal: {user.baseline.typicalDailySteps.toLocaleString()} steps</p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 uppercase">
              {vitals.activityLevel}
            </span>
          </div>

          <div className="flex items-baseline justify-between mb-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-white tabular-nums tracking-tight">
                {vitals.stepsCount.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-slate-400">Steps</span>
            </div>
            <span className="text-[11px] text-emerald-400 font-mono font-bold">
              {activityPercent}% Goal
            </span>
          </div>

          <div className="space-y-1.5 pt-2">
            <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, activityPercent)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>0</span>
              <span>{user.baseline.typicalDailySteps.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* 5. 💧 Hydration Index */}
        <div className="bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-cyan-500/15 text-cyan-400">
                <Droplets className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Hydration Level</h4>
                <p className="text-[11px] text-slate-400">Fluid & Electrolyte Index</p>
              </div>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                isHydrationLow
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              }`}
            >
              {isHydrationLow ? 'Drink Water' : 'Good'}
            </span>
          </div>

          <div className="flex items-baseline justify-between mb-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-white tabular-nums tracking-tight">
                {Math.round(vitals.hydrationIndex)}
              </span>
              <span className="text-xs font-semibold text-slate-400">%</span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              {vitals.hydrationIndex > 70 ? 'Adequate' : 'Hydration Reminder'}
            </span>
          </div>

          <div className="space-y-1.5 pt-2">
            <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isHydrationLow ? 'bg-rose-500' : 'bg-cyan-400'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, vitals.hydrationIndex))}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>Low</span>
              <span>Optimal</span>
            </div>
          </div>
        </div>

        {/* 6. 😴 Sleep Recovery */}
        <div className="bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-purple-500/15 text-purple-400">
                <Moon className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Sleep & Recovery</h4>
                <p className="text-[11px] text-slate-400">Target: {user.baseline.typicalSleepHours} hrs</p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
              Restful
            </span>
          </div>

          <div className="flex items-baseline justify-between mb-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-white tabular-nums tracking-tight">{vitals.sleepHours}</span>
              <span className="text-xs font-semibold text-slate-400">hrs</span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              Fatigue: {vitals.fatigueIndex}/100
            </span>
          </div>

          <div className="p-2.5 bg-slate-950/70 rounded-xl border border-slate-800/80 text-[11px] text-slate-300 flex items-center justify-between">
            <span>Recovery Score:</span>
            <span className="font-semibold text-purple-300">
              {vitals.sleepHours >= 7 ? '94% Restored' : 'Mild Sleep Deficit'}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};
