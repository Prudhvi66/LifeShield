import React from 'react';
import {
  Shield,
  Activity,
  CloudSun,
  PhoneCall,
  User,
  Lock,
  Flame,
  Sliders,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  ChevronRight
} from 'lucide-react';
import { useApp, ActiveTab } from '../../context/AppContext';
import { DisclaimerBanner } from '../common/DisclaimerBanner';
import { LanguagePicker } from '../common/LanguagePicker';

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    activeTab,
    setActiveTab,
    aiAnalysis,
    user,
    triggerManualSos,
    demoPanelOpen,
    setDemoPanelOpen,
  } = useApp();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getStatusBadge = () => {
    switch (aiAnalysis.overallRisk) {
      case 'EMERGENCY':
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-red-500/15 text-red-400 border border-red-500/40 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <AlertOctagon className="w-3.5 h-3.5" />
            <span>EMERGENCY DETECTED</span>
          </div>
        );
      case 'HIGH RISK':
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/40">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>ATTENTION REQUIRED</span>
          </div>
        );
      case 'CAUTION':
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-yellow-500/15 text-yellow-400 border border-yellow-500/40">
            <span className="w-2 h-2 rounded-full bg-yellow-400" />
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>MILD CAUTION</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>ALL SYSTEMS NORMAL</span>
          </div>
        );
    }
  };

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'home', label: 'Home', icon: <Shield className="w-4 h-4" /> },
    { id: 'health', label: 'Health', icon: <Activity className="w-4 h-4" /> },
    { id: 'environment', label: 'Environment', icon: <CloudSun className="w-4 h-4" /> },
    { id: 'emergency', label: 'Emergency', icon: <PhoneCall className="w-4 h-4" /> },
    { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
    { id: 'privacy', label: 'Privacy', icon: <Lock className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-sky-500 selection:text-white font-sans antialiased">
      {/* 1. Persistent Medical & Safety Disclaimer Notice */}
      <DisclaimerBanner />

      <div className="flex-1 flex w-full max-w-7xl mx-auto">
        
        {/* ===================================================
            DESKTOP SIDEBAR NAVIGATION
            =================================================== */}
        <aside className="hidden lg:flex flex-col w-64 border-r border-slate-800/80 bg-slate-950/60 p-5 shrink-0 justify-between">
          <div className="space-y-6">
            
            {/* Brand Logo & Tagline */}
            <div
              className="flex items-center gap-3 cursor-pointer group"
              onClick={() => setActiveTab('home')}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-sky-400 flex items-center justify-center shadow-lg shadow-sky-600/25 text-white group-hover:scale-105 transition-transform">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                  LifeShield
                </h1>
                <p className="text-[10px] text-slate-400 font-medium leading-none">
                  Safety Companion
                </p>
              </div>
            </div>

            {/* Live Edge AI Local Status Pill */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-xs">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1">
                <span>SYSTEM STATUS</span>
                <span className="text-emerald-400 font-mono text-[10px]">● ON-DEVICE</span>
              </div>
              <div className="text-xs font-bold text-slate-200 truncate">
                {aiAnalysis.overallRisk === 'SAFE' ? 'Normal Monitoring' : aiAnalysis.headline.replace('LifeShield Status: ', '')}
              </div>
            </div>

            {/* Navigation Menu */}
            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-sky-600/15 text-sky-400 border border-sky-500/30 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/70 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={isActive ? 'text-sky-400' : 'text-slate-400'}>{item.icon}</span>
                      <span>{item.label}</span>
                    </div>
                    {isActive && <ChevronRight className="w-3.5 h-3.5 text-sky-400" />}
                  </button>
                );
              })}
            </nav>

            {/* Prominent SOS Button in Sidebar */}
            <div className="pt-2">
              <button
                onClick={triggerManualSos}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-950/50 active:scale-95 transition-all cursor-pointer"
              >
                <Flame className="w-4 h-4 animate-pulse" />
                <span>EMERGENCY SOS (112)</span>
              </button>
            </div>
          </div>

          {/* User Profile Mini Card in Sidebar Footer */}
          <div
            onClick={() => setActiveTab('profile')}
            className="p-3 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-xs shrink-0">
                {user.fullName.charAt(0)}
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-white truncate">{user.fullName}</p>
                <p className="text-[10px] text-slate-400">{user.age} yrs • Blood: {user.bloodGroup}</p>
              </div>
            </div>
            <Sparkles className="w-3.5 h-3.5 text-slate-500" />
          </div>
        </aside>

        {/* ===================================================
            MAIN VIEW WRAPPER
            =================================================== */}
        <div className="flex-1 flex flex-col min-w-0">
          
          {/* Top Header / Bar */}
          <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 py-3.5">
            <div className="flex items-center justify-between gap-3">
              
              {/* Left Greeting & Status */}
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                    {getGreeting()}, <span className="text-sky-400">{user.fullName.split(' ')[0]}</span>
                  </h2>
                </div>
                <p className="text-xs text-slate-400 hidden sm:block">
                  LifeShield is actively monitoring physiological & environmental sensors.
                </p>
              </div>

              {/* Right Status Pill & Actions */}
              <div className="flex items-center gap-2 sm:gap-3">
                {/* Status Indicator */}
                {getStatusBadge()}

                {/* Language Picker */}
                <LanguagePicker />

                {/* Presentation Demo Mode Trigger */}
                <button
                  onClick={() => setDemoPanelOpen(!demoPanelOpen)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    demoPanelOpen
                      ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30'
                      : 'bg-slate-900 text-purple-300 border-purple-900/60 hover:bg-purple-950/40'
                  }`}
                  title="Toggle Hackathon Simulation Toolbar"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Demo Suite</span>
                </button>

                {/* Mobile SOS Button in header */}
                <button
                  onClick={triggerManualSos}
                  className="lg:hidden flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-black shadow-md shadow-red-950/50"
                >
                  <Flame className="w-3.5 h-3.5 animate-pulse" />
                  <span>SOS</span>
                </button>
              </div>
            </div>
          </header>

          {/* Tab Content Container */}
          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-12 max-w-6xl w-full">
            {children}
          </main>
        </div>

      </div>

      {/* ===================================================
          MOBILE BOTTOM NAVIGATION (Fixed for phones/tablets)
          =================================================== */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 px-3 py-2">
        <div className="flex items-center justify-around">
          {navItems.slice(0, 5).map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-[10px] font-bold transition-all ${
                  isActive
                    ? 'text-sky-400 font-black'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className={`p-1.5 rounded-lg ${isActive ? 'bg-sky-500/20 text-sky-400' : ''}`}>
                  {item.icon}
                </div>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
