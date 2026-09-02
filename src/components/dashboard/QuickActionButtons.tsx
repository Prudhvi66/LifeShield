import React, { useState } from 'react';
import {
  PhoneCall,
  CheckCircle,
  Hospital,
  Volume2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { soundService } from '../../services/soundService';

export const QuickActionButtons: React.FC = () => {
  const {
    triggerManualSos,
    setActiveTab,
    toggleAudioBeacon,
    isBeaconActive,
    t
  } = useApp();

  const [checkedInMessage, setCheckedInMessage] = useState(false);

  const handleCheckIn = () => {
    soundService.playSafeChime();
    setCheckedInMessage(true);
    setTimeout(() => setCheckedInMessage(false), 3500);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-300">Quick Safety Actions</h3>
        {checkedInMessage && (
          <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2.5 py-1 rounded-lg animate-in fade-in">
            ✓ Safety Check-In Logged Locally!
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        
        {/* 1. Large Emergency SOS Button */}
        <button
          onClick={triggerManualSos}
          className="p-4 rounded-2xl bg-gradient-to-br from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white flex flex-col items-center justify-center gap-2 shadow-xl shadow-red-950/60 active:scale-95 transition-all group cursor-pointer border border-red-400/30"
        >
          <div className="p-3 rounded-full bg-white/20 group-hover:scale-110 transition-transform">
            <PhoneCall className="w-6 h-6 animate-pulse" />
          </div>
          <span className="text-sm font-black tracking-wide">{t.sosButton}</span>
          <span className="text-[10px] text-red-100 opacity-90">1-Tap 112 / 108 Alert</span>
        </button>

        {/* 2. Daily Safety Check-In */}
        <button
          onClick={handleCheckIn}
          className="p-4 rounded-2xl bg-slate-900/90 hover:bg-slate-800/90 text-white flex flex-col items-center justify-center gap-2 border border-slate-800 hover:border-emerald-500/50 shadow-lg active:scale-95 transition-all group cursor-pointer"
        >
          <div className="p-3 rounded-full bg-emerald-500/20 text-emerald-400 group-hover:scale-110 transition-transform">
            <CheckCircle className="w-6 h-6" />
          </div>
          <span className="text-sm font-bold">I'm Feeling Safe</span>
          <span className="text-[10px] text-slate-400">Log Safe Check-in</span>
        </button>

        {/* 3. Audio SOS Distress Beacon */}
        <button
          onClick={toggleAudioBeacon}
          className={`p-4 rounded-2xl flex flex-col items-center justify-center gap-2 shadow-lg active:scale-95 transition-all group cursor-pointer border ${
            isBeaconActive
              ? 'bg-amber-600 text-white border-amber-400 shadow-amber-950/60 animate-pulse'
              : 'bg-slate-900/90 hover:bg-slate-800/90 text-white border-slate-800 hover:border-amber-500/50'
          }`}
        >
          <div
            className={`p-3 rounded-full transition-transform ${
              isBeaconActive ? 'bg-white/20' : 'bg-amber-500/20 text-amber-400 group-hover:scale-110'
            }`}
          >
            <Volume2 className="w-6 h-6" />
          </div>
          <span className="text-sm font-bold">{isBeaconActive ? 'Stop Siren' : 'Audio Beacon'}</span>
          <span className="text-[10px] text-slate-400">
            {isBeaconActive ? 'Distress Siren Active' : 'Sound Alarm for Rescuers'}
          </span>
        </button>

        {/* 4. Nearest Emergency Care / Map */}
        <button
          onClick={() => setActiveTab('emergency')}
          className="p-4 rounded-2xl bg-slate-900/90 hover:bg-slate-800/90 text-white flex flex-col items-center justify-center gap-2 border border-slate-800 hover:border-sky-500/50 shadow-lg active:scale-95 transition-all group cursor-pointer"
        >
          <div className="p-3 rounded-full bg-sky-500/20 text-sky-400 group-hover:scale-110 transition-transform">
            <Hospital className="w-6 h-6" />
          </div>
          <span className="text-sm font-bold">Emergency Directory</span>
          <span className="text-[10px] text-slate-400">Indian 112, 108 & Map</span>
        </button>

      </div>
    </div>
  );
};
