import React from 'react';
import {
  AlertOctagon,
  PhoneCall,
  Heart,
  Wind,
  Thermometer,
  MapPin,
  XCircle,
  Volume2,
  Share2,
  Send,
  Radio
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { InteractiveMap } from './InteractiveMap';
import { EmergencyService } from '../../services/emergencyService';

export const LiveEmergencyView: React.FC = () => {
  const {
    emergencyDispatchPayload,
    exitEmergencyMode,
    vitals,
    user,
    currentLocation,
    toggleAudioBeacon,
    isBeaconActive,
  } = useApp();

  const primaryContact = user.emergencyContacts[0];

  const emergencyMessage = EmergencyService.generateEmergencyMessage(
    user,
    vitals,
    {
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      accuracyMeters: currentLocation.accuracyMeters,
      addressDescription: currentLocation.formattedAddress
    },
    emergencyDispatchPayload?.emergencyType || 'Critical Safety Event Detected'
  );

  const waHref = EmergencyService.generateWhatsAppLink(primaryContact?.phone || '', emergencyMessage);
  const smsHref = EmergencyService.generateSmsLink(primaryContact?.phone || '', emergencyMessage);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* High Alert Hero Banner */}
      <div className="p-6 sm:p-7 rounded-3xl bg-gradient-to-r from-red-950 via-slate-900 to-red-950 border-2 border-red-500 shadow-2xl shadow-red-950/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-4">
          <div className="p-4 rounded-2xl bg-red-600/30 border-2 border-red-500 shrink-0 text-red-500 animate-pulse">
            <AlertOctagon className="w-10 h-10" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-red-600 text-white animate-bounce">
                🚨 EMERGENCY MODE
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase bg-purple-500/20 text-purple-300 border border-purple-500/40">
                SIMULATED DISPATCH
              </span>
              <span className="text-xs text-slate-400 font-mono">ID: {emergencyDispatchPayload?.incidentId || 'LS-911'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Possible emergency detected.
            </h1>
            <p className="text-xs sm:text-sm text-red-200 mt-0.5 font-medium">
              {emergencyDispatchPayload?.emergencyType || 'Unconfirmed Fall / Acute Physiological Distress'}
            </p>
          </div>
        </div>

        <button
          onClick={exitEmergencyMode}
          className="self-start md:self-center flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-5 py-3 rounded-2xl text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
        >
          <XCircle className="w-4 h-4 text-red-400" />
          <span>CANCEL EMERGENCY</span>
        </button>
      </div>

      {/* 4 Core Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        
        {/* CALL 112 */}
        <a
          href="tel:112"
          className="p-5 rounded-2xl bg-red-600 hover:bg-red-500 text-white flex flex-col items-center justify-center gap-1.5 shadow-xl shadow-red-950/80 active:scale-95 transition-all text-center border-2 border-red-400"
        >
          <PhoneCall className="w-6 h-6 animate-pulse" />
          <span className="text-lg font-black tracking-tight">CALL 112</span>
          <span className="text-[10px] text-red-100 font-medium">National Helpline</span>
        </a>

        {/* CALL CONTACT */}
        {primaryContact ? (
          <a
            href={`tel:${primaryContact.phone}`}
            className="p-5 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white flex flex-col items-center justify-center gap-1.5 shadow-xl shadow-sky-950/80 active:scale-95 transition-all text-center border-2 border-sky-400"
          >
            <PhoneCall className="w-6 h-6" />
            <span className="text-lg font-black tracking-tight truncate max-w-[180px]">
              CALL {primaryContact.name.split(' ')[0].toUpperCase()}
            </span>
            <span className="text-[10px] text-sky-100 font-medium">{primaryContact.relationship} ({primaryContact.phone})</span>
          </a>
        ) : (
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center text-center text-slate-400">
            <span className="text-xs">No primary contact</span>
          </div>
        )}

        {/* SHARE LOCATION / BROADCAST */}
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="p-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white flex flex-col items-center justify-center gap-1.5 shadow-xl shadow-emerald-950/80 active:scale-95 transition-all text-center border-2 border-emerald-400"
        >
          <Send className="w-6 h-6" />
          <span className="text-lg font-black tracking-tight">SHARE LOCATION</span>
          <span className="text-[10px] text-emerald-100 font-medium">WhatsApp Broadcast</span>
        </a>

        {/* AUDIO RESCUE BEACON */}
        <button
          onClick={toggleAudioBeacon}
          className={`p-5 rounded-2xl flex flex-col items-center justify-center gap-1.5 shadow-xl active:scale-95 transition-all text-center border-2 ${
            isBeaconActive
              ? 'bg-amber-600 text-white border-amber-400 shadow-amber-950/80 animate-pulse'
              : 'bg-slate-900 hover:bg-slate-800 text-amber-300 border-amber-500/50'
          }`}
        >
          <Volume2 className="w-6 h-6" />
          <span className="text-lg font-black tracking-tight">
            {isBeaconActive ? 'STOP SIREN' : 'RESCUE BEACON'}
          </span>
          <span className="text-[10px] text-slate-400 font-medium">
            {isBeaconActive ? 'Siren Active' : 'Sound Alarm'}
          </span>
        </button>

      </div>

      {/* 3 Structured Sections: LOCATION, HEALTH, RESPONSE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* SECTION 1: 📍 LOCATION */}
        <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-red-500" />
              <div>
                <h3 className="text-base font-bold text-white uppercase tracking-wider text-xs">LOCATION</h3>
                <p className="text-xs text-slate-300 font-semibold">{currentLocation.formattedAddress}</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              Location sharing enabled
            </span>
          </div>

          <InteractiveMap
            latitude={currentLocation.latitude}
            longitude={currentLocation.longitude}
            accuracyMeters={currentLocation.accuracyMeters}
            addressDescription={currentLocation.formattedAddress}
            isEmergencyMode={true}
          />
        </div>

        {/* SECTION 2 & 3: HEALTH & RESPONSE */}
        <div className="space-y-6">
          
          {/* SECTION 2: 📊 HEALTH SNAPSHOT */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Radio className="w-4 h-4 text-red-400 animate-pulse" />
              HEALTH SNAPSHOT
            </h3>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Heart className="w-4 h-4 text-rose-400 animate-bounce" /> Heart Rate:
                </span>
                <span className="text-base font-black text-white font-mono">{vitals.heartRate} BPM</span>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Wind className="w-4 h-4 text-sky-400" /> SpO₂ Oxygen:
                </span>
                <span className="text-base font-black text-white font-mono">{vitals.spO2}%</span>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Thermometer className="w-4 h-4 text-amber-400" /> Temperature:
                </span>
                <span className="text-base font-black text-white font-mono">{vitals.bodyTemperature}°C</span>
              </div>
            </div>
          </div>

          {/* SECTION 3: 📞 RESPONSE STATUS */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">RESPONSE STATUS</h3>
            
            <div className="space-y-2 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <span className="text-slate-300">Emergency Contacts:</span>
                <span className="text-emerald-400 font-bold">Auto-Notified (SMS/WA)</span>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <span className="text-slate-300">Emergency Services (112/108):</span>
                <span className="text-sky-400 font-bold">Ready to Dispatch</span>
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <a
                href={smsHref}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-center font-bold rounded-xl text-xs flex items-center justify-center gap-1.5"
              >
                <Share2 className="w-3.5 h-3.5" /> SMS Dispatch
              </a>
              <button
                onClick={exitEmergencyMode}
                className="px-4 py-2.5 bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 font-bold rounded-xl text-xs border border-rose-800/60"
              >
                Cancel
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
