import React from 'react';
import {
  Shield,
  Activity,
  CloudSun,
  PhoneCall,
  User,
  Lock,
  Flame,
  Sliders
} from 'lucide-react';
import { useApp, ActiveTab } from '../../context/AppContext';
import { LanguagePicker } from './LanguagePicker';

export const Navbar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    aiAnalysis,
    triggerManualSos,
    demoPanelOpen,
    setDemoPanelOpen,
    t
  } = useApp();

  const getStatusBadge = () => {
    switch (aiAnalysis.overallRisk) {
      case 'EMERGENCY':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-red-500/20 text-red-400 border border-red-500/50 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            {t.statusEmergency}
          </span>
        );
      case 'HIGH RISK':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/50">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            {t.statusHighRisk}
          </span>
        );
      case 'CAUTION':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/50">
            <span className="w-2 h-2 rounded-full bg-yellow-400" />
            {t.statusCaution}
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            {t.statusSafe}
          </span>
        );
    }
  };

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: t.navHome, icon: <Shield className="w-4 h-4" /> },
    { id: 'health', label: t.navHealth, icon: <Activity className="w-4 h-4" /> },
    { id: 'environment', label: t.navEnvironment, icon: <CloudSun className="w-4 h-4" /> },
    { id: 'emergency', label: t.navEmergency, icon: <PhoneCall className="w-4 h-4" /> },
    { id: 'profile', label: t.navProfile, icon: <User className="w-4 h-4" /> },
    { id: 'privacy', label: t.navPrivacy, icon: <Lock className="w-4 h-4" /> },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          
          {/* Logo & Brand Identity */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('home')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-sky-400 flex items-center justify-center shadow-lg shadow-sky-600/30 text-white">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight text-white">{t.appName}</span>
                <div className="hidden sm:block">{getStatusBadge()}</div>
              </div>
              <p className="hidden md:block text-[11px] text-slate-400 font-medium leading-none mt-0.5">
                {t.tagline}
              </p>
            </div>
          </div>

          {/* Center Navigation for Desktop */}
          <nav className="hidden lg:flex items-center space-x-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Action Toolbar */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Language Selector */}
            <LanguagePicker />

            {/* Demo Mode Button */}
            <button
              onClick={() => setDemoPanelOpen(!demoPanelOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                demoPanelOpen
                  ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-600/30'
                  : 'bg-slate-800/90 text-purple-300 border-purple-800/60 hover:bg-purple-950/50'
              }`}
              title="Open Hackathon Simulation Suite"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Demo Suite</span>
            </button>

            {/* Emergency SOS Header Button */}
            <button
              onClick={triggerManualSos}
              className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white px-3.5 py-2 rounded-xl text-xs font-black shadow-lg shadow-red-600/30 active:scale-95 transition-all cursor-pointer"
            >
              <Flame className="w-4 h-4 animate-pulse" />
              <span className="hidden xs:inline">SOS</span>
            </button>
          </div>
        </div>

        {/* Mobile Sub-Navigation Bar */}
        <div className="lg:hidden flex items-center justify-between overflow-x-auto py-2 border-t border-slate-800/80 gap-1 no-scrollbar">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-sky-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
