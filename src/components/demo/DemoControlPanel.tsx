import React, { useState } from 'react';
import {
  Sliders,
  Flame,
  Wind,
  HeartPulse,
  AlertOctagon,
  ShieldAlert,
  X,
  Sparkles,
  Zap,
  RotateCcw,
  Play
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SimulationScenario } from '../../services/sensorSimulator';

export const DemoControlPanel: React.FC = () => {
  const {
    demoPanelOpen,
    setDemoPanelOpen,
    activeScenario,
    changeScenario,
    triggerSimulatedFall,
    setActiveTab,
    exitEmergencyMode
  } = useApp();

  const [isRunningFullDemo, setIsRunningFullDemo] = useState(false);
  const [demoStepMessage, setDemoStepMessage] = useState<string | null>(null);

  if (!demoPanelOpen) return null;

  const scenarios: {
    id: SimulationScenario;
    label: string;
    description: string;
    icon: React.ReactNode;
    color: string;
  }[] = [
    {
      id: 'NORMAL_BASELINE',
      label: 'RESET TO BASELINE',
      description: 'Resting HR 72 BPM, SpO₂ 98%, Temp 36.7°C, Safe',
      icon: <Sparkles className="w-4 h-4" />,
      color: 'bg-emerald-600 hover:bg-emerald-500'
    },
    {
      id: 'HEAT_STRESS_OUTDOORS',
      label: 'SIMULATE HEAT STRESS',
      description: 'Ambient 44°C, HR 114 BPM, Fatigue 84%, Hydration 34%',
      icon: <Flame className="w-4 h-4" />,
      color: 'bg-amber-600 hover:bg-amber-500'
    },
    {
      id: 'LOW_SPO2_HYPOXIA',
      label: 'SIMULATE LOW SpO₂',
      description: 'Hypoxia 87%, Respiratory Rate 26 bpm, AQI 382',
      icon: <Wind className="w-4 h-4" />,
      color: 'bg-purple-600 hover:bg-purple-500'
    },
    {
      id: 'TACHYCARDIA_ARRHYTHMIA',
      label: 'SIMULATE ABNORMAL HEART RATE',
      description: 'Resting Tachycardia 138 BPM while stationary',
      icon: <HeartPulse className="w-4 h-4" />,
      color: 'bg-rose-600 hover:bg-rose-500'
    },
    {
      id: 'POST_FALL_EMERGENCY',
      label: 'SIMULATE ACCIDENT',
      description: 'Multi-signal fusion: High impact + Stillness + Tachycardia',
      icon: <AlertOctagon className="w-4 h-4" />,
      color: 'bg-red-600 hover:bg-red-500'
    },
    {
      id: 'DISASTER_WARNING',
      label: 'SIMULATE DISASTER ALERT',
      description: 'IMD Red Alert Heatwave & NDMA Cyclone warning',
      icon: <ShieldAlert className="w-4 h-4" />,
      color: 'bg-orange-600 hover:bg-orange-500'
    }
  ];

  const handleRunCompleteDemo = () => {
    setIsRunningFullDemo(true);
    setDemoStepMessage('Stage 1: Outdoor Heat Stress Detected (44°C)...');
    changeScenario('HEAT_STRESS_OUTDOORS');
    setActiveTab('home');

    // Stage 2: After 3 seconds, simulate sudden fall
    setTimeout(() => {
      setDemoStepMessage('Stage 2: Sudden Fall & Inactivity Spike Detected. 30s Countdown running...');
      triggerSimulatedFall();
      setIsRunningFullDemo(false);
      setTimeout(() => setDemoStepMessage(null), 5000);
    }, 3000);
  };

  const handleReset = () => {
    exitEmergencyMode();
    changeScenario('NORMAL_BASELINE');
    setDemoStepMessage('Reset to Normal Baseline Monitoring.');
    setTimeout(() => setDemoStepMessage(null), 2500);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 p-4 sm:p-6 pointer-events-none flex justify-center animate-in slide-in-from-bottom duration-300">
      <div className="w-full max-w-4xl bg-slate-900/95 backdrop-blur-2xl border-2 border-purple-500/80 rounded-3xl p-5 sm:p-6 shadow-2xl shadow-purple-950/80 pointer-events-auto flex flex-col gap-4 text-white">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/40">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">Simulation Control Panel</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  SIMULATION SUITE
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Trigger simulated anomalies and test automated emergency response.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>

            <button
              onClick={() => setDemoPanelOpen(false)}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {demoStepMessage && (
          <div className="p-3 bg-purple-950/80 border border-purple-500/60 rounded-2xl text-xs text-purple-200 font-bold flex items-center gap-2 animate-in fade-in">
            <Zap className="w-4 h-4 text-purple-400 animate-pulse" />
            <span>{demoStepMessage}</span>
          </div>
        )}

        {/* Action Triggers Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          
          {/* RUN COMPLETE DEMO */}
          <button
            onClick={handleRunCompleteDemo}
            disabled={isRunningFullDemo}
            className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-600 via-rose-600 to-red-600 hover:from-amber-500 hover:to-red-500 text-white font-bold text-xs flex items-center gap-3 shadow-lg shadow-red-950/60 active:scale-95 transition-all text-left col-span-1 sm:col-span-2 group cursor-pointer"
          >
            <div className="p-2 rounded-xl bg-white/20 group-hover:scale-110 transition-transform shrink-0">
              <Play className="w-5 h-5 fill-current" />
            </div>
            <div>
              <span className="block font-black text-sm">RUN COMPLETE DEMO</span>
              <span className="text-[10px] text-red-100 font-normal">
                Heat Stress → Fall Detection → 30s Countdown → Emergency Mode
              </span>
            </div>
          </button>

          {/* SIMULATE FALL */}
          <button
            onClick={triggerSimulatedFall}
            className="p-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-2.5 shadow-md shadow-red-950/50 active:scale-95 transition-all text-left group cursor-pointer col-span-1 sm:col-span-2"
          >
            <div className="p-1.5 rounded-lg bg-white/20 shrink-0">
              <AlertOctagon className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <span className="block font-bold">SIMULATE FALL</span>
              <span className="text-[10px] text-red-100 font-normal">Trigger 30-second siren & countdown</span>
            </div>
          </button>

          {/* Individual Scenario Buttons */}
          {scenarios.map((sc) => {
            const isSelected = activeScenario === sc.id;
            return (
              <button
                key={sc.id}
                onClick={() => changeScenario(sc.id)}
                className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-2.5 ${
                  isSelected
                    ? 'bg-slate-800 border-sky-400 ring-2 ring-sky-500/30'
                    : 'bg-slate-950/80 border-slate-800 hover:bg-slate-800/80'
                }`}
              >
                <div className={`p-1.5 rounded-lg ${sc.color} text-white shrink-0`}>
                  {sc.icon}
                </div>
                <div className="overflow-hidden">
                  <span className="block text-[11px] font-black text-white truncate">{sc.label}</span>
                  <span className="block text-[9px] text-slate-400 truncate">{sc.description}</span>
                </div>
              </button>
            );
          })}

        </div>

      </div>
    </div>
  );
};
