import React from 'react';
import { ShieldCheck, AlertTriangle, AlertOctagon, Info, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const StatusBanner: React.FC = () => {
  const { aiAnalysis, user, vitals } = useApp();

  const getStyle = () => {
    switch (aiAnalysis.overallRisk) {
      case 'EMERGENCY':
        return {
          bg: 'bg-gradient-to-r from-red-950/80 via-slate-900 to-red-950/80 border-red-500/80',
          text: 'text-red-400',
          badge: 'bg-red-500/20 text-red-300 border-red-500/50',
          icon: <AlertOctagon className="w-8 h-8 text-red-500 animate-pulse" />
        };
      case 'HIGH RISK':
        return {
          bg: 'bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/80 border-amber-500/80',
          text: 'text-amber-400',
          badge: 'bg-amber-500/20 text-amber-300 border-amber-500/50',
          icon: <AlertTriangle className="w-8 h-8 text-amber-400 animate-pulse" />
        };
      case 'CAUTION':
        return {
          bg: 'bg-gradient-to-r from-yellow-950/60 via-slate-900 to-yellow-950/60 border-yellow-500/60',
          text: 'text-yellow-400',
          badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50',
          icon: <AlertTriangle className="w-8 h-8 text-yellow-400" />
        };
      default:
        return {
          bg: 'bg-gradient-to-r from-emerald-950/60 via-slate-900 to-sky-950/60 border-emerald-500/40',
          text: 'text-emerald-400',
          badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          icon: <ShieldCheck className="w-8 h-8 text-emerald-400" />
        };
    }
  };

  const style = getStyle();

  return (
    <div className={`w-full rounded-2xl border p-5 sm:p-6 shadow-xl ${style.bg} relative overflow-hidden transition-all duration-300`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Left Side: Status & Description */}
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-700/60 shrink-0 shadow-inner">
            {style.icon}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {aiAnalysis.headline}
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${style.badge}`}>
                {aiAnalysis.overallRisk}
              </span>
            </div>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
              {aiAnalysis.summaryReason}
            </p>
          </div>
        </div>

        {/* Right Side: Baseline Context & Edge AI Metric */}
        <div className="flex items-center gap-3 self-end md:self-center shrink-0">
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-right">
            <div className="flex items-center justify-end gap-1.5 text-[11px] text-sky-400 font-mono">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Edge AI Model</span>
            </div>
            <div className="text-lg font-black text-white font-mono">
              {100 - aiAnalysis.riskScore}% <span className="text-xs text-slate-400 font-normal">Safety Index</span>
            </div>
            <div className="text-[10px] text-slate-400">
              Resting Base: <strong className="text-slate-200">{user.baseline.restingHeartRate} BPM</strong> (Current: {vitals.heartRate})
            </div>
          </div>
        </div>

      </div>

      {/* Actionable recommendations bar */}
      {aiAnalysis.recommendations.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-400 flex items-center gap-1 shrink-0">
            <Info className="w-3.5 h-3.5 text-sky-400" />
            AI Safety Advice:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {aiAnalysis.recommendations.slice(0, 2).map((rec, i) => (
              <span
                key={i}
                className="text-xs font-medium bg-slate-800/80 text-slate-200 px-3 py-1 rounded-lg border border-slate-700/60"
              >
                {rec}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
