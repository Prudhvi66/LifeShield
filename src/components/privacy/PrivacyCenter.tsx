import React, { useState } from 'react';
import {
  Lock,
  ShieldCheck,
  Trash2,
  Download,
  CheckCircle,
  CheckCircle2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { StorageService } from '../../services/storageService';

export const PrivacyCenter: React.FC = () => {
  const { privacyPrefs, updatePrivacy } = useApp();
  const [purgeConfirmOpen, setPurgeConfirmOpen] = useState(false);
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  const handleToggle = (key: keyof typeof privacyPrefs) => {
    updatePrivacy(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleExport = () => {
    const dataStr = StorageService.exportAllUserData();
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lifeshield_privacy_archive_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setNotificationMsg('Local encrypted health record exported successfully.');
    setTimeout(() => setNotificationMsg(null), 3000);
  };

  const handlePurge = () => {
    StorageService.clearAllData();
    setPurgeConfirmOpen(false);
    setNotificationMsg('All local cache, personal baselines, and logs have been wiped.');
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <span className="p-2 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <Lock className="w-7 h-7" />
            </span>
            🔒 Your Health Data. Your Control.
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            LifeShield is architected for strict privacy: on-device Edge AI models, zero cloud telemetry, and total user ownership.
          </p>
        </div>

        {/* Live Visual Indicator: Local AI Processing: ACTIVE */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-black shadow-lg">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Local AI Processing: ACTIVE</span>
        </div>
      </div>

      {notificationMsg && (
        <div className="p-4 bg-emerald-950/80 border border-emerald-500/50 rounded-2xl text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{notificationMsg}</span>
        </div>
      )}

      {/* Confirmation Modal for Data Wipe */}
      {purgeConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-slate-900 border border-red-500/50 rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center mx-auto text-red-400">
              <Trash2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-white">Permanently Wipe All Data?</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              This will permanently delete your personalized health baseline, emergency contacts, and incident logs stored on this device.
            </p>
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                onClick={() => setPurgeConfirmOpen(false)}
                className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handlePurge}
                className="py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md"
              >
                Yes, Wipe Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6 Core Privacy Pillars Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-2">
          <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5" />
            <span>✓ On-Device Processing</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            All AI inference, fall verification heuristics, and vitals anomaly checks execute inside your device's browser runtime.
          </p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-2">
          <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5" />
            <span>✓ Minimal Data Sharing</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            No advertising trackers or biometric analytics data is ever gathered, aggregated, or sold.
          </p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-2">
          <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5" />
            <span>✓ Local Health History</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Your learned baseline patterns and incident logs are stored securely in local browser IndexedDB / localStorage.
          </p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-2">
          <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5" />
            <span>✓ Location Permission Control</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            GPS coordinates are only used locally for regional weather risk indices and emergency pin rendering.
          </p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-2">
          <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5" />
            <span>✓ Emergency Sharing Control</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Location and health payloads are only transmitted when a confirmed emergency is triggered or countdown expires.
          </p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-2">
          <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5" />
            <span>✓ Data Deletion</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            You maintain full sovereignty to export or permanently purge all biometric cache with one tap.
          </p>
        </div>

      </div>

      {/* Granular Permission Toggles */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-sky-400" />
          Sensor & Telemetry Permission Management
        </h3>

        <div className="divide-y divide-slate-800 text-xs">
          
          <div className="py-3.5 flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <span className="font-bold text-white block">Motion & Accelerometer Sensor Access</span>
              <p className="text-slate-400 text-[11px]">Enables on-device fall detection and physical exertion analysis.</p>
            </div>
            <button
              onClick={() => handleToggle('motionSensorsPermissionGranted')}
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                privacyPrefs.motionSensorsPermissionGranted ? 'bg-sky-600' : 'bg-slate-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                  privacyPrefs.motionSensorsPermissionGranted ? 'right-1' : 'left-1'
                }`}
              />
            </button>
          </div>

          <div className="py-3.5 flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <span className="font-bold text-white block">GPS Geolocation Access</span>
              <p className="text-slate-400 text-[11px]">Used for regional heat indices and generating emergency map coordinates.</p>
            </div>
            <button
              onClick={() => handleToggle('locationPermissionGranted')}
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                privacyPrefs.locationPermissionGranted ? 'bg-sky-600' : 'bg-slate-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                  privacyPrefs.locationPermissionGranted ? 'right-1' : 'left-1'
                }`}
              />
            </button>
          </div>

          <div className="py-3.5 flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <span className="font-bold text-white block">Auto-Share Location in Confirmed SOS</span>
              <p className="text-slate-400 text-[11px]">Embeds Google Maps pin in SMS & WhatsApp alerts to emergency contacts.</p>
            </div>
            <button
              onClick={() => handleToggle('emergencyAutoShareLocation')}
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                privacyPrefs.emergencyAutoShareLocation ? 'bg-sky-600' : 'bg-slate-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                  privacyPrefs.emergencyAutoShareLocation ? 'right-1' : 'left-1'
                }`}
              />
            </button>
          </div>

        </div>
      </div>

      {/* Export & Purge Actions */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white">Data Portability & Deletion</h3>
          <p className="text-xs text-slate-400 mt-0.5">Download your encrypted local JSON archive or wipe all traces.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-2xl text-xs font-bold border border-slate-700 transition-colors"
          >
            <Download className="w-4 h-4 text-sky-400" />
            <span>Export Archive</span>
          </button>

          <button
            onClick={() => setPurgeConfirmOpen(true)}
            className="flex items-center gap-2 bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 px-4 py-2.5 rounded-2xl text-xs font-bold border border-rose-800/60 transition-colors"
          >
            <Trash2 className="w-4 h-4 text-rose-400" />
            <span>Wipe Local Data</span>
          </button>
        </div>
      </div>

    </div>
  );
};
