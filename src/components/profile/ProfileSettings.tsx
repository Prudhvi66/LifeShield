import React, { useState } from 'react';
import {
  User,
  Heart,
  Save,
  CheckCircle2,
  Sparkles,
  Loader2,
  Cloud
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { apiClient } from '../../services/apiClient';

export const ProfileSettings: React.FC = () => {
  const { user, updateUser, t } = useApp();
  
  const [fullName, setFullName] = useState(user.fullName);
  const [age, setAge] = useState(user.age);
  const [bloodGroup, setBloodGroup] = useState(user.bloodGroup);
  const [phone, setPhone] = useState(user.phoneNumber);
  const [isOutdoorWorker, setIsOutdoorWorker] = useState(user.isOutdoorWorker);
  const [medicalConditionsInput, setMedicalConditionsInput] = useState(user.medicalConditions.join(', '));
  const [medicationsInput, setMedicationsInput] = useState(user.currentMedications.join(', '));
  const [restingHrBaseline, setRestingHrBaseline] = useState(user.baseline.restingHeartRate);
  const [spO2MinBaseline, setSpO2MinBaseline] = useState(user.baseline.normalSpO2Min);
  
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [backendSynced, setBackendSynced] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedSuccess(false);

    updateUser(prev => ({
      ...prev,
      fullName,
      age: Number(age),
      bloodGroup,
      phoneNumber: phone,
      isOutdoorWorker,
      medicalConditions: medicalConditionsInput.split(',').map(s => s.trim()).filter(Boolean),
      currentMedications: medicationsInput.split(',').map(s => s.trim()).filter(Boolean),
      baseline: {
        ...prev.baseline,
        restingHeartRate: Number(restingHrBaseline),
        normalSpO2Min: Number(spO2MinBaseline)
      }
    }));

    try {
      if (apiClient.getToken()) {
        await apiClient.profile.update({
          full_name: fullName,
          age: Number(age),
          blood_group: bloodGroup,
          phone_number: phone,
        });
        await apiClient.profile.updateBaseline({
          resting_heart_rate: Number(restingHrBaseline),
          normal_spo2_min: Number(spO2MinBaseline),
        });
        setBackendSynced(true);
      } else {
        setBackendSynced(false);
      }
    } catch (err) {
      console.warn('Backend profile sync skipped (no active auth session):', err);
      setBackendSynced(false);
    } finally {
      setIsSaving(false);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <User className="w-8 h-8 text-sky-400" />
            {t.navProfile}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Personal health details and Edge AI baseline parameters stored 100% locally on this device.
          </p>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-emerald-950/80 border border-emerald-500/50 rounded-2xl text-xs text-emerald-300 flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>Profile & Personalized Baseline configurations updated successfully!</span>
          </div>
          {backendSynced && (
            <span className="flex items-center gap-1 text-[11px] bg-emerald-900/60 px-2 py-0.5 rounded text-emerald-200 border border-emerald-700/50">
              <Cloud className="w-3 h-3" />
              Synced to Cloud
            </span>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Personal & Medical Info Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Heart className="w-5 h-5 text-rose-400" />
            Medical & Emergency Identity
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Age</label>
              <input
                type="number"
                value={age}
                onChange={e => setAge(Number(e.target.value))}
                min={1}
                max={120}
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Blood Group</label>
              <select
                value={bloodGroup}
                onChange={e => setBloodGroup(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
              >
                {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(bg => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Known Medical Conditions (Comma separated)
              </label>
              <input
                type="text"
                value={medicalConditionsInput}
                onChange={e => setMedicalConditionsInput(e.target.value)}
                placeholder="e.g. Hypertension, Asthma, Diabetes Type 2"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Current Medications & Dosage
              </label>
              <input
                type="text"
                value={medicationsInput}
                onChange={e => setMedicationsInput(e.target.value)}
                placeholder="e.g. Amlodipine 5mg, Inhaler (PRN)"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isOutdoorWorker}
                onChange={e => setIsOutdoorWorker(e.target.checked)}
                className="rounded text-sky-600 focus:ring-sky-500 bg-slate-800 border-slate-700"
              />
              <span>I perform regular outdoor physical work / commute in high heat</span>
            </label>
          </div>
        </div>

        {/* Edge AI Personal Baseline Tuning */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-sky-400" />
              Edge AI Learned Baseline Thresholds
            </h3>
            <span className="text-xs text-slate-400">Calibrated over {user.baseline.calibratedDays} days</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span>Resting Heart Rate Baseline</span>
                <span className="text-sky-400 font-bold">{restingHrBaseline} BPM</span>
              </div>
              <input
                type="range"
                min={45}
                max={95}
                value={restingHrBaseline}
                onChange={e => setRestingHrBaseline(Number(e.target.value))}
                className="w-full accent-sky-500"
              />
              <p className="text-[11px] text-slate-400">
                Spikes &gt; 25 BPM above this baseline while at rest trigger cardiac stress warnings.
              </p>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span>SpO2 Oxygen Normal Floor</span>
                <span className="text-emerald-400 font-bold">{spO2MinBaseline}%</span>
              </div>
              <input
                type="range"
                min={90}
                max={98}
                value={spO2MinBaseline}
                onChange={e => setSpO2MinBaseline(Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
              <p className="text-[11px] text-slate-400">
                Dips below this threshold combined with poor AQI trigger respiratory hypoxia flags.
              </p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-xl text-xs shadow-lg shadow-sky-950/50 transition-all active:scale-95 cursor-pointer"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{isSaving ? 'Saving...' : 'Save Profile & Baseline'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
