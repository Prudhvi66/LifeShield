import React, { useState } from "react";
import {
  Settings,
  Bell,
  Volume2,
  Lock,
  Moon,
  Smartphone,
  ShieldCheck,
  LogOut,
  Info,
  Radio,
} from "lucide-react";
import { VoiceSettings } from "../../services/voiceTtsService";
import { soundService } from "../../services/soundService";
import { BackendConnectionTest } from "../diagnostic/BackendConnectionTest";

interface SettingsViewProps {
  user: any;
  voiceSettings: VoiceSettings;
  onUpdateVoiceSettings: (settings: VoiceSettings) => void;
  onLogout: () => void;
  onOpenDisclaimer: () => void;
  onOpenPrivacy: () => void;
  onOpenPermissions: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  voiceSettings,
  onUpdateVoiceSettings,
  onLogout,
  onOpenDisclaimer,
  onOpenPrivacy,
  onOpenPermissions,
}) => {
  const [notifyEnv, setNotifyEnv] = useState(true);
  const [notifyFall, setNotifyFall] = useState(true);
  const [isBeaconPlaying, setIsBeaconPlaying] = useState(false);

  const toggleBeacon = () => {
    if (isBeaconPlaying) {
      soundService.stopAudioBeacon();
      setIsBeaconPlaying(false);
    } else {
      soundService.startAudioBeacon();
      setIsBeaconPlaying(true);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn" style={{ textAlign: "left" }}>
      {/* Header */}
      <div>
        <div className="text-xs font-bold text-sky-400 tracking-wider uppercase">CONFIGURATION</div>
        <h1 className="text-2xl lg:text-3xl font-extrabold text-white">System Settings & Privacy</h1>
        <p className="text-slate-400 text-sm mt-1">
          Control notification preferences, emergency audio beacons, permissions, and session security.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Account & Security */}
        <div
          className="p-6 rounded-2xl border space-y-4"
          style={{ background: "rgba(15, 23, 42, 0.6)", borderColor: "rgba(51, 65, 85, 0.5)" }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/15 text-sky-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Account & Session</h3>
              <div className="text-xs text-slate-400">
                {user ? `Logged in as ${user.email}` : "Guest / Local Profile"}
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-800 text-xs text-slate-300">
            <div className="flex justify-between py-1.5">
              <span className="text-slate-400">Data Storage:</span>
              <span className="font-semibold text-slate-200">Local Encrypted SQLite</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-400">Token Scheme:</span>
              <span className="font-semibold text-slate-200">JWT Bearer (HS256)</span>
            </div>
          </div>

          {user && (
            <button
              type="button"
              className="ls-btn-danger w-full flex items-center justify-center gap-2 mt-2"
              onClick={onLogout}
            >
              <LogOut className="w-4 h-4" /> Sign Out of This Device
            </button>
          )}
        </div>

        {/* 2. Notifications & Alerts */}
        <div
          className="p-6 rounded-2xl border space-y-4"
          style={{ background: "rgba(15, 23, 42, 0.6)", borderColor: "rgba(51, 65, 85, 0.5)" }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Alert Notifications</h3>
              <div className="text-xs text-slate-400">Threshold alarms & safety advisories</div>
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-800">
            <label className="flex items-center justify-between cursor-pointer text-xs">
              <span className="text-slate-300">Severe Weather & AQI Alerts</span>
              <input
                type="checkbox"
                checked={notifyEnv}
                onChange={(e) => setNotifyEnv(e.target.checked)}
                className="w-4 h-4 accent-sky-500 rounded"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer text-xs">
              <span className="text-slate-300">High-G Fall Siren Alarms</span>
              <input
                type="checkbox"
                checked={notifyFall}
                onChange={(e) => setNotifyFall(e.target.checked)}
                className="w-4 h-4 accent-sky-500 rounded"
              />
            </label>
          </div>
        </div>

        {/* 3. Audio Beacon & Voice Synthesizer */}
        <div
          className="p-6 rounded-2xl border space-y-4"
          style={{ background: "rgba(15, 23, 42, 0.6)", borderColor: "rgba(51, 65, 85, 0.5)" }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-500/15 text-violet-400">
              <Volume2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Voice & Audio Services</h3>
              <div className="text-xs text-slate-400">Text-to-speech guidance & search beacons</div>
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-800 text-xs">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-slate-300">Master Voice Announcements</span>
              <input
                type="checkbox"
                checked={voiceSettings.masterVoiceEnabled}
                onChange={(e) =>
                  onUpdateVoiceSettings({ ...voiceSettings, masterVoiceEnabled: e.target.checked })
                }
                className="w-4 h-4 accent-sky-500 rounded"
              />
            </label>

            <div className="pt-2">
              <div className="flex justify-between items-center mb-2">
                <span className="text-slate-400">Emergency Audio Beacon:</span>
                <span className="text-[11px] text-slate-500">High-pitch acoustic locator</span>
              </div>
              <button
                type="button"
                className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  isBeaconPlaying
                    ? "bg-rose-600 text-white animate-pulse"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
                onClick={toggleBeacon}
              >
                <Radio className="w-4 h-4" />
                {isBeaconPlaying ? "Stop Audio Beacon" : "Test Emergency Audio Beacon"}
              </button>
            </div>
          </div>
        </div>

        {/* 4. Permissions & Privacy Policy */}
        <div
          className="p-6 rounded-2xl border space-y-4"
          style={{ background: "rgba(15, 23, 42, 0.6)", borderColor: "rgba(51, 65, 85, 0.5)" }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-500/15 text-teal-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Privacy & Sensor Access</h3>
              <div className="text-xs text-slate-400">Hardware permissions & legal compliance</div>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              className="ls-btn-secondary w-full text-xs text-left justify-between flex items-center"
              onClick={onOpenPermissions}
            >
              <span>View Hardware Sensor Permissions</span>
              <span className="text-slate-500">→</span>
            </button>
            <button
              type="button"
              className="ls-btn-secondary w-full text-xs text-left justify-between flex items-center"
              onClick={onOpenDisclaimer}
            >
              <span>Clinical Safety Notice & Disclaimer</span>
              <span className="text-slate-500">→</span>
            </button>
          </div>
        </div>
      </div>

      {/* DIAGNOSTIC — Backend Connection Test (temporary, remove before release) */}
      <BackendConnectionTest />
    </div>
  );
};
