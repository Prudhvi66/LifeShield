import React from 'react';
import {
  Sparkles,
  Activity,
  CloudSun,
  Footprints,
  PhoneCall
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const SafetyScoreHero: React.FC = () => {
  const { aiAnalysis, vitals, environment, user } = useApp();

  const score = Math.max(0, Math.min(100, 100 - aiAnalysis.riskScore));

  // Compute sub-breakdown scores
  const healthSubScore = Math.max(0, Math.min(100, 100 - (vitals.heartRate > 100 ? 25 : 0) - (vitals.spO2 < 95 ? 30 : 0) - (vitals.bodyTemperature > 37.8 ? 20 : 0)));
  const envSubScore = Math.max(0, Math.min(100, 100 - (environment.heatRiskLevel === 'CRITICAL' ? 50 : environment.heatRiskLevel === 'HIGH' ? 30 : environment.heatRiskLevel === 'MODERATE' ? 15 : 0) - (environment.aqi > 200 ? 30 : environment.aqi > 100 ? 15 : 0)));
  const activitySubScore = Math.max(0, Math.min(100, Math.round((vitals.stepsCount / user.baseline.typicalDailySteps) * 100)));
  const readinessSubScore = user.emergencyContacts.length > 0 && user.wearableConnected.isConnected ? 98 : 75;

  const getScoreColor = () => {
    if (score >= 85) return { stroke: '#10b981', text: 'text-emerald-400', label: 'LOW RISK', bg: 'bg-emerald-500/10 border-emerald-500/20' };
    if (score >= 60) return { stroke: '#f59e0b', text: 'text-amber-400', label: 'MODERATE RISK', bg: 'bg-amber-500/10 border-amber-500/20' };
    return { stroke: '#ef4444', text: 'text-red-400', label: 'HIGH RISK', bg: 'bg-red-500/10 border-red-500/20' };
  };

  const statusTheme = getScoreColor();
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-6 relative overflow-hidden">
      
      {/* Top Banner Header */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
        
        {/* Left Side: Circular Safety Score Dial */}
        <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
          <div className="relative w-40 h-40 shrink-0 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 150 150">
              <circle
                cx="75"
                cy="75"
                r={radius}
                stroke="currentColor"
                strokeWidth="12"
                className="text-slate-800 fill-none"
              />
              <circle
                cx="75"
                cy="75"
                r={radius}
                stroke={statusTheme.stroke}
                strokeWidth="12"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="fill-none transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className={`text-4xl sm:text-5xl font-black tracking-tight tabular-nums ${statusTheme.text}`}>
                {score}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                Safety Score
              </span>
            </div>
          </div>

          <div className="space-y-2 max-w-md">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${statusTheme.bg} ${statusTheme.text}`}>
                {aiAnalysis.overallRisk === 'SAFE' ? 'ALL SYSTEMS NORMAL' : aiAnalysis.headline.replace('LifeShield Status: ', '')}
              </span>
              <span className="text-xs font-bold text-slate-400 font-mono">
                {statusTheme.label}
              </span>
            </div>
            
            <h3 className="text-lg sm:text-xl font-bold text-white leading-snug">
              {aiAnalysis.summaryReason}
            </h3>

            <p className="text-xs text-slate-400 leading-relaxed">
              Calculated on-device via personalized biometric deviation and ambient weather sensors.
            </p>
          </div>
        </div>

        {/* Right Side: 4-Pillar Score Breakdown */}
        <div className="w-full lg:w-72 bg-slate-950/70 border border-slate-800/90 rounded-2xl p-4 space-y-3 shrink-0">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300">
            <span>Safety Dimension Breakdown</span>
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
          </div>

          <div className="space-y-2.5 text-xs">
            {/* Health Vitals */}
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-rose-400" /> Health Vitals
                </span>
                <span className="font-bold text-white font-mono">{healthSubScore}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div className="bg-rose-500 h-full rounded-full transition-all duration-500" style={{ width: `${healthSubScore}%` }} />
              </div>
            </div>

            {/* Environment */}
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <CloudSun className="w-3.5 h-3.5 text-amber-400" /> Environment
                </span>
                <span className="font-bold text-white font-mono">{envSubScore}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${envSubScore}%` }} />
              </div>
            </div>

            {/* Physical Activity */}
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Footprints className="w-3.5 h-3.5 text-emerald-400" /> Daily Activity
                </span>
                <span className="font-bold text-white font-mono">{Math.min(100, activitySubScore)}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, activitySubScore)}%` }} />
              </div>
            </div>

            {/* Emergency Readiness */}
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <PhoneCall className="w-3.5 h-3.5 text-sky-400" /> Emergency Ready
                </span>
                <span className="font-bold text-white font-mono">{readinessSubScore}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div className="bg-sky-500 h-full rounded-full transition-all duration-500" style={{ width: `${readinessSubScore}%` }} />
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* AI Safety Recommendation Strip */}
      <div className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-2xl flex items-start gap-3 text-xs">
        <div className="p-2 rounded-xl bg-sky-500/15 text-sky-400 shrink-0">
          <Sparkles className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-bold text-sky-400">✨ LifeShield AI Insights</span>
            <span className="text-[10px] text-slate-500 font-mono">Edge Model v2.4</span>
          </div>
          <p className="text-slate-300 leading-relaxed">
            {aiAnalysis.recommendations[0] || 'All physiological indicators and environmental parameters are within safe baseline limits.'}
          </p>
        </div>
      </div>

    </div>
  );
};
