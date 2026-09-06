import React, { useState } from 'react';
import {
  Bluetooth,
  X,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Heart,
  RefreshCw
} from 'lucide-react';
import { bluetoothService, BLEDeviceStatus } from '../../services/bluetoothService';
import { useApp } from '../../context/AppContext';

interface BluetoothPairingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BluetoothPairingModal: React.FC<BluetoothPairingModalProps> = ({ isOpen, onClose }) => {
  const { updateUser, updateLiveVitals } = useApp();
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState<BLEDeviceStatus | null>(null);
  const [activeGuideTab, setActiveGuideTab] = useState<'garmin' | 'apple' | 'wearos' | 'generic'>('generic');

  if (!isOpen) return null;

  const isSupported = bluetoothService.isSupported();

  const handleConnect = async () => {
    setConnecting(true);
    setStatus(null);

    const result = await bluetoothService.connect((liveData) => {
      // Live heart rate callback directly updating user vitals
      if (liveData.heartRate) {
        setStatus(prev => prev ? { ...prev, lastHeartRate: liveData.heartRate } : null);
        updateLiveVitals({
          heartRate: liveData.heartRate,
          source: 'ble',
          deviceName: result.deviceName || 'Bluetooth Sensor',
        });
      }
    });

    setConnecting(false);
    setStatus(result);

    if (result.isConnected && result.deviceName) {
      updateUser(prev => ({
        ...prev,
        wearableConnected: {
          deviceName: result.deviceName || 'Bluetooth BLE Smartwatch',
          isConnected: true,
          batteryPercent: result.batteryLevel || 90,
          protocol: 'BLE'
        }
      }));
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-sky-500/15 text-sky-400 border border-sky-500/30">
              <Bluetooth className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white">Connect Real Smartwatch / BLE Sensor</h3>
              <p className="text-xs text-slate-400">Stream live Heart Rate & Vitals via Web Bluetooth API (GATT 0x180D)</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Browser Compatibility Notice */}
        {!isSupported ? (
          <div className="p-4 bg-amber-950/60 border border-amber-500/40 rounded-2xl text-xs text-amber-200 space-y-1">
            <div className="flex items-center gap-2 font-bold text-amber-300">
              <AlertCircle className="w-4 h-4" />
              <span>Web Bluetooth Not Supported in this Browser</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Direct Web Bluetooth pairing requires <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong> on Android, Windows, macOS, Linux, or ChromeOS.
            </p>
          </div>
        ) : (
          <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Web Bluetooth API is active. Ready to scan standard Bluetooth SIG GATT wearables.</span>
          </div>
        )}

        {/* Status display if connected or error */}
        {status && (
          <div
            className={`p-4 rounded-2xl border text-xs ${
              status.isConnected
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
                : 'bg-rose-950/80 border-rose-500/50 text-rose-200'
            }`}
          >
            {status.isConnected ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Paired with {status.deviceName}
                  </span>
                  <span className="font-mono text-emerald-400">Battery: {status.batteryLevel}%</span>
                </div>
                <p className="text-[11px] text-emerald-300">
                  Live GATT notifications active. Real pulse readings are now streaming into LifeShield!
                </p>
                {status.lastHeartRate && (
                  <div className="mt-2 text-sm font-black text-white font-mono flex items-center gap-1.5">
                    <Heart className="w-4 h-4 text-rose-400 animate-bounce" />
                    Live Pulse: {status.lastHeartRate} BPM
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-rose-300">
                  <AlertCircle className="w-4 h-4" />
                  <span>Connection Failed</span>
                </div>
                <p className="text-[11px] text-slate-300">{status.errorMessage}</p>
              </div>
            )}
          </div>
        )}

        {/* Primary Pairing Action Button */}
        <button
          onClick={handleConnect}
          disabled={connecting || !isSupported}
          className="w-full py-4 px-6 rounded-2xl bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-sky-950/60 active:scale-95 transition-all cursor-pointer"
        >
          {connecting ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Scanning for Bluetooth Devices...</span>
            </>
          ) : (
            <>
              <Bluetooth className="w-5 h-5" />
              <span>Scan & Pair BLE Smartwatch</span>
            </>
          )}
        </button>

        {/* Step-by-Step Watch Setup Instructions */}
        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-sky-400" />
            How to set your smartwatch to Bluetooth Broadcast mode:
          </h4>

          {/* Guide Tabs */}
          <div className="flex gap-1.5 border-b border-slate-800 pb-2">
            {[
              { id: 'generic', label: 'Heart Rate Band / Chest Strap' },
              { id: 'garmin', label: 'Garmin Watches' },
              { id: 'apple', label: 'Apple Watch' },
              { id: 'wearos', label: 'Wear OS (Samsung/Pixel)' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveGuideTab(tab.id as any)}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  activeGuideTab === tab.id
                    ? 'bg-slate-800 text-sky-400 border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-2xl text-xs text-slate-300 space-y-2">
            {activeGuideTab === 'generic' && (
              <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-300">
                <li>Wear your chest strap, arm band, or Bluetooth pulse oximeter (e.g. Polar H10, Wahoo, CooSpo, BerryMed).</li>
                <li>Ensure Bluetooth is turned ON on your computer/phone.</li>
                <li>Click <strong>Scan & Pair BLE Smartwatch</strong> above and select your device from the browser popup.</li>
              </ul>
            )}

            {activeGuideTab === 'garmin' && (
              <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-300">
                <li>On your Garmin watch: Go to <strong>Settings</strong> → <strong>Wrist Heart Rate</strong>.</li>
                <li>Select <strong>Broadcast Heart Rate</strong> and choose <strong>Start</strong>.</li>
                <li>Your Garmin will now broadcast standard Bluetooth SIG 0x180D GATT signals to LifeShield!</li>
              </ul>
            )}

            {activeGuideTab === 'apple' && (
              <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-300">
                <li>Apple Watch restricts direct browser BLE by default.</li>
                <li>Use free BLE broadcaster apps on Apple Watch such as <strong>HeartCast</strong>, <strong>Echo Heart Rate</strong>, or <strong>Heart Rate Broadcaster</strong>.</li>
                <li>Start the broadcast on your watch, then click Scan above.</li>
              </ul>
            )}

            {activeGuideTab === 'wearos' && (
              <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-300">
                <li>On Samsung Galaxy Watch (Wear OS) or Google Pixel Watch:</li>
                <li>Install the free <strong>Heart Rate Broadcaster (Wear OS)</strong> app from Google Play Store.</li>
                <li>Tap "Start Broadcasting over BLE", then pair directly with LifeShield above.</li>
              </ul>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
