import React from 'react';
import {
  Sparkles,
  Activity,
  CloudSun,
  Footprints,
  PhoneCall,
  ShieldCheck,
  AlertTriangle,
  Info
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const SafetyScoreHero: React.FC = () => {
  const { aiAnalysis, vitals, environment, user } = useApp();

  const score = Math.max(0, Math.min(100, 100 - aiAnalysis.riskScore));

  // Compute sub-breakdown scores
  const healthSubScore = Math.max(
    0,
    Math.min(
      100,
      100 -
        (vitals.heartRate && vitals.heartRate > 100 ? 25 : 0) -
        (vitals.spO2 && vitals.spO2 < 95 ? 30 : 0) -
        (vitals.bodyTemperature && vitals.bodyTemperature > 37.8 ? 20 : 0)
    )
  );

  const envSubScore = Math.max(
    0,
    Math.min(
      100,
      100 -
        (environment.heatRiskLevel === 'CRITICAL'
          ? 50
          : environment.heatRiskLevel === 'HIGH'
          ? 30
          : environment.heatRiskLevel === 'MODERATE'
          ? 15
          : 0) -
        (environment.aqi > 200 ? 30 : environment.aqi > 100 ? 15 : 0)
    )
  );

  const activitySubScore = vitals.stepsCount && user.baseline?.typicalDailySteps
    ? Math.max(0, Math.min(100, Math.round((vitals.stepsCount / user.baseline.typicalDailySteps) * 100)))
    : 70;

  const readinessSubScore = user.emergencyContacts.length > 0 ? 95 : 60;

  const getScoreTheme = () => {
    if (score >= 80) {
      return {
        stroke: '#16A673',
        text: 'text-[#16A673]',
        label: 'NORMAL / LOW RISK',
        bg: 'bg-emerald-50 border-emerald-200 text-[#16A673]',
        icon: ShieldCheck,
      };
    }
    if (score >= 50) {
      return {
        stroke: '#F2A900',
        text: 'text-[#F2A900]',
        label: 'CAUTION / MODERATE',
        bg: 'bg-amber-50 border-amber-200 text-[#F2A900]',
        icon: AlertTriangle,
      };
    }
    return {
      stroke: '#E5485D',
      text: 'text-[#E5485D]',
      label: 'HIGH RISK / EMERGENCY',
      bg: 'bg-rose-50 border-rose-200 text-[#E5485D]',
      icon: AlertTriangle,
    };
  };

  const statusTheme = getScoreTheme();
  const StatusIcon = statusTheme.icon;
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-7 shadow-sm space-y-6 relative overflow-hidden">
      
      {/* Top Banner Header */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
        
        {/* Left Side: Circular Safety Score Dial */}
        <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
          <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 140 140">
              <circle
                cx="70"
                cy="70"
                r={radius}
                stroke="#E2E8F0"
                strokeWidth="10"
                className="fill-none"
              />
              <circle
                cx="70"
                cy="70"
                r={radius}
                stroke={statusTheme.stroke}
                strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="fill-none transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className={`text-3xl sm:text-4xl font-black tracking-tight tabular-nums ${statusTheme.text}`}>
                {score}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                Safety Index
              </span>
            </div>
          </div>

          <div className="space-y-2 max-w-md">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border inline-flex items-center gap-1.5 ${statusTheme.bg}`}>
                <StatusIcon className="w-3.5 h-3.5" />
                {aiAnalysis.overallRisk === 'SAFE' ? 'ALL METRICS NORMAL' : aiAnalysis.overallRisk}
              </span>
              <span className="text-xs font-bold text-slate-500 font-mono">
                {statusTheme.label}
              </span>
            </div>
            
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
              {aiAnalysis.summaryReason}
            </h3>

            <p className="text-xs text-slate-500 leading-relaxed">
              Synthesized from real Open-Meteo meteorological data, connected wearable sensors, and your personal baseline.
            </p>
          </div>
        </div>

        {/* Right Side: 4-Pillar Score Breakdown */}
        <div className="w-full lg:w-72 bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3 shrink-0">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span>Transparent Risk Breakdown</span>
            <Sparkles className="w-3.5 h-3.5 text-[#3478F6]" />
          </div>

          <div className="space-y-2.5 text-xs">
            {/* Health Vitals */}
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-600 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-[#E5485D]" /> Health Vitals
                </span>
                <span className="font-bold text-slate-900 font-mono">
                  {vitals.heartRate || vitals.spO2 ? `${healthSubScore}%` : 'Unlinked'}
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-[#E5485D] h-full rounded-full transition-all duration-500"
                  style={{ width: `${vitals.heartRate || vitals.spO2 ? healthSubScore : 100}%` }}
                />
              </div>
            </div>

            {/* Environment */}
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-600 flex items-center gap-1.5">
                  <CloudSun className="w-3.5 h-3.5 text-[#F2A900]" /> Environment & Heat
                </span>
                <span className="font-bold text-slate-900 font-mono">{envSubScore}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                <div className="bg-[#F2A900] h-full rounded-full transition-all duration-500" style={{ width: `${envSubScore}%` }} />
              </div>
            </div>

            {/* Physical Activity */}
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-600 flex items-center gap-1.5">
                  <Footprints className="w-3.5 h-3.5 text-[#16A673]" /> Daily Activity
                </span>
                <span className="font-bold text-slate-900 font-mono">{Math.min(100, activitySubScore)}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                <div className="bg-[#16A673] h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, activitySubScore)}%` }} />
              </div>
            </div>

            {/* Emergency Readiness */}
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-600 flex items-center gap-1.5">
                  <PhoneCall className="w-3.5 h-3.5 text-[#3478F6]" /> Emergency Contacts
                </span>
                <span className="font-bold text-slate-900 font-mono">{readinessSubScore}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                <div className="bg-[#3478F6] h-full rounded-full transition-all duration-500" style={{ width: `${readinessSubScore}%` }} />
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* AI Safety Recommendation Strip + Mandatory Medical Disclaimer */}
      <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-indigo-50 text-[#7357E8] shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-bold text-[#7357E8]">✨ Recommended Safety Action</span>
            </div>
            <p className="text-slate-700 leading-relaxed font-medium">
              {aiAnalysis.recommendations[0] || 'Maintain scheduled hydration and track your baseline vitals.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-200/70 text-slate-600 text-[11px] font-semibold shrink-0">
          <Info className="w-3.5 h-3.5 text-slate-500" />
          <span>Risk indicator only — not a medical diagnosis.</span>
        </div>
      </div>

    </div>
  );
};
