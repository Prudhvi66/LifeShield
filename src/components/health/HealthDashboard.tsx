import React, { useState } from 'react';
import {
  Activity,
  Sparkles,
  Bluetooth,
  TrendingUp,
  Download,
  CheckCircle2,
  PlusCircle
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { StorageService } from '../../services/storageService';
import { apiClient } from '../../services/apiClient';
import { BluetoothPairingModal } from './BluetoothPairingModal';

export const HealthDashboard: React.FC = () => {
  const { vitals, user, historicalTrends, updateLiveVitals } = useApp();
  const [exportMessage, setExportMessage] = useState(false);
  const [bleModalOpen, setBleModalOpen] = useState(false);
  const [manualFormOpen, setManualFormOpen] = useState(false);

  // Manual Log Form State
  const [manualHr, setManualHr] = useState<string>('');
  const [manualSpo2, setManualSpo2] = useState<string>('');
  const [manualTemp, setManualTemp] = useState<string>('');
  const [manualSys, setManualSys] = useState<string>('');
  const [manualDia, setManualDia] = useState<string>('');
  const [manualSteps, setManualSteps] = useState<string>('');
  const [logSuccess, setLogSuccess] = useState<string | null>(null);

  const handleExport = () => {
    const dataStr = StorageService.exportAllUserData();
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lifeshield_health_analytics_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportMessage(true);
    setTimeout(() => setExportMessage(false), 3000);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const hr = manualHr ? parseInt(manualHr, 10) : undefined;
    const spo2 = manualSpo2 ? parseInt(manualSpo2, 10) : undefined;
    const temp = manualTemp ? parseFloat(manualTemp) : undefined;
    const sys = manualSys ? parseInt(manualSys, 10) : undefined;
    const dia = manualDia ? parseInt(manualDia, 10) : undefined;
    const steps = manualSteps ? parseInt(manualSteps, 10) : undefined;

    updateLiveVitals({
      heartRate: hr ?? vitals.heartRate,
      spO2: spo2 ?? vitals.spO2,
      bodyTemperature: temp ?? vitals.bodyTemperature,
      bloodPressureSys: sys ?? vitals.bloodPressureSys,
      bloodPressureDia: dia ?? vitals.bloodPressureDia,
      stepsCount: steps ?? vitals.stepsCount,
      source: 'manual',
    });

    try {
      await apiClient.health.ingestReading({
        heart_rate: hr,
        spo2,
        body_temperature: temp,
        systolic_bp: sys,
        diastolic_bp: dia,
        steps,
        source: 'manual',
      });
      setLogSuccess('Vitals reading saved to database.');
      setTimeout(() => setLogSuccess(null), 3000);
      setManualFormOpen(false);
      setManualHr('');
      setManualSpo2('');
      setManualTemp('');
      setManualSys('');
      setManualDia('');
      setManualSteps('');
    } catch (err: any) {
      console.warn('Could not save manual vitals:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <span className="p-2 rounded-2xl bg-teal-50 text-[#00A88F] border border-teal-200">
              <Activity className="w-7 h-7" />
            </span>
            Health Analytics & Baseline
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Real physiological telemetry synchronized with your personal baseline and FastAPI backend.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setManualFormOpen(prev => !prev)}
            className="flex items-center gap-1.5 bg-[#00A88F] hover:bg-[#008f7a] text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Log Vitals</span>
          </button>

          <button
            onClick={() => setBleModalOpen(true)}
            className="flex items-center gap-1.5 bg-[#3478F6] hover:bg-[#2563eb] text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
          >
            <Bluetooth className="w-4 h-4" />
            <span>Pair Bluetooth Sensor</span>
          </button>

          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-300 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {logSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-[#16A673] flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>{logSuccess}</span>
        </div>
      )}

      {exportMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-[#16A673] flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>Health records successfully exported locally as JSON.</span>
        </div>
      )}

      {/* Manual Vitals Entry Dropdown */}
      {manualFormOpen && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-[#00A88F]" />
              Manual Health Reading Entry
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">Syncs to PostgreSQL / SQLite</span>
          </div>

          <form onSubmit={handleManualSubmit} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Heart Rate (BPM)</label>
              <input
                type="number"
                placeholder="e.g. 72"
                value={manualHr}
                onChange={(e) => setManualHr(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium outline-none focus:border-[#00A88F] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">SpO₂ Oxygen (%)</label>
              <input
                type="number"
                placeholder="e.g. 98"
                value={manualSpo2}
                onChange={(e) => setManualSpo2(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium outline-none focus:border-[#00A88F] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Body Temp (°C)</label>
              <input
                type="number"
                step="0.1"
                placeholder="e.g. 36.6"
                value={manualTemp}
                onChange={(e) => setManualTemp(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium outline-none focus:border-[#00A88F] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Systolic BP (mmHg)</label>
              <input
                type="number"
                placeholder="e.g. 120"
                value={manualSys}
                onChange={(e) => setManualSys(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium outline-none focus:border-[#00A88F] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Diastolic BP (mmHg)</label>
              <input
                type="number"
                placeholder="e.g. 80"
                value={manualDia}
                onChange={(e) => setManualDia(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium outline-none focus:border-[#00A88F] focus:bg-white"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full py-2.5 bg-[#00A88F] hover:bg-[#008f7a] text-white rounded-xl font-bold text-xs shadow-sm transition-all"
              >
                Save Reading
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Personalized Baseline Intelligence Box */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-50 text-[#7357E8]">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Personalized Health Baseline</h2>
              <p className="text-xs text-slate-500">Stored securely in LifeShield database</p>
            </div>
          </div>
          <span className="text-[11px] font-mono bg-teal-50 border border-teal-200 text-[#00A88F] px-3 py-1 rounded-full self-start sm:self-auto font-semibold">
            Authenticated Profile
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          
          {/* Average Resting Heart Rate */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-1">
            <span className="text-slate-500 block text-[11px] font-medium">Target Resting Heart Rate</span>
            <span className="text-2xl font-black text-slate-900">{user.baseline?.restingHeartRate || 70} BPM</span>
            <p className="text-[10px] text-slate-500">
              Current: <strong className="text-[#3478F6]">{vitals.heartRate ? `${vitals.heartRate} BPM` : 'Unlinked'}</strong>
            </p>
          </div>

          {/* SpO2 Minimum Floor */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-1">
            <span className="text-slate-500 block text-[11px] font-medium">SpO₂ Normal Target</span>
            <span className="text-2xl font-black text-slate-900">{user.baseline?.normalSpO2Min || 95}%+</span>
            <p className="text-[10px] text-slate-500">
              Current: <strong className="text-[#16A673]">{vitals.spO2 ? `${vitals.spO2}%` : 'Unlinked'}</strong>
            </p>
          </div>

          {/* Temperature Range */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-1">
            <span className="text-slate-500 block text-[11px] font-medium">Standard Body Temp</span>
            <span className="text-2xl font-black text-slate-900">36.2–37.2°C</span>
            <p className="text-[10px] text-slate-500">
              Current: <strong className="text-slate-700">{vitals.bodyTemperature ? `${vitals.bodyTemperature}°C` : 'Unlinked'}</strong>
            </p>
          </div>

          {/* Typical Activity Target */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-1">
            <span className="text-slate-500 block text-[11px] font-medium">Daily Step Goal</span>
            <span className="text-2xl font-black text-slate-900">{(user.baseline?.typicalDailySteps || 8000).toLocaleString()}</span>
            <p className="text-[10px] text-slate-500">
              Recorded today: <strong className="text-[#7357E8]">{vitals.stepsCount ? vitals.stepsCount.toLocaleString() : '0'}</strong>
            </p>
          </div>

        </div>
      </div>

      {/* Hourly Trends Timeline */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#3478F6]" />
            Heart Rate & Vitals Historical Timeline (24 Hours)
          </h3>
          <span className="text-xs text-slate-500 font-mono">Backend Feed</span>
        </div>

        {historicalTrends.length === 0 ? (
          <div className="h-36 w-full bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-center text-xs text-slate-500">
            No historical telemetry recorded in the last 24 hours. Connect Bluetooth or log a reading above.
          </div>
        ) : (
          <div className="h-44 w-full bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-end justify-between gap-2 overflow-x-auto">
            {historicalTrends.map((pt, idx) => {
              const hr = pt.heartRate || 70;
              const heightPercent = Math.min(100, Math.max(20, ((hr - 50) / 70) * 100));
              const isHigh = hr > 85;

              return (
                <div key={idx} className="flex-1 min-w-[36px] flex flex-col items-center gap-1 group">
                  <div className="text-[10px] text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity font-mono">
                    {hr}
                  </div>
                  <div
                    className={`w-full rounded-t-xl transition-all duration-300 ${
                      isHigh
                        ? 'bg-gradient-to-t from-amber-500 to-rose-500 group-hover:brightness-110'
                        : 'bg-gradient-to-t from-[#3478F6] to-[#00A88F] group-hover:brightness-110'
                    }`}
                    style={{ height: `${heightPercent}%` }}
                  />
                  <span className="text-[10px] text-slate-500 font-mono mt-1">{pt.timeLabel}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bluetooth Smartwatch Pairing Modal */}
      <BluetoothPairingModal
        isOpen={bleModalOpen}
        onClose={() => setBleModalOpen(false)}
      />
    </div>
  );
};

export default HealthDashboard;
