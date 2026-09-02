import React from 'react';
import { SunMedium, MapPin, AlertCircle, ArrowUpRight, Droplet, Wind, CloudFog } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const EnvironmentCard: React.FC = () => {
  const { environment, setActiveTab } = useApp();

  const getHeatBadgeColor = () => {
    switch (environment.heatRiskLevel) {
      case 'CRITICAL':
        return 'bg-red-500/20 text-red-300 border-red-500/40';
      case 'HIGH':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'MODERATE':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
      default:
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    }
  };

  const getAqiBadgeColor = () => {
    if (environment.aqi > 300) return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    if (environment.aqi > 200) return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
    if (environment.aqi > 100) return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  };

  const getRecommendation = () => {
    if (environment.heatRiskLevel === 'CRITICAL') {
      return 'Extreme thermal load: Move indoors to shade immediately and drink cool water with electrolytes.';
    }
    if (environment.aqi > 200) {
      return 'Poor ambient air quality: Limit outdoor cardio exercises and wear an N95 mask if commuting.';
    }
    if (environment.heatRiskLevel === 'HIGH' || environment.heatRiskLevel === 'MODERATE') {
      return 'Limit prolonged outdoor activity during peak sun and maintain steady hydration.';
    }
    return 'Environmental conditions are optimal for outdoor work and routine activities.';
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between space-y-5">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-400">
              <SunMedium className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Environmental Safety</h3>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-sky-400" />
                {environment.locationName}
              </p>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('environment')}
            className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-bold transition-colors cursor-pointer"
          >
            Disaster Center
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 4 Core Environmental Parameters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          
          {/* 1. Ambient Temperature */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5">
            <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
              <span>Temperature</span>
              <SunMedium className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <span className="text-2xl font-black text-white">{environment.ambientTempC}°C</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Heat Index: {Math.round(environment.heatIndexC)}°C</span>
          </div>

          {/* 2. Humidity */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5">
            <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
              <span>Humidity</span>
              <Droplet className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <span className="text-2xl font-black text-white">{environment.humidityPercent}%</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Wet-Bulb: {environment.wetBulbTempC}°C</span>
          </div>

          {/* 3. AQI */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5">
            <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
              <span>Air Quality (AQI)</span>
              <Wind className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <span className="text-2xl font-black text-white">{environment.aqi}</span>
            <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded border mt-0.5 ${getAqiBadgeColor()}`}>
              {environment.pollutionCategory}
            </span>
          </div>

          {/* 4. Heat Risk */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5">
            <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
              <span>Heat Risk</span>
              <CloudFog className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <span className="text-2xl font-black text-white capitalize text-sm sm:text-base">{environment.heatRiskLevel}</span>
            <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded border mt-0.5 ${getHeatBadgeColor()}`}>
              {environment.heatRiskLevel}
            </span>
          </div>

        </div>
      </div>

      {/* LifeShield Recommendation Box */}
      <div className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-4 flex items-start gap-3 text-xs text-slate-300">
        <AlertCircle className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-white block mb-0.5">LifeShield Recommendation:</strong>
          <p className="leading-relaxed">{getRecommendation()}</p>
        </div>
      </div>
    </div>
  );
};
