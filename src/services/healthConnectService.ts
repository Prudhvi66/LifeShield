import { registerPlugin, Capacitor } from '@capacitor/core';
import { HealthConnectMetricDetail, formatHumanSourceLabel } from './wearableSource';

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
  requestPermissions(): Promise<{
    permissionsGranted: boolean;
    permissions: Record<string, boolean>;
    grantedCount: number;
    resultCode: number;
    cancelled: boolean;
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
    metrics?: {
      heart_rate: HealthConnectMetricDetail;
      spo2: HealthConnectMetricDetail;
      steps: HealthConnectMetricDetail;
      sleep: HealthConnectMetricDetail;
      temperature: HealthConnectMetricDetail;
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

  public static async requestPermissions() {
    if (!this.isNativeAndroid()) {
      return { permissionsGranted: false, permissions: {}, grantedCount: 0, resultCode: 0, cancelled: true };
    }
    try {
      return await HealthConnectNative.requestPermissions();
    } catch (e) {
      return { permissionsGranted: false, permissions: {}, grantedCount: 0, resultCode: 0, cancelled: true };
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
        message: 'Web Preview: Open the LifeShield Android app to sync wearable health data via Health Connect.',
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
      let perms = await HealthConnectNative.checkPermissions();
      if (!perms.permissionsGranted) {
        // Try requesting via native dialog first
        const reqRes = await HealthConnectNative.requestPermissions().catch(() => null);
        if (reqRes && reqRes.permissionsGranted) {
          perms = reqRes;
        } else {
          // Fallback to opening settings
          await HealthConnectNative.openHealthConnectSettings();
          return {
            success: false,
            hasData: false,
            data: null,
            message: 'Health Connect permissions needed. LifeShield opened settings. Please grant permissions and tap sync again.',
          };
        }
      }

      // 3. Read real telemetry
      const res = await HealthConnectNative.readAggregatedData();
      return {
        success: true,
        hasData: res.hasData,
        data: res.data,
        metrics: res.metrics,
        message: res.message,
        source: formatHumanSourceLabel(res.source),
      };
    } catch (e: any) {
      return {
        success: false,
        hasData: false,
        data: null,
        metrics: undefined,
        message: 'Health Connect sync error: ' + (e.message || String(e)),
        source: 'Health Connect',
      };
    }
  }

  public static async readAggregatedData(): Promise<{
    permissionsGranted: boolean;
    hasData: boolean;
    data: {
      heart_rate: number | null;
      spo2: number | null;
      steps: number | null;
      sleep: number | null;
      temperature: number | null;
    };
    metrics?: {
      heart_rate: HealthConnectMetricDetail;
      spo2: HealthConnectMetricDetail;
      steps: HealthConnectMetricDetail;
      sleep: HealthConnectMetricDetail;
      temperature: HealthConnectMetricDetail;
    };
    message: string;
    source: string;
  }> {
    if (!this.isNativeAndroid()) {
      return {
        permissionsGranted: false,
        hasData: false,
        data: { heart_rate: null, spo2: null, steps: null, sleep: null, temperature: null },
        metrics: undefined,
        message: 'Native Android required',
        source: 'Web Preview',
      };
    }
    try {
      const res = await HealthConnectNative.readAggregatedData();
      return {
        ...res,
        source: formatHumanSourceLabel(res?.source),
      };
    } catch (e: any) {
      return {
        permissionsGranted: false,
        hasData: false,
        data: { heart_rate: null, spo2: null, steps: null, sleep: null, temperature: null },
        metrics: undefined,
        message: e.message || 'Could not read Health Connect data.',
        source: 'Health Connect',
      };
    }
  }

  public static async getPermissionsSummary(): Promise<{
    isAndroid: boolean;
    allGranted: boolean;
    grantedCount: number;
    totalCount: number;
    details: {
      heartRate: boolean;
      steps: boolean;
      sleep: boolean;
      spo2: boolean;
      temperature: boolean;
    };
    missing: string[];
  }> {
    const totalCount = 5;
    if (!this.isNativeAndroid()) {
      return {
        isAndroid: false,
        allGranted: false,
        grantedCount: 0,
        totalCount,
        details: {
          heartRate: false,
          steps: false,
          sleep: false,
          spo2: false,
          temperature: false,
        },
        missing: ['Android device required'],
      };
    }

    try {
      const perms = await HealthConnectNative.checkPermissions();
      const p = perms.permissions || {};
      const heartRate = Boolean(p['READ_HEART_RATE']);
      const steps = Boolean(p['READ_STEPS']);
      const sleep = Boolean(p['READ_SLEEP']);
      const spo2 = Boolean(p['READ_OXYGEN_SATURATION']);
      const temperature = Boolean(p['READ_BODY_TEMPERATURE']);

      const missing: string[] = [];
      if (!heartRate) missing.push('Heart Rate');
      if (!steps) missing.push('Steps');
      if (!sleep) missing.push('Sleep');
      if (!spo2) missing.push('Blood Oxygen (SpO2)');
      if (!temperature) missing.push('Body Temperature');

      const grantedCount = (heartRate ? 1 : 0) + (steps ? 1 : 0) + (sleep ? 1 : 0) + (spo2 ? 1 : 0) + (temperature ? 1 : 0);

      return {
        isAndroid: true,
        allGranted: grantedCount === totalCount,
        grantedCount,
        totalCount,
        details: { heartRate, steps, sleep, spo2, temperature },
        missing,
      };
    } catch {
      return {
        isAndroid: true,
        allGranted: false,
        grantedCount: 0,
        totalCount,
        details: {
          heartRate: false,
          steps: false,
          sleep: false,
          spo2: false,
          temperature: false,
        },
        missing: ['Could not verify permissions'],
      };
    }
  }
}

