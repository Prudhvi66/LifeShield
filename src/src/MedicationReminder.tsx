import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Bell,
  Volume2,
  VolumeX,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Pill,
  Droplets,
  Utensils,
  Activity,
  Globe,
  Sliders
} from "lucide-react";
import { apiClient } from "../services/apiClient";
import { voiceTtsService, VoiceLanguage } from "../services/voiceTtsService";

export type ReminderType = "medicine" | "water" | "meal" | "activity";
export type RepeatType = "Daily" | "Once" | "Weekly";

interface ReminderItem {
  id: string;
  title: string;
  reminder_type: ReminderType;
  time: string;
  dosage?: string;
  repeat: RepeatType;
  voice_enabled: boolean;
  language: VoiceLanguage;
  is_active: boolean;
}

interface HistoryItem {
  id: string;
  medicine_name: string;
  scheduled_time: string;
  action: "Taken" | "Skipped";
  timestamp: string;
  notes?: string;
}

export const MedicationReminder: React.FC = () => {
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [reminderType, setReminderType] = useState<ReminderType>("medicine");
  const [time, setTime] = useState("");
  const [dosage, setDosage] = useState("");
  const [repeat, setRepeat] = useState<RepeatType>("Daily");
  const [reminderLang, setReminderLang] = useState<VoiceLanguage>("en");
  const [itemVoiceEnabled, setItemVoiceEnabled] = useState(true);

  // Voice Settings State
  const [voiceSettings, setVoiceSettings] = useState(() => voiceTtsService.getSettings());
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [showVoiceConfig, setShowVoiceConfig] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  // Prevent duplicate voice triggers within the same minute
  const triggeredRef = useRef<Set<string>>(new Set());

  // Load reminders & history from FastAPI backend
  const loadData = useCallback(async () => {
    try {
      const [remList, histList] = await Promise.all([
        apiClient.reminders.list(),
        apiClient.reminders.getHistory(30),
      ]);

      if (remList && Array.isArray(remList)) {
        setReminders(remList.map((r: any) => ({
          id: r.id,
          title: r.title,
          reminder_type: r.reminder_type || "medicine",
          time: r.time,
          dosage: r.dosage,
          repeat: r.repeat || "Daily",
          voice_enabled: r.voice_enabled ?? true,
          language: r.language || "en",
          is_active: r.is_active ?? true,
        })));
      }

      if (histList && Array.isArray(histList)) {
        setHistory(histList.map((h: any) => ({
          id: h.id,
          medicine_name: h.medicine_name,
          scheduled_time: h.scheduled_time,
          action: h.action as "Taken" | "Skipped",
          timestamp: new Date(h.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" }),
          notes: h.notes,
        })));
      }
    } catch (err) {
      console.warn("Could not load reminders from backend:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const voices = voiceTtsService.populateVoices();
    setAvailableVoices(voices);
  }, [loadData]);

  // Check reminder schedules every 5 seconds
  useEffect(() => {
    const checkTimer = () => {
      const now = new Date();
      const currentHH = String(now.getHours()).padStart(2, "0");
      const currentMM = String(now.getMinutes()).padStart(2, "0");
      const currentTimeStr = `${currentHH}:${currentMM}`;
      const todayStr = now.toISOString().slice(0, 10);

      reminders.forEach((item) => {
        if (!item.is_active || item.time !== currentTimeStr) return;

        const triggerKey = `${item.id}-${todayStr}-${item.time}`;
        if (triggeredRef.current.has(triggerKey)) return;
        triggeredRef.current.add(triggerKey);

        // Execute Real Device Voice TTS
        if (voiceSettings.masterVoiceEnabled && item.voice_enabled) {
          voiceTtsService.speakReminder({
            title: item.title,
            dosage: item.dosage,
            reminderType: item.reminder_type,
            language: item.language,
          });
        }

        // Browser notification if permitted
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("💊 LifeShield Health Reminder", {
            body: `Time for: ${item.title} ${item.dosage ? '(' + item.dosage + ')' : ''}`,
            icon: "/favicon.ico",
          });
        }

        setMessage({
          text: `🔔 Scheduled Reminder: ${item.title} (${item.time})`,
          type: "info",
        });
      });
    };

    const interval = setInterval(checkTimer, 5000);
    return () => clearInterval(interval);
  }, [reminders, voiceSettings]);

  // Add new reminder
  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !time) {
      setMessage({ text: "Please enter a reminder title and scheduled time.", type: "error" });
      return;
    }

    try {
      const created = await apiClient.reminders.create({
        title: title.trim(),
        reminder_type: reminderType,
        time,
        dosage: dosage.trim() || undefined,
        repeat,
        voice_enabled: itemVoiceEnabled,
        language: reminderLang,
        is_active: true,
      });

      if (created) {
        setReminders(prev => [...prev, {
          id: created.id,
          title: created.title,
          reminder_type: created.reminder_type as ReminderType,
          time: created.time,
          dosage: created.dosage,
          repeat: created.repeat as RepeatType,
          voice_enabled: created.voice_enabled,
          language: created.language as VoiceLanguage,
          is_active: created.is_active,
        }]);

        setTitle("");
        setDosage("");
        setTime("");
        setMessage({ text: `✅ Reminder for "${created.title}" scheduled successfully.`, type: "success" });
      }
    } catch (err: any) {
      setMessage({ text: `Failed to save reminder: ${err.message}`, type: "error" });
    }
  };

  // Delete reminder
  const handleDelete = async (id: string) => {
    try {
      await apiClient.reminders.delete(id);
      setReminders(prev => prev.filter(r => r.id !== id));
      setMessage({ text: "Reminder deleted.", type: "info" });
    } catch (err: any) {
      setMessage({ text: `Could not delete reminder: ${err.message}`, type: "error" });
    }
  };

  // Record action: Taken / Skipped
  const handleAction = async (item: ReminderItem, action: "Taken" | "Skipped") => {
    try {
      const logged = await apiClient.reminders.logAction(item.id, {
        medicine_name: item.title,
        scheduled_time: item.time,
        action,
        notes: `Marked by user at ${new Date().toLocaleTimeString()}`,
      });

      if (logged) {
        const newHist: HistoryItem = {
          id: logged.id,
          medicine_name: logged.medicine_name,
          scheduled_time: logged.scheduled_time,
          action,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setHistory(prev => [newHist, ...prev]);

        setMessage({
          text: action === "Taken" ? `✓ Marked "${item.title}" as Taken.` : `Marked "${item.title}" as Skipped.`,
          type: action === "Taken" ? "success" : "info",
        });
      }
    } catch (err: any) {
      setMessage({ text: `Action log failed: ${err.message}`, type: "error" });
    }
  };

  // Toggle master voice setting
  const toggleMasterVoice = () => {
    const updated = !voiceSettings.masterVoiceEnabled;
    const next = { ...voiceSettings, masterVoiceEnabled: updated };
    setVoiceSettings(next);
    voiceTtsService.saveSettings({ masterVoiceEnabled: updated });
    apiClient.profile.updateVoicePreferences({
      master_voice_enabled: updated,
      voice_lang: next.language,
      speech_rate: next.speechRate,
      selected_voice_name: next.selectedVoiceName,
    }).catch(() => {});
  };

  // Test current voice TTS
  const testVoiceAlert = (lang?: VoiceLanguage) => {
    voiceTtsService.speakReminder({
      title: title || "Paracetamol 500mg",
      dosage: dosage || "1 tablet after meals",
      reminderType: reminderType,
      language: lang || reminderLang,
      force: true,
    });
    setMessage({ text: `🔊 Testing real device voice TTS (${(lang || reminderLang).toUpperCase()}).`, type: "info" });
  };

  const getReminderIcon = (type: ReminderType) => {
    switch (type) {
      case "water":
        return <Droplets className="w-5 h-5 text-[#00A88F]" />;
      case "meal":
        return <Utensils className="w-5 h-5 text-[#F2A900]" />;
      case "activity":
        return <Activity className="w-5 h-5 text-[#3478F6]" />;
      default:
        return <Pill className="w-5 h-5 text-[#7357E8]" />;
    }
  };

  return (
    <div className="space-y-6 pt-2">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="p-2 rounded-xl bg-teal-50 text-[#00A88F]">
                <Bell className="w-5 h-5" />
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Health & Medication Reminders
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 max-w-xl">
              Real device-scheduled alerts for medicines, hydration, meals, and health routines with native multi-lingual Voice Text-to-Speech.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={toggleMasterVoice}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
                voiceSettings.masterVoiceEnabled
                  ? "bg-[#00A88F] text-white shadow-sm hover:bg-[#008f7a]"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {voiceSettings.masterVoiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span>{voiceSettings.masterVoiceEnabled ? "Voice Alerts ON" : "Voice Alerts OFF"}</span>
            </button>

            <button
              onClick={() => setShowVoiceConfig(prev => !prev)}
              className="p-2.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
              title="Voice & Language Settings"
            >
              <Sliders className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Voice TTS Configuration Panel */}
        {showVoiceConfig && (
          <div className="mt-5 p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4 text-xs animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-[#3478F6]" />
                Native Device Voice & Multi-Lingual Settings
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Web Speech Synthesis API</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Language Selection */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Default Language
                </label>
                <select
                  value={voiceSettings.language}
                  onChange={(e) => {
                    const l = e.target.value as VoiceLanguage;
                    const next = { ...voiceSettings, language: l };
                    setVoiceSettings(next);
                    voiceTtsService.saveSettings({ language: l });
                  }}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium outline-none focus:border-[#00A88F]"
                >
                  <option value="en">English (India / US)</option>
                  <option value="te">తెలుగు (Telugu)</option>
                  <option value="hi">हिंदी (Hindi)</option>
                </select>
              </div>

              {/* Speech Rate Slider */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Speech Rate: {voiceSettings.speechRate}x
                </label>
                <input
                  type="range"
                  min="0.75"
                  max="1.25"
                  step="0.05"
                  value={voiceSettings.speechRate}
                  onChange={(e) => {
                    const r = parseFloat(e.target.value);
                    const next = { ...voiceSettings, speechRate: r };
                    setVoiceSettings(next);
                    voiceTtsService.saveSettings({ speechRate: r });
                  }}
                  className="w-full accent-[#00A88F] mt-2"
                />
              </div>

              {/* Test Speech Button */}
              <div className="flex items-end gap-2">
                <button
                  onClick={() => testVoiceAlert("en")}
                  className="flex-1 px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold text-[11px] transition-colors"
                >
                  🔊 Test EN
                </button>
                <button
                  onClick={() => testVoiceAlert("te")}
                  className="flex-1 px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold text-[11px] transition-colors"
                >
                  🔊 Test తెలుగు
                </button>
                <button
                  onClick={() => testVoiceAlert("hi")}
                  className="flex-1 px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold text-[11px] transition-colors"
                >
                  🔊 Test हिंदी
                </button>
              </div>
            </div>

            {/* System Voice Selection */}
            {availableVoices.length > 0 && (
              <div className="pt-2 border-t border-slate-200">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Device Hardware Voice ({availableVoices.length} detected)
                </label>
                <select
                  value={voiceSettings.selectedVoiceName || ""}
                  onChange={(e) => {
                    const name = e.target.value;
                    const next = { ...voiceSettings, selectedVoiceName: name };
                    setVoiceSettings(next);
                    voiceTtsService.saveSettings({ selectedVoiceName: name });
                  }}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium text-xs outline-none focus:border-[#00A88F]"
                >
                  <option value="">Default System Voice</option>
                  {availableVoices.map((v, i) => (
                    <option key={i} value={v.name}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Status Message */}
      {message && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center justify-between ${
            message.type === "success"
              ? "bg-emerald-50 text-[#16A673] border border-emerald-200"
              : message.type === "error"
              ? "bg-rose-50 text-[#E5485D] border border-rose-200"
              : "bg-sky-50 text-[#3478F6] border border-sky-200"
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600 font-bold ml-3">
            ✕
          </button>
        </div>
      )}

      {/* Main Grid: Add Reminder Form + Schedule List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Create Reminder Form */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <span className="p-2 rounded-xl bg-indigo-50 text-[#7357E8]">
              <Plus className="w-4 h-4" />
            </span>
            <h3 className="text-base font-bold text-slate-900">Add Schedule</h3>
          </div>

          <form onSubmit={handleAddReminder} className="space-y-3.5 text-xs">
            {/* Category Selector */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Reminder Category
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { type: "medicine", label: "Medicine", icon: Pill },
                  { type: "water", label: "Water", icon: Droplets },
                  { type: "meal", label: "Meal", icon: Utensils },
                  { type: "activity", label: "Activity", icon: Activity },
                ].map((c) => {
                  const Icon = c.icon;
                  const isSelected = reminderType === c.type;
                  return (
                    <button
                      type="button"
                      key={c.type}
                      onClick={() => setReminderType(c.type as ReminderType)}
                      className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 font-bold text-[11px] transition-all ${
                        isSelected
                          ? "bg-teal-50 text-[#00A88F] border-[#00A88F] shadow-sm"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{c.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title / Name */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                {reminderType === "medicine"
                  ? "Medicine Name"
                  : reminderType === "water"
                  ? "Hydration Goal"
                  : reminderType === "meal"
                  ? "Meal Name"
                  : "Health Routine"}
              </label>
              <input
                type="text"
                placeholder={
                  reminderType === "medicine"
                    ? "e.g. Paracetamol 500mg"
                    : reminderType === "water"
                    ? "e.g. 500ml Water Glass"
                    : "e.g. Post-lunch walk"
                }
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-medium outline-none focus:border-[#00A88F] focus:bg-white transition-all"
                required
              />
            </div>

            {/* Time & Repeat */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Scheduled Time
                </label>
                <div className="relative">
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium outline-none focus:border-[#00A88F] focus:bg-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Repeat Schedule
                </label>
                <select
                  value={repeat}
                  onChange={(e) => setRepeat(e.target.value as RepeatType)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium outline-none focus:border-[#00A88F] focus:bg-white"
                >
                  <option value="Daily">Daily</option>
                  <option value="Once">Once</option>
                  <option value="Weekly">Weekly</option>
                </select>
              </div>
            </div>

            {/* Dosage / Instructions (User-entered only) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Schedule Notes / Dosage Instructions (Entered by User)
              </label>
              <input
                type="text"
                placeholder="e.g. 1 tablet after meals"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-medium outline-none focus:border-[#00A88F] focus:bg-white transition-all"
              />
            </div>

            {/* Language & Voice Toggle for this reminder */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Voice Language
                </label>
                <select
                  value={reminderLang}
                  onChange={(e) => setReminderLang(e.target.value as VoiceLanguage)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium outline-none focus:border-[#00A88F]"
                >
                  <option value="en">English</option>
                  <option value="te">తెలుగు (Telugu)</option>
                  <option value="hi">हिंदी (Hindi)</option>
                </select>
              </div>

              <div className="flex items-center justify-between px-3 bg-slate-50 border border-slate-200 rounded-xl mt-5">
                <span className="text-[11px] font-bold text-slate-700">Speak Voice</span>
                <input
                  type="checkbox"
                  checked={itemVoiceEnabled}
                  onChange={(e) => setItemVoiceEnabled(e.target.checked)}
                  className="w-4 h-4 accent-[#00A88F] cursor-pointer"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-[#00A88F] hover:bg-[#008f7a] text-white rounded-xl font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 mt-4"
            >
              <Plus className="w-4 h-4" />
              <span>Save Reminder</span>
            </button>

            <p className="text-[10px] text-slate-400 text-center italic mt-2">
              LifeShield only reminds your entered schedule. Never prescribes medication or dosage.
            </p>
          </form>
        </div>

        {/* Right Column: Scheduled Reminders & History */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Active Reminders List */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Active Schedules</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] bg-teal-50 text-[#00A88F] font-bold">
                  {reminders.length}
                </span>
                {loading && (
                  <span className="text-[10px] text-teal-600 font-medium animate-pulse">Syncing...</span>
                )}
              </h3>
              <span className="text-xs text-slate-500 font-mono">Real-time Check</span>
            </div>

            {reminders.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <Pill className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-500 font-medium">
                  No reminders scheduled yet. Add your medicine or hydration schedule on the left.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {reminders.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl bg-slate-50 hover:bg-slate-100/70 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                        {getReminderIcon(item.reminder_type)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-200 text-slate-700 uppercase">
                            {item.repeat}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-50 text-[#7357E8]">
                            {item.language.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {item.dosage || "Scheduled daily intake"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-mono text-xs font-bold text-slate-800 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-[#3478F6]" />
                        {item.time}
                      </span>

                      <button
                        onClick={() => handleAction(item, "Taken")}
                        className="px-3 py-1.5 rounded-lg bg-[#16A673] hover:bg-[#128a5e] text-white text-[11px] font-bold flex items-center gap-1 transition-colors"
                        title="Mark as Taken"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Taken</span>
                      </button>

                      <button
                        onClick={() => handleAction(item, "Skipped")}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold flex items-center gap-1 transition-colors"
                        title="Mark as Skipped"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Skip</span>
                      </button>

                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-[#E5485D] hover:bg-rose-50 transition-colors"
                        title="Delete Reminder"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action History Log */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Medication & Routine Log History</span>
                <span className="text-xs text-slate-500 font-normal">({history.length} logged)</span>
              </h3>
            </div>

            {history.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2">
                No medication actions recorded yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto pr-1">
                {history.map((h) => (
                  <div key={h.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-800">{h.medicine_name}</span>
                      <span className="text-slate-400 text-[11px] ml-2">({h.scheduled_time})</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-slate-400 font-mono">{h.timestamp}</span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          h.action === "Taken"
                            ? "bg-emerald-50 text-[#16A673] border border-emerald-200"
                            : "bg-amber-50 text-[#F2A900] border border-amber-200"
                        }`}
                      >
                        {h.action}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};

export default MedicationReminder;