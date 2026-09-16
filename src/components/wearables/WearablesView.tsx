import React from "react";
import {
  Watch,
  Bluetooth,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Battery,
  ShieldCheck,
  Info,
  ExternalLink,
} from "lucide-react";
import { BLEDeviceStatus } from "../../services/bluetoothService";
import { HealthConnectService } from "../../services/healthConnectService";

interface WearablesViewProps {
  bleStatus: BLEDeviceStatus;
  healthConnectStatus: string;
  isScanningBle: boolean;
  isSyncingHealthConnect: boolean;
  lastSyncTime: string | null;
  onPairBluetooth: () => void;
  onSyncHealthConnect: () => void;
}

export const WearablesView: React.FC<WearablesViewProps> = ({
  bleStatus,
  healthConnectStatus,
  isScanningBle,
  isSyncingHealthConnect,
  lastSyncTime,
  onPairBluetooth,
  onSyncHealthConnect,
}) => {
  return (
    <div className="space-y-6 animate-fadeIn" style={{ textAlign: "left" }}>
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold text-sky-400 tracking-wider uppercase">DEVICE INTEGRATIONS</div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-white">Wearables & Health Sensors</h1>
          <p className="text-slate-400 text-sm mt-1">
            Connect standard Bluetooth LE pulse oximeters and synchronize with Android Health Connect.
          </p>
        </div>
      </div>

      {/* Connected Devices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Bluetooth Smartwatch / BLE Sensor */}
        <div
          className="p-6 rounded-2xl border flex flex-col justify-between"
          style={{
            background: "rgba(15, 23, 42, 0.65)",
            borderColor: bleStatus.isConnected ? "rgba(16, 185, 129, 0.4)" : "rgba(51, 65, 85, 0.5)",
          }}
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-indigo-500/15 text-indigo-400">
                  <Watch className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {bleStatus.deviceName || "Bluetooth LE Wearable"}
                  </h3>
                  <div className="text-xs text-slate-400">Standard GATT Heart Rate / Pulse Oximeter</div>
                </div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                  bleStatus.isConnected
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : "bg-slate-800 text-slate-400 border border-slate-700"
                }`}
              >
                {bleStatus.isConnected ? "Connected" : "Disconnected"}
              </span>
            </div>

            <div className="space-y-2 text-xs text-slate-300 py-3 border-y border-slate-800/80 my-3">
              <div className="flex justify-between">
                <span className="text-slate-400">Transport:</span>
                <span className="font-semibold text-slate-200">Web Bluetooth LE (GATT)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Battery Level:</span>
                <span className="font-semibold text-slate-200 flex items-center gap-1">
                  <Battery className="w-3.5 h-3.5 text-emerald-400" />
                  {bleStatus.batteryLevel !== undefined ? `${bleStatus.batteryLevel}%` : "Unavailable"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Last Telemetry Sync:</span>
                <span className="font-semibold text-slate-200">{lastSyncTime || "No active stream"}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-2">
            <button
              type="button"
              className="ls-btn-primary w-full flex items-center justify-center gap-2"
              onClick={onPairBluetooth}
              disabled={isScanningBle}
            >
              <Bluetooth className="w-4 h-4" />
              {isScanningBle
                ? "Scanning for BLE Peripherals..."
                : bleStatus.isConnected
                ? "Reconnect / Switch Device"
                : "Scan & Connect Smartwatch"}
            </button>
          </div>
        </div>

        {/* 2. Android Health Connect Bridge */}
        <div
          className="p-6 rounded-2xl border flex flex-col justify-between"
          style={{
            background: "rgba(15, 23, 42, 0.65)",
            borderColor: "rgba(51, 65, 85, 0.5)",
          }}
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-rose-500/15 text-rose-400">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Android Health Connect</h3>
                  <div className="text-xs text-slate-400">Samsung Health, Google Fit & Wear OS Hub</div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30">
                Bridge Ready
              </span>
            </div>

            <div className="space-y-2 text-xs text-slate-300 py-3 border-y border-slate-800/80 my-3">
              <div className="flex justify-between">
                <span className="text-slate-400">Bridge Status:</span>
                <span className="font-semibold text-slate-200">{healthConnectStatus}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Supported Metrics:</span>
                <span className="font-semibold text-slate-200">HR, Steps, SpO2, Sleep, Temp</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Runtime:</span>
                <span className="font-semibold text-slate-200">Android 14+ / Google Healthdata APK</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-2 flex gap-3">
            <button
              type="button"
              className="ls-btn-secondary flex-1 flex items-center justify-center gap-2"
              onClick={onSyncHealthConnect}
              disabled={isSyncingHealthConnect}
            >
              <RefreshCw className={`w-4 h-4 ${isSyncingHealthConnect ? "animate-spin" : ""}`} />
              {isSyncingHealthConnect ? "Querying..." : "Sync Health Connect"}
            </button>
            <button
              type="button"
              className="ls-btn-primary flex-1"
              onClick={() => HealthConnectService.openSettings()}
            >
              Manage Permissions
            </button>
          </div>
        </div>
      </div>

      {/* Compatibility Notice */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 space-y-2">
        <h4 className="font-bold text-slate-200 flex items-center gap-2">
          <Info className="w-4 h-4 text-sky-400" />
          Hardware Compatibility & Architectural Limitations
        </h4>
        <p className="leading-relaxed">
          Different wearable manufacturers (Apple, Garmin, Fitbit, Noise, Boat) utilize proprietary encrypted
          Bluetooth protocols. LifeShield integrates via standard <strong>Bluetooth SIG Heart Rate Service (0x180D)</strong> and{" "}
          <strong>Pulse Oximeter Service (0x1822)</strong>, as well as the <strong>Android Health Connect unified pipeline</strong>.
          If your watch uses a closed ecosystem, connect it via Google Fit / Samsung Health to enable automatic Health Connect synchronization.
        </p>
      </div>
    </div>
  );
};
