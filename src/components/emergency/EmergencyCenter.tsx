import React, { useState } from 'react';
import {
  PhoneCall,
  MapPin,
  Ambulance,
  Volume2,
  Users,
  History,
  AlertOctagon
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { INDIAN_EMERGENCY_DIRECTORY } from '../../services/emergencyService';
import { InteractiveMap } from './InteractiveMap';
import { EmergencyContactsManager } from './EmergencyContactsManager';
import { DispatchMessagePreview } from './DispatchMessagePreview';

export const EmergencyCenter: React.FC = () => {
  const {
    currentLocation,
    toggleAudioBeacon,
    isBeaconActive,
    user
  } = useApp();

  const [activeSection, setActiveSection] = useState<'contacts' | 'services' | 'location' | 'history' | 'settings'>('services');
  const [confirmCallNumber, setConfirmCallNumber] = useState<string | null>(null);

  const handleCall = (num: string) => {
    window.location.href = `tel:${num}`;
    setConfirmCallNumber(null);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <span className="p-2 rounded-2xl bg-red-500/15 text-red-500 border border-red-500/30">
              <AlertOctagon className="w-7 h-7" />
            </span>
            Emergency Center
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Verified Indian emergency response lines (112 / 108), automated dispatch, and priority contacts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleAudioBeacon}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${
              isBeaconActive
                ? 'bg-amber-600 text-white border-amber-400 shadow-lg shadow-amber-950/60 animate-pulse'
                : 'bg-slate-900 text-amber-300 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <Volume2 className="w-4 h-4" />
            <span>{isBeaconActive ? 'Stop Rescue Siren' : 'Trigger SOS Sound Beacon'}</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal for Direct Calling */}
      {confirmCallNumber && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center mx-auto text-red-400">
              <PhoneCall className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-white">Call Emergency Line?</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              You are about to dial verified official helpline <strong className="text-white font-mono text-sm">{confirmCallNumber}</strong>.
            </p>
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                onClick={() => setConfirmCallNumber(null)}
                className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={() => handleCall(confirmCallNumber)}
                className="py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md"
              >
                Dial Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-b border-slate-800">
        {[
          { id: 'services', label: 'Emergency Services', icon: <PhoneCall className="w-3.5 h-3.5" /> },
          { id: 'contacts', label: `Contacts (${user.emergencyContacts.length})`, icon: <Users className="w-3.5 h-3.5" /> },
          { id: 'location', label: 'Location Sharing & Map', icon: <MapPin className="w-3.5 h-3.5" /> },
          { id: 'history', label: 'SOS Broadcast & History', icon: <History className="w-3.5 h-3.5" /> }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeSection === tab.id
                ? 'bg-sky-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* 1. SERVICES TAB */}
      {activeSection === 'services' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Primary 112 & 108 Emergency Dialers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* 112 National Unified Emergency */}
            <div className="bg-gradient-to-br from-red-950/60 via-slate-900 to-rose-950/60 border-2 border-red-500/70 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/40">
                    Primary Unified Line
                  </span>
                  <span className="text-xs text-slate-400 font-mono">India All-States</span>
                </div>

                <div className="flex items-center gap-4 mb-2">
                  <div className="text-5xl font-black text-white font-mono tracking-tight">112</div>
                  <div>
                    <h3 className="text-base font-bold text-white">National Emergency Response (ERSS)</h3>
                    <p className="text-xs text-slate-300">Police, Ambulance, Fire & Disaster in one single line.</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setConfirmCallNumber('112')}
                className="w-full mt-5 py-3.5 px-6 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-950/60 active:scale-95 transition-all cursor-pointer"
              >
                <PhoneCall className="w-4 h-4" />
                <span>CALL 112 (NATIONAL HELPLINE)</span>
              </button>
            </div>

            {/* 108 Emergency Ambulance / EMS */}
            <div className="bg-gradient-to-br from-emerald-950/60 via-slate-900 to-sky-950/60 border-2 border-emerald-500/70 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    Medical & Ambulance
                  </span>
                  <span className="text-xs text-slate-400 font-mono">EMRI 108 Network</span>
                </div>

                <div className="flex items-center gap-4 mb-2">
                  <div className="text-5xl font-black text-white font-mono tracking-tight">108</div>
                  <div>
                    <h3 className="text-base font-bold text-white">Emergency Medical Service (Ambulance)</h3>
                    <p className="text-xs text-slate-300">Free 24/7 paramedic trauma ambulance support in 23+ states.</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setConfirmCallNumber('108')}
                className="w-full mt-5 py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 active:scale-95 transition-all cursor-pointer"
              >
                <Ambulance className="w-4 h-4" />
                <span>CALL 108 (AMBULANCE / EMS)</span>
              </button>
            </div>

          </div>

          {/* Secondary Indian Helplines */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white">Additional Official Emergency Services (India)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {INDIAN_EMERGENCY_DIRECTORY.filter(s => s.number !== '112' && s.number !== '108').map((srv) => (
                <div
                  key={srv.id}
                  className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-lg font-black text-sky-400">{srv.number}</span>
                      <span className="text-[10px] text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/50">Verified</span>
                    </div>
                    <h4 className="font-bold text-white text-xs leading-snug">{srv.name}</h4>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{srv.description}</p>
                  </div>

                  <button
                    onClick={() => setConfirmCallNumber(srv.number)}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs transition-colors"
                  >
                    Call {srv.number}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. CONTACTS TAB */}
      {activeSection === 'contacts' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <EmergencyContactsManager />
        </div>
      )}

      {/* 3. LOCATION & MAP TAB */}
      {activeSection === 'location' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-sky-400" />
              <div>
                <h3 className="text-base font-bold text-white">Live Geolocation & Nearest Trauma Centers</h3>
                <p className="text-xs text-slate-400">{currentLocation.formattedAddress}</p>
              </div>
            </div>
            <span className="text-xs font-mono text-sky-400 bg-sky-950/60 border border-sky-800/60 px-3 py-1 rounded-xl">
              Accuracy: ±{Math.round(currentLocation.accuracyMeters)}m
            </span>
          </div>

          <InteractiveMap
            latitude={currentLocation.latitude}
            longitude={currentLocation.longitude}
            accuracyMeters={currentLocation.accuracyMeters}
            addressDescription={currentLocation.formattedAddress}
          />
        </div>
      )}

      {/* 4. BROADCAST & HISTORY TAB */}
      {activeSection === 'history' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <DispatchMessagePreview />
        </div>
      )}

    </div>
  );
};
