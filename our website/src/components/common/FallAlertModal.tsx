import React from 'react';
import { AlertOctagon, CheckCircle2, PhoneCall, Radio, AlertTriangle } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const FallAlertModal: React.FC = () => {
  const {
    fallAlertOpen,
    fallCountdown,
    handleUserOk,
    handleUserNeedHelp,
    activeFallEvent,
  } = useApp();

  if (!fallAlertOpen) return null;

  // 30 seconds circle stroke calculation
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (fallCountdown / 30) * circumference;

  const isCriticalCount = fallCountdown <= 10;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-2xl animate-in fade-in duration-200">
      
      {/* Background pulsing emergency rings */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center">
        <div className={`w-[550px] h-[550px] rounded-full ${isCriticalCount ? 'bg-red-600/30' : 'bg-red-600/20'} animate-ping opacity-30`} />
        <div className={`w-[750px] h-[750px] rounded-full ${isCriticalCount ? 'bg-red-700/20' : 'bg-red-700/10'} animate-pulse opacity-20`} />
      </div>

      <div className="relative w-full max-w-lg bg-slate-900 border-2 border-red-500/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-red-950/90 flex flex-col items-center text-center overflow-hidden">
        
        {/* Demo Mode Notice Banner if in simulation */}
        <div className="w-full bg-purple-950/80 border border-purple-500/50 rounded-xl py-1 px-3 mb-4 text-[11px] font-black text-purple-300 uppercase tracking-wider flex items-center justify-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>DEMO MODE — NO REAL EMERGENCY CALL</span>
        </div>

        {/* Top Emergency Indicator */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/50 text-red-400 text-xs font-black uppercase tracking-wider mb-3 animate-pulse">
          <Radio className="w-3.5 h-3.5 animate-spin" />
          <span>Fall Detection Pipeline Active</span>
        </div>

        <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center mb-2">
          <AlertOctagon className="w-10 h-10 text-red-500 animate-pulse" />
        </div>

        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-1">
          POSSIBLE FALL DETECTED
        </h2>

        <p className="text-slate-300 text-sm sm:text-base max-w-md mb-5 leading-relaxed font-medium">
          Are you okay? If no response is detected, emergency assistance will automatically be dispatched.
        </p>

        {/* Circular Countdown Progress Ring */}
        <div className="relative w-40 h-40 flex items-center justify-center mb-6">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 140 140">
            <circle
              cx="70"
              cy="70"
              r={radius}
              stroke="currentColor"
              strokeWidth="10"
              className="text-slate-800 fill-none"
            />
            <circle
              cx="70"
              cy="70"
              r={radius}
              stroke="currentColor"
              strokeWidth="10"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className={`${
                isCriticalCount ? 'text-red-500' : 'text-amber-400'
              } fill-none transition-all duration-1000 ease-linear`}
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span
              className={`text-4xl sm:text-5xl font-black tabular-nums ${
                isCriticalCount ? 'text-red-400 scale-110' : 'text-amber-300'
              } transition-transform`}
            >
              {fallCountdown}
            </span>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Seconds Remaining</span>
          </div>
        </div>

        {/* Sensor telemetry snippet */}
        {activeFallEvent && (
          <div className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3 mb-6 flex items-center justify-around text-xs font-mono text-slate-400">
            <div>
              <span className="text-slate-500 block text-[10px]">IMPACT FORCE</span>
              <span className="text-amber-400 font-bold">{activeFallEvent.accelerationPeakG} G</span>
            </div>
            <div className="h-6 w-px bg-slate-800" />
            <div>
              <span className="text-slate-500 block text-[10px]">DEVICE TILT</span>
              <span className="text-sky-400 font-bold">{activeFallEvent.tiltAngleDeg}°</span>
            </div>
            <div className="h-6 w-px bg-slate-800" />
            <div>
              <span className="text-slate-500 block text-[10px]">POST-MOTION</span>
              <span className="text-red-400 font-bold">Still ({activeFallEvent.inactivityDurationSec}s)</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
          <button
            onClick={handleUserOk}
            className="w-full py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base sm:text-lg flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-950/60 active:scale-95 transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-6 h-6" />
            <span>✓ I'M OK</span>
          </button>

          <button
            onClick={handleUserNeedHelp}
            className="w-full py-4 px-6 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black text-base sm:text-lg flex items-center justify-center gap-2.5 shadow-xl shadow-red-950/60 active:scale-95 transition-all cursor-pointer animate-pulse"
          >
            <PhoneCall className="w-6 h-6" />
            <span>🚨 I NEED HELP</span>
          </button>
        </div>

        <p className="mt-4 text-[11px] text-slate-400">
          Continuous audio alarm & haptics active. Press <strong className="text-emerald-400 font-bold">I'M OK</strong> to cancel immediately.
        </p>
      </div>
    </div>
  );
};
