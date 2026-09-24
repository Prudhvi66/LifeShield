/**
 * LifeShield Bluetooth Service
 *
 * On Android (Capacitor native): uses the BluetoothGattPlugin — a real native
 * Android BLE implementation that works from inside a Capacitor WebView.
 *
 * On Desktop/Browser (non-native): falls back to Web Bluetooth API (Chrome/Edge).
 *
 * Supports BLE GATT profiles:
 *   - Heart Rate Service  0x180D / Characteristic 0x2A37
 *   - Battery Service     0x180F / Characteristic 0x2A19
 *   - Pulse Oximeter      0x1822 / Characteristic 0x2A5E
 */

import { registerPlugin, Capacitor } from '@capacitor/core';
import { DeviceCapabilities } from './wearableSource';

// ─── Native BLE plugin interface ───────────────────────────────────────────
interface BluetoothGattPluginInterface {
  isSupported(): Promise<{ supported: boolean; platform: string }>;
  checkBlePermissions(): Promise<{ granted: boolean }>;
  requestBlePermissions(): Promise<{ granted: boolean }>;
  checkBluetoothState(): Promise<{
    supported: boolean;
    enabled: boolean;
    hasPermissions: boolean;
    bondedDevices: Array<{ name: string; address: string; type: number; isWearable: boolean }>;
    detectedWatchName?: string | null;
    status: 'READY' | 'CONNECTED' | 'BLUETOOTH_OFF' | 'PERMISSION_REQUIRED' | 'UNSUPPORTED';
    message: string;
    deviceName?: string;
  }>;
  scanAndConnect(): Promise<{
    isConnected: boolean;
    status?: string;
    pairedWatchDetected?: boolean;
    deviceName?: string;
    deviceAddress?: string;
    batteryLevel?: number | null;
    capabilities?: DeviceCapabilities;
    servicesDiscovered?: string[];
    error?: string;
    message?: string;
  }>;
  getCapabilities(): Promise<{
    isConnected: boolean;
    deviceName?: string;
    deviceAddress?: string;
    capabilities: DeviceCapabilities;
  }>;
  readVitals(): Promise<{
    connected: boolean;
    deviceName?: string;
    heartRate?: number | null;
    batteryLevel?: number | null;
    spO2?: number | null;
    temperature?: number | null;
    timestamp?: number;
    source?: string;
  }>;
  disconnect(): Promise<{ disconnected: boolean }>;
  addListener(
    event: 'bleVitalsUpdate',
    callback: (data: {
      heartRate?: number;
      batteryLevel?: number;
      spO2?: number;
      temperature?: number;
      cadence?: number;
      timestamp?: number;
      source?: string;
      isLive?: boolean;
    }) => void
  ): Promise<{ remove: () => void }>;
  addListener(
    event: 'bleDisconnected',
    callback: (data: { connected: boolean; deviceName?: string }) => void
  ): Promise<{ remove: () => void }>;
}

const BluetoothGattNative = registerPlugin<BluetoothGattPluginInterface>('BluetoothGatt');

// ─── Public interface ───────────────────────────────────────────────────────
export interface BLEDeviceStatus {
  isConnected: boolean;
  deviceName?: string;
  deviceAddress?: string;
  batteryLevel?: number;
  lastHeartRate?: number;
  capabilities?: DeviceCapabilities;
  errorMessage?: string;
  status?: string;
  bluetoothOff?: boolean;
  permissionRequired?: boolean;
  companionAppBridge?: boolean;
  bondedDevices?: Array<{ name: string; address: string; type: number; isWearable: boolean }>;
}

export type VitalsUpdateCallback = (vitals: {
  heartRate?: number;
  spO2?: number;
  temperature?: number;
  cadence?: number;
  batteryLevel?: number;
  timestamp?: number;
  isLive?: boolean;
}) => void;

// ─── BluetoothService class ─────────────────────────────────────────────────
class BluetoothService {
  private device: any = null;          // Web Bluetooth device (browser fallback)
  private server: any = null;
  private heartRateChar: any = null;
  private onVitalsUpdate: VitalsUpdateCallback | null = null;
  private onDisconnectCallback: (() => void) | null = null;
  private nativeListeners: Array<{ remove: () => void }> = [];

  /** True when running inside a Capacitor native Android app. */
  private isNativeAndroid(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  }

