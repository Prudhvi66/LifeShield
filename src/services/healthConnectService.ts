import { registerPlugin, Capacitor } from '@capacitor/core';

export interface HealthConnectPluginInterface {
  checkAvailability(): Promise<{
    isAvailable: boolean;
    status: string;
    provider: string;
    sdkVersion: number;
  }>;
  checkPermissions(): Promise<{
    permissionsGranted: boolean;
    permissions: Record<string, boolean>;
  }>;
  openHealthConnectSettings(): Promise<{
    opened: boolean;
    action?: string;
    error?: string;
  }>;
  readAggregatedData(): Promise<{
    permissionsGranted: boolean;
    hasData: boolean;
    data: {
      heart_rate: number | null;
      spo2: number | null;
      steps: number | null;
      sleep: number | null;
      temperature: number | null;
    };
    message: string;
    source: string;
  }>;
}

const HealthConnectNative = registerPlugin<HealthConnectPluginInterface>('HealthConnect');

export class HealthConnectService {
  public static isNativeAndroid(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  }

  public static async checkAvailability() {
    if (!this.isNativeAndroid()) {
      return {
        isAvailable: false,
        status: 'WEB_PREVIEW',
        provider: 'BROWSER_ENVIRONMENT',
        sdkVersion: 0,
        message: 'Health Connect native framework requires running on Android. In browser preview, Bluetooth GATT and Manual Telemetry are active.',
      };
    }
    try {
      return await HealthConnectNative.checkAvailability();
    } catch (e: any) {
      return {
        isAvailable: false,
        status: 'ERROR',
        provider: 'NONE',
        sdkVersion: 0,
        message: e.message || 'Could not verify Health Connect availability.',
      };
    }
  }

  public static async checkPermissions() {
    if (!this.isNativeAndroid()) {
      return { permissionsGranted: false, permissions: {} };
    }
    try {
      return await HealthConnectNative.checkPermissions();
    } catch (e) {
      return { permissionsGranted: false, permissions: {} };
    }
  }

  public static async openSettings() {
    if (!this.isNativeAndroid()) {
      return { opened: false, message: 'Settings are available on physical Android devices.' };
    }
    try {
      return await HealthConnectNative.openHealthConnectSettings();
    } catch (e: any) {
      return { opened: false, error: e.message };
    }
  }

  public static async syncRealData() {
    if (!this.isNativeAndroid()) {
      return {
        success: false,
        hasData: false,
        data: null,
        message: 'Running in Web environment. Health Connect sync requires Android device. Please use Web Bluetooth GATT or Manual Telemetry.',
      };
    }

    try {
      // 1. Check availability
      const avail = await HealthConnectNative.checkAvailability();
      if (!avail.isAvailable) {
        return {
          success: false,
          hasData: false,
          data: null,
          message: `Health Connect is not available on this device (${avail.status}). Google Play Health Connect app may be required.`,
        };
      }

      // 2. Check permissions
      const perms = await HealthConnectNative.checkPermissions();
      if (!perms.permissionsGranted) {
        // Open settings so user can grant
        await HealthConnectNative.openHealthConnectSettings();
        return {
          success: false,
          hasData: false,
          data: null,
          message: 'Health Connect permissions needed. LifeShield opened the Health Connect settings. Please grant permissions and tap sync again.',
        };
      }

      // 3. Read real telemetry
      const res = await HealthConnectNative.readAggregatedData();
      return {
        success: true,
        hasData: res.hasData,
        data: res.data,
        message: res.message,
      };
    } catch (e: any) {
      return {
        success: false,
        hasData: false,
        data: null,
        message: 'Health Connect sync error: ' + (e.message || String(e)),
      };
    }
  }
}
