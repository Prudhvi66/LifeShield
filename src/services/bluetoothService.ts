/**
 * Web Bluetooth API Service for LifeShield
 * Connects directly to real Bluetooth Low Energy (BLE) Smartwatches,
 * Fitness Bands, Chest Straps (Polar, Garmin, Apple Watch BLE broadcast apps),
 * and Pulse Oximeters using standard Bluetooth SIG GATT Profiles:
 * - Heart Rate Service: 0x180D (Characteristic: 0x2A37)
 * - Battery Service: 0x180F (Characteristic: 0x2A19)
 */

export interface BLEDeviceStatus {
  isConnected: boolean;
  deviceName?: string;
  batteryLevel?: number;
  lastHeartRate?: number;
  errorMessage?: string;
}

export type VitalsUpdateCallback = (vitals: { heartRate: number; spO2?: number; batteryLevel?: number }) => void;

class BluetoothService {
  private device: any = null;
  private server: any = null;
  private heartRateChar: any = null;
  private onVitalsUpdate: VitalsUpdateCallback | null = null;
  private onDisconnectCallback: (() => void) | null = null;

  public isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  public async connect(
    onUpdate: VitalsUpdateCallback,
    onDisconnect?: () => void
  ): Promise<BLEDeviceStatus> {
    this.onVitalsUpdate = onUpdate;
    this.onDisconnectCallback = onDisconnect || null;

    if (!this.isSupported()) {
      return {
        isConnected: false,
        errorMessage: 'Web Bluetooth API is not supported in this browser. Please use Chrome or Edge on Android / Windows / Mac.'
      };
    }

    try {
      const nav = navigator as any;
      this.device = await nav.bluetooth.requestDevice({
        filters: [{ services: ['heart_rate'] }],
        optionalServices: ['battery_service', 0x1822] // Standard pulse oximeter GATT
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
        // Battery service optional
      }

      return {
        isConnected: true,
        deviceName: this.device.name || 'Bluetooth BLE Smartwatch',
        batteryLevel: batteryLevel
      };
    } catch (err: any) {
      console.warn('Bluetooth connection error:', err);
      return {
        isConnected: false,
        errorMessage: err.message || 'Bluetooth connection failed.'
      };
    }
  }

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

  public disconnect(): void {
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
      console.warn('Error disconnecting BLE device:', e);
    }
  }

  private handleDisconnect = () => {
    console.log('Bluetooth device disconnected');
    if (this.onDisconnectCallback) {
      this.onDisconnectCallback();
    }
  };
}

export const bluetoothService = new BluetoothService();