  /**
   * Returns true when BLE is available.
   *  - On native Android: always true (uses native BluetoothGattPlugin).
   *  - On browser: only when Web Bluetooth API is present (Chrome/Edge).
   */
  public isSupported(): boolean {
    if (this.isNativeAndroid()) return true;
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  // ─── Main connect entry point ─────────────────────────────────────────────
  public async connect(
    onUpdate: VitalsUpdateCallback,
    onDisconnect?: () => void
  ): Promise<BLEDeviceStatus> {
    this.onVitalsUpdate = onUpdate;
    this.onDisconnectCallback = onDisconnect || null;

    if (this.isNativeAndroid()) {
      return this.connectNativeAndroid();
    }
    return this.connectWebBluetooth();
  }

  /**
   * Check Bluetooth state, permissions, and bonded devices.
   */
  public async checkState(): Promise<{
    supported: boolean;
    enabled: boolean;
    hasPermissions: boolean;
    bondedDevices: Array<{ name: string; address: string; type: number; isWearable: boolean }>;
    detectedWatchName?: string | null;
    status: 'READY' | 'CONNECTED' | 'BLUETOOTH_OFF' | 'PERMISSION_REQUIRED' | 'UNSUPPORTED';
    message: string;
  }> {
    if (this.isNativeAndroid()) {
      try {
        return await BluetoothGattNative.checkBluetoothState();
      } catch (err: any) {
        return {
          supported: true,
          enabled: false,
          hasPermissions: false,
          bondedDevices: [],
          status: 'UNSUPPORTED',
          message: err.message || 'Failed to check Bluetooth status.',
        };
      }
    }
    return {
      supported: this.isSupported(),
      enabled: true,
      hasPermissions: true,
      bondedDevices: [],
      status: this.isSupported() ? 'READY' : 'UNSUPPORTED',
      message: this.isSupported() ? 'Web Bluetooth ready' : 'Web Bluetooth not supported',
    };
  }

  // ─── Native Android BLE (Capacitor BluetoothGattPlugin) ──────────────────
  private async connectNativeAndroid(): Promise<BLEDeviceStatus> {
    try {
      // 1. Check current Bluetooth state
      const state = await BluetoothGattNative.checkBluetoothState();
      if (!state.hasPermissions) {
        const req = await BluetoothGattNative.requestBlePermissions();
        if (!req.granted) {
          return {
            isConnected: false,
            permissionRequired: true,
            status: 'PERMISSION_REQUIRED',
            errorMessage: 'Bluetooth permission required. Please allow Bluetooth permission in Android Settings.',
          };
        }
      }

      if (!state.enabled) {
        return {
          isConnected: false,
          bluetoothOff: true,
          status: 'BLUETOOTH_OFF',
          errorMessage: 'Bluetooth is turned off. Please turn on Bluetooth in quick settings or Android Settings.',
        };
      }

      // 2. Remove any previous listeners
      this.removeNativeListeners();

      // 3. Register real-time vitals listener BEFORE connecting
      const vitalsListener = await BluetoothGattNative.addListener(
        'bleVitalsUpdate',
        (data) => {
          if (this.onVitalsUpdate) {
            this.onVitalsUpdate({
              heartRate: data.heartRate,
              spO2: data.spO2 ?? undefined,
              temperature: data.temperature ?? undefined,
              cadence: data.cadence ?? undefined,
              batteryLevel: data.batteryLevel ?? undefined,
              timestamp: data.timestamp,
              isLive: data.isLive ?? true,
            });
          }
        }
      );
      this.nativeListeners.push(vitalsListener);

      // 4. Register disconnect listener
      const disconnectListener = await BluetoothGattNative.addListener(
        'bleDisconnected',
        () => {
          if (this.onDisconnectCallback) {
            this.onDisconnectCallback();
          }
        }
      );
      this.nativeListeners.push(disconnectListener);

      // 5. Start BLE scan and connect to first health device found
      const status = await BluetoothGattNative.scanAndConnect();

      if (!status.isConnected) {
        const isCompanionBridge = status.status === 'COMPANION_APP_BRIDGE' || Boolean(status.pairedWatchDetected);
        const isBtOff = status.status === 'BLUETOOTH_OFF';
        const isPermReq = status.status === 'PERMISSION_REQUIRED';

        return {
          isConnected: false,
          status: status.status,
          deviceName: status.deviceName,
          bluetoothOff: isBtOff,
          permissionRequired: isPermReq,
          companionAppBridge: isCompanionBridge,
          errorMessage: status.message || status.error || 'Could not find a compatible BLE health device. Ensure your smartwatch/sensor is in pairing mode.',
        };
      }

      return {
        isConnected: true,
        deviceName: status.deviceName || 'BLE Health Device',
        deviceAddress: status.deviceAddress,
        batteryLevel: status.batteryLevel ?? undefined,
        capabilities: status.capabilities,
      };
    } catch (err: any) {
      console.warn('[LifeShield BLE] Native connect error:', err);
      const isBtOff = err.message?.toLowerCase().includes('disabled') || err.message?.toLowerCase().includes('turned off');
      const isPerm = err.message?.toLowerCase().includes('permission');
      return {
        isConnected: false,
        bluetoothOff: isBtOff,
        permissionRequired: isPerm,
        status: isBtOff ? 'BLUETOOTH_OFF' : isPerm ? 'PERMISSION_REQUIRED' : 'CONNECTION_ERROR',
        errorMessage: err.message || 'Bluetooth connection failed on Android.',
      };
    }
  }

  public async getCapabilities(): Promise<BLEDeviceStatus> {
    if (this.isNativeAndroid()) {
      try {
        const caps = await BluetoothGattNative.getCapabilities();
        return {
          isConnected: caps.isConnected,
          deviceName: caps.deviceName,
          deviceAddress: caps.deviceAddress,
          capabilities: caps.capabilities,
        };
      } catch {
        return { isConnected: false };
      }
    }
    return { isConnected: !!(this.device && this.device.gatt?.connected) };
  }

  // ─── Web Bluetooth fallback (browser only) ────────────────────────────────
  private async connectWebBluetooth(): Promise<BLEDeviceStatus> {
    if (!this.isSupported()) {
      return {
        isConnected: false,
        errorMessage:
          'Web Bluetooth API is not available. On Android, ensure you are using the LifeShield app (not a browser). On desktop, use Chrome or Edge.',
      };
    }

    try {
      const nav = navigator as any;
      this.device = await nav.bluetooth.requestDevice({
        filters: [{ services: ['heart_rate'] }],
        optionalServices: ['battery_service', 0x1822],
      });

      if (!this.device) {
        throw new Error('Device selection was cancelled.');
      }

      this.device.addEventListener('gattserverdisconnected', this.handleDisconnect);
      this.server = await this.device.gatt.connect();

      // Discover Heart Rate Service (0x180D)
      const hrService = await this.server.getPrimaryService('heart_rate');
      this.heartRateChar = await hrService.getCharacteristic('heart_rate_measurement');
      await this.heartRateChar.startNotifications();
      this.heartRateChar.addEventListener('characteristicvaluechanged', this.handleHeartRateData);

      // Read battery level if available
      let batteryLevel: number | undefined;
      try {
        const batteryService = await this.server.getPrimaryService('battery_service');
        const batteryChar = await batteryService.getCharacteristic('battery_level');
        const batteryVal = await batteryChar.readValue();
        batteryLevel = batteryVal.getUint8(0);
      } catch {
        // Battery service is optional
      }

      return {
        isConnected: true,
        deviceName: this.device.name || 'Bluetooth BLE Smartwatch',
        batteryLevel,
      };
    } catch (err: any) {
      console.warn('[LifeShield BLE] Web Bluetooth error:', err);
      return {
        isConnected: false,
        errorMessage: err.message || 'Bluetooth connection failed.',
      };
    }
  }

  // ─── Disconnect ───────────────────────────────────────────────────────────
  public async disconnect(): Promise<void> {
    if (this.isNativeAndroid()) {
      this.removeNativeListeners();
      try {
        await BluetoothGattNative.disconnect();
      } catch (e) {
        console.warn('[LifeShield BLE] Native disconnect error:', e);
      }
    } else {
      try {
        if (this.heartRateChar) {
          this.heartRateChar.removeEventListener('characteristicvaluechanged', this.handleHeartRateData);
          this.heartRateChar = null;
        }
        if (this.device && this.device.gatt.connected) {
          this.device.gatt.disconnect();
        }
        this.device = null;
        this.server = null;
      } catch (e) {
        console.warn('[LifeShield BLE] Web Bluetooth disconnect error:', e);
      }
    }
  }

  // ─── Web Bluetooth event handlers ─────────────────────────────────────────
  private handleHeartRateData = (event: any) => {
    const value = event.target.value;
    if (!value) return;

    const flags = value.getUint8(0);
    const is16Bit = (flags & 0x01) === 1;

    let heartRate = 0;
    if (is16Bit) {
      heartRate = value.getUint16(1, true);
    } else {
      heartRate = value.getUint8(1);
    }

    if (heartRate > 30 && heartRate < 240 && this.onVitalsUpdate) {
      this.onVitalsUpdate({ heartRate });
    }
  };

  private handleDisconnect = () => {
    console.log('[LifeShield BLE] Web Bluetooth device disconnected');
    if (this.onDisconnectCallback) {
      this.onDisconnectCallback();
    }
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────
  private removeNativeListeners(): void {
    for (const l of this.nativeListeners) {
      try {
        l.remove();
      } catch (e) {
        // ignore
      }
    }
    this.nativeListeners = [];
  }
}

export const bluetoothService = new BluetoothService();
