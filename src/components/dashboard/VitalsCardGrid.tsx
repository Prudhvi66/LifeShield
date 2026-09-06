import React from 'react';
import {
  Heart,
  Droplets,
  Thermometer,
  Footprints,
  Moon,
  Wind,
  TrendingUp,
  Bluetooth,
  PlusCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { EcgWaveform } from './EcgWaveform';

const UNAVAILABLE_TEXT = "Not available from connected device";

export const VitalsCardGrid: React.FC = () => {
  const { vitals, user, setActiveTab } = useApp();

  const isHeartRateElevated = vitals.heartRate
    ? vitals.heartRate > (user.baseline?.restingHeartRate || 70) + 20 || vitals.heartRate > 105
    : false;

  const isSpO2Low = vitals.spO2
    ? vitals.spO2 < (user.baseline?.normalSpO2Min || 95)
    : false;

  const isTempElevated = vitals.bodyTemperature
    ? vitals.bodyTemperature > 37.8
    : false;

  const isHydrationLow = vitals.hydrationIndex
    ? vitals.hydrationIndex < 45
    : false;

  const activityPercent = vitals.stepsCount && user.baseline?.typicalDailySteps
    ? Math.min(100, Math.round((vitals.stepsCount / user.baseline.typicalDailySteps) * 100))
    : 0;

  const isConnected = Boolean(vitals.heartRate || vitals.spO2 || vitals.source === 'ble');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <span>Live Health Telemetry</span>
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-[#16A673] animate-pulse' : 'bg-slate-400'
            }`}
          />
        </h3>
        <button
          onClick={() => setActiveTab('health')}
          className="text-xs font-semibold text-[#00A88F] hover:text-[#008f7a] flex items-center gap-1.5 transition-colors"
        >
          <Bluetooth className="w-3.5 h-3.5" />
          <span>{isConnected ? 'Manage Device' : 'Pair Sensor / Log Vitals'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* 1. ❤️ Heart Rate */}
        <div className="bg-white border border-slate-200/80 hover:border-slate-300 rounded-2xl p-5 shadow-sm flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-rose-50 text-[#E5485D]">
                <Heart className={`w-5 h-5 ${isHeartRateElevated ? 'animate-bounce' : isConnected ? 'animate-pulse' : ''}`} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Heart Rate</h4>
                <p className="text-[11px] text-slate-500">
                  Baseline: {user.baseline?.restingHeartRate || 70} BPM
                </p>
              </div>
            </div>
            {vitals.heartRate ? (
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                  isHeartRateElevated
                    ? 'bg-rose-50 text-[#E5485D] border-rose-200'
                    : 'bg-emerald-50 text-[#16A673] border-emerald-200'
                }`}
              >
                {isHeartRateElevated ? 'Elevated' : 'Normal'}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                Unlinked
              </span>
            )}
          </div>

          {vitals.heartRate ? (
            <>
              <div className="flex items-baseline justify-between mb-2">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-slate-900 tabular-nums tracking-tight">
                    {vitals.heartRate}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">BPM</span>
                </div>
                {vitals.bloodPressureSys && vitals.bloodPressureDia && (
                  <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-[#3478F6]" />
                    {vitals.bloodPressureSys}/{vitals.bloodPressureDia} mmHg
                  </span>
                )}
              </div>
              <EcgWaveform heartRate={vitals.heartRate} isAbnormal={isHeartRateElevated} />
            </>
          ) : (
            <div className="py-4 text-center">
              <p className="text-xs text-slate-500 font-medium italic mb-2">
                {UNAVAILABLE_TEXT}
              </p>
              <button
                onClick={() => setActiveTab('health')}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#3478F6] hover:underline"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Pair Bluetooth Sensor</span>
              </button>
            </div>
          )}
        </div>

        {/* 2. 🫁 SpO₂ (Blood Oxygen) */}
        <div className="bg-white border border-slate-200/80 hover:border-slate-300 rounded-2xl p-5 shadow-sm flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-sky-50 text-[#3478F6]">
                <Wind className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">SpO₂ Oxygen</h4>
                <p className="text-[11px] text-slate-500">
                  Target: {user.baseline?.normalSpO2Min || 95}%+
                </p>
              </div>
            </div>
            {vitals.spO2 ? (
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                  isSpO2Low
                    ? 'bg-rose-50 text-[#E5485D] border-rose-200'
                    : 'bg-emerald-50 text-[#16A673] border-emerald-200'
                }`}
              >
                {isSpO2Low ? 'Hypoxia Alert' : 'Normal'}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                Unlinked
              </span>
            )}
          </div>

          {vitals.spO2 ? (
            <>
              <div className="flex items-baseline justify-between mb-2">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-slate-900 tabular-nums tracking-tight">
                    {vitals.spO2}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">%</span>
                </div>
                {vitals.respirationRate && (
                  <span className="text-[11px] text-slate-500 font-mono">
                    Resp: {vitals.respirationRate} bpm
                  </span>
                )}
              </div>

              <div className="space-y-1.5 pt-2">
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isSpO2Low ? 'bg-[#E5485D]' : 'bg-gradient-to-r from-[#3478F6] to-[#16A673]'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, vitals.spO2))}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>90% Min Safe</span>
                  <span>100% Saturation</span>
                </div>
              </div>
            </>
          ) : (
            <div className="py-4 text-center">
              <p className="text-xs text-slate-500 font-medium italic mb-2">
                {UNAVAILABLE_TEXT}
              </p>
              <button
                onClick={() => setActiveTab('health')}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#3478F6] hover:underline"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Log SpO₂ Reading</span>
              </button>
            </div>
          )}
        </div>

        {/* 3. 🌡 Body Temperature */}
        <div className="bg-white border border-slate-200/80 hover:border-slate-300 rounded-2xl p-5 shadow-sm flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-amber-50 text-[#F2A900]">
                <Thermometer className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Body Temperature</h4>
                <p className="text-[11px] text-slate-500">Range: 36.2 - 37.2°C</p>
              </div>
            </div>
            {vitals.bodyTemperature ? (
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                  isTempElevated
                    ? 'bg-amber-50 text-[#F2A900] border-amber-200'
                    : 'bg-emerald-50 text-[#16A673] border-emerald-200'
                }`}
              >
                {isTempElevated ? 'Elevated' : 'Normal'}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                Unlinked
              </span>
            )}
          </div>

          {vitals.bodyTemperature ? (
            <>
              <div className="flex items-baseline justify-between mb-2">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-slate-900 tabular-nums tracking-tight">
                    {vitals.bodyTemperature}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">°C</span>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">
                  ({((vitals.bodyTemperature * 9) / 5 + 32).toFixed(1)}°F)
                </span>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-600 flex items-center justify-between">
                <span>Thermal Status:</span>
                <span className="font-semibold text-slate-900">
                  {vitals.bodyTemperature > 38.0 ? 'Heat Strain / Fever' : 'Optimal Homeostasis'}
                </span>
              </div>
            </>
          ) : (
            <div className="py-4 text-center">
              <p className="text-xs text-slate-500 font-medium italic mb-2">
                {UNAVAILABLE_TEXT}
              </p>
              <button
                onClick={() => setActiveTab('health')}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#3478F6] hover:underline"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Log Temperature</span>
              </button>
            </div>
          )}
        </div>

        {/* 4. 🏃 Physical Activity & Steps */}
        <div className="bg-white border border-slate-200/80 hover:border-slate-300 rounded-2xl p-5 shadow-sm flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-emerald-50 text-[#16A673]">
                <Footprints className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Daily Activity</h4>
                <p className="text-[11px] text-slate-500">
                  Goal: {(user.baseline?.typicalDailySteps || 8000).toLocaleString()} steps
                </p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-[#16A673] border border-emerald-200 uppercase">
              {vitals.activityLevel || 'Active'}
            </span>
          </div>

          {vitals.stepsCount !== null && vitals.stepsCount !== undefined ? (
            <>
              <div className="flex items-baseline justify-between mb-2">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-slate-900 tabular-nums tracking-tight">
                    {vitals.stepsCount.toLocaleString()}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">Steps</span>
                </div>
                <span className="text-[11px] text-[#16A673] font-mono font-bold">
                  {activityPercent}% Goal
                </span>
              </div>

              <div className="space-y-1.5 pt-2">
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                  <div
                    className="h-full bg-gradient-to-r from-[#16A673] to-[#00A88F] rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, activityPercent)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>0</span>
                  <span>{(user.baseline?.typicalDailySteps || 8000).toLocaleString()}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="py-4 text-center">
              <p className="text-xs text-slate-500 font-medium italic mb-2">
                {UNAVAILABLE_TEXT}
              </p>
              <button
                onClick={() => setActiveTab('health')}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#3478F6] hover:underline"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Sync Health Connect</span>
              </button>
            </div>
          )}
        </div>

        {/* 5. 💧 Hydration Index */}
        <div className="bg-white border border-slate-200/80 hover:border-slate-300 rounded-2xl p-5 shadow-sm flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-teal-50 text-[#00A88F]">
                <Droplets className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Hydration Tracking</h4>
                <p className="text-[11px] text-slate-500">Water & Fluid Balance</p>
              </div>
            </div>
            {vitals.hydrationIndex ? (
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                  isHydrationLow
                    ? 'bg-rose-50 text-[#E5485D] border-rose-200'
                    : 'bg-emerald-50 text-[#16A673] border-emerald-200'
                }`}
              >
                {isHydrationLow ? 'Drink Water' : 'Optimal'}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                Log Routine
              </span>
            )}
          </div>

          {vitals.hydrationIndex ? (
            <>
              <div className="flex items-baseline justify-between mb-2">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-slate-900 tabular-nums tracking-tight">
                    {Math.round(vitals.hydrationIndex)}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">%</span>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">
                  {vitals.hydrationIndex > 70 ? 'Adequate' : 'Hydration Reminder'}
                </span>
              </div>

              <div className="space-y-1.5 pt-2">
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isHydrationLow ? 'bg-[#E5485D]' : 'bg-[#00A88F]'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, vitals.hydrationIndex))}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Low</span>
                  <span>Optimal</span>
                </div>
              </div>
            </>
          ) : (
            <div className="py-4 text-center">
              <p className="text-xs text-slate-500 font-medium italic mb-2">
                Track hydration via Medicine & Water Reminders
              </p>
              <button
                onClick={() => setActiveTab('health')}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#00A88F] hover:underline"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Open Hydration Reminders</span>
              </button>
            </div>
          )}
        </div>

        {/* 6. 😴 Sleep Recovery */}
        <div className="bg-white border border-slate-200/80 hover:border-slate-300 rounded-2xl p-5 shadow-sm flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-indigo-50 text-[#7357E8]">
                <Moon className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Sleep & Rest</h4>
                <p className="text-[11px] text-slate-500">
                  Target: {user.baseline?.typicalSleepHours || 7.5} hrs
                </p>
              </div>
            </div>
            {vitals.sleepHours ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-[#7357E8] border border-indigo-200">
                Restful
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                Unlinked
              </span>
            )}
          </div>

          {vitals.sleepHours ? (
            <>
              <div className="flex items-baseline justify-between mb-2">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-slate-900 tabular-nums tracking-tight">
                    {vitals.sleepHours}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">hrs</span>
                </div>
                {vitals.fatigueIndex && (
                  <span className="text-[11px] text-slate-500 font-mono">
                    Fatigue: {vitals.fatigueIndex}/100
                  </span>
                )}
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-600 flex items-center justify-between">
                <span>Recovery Status:</span>
                <span className="font-semibold text-[#7357E8]">
                  {vitals.sleepHours >= 7 ? 'Restored' : 'Mild Sleep Deficit'}
                </span>
              </div>
            </>
          ) : (
            <div className="py-4 text-center">
              <p className="text-xs text-slate-500 font-medium italic mb-2">
                {UNAVAILABLE_TEXT}
              </p>
              <button
                onClick={() => setActiveTab('health')}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#7357E8] hover:underline"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Log Sleep Hours</span>
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
