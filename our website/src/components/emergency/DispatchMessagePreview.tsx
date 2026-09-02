import React, { useState } from 'react';
import { Share2, Copy, Check, MessageSquare, Send } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { EmergencyService } from '../../services/emergencyService';

export const DispatchMessagePreview: React.FC = () => {
  const { user, vitals, currentLocation } = useApp();
  const [copied, setCopied] = useState(false);

  const messageText = EmergencyService.generateEmergencyMessage(
    user,
    vitals,
    {
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      accuracyMeters: currentLocation.accuracyMeters,
      addressDescription: currentLocation.formattedAddress
    }
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(messageText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const primaryContactPhone = user.emergencyContacts[0]?.phone || '';
  const smsHref = EmergencyService.generateSmsLink(primaryContactPhone, messageText);
  const waHref = EmergencyService.generateWhatsAppLink(primaryContactPhone, messageText);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Share2 className="w-5 h-5 text-sky-400" />
            Auto-Generated Emergency Broadcast
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Pre-assembled with your live coordinates, Google Maps pin, and real-time vital telemetry.
          </p>
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-700 transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied!' : 'Copy Text'}</span>
        </button>
      </div>

      {/* Message Output Terminal Preview */}
      <pre className="w-full bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
        {messageText}
      </pre>

      {/* 1-Tap Broadcasters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
        <a
          href={smsHref}
          className="flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-md transition-colors"
        >
          <MessageSquare className="w-4 h-4" />
          <span>Send via SMS Intent</span>
        </a>

        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-md transition-colors"
        >
          <Send className="w-4 h-4" />
          <span>Send via WhatsApp</span>
        </a>
      </div>
    </div>
  );
};
