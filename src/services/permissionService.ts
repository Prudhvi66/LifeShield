/**
 * LifeShield Permission Setup Service.
 * Centralized orchestration for all Android runtime permissions.
 * Uses existing plugin APIs for Location, Call, SMS, Notifications, Health Connect.
 * Uses new PermissionsPlugin for ACTIVITY_RECOGNITION and BODY_SENSORS.
 */
import { registerPlugin, Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { AndroidLocationService } from './androidLocationService';
import { EmergencyCallService } from './emergencyCallService';
import { emergencySmsService } from './emergencySmsService';
import { HealthConnectService } from './healthConnectService';
import { androidNotificationService } from './androidNotificationService';

// ---------------------------------------------------------------
// New PermissionsPlugin bridge (ACTIVITY_RECOGNITION, BODY_SENSORS)
// ---------------------------------------------------------------
interface PermissionsPluginInterface {
  checkActivityRecognition(): Promise<{ granted: boolean; required: boolean }>;
  requestActivityRecognition(): Promise<{ granted: boolean }>;
  checkBodySensors(): Promise<{ granted: boolean }>;
  requestBodySensors(): Promise<{ granted: boolean }>;
  openAppSettings(): Promise<{ opened: boolean; error?: string }>;
}

const PermissionsNative = registerPlugin<PermissionsPluginInterface>('Permissions');

// ---------------------------------------------------------------
// Permission group definitions
// ---------------------------------------------------------------
export type PermissionGroupKey =
  | 'location'
  | 'phone'
  | 'sms'
  | 'notifications'
  | 'activityRecognition'
  | 'bodySensors'
  | 'healthConnect';

export type PermissionStatus = 'granted' | 'denied' | 'not_required' | 'unknown';

export interface PermissionGroupInfo {
  key: PermissionGroupKey;
  title: string;
  description: string;
  critical: boolean;
  icon: string;
  status: PermissionStatus;
}

const STORAGE_KEY = 'lifeshield_permissions_setup_complete';

class PermissionService {
  private isNative(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  }

  // ---------------------------------------------------------------
  // Setup persistence
  // ---------------------------------------------------------------
  isSetupComplete(): boolean {
    if (!this.isNative()) return true;
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  markSetupComplete(): void {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch { /* ignore */ }
  }

  resetSetup(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
  }

  // ---------------------------------------------------------------
  // Check all permissions and return their status
  // ---------------------------------------------------------------
  async checkAllPermissions(): Promise<PermissionGroupInfo[]> {
    const groups: PermissionGroupInfo[] = [];

    // 1. Location
    const locationGranted = await this.checkLocation();
    groups.push({
      key: 'location',
      title: 'Location',
      description: 'Used to share your GPS location with emergency contacts during SOS alerts.',
      critical: true,
      icon: '📍',
      status: locationGranted ? 'granted' : 'denied',
    });

    // 2. Phone Call
    const phoneGranted = await this.checkPhone();
    groups.push({
      key: 'phone',
      title: 'Phone',
      description: 'Used to automatically call your emergency contact or emergency services (112/108).',
      critical: true,
      icon: '📞',
      status: phoneGranted ? 'granted' : 'denied',
    });

    // 3. SMS
    const smsGranted = await this.checkSms();
    groups.push({
      key: 'sms',
      title: 'SMS',
      description: 'Used to send your GPS location and emergency message via text message.',
      critical: true,
      icon: '💬',
      status: smsGranted ? 'granted' : 'denied',
    });

    // 4. Notifications
    const notifGranted = await this.checkNotifications();
    groups.push({
      key: 'notifications',
      title: 'Notifications',
      description: 'Used for medication reminders, fall-detection alerts, and emergency notifications.',
      critical: false,
      icon: '🔔',
      status: notifGranted ? 'granted' : 'denied',
    });

    // 5. Activity Recognition
    const arResult = await this.checkActivityRecognition();
    groups.push({
      key: 'activityRecognition',
      title: 'Physical Activity',
      description: 'Used to detect falls and physical activity for background motion monitoring.',
      critical: false,
      icon: '🏃',
      status: arResult.granted ? 'granted' : (arResult.required ? 'denied' : 'not_required'),
    });

    // 6. Body Sensors
    const bsGranted = await this.checkBodySensors();
    groups.push({
      key: 'bodySensors',
      title: 'Body Sensors',
      description: 'Used to read heart rate and body temperature from connected wearable devices.',
      critical: false,
      icon: '❤️',
      status: bsGranted ? 'granted' : 'denied',
    });

    // 7. Health Connect
    const hcGranted = await this.checkHealthConnect();
    groups.push({
      key: 'healthConnect',
      title: 'Health Connect',
      description: 'Used to read heart rate, steps, sleep, and SpO2 from Google Health Connect.',
      critical: false,
      icon: '🩺',
      status: hcGranted ? 'granted' : 'denied',
    });

    return groups;
  }

  // ---------------------------------------------------------------
  // Check a single permission group and return its status
  // ---------------------------------------------------------------
  async checkGroupStatus(group: PermissionGroupKey): Promise<{ status: PermissionStatus }> {
    switch (group) {
      case 'location': {
        const granted = await this.checkLocation();
        return { status: granted ? 'granted' : 'denied' };
      }
      case 'phone': {
        const granted = await this.checkPhone();
        return { status: granted ? 'granted' : 'denied' };
      }
      case 'sms': {
        const granted = await this.checkSms();
        return { status: granted ? 'granted' : 'denied' };
      }
      case 'notifications': {
        const granted = await this.checkNotifications();
        return { status: granted ? 'granted' : 'denied' };
      }
      case 'activityRecognition': {
        const result = await this.checkActivityRecognition();
        return { status: result.granted ? 'granted' : (result.required ? 'denied' : 'not_required') };
      }
      case 'bodySensors': {
        const granted = await this.checkBodySensors();
        return { status: granted ? 'granted' : 'denied' };
      }
      case 'healthConnect': {
        const granted = await this.checkHealthConnect();
        return { status: granted ? 'granted' : 'denied' };
      }
      default:
        return { status: 'unknown' };
    }
  }

  // ---------------------------------------------------------------
  // Individual permission checks
  // ---------------------------------------------------------------
  private async checkLocation(): Promise<boolean> {
    if (!this.isNative()) return true;
    try {
      return await AndroidLocationService.checkPermission();
    } catch {
      return false;
    }
  }

  private async checkPhone(): Promise<boolean> {
    if (!this.isNative()) return false;
    try {
      return await EmergencyCallService.hasCallPermission();
    } catch {
      return false;
    }
  }

  private async checkSms(): Promise<boolean> {
    if (!this.isNative()) return false;
    try {
      const result = await emergencySmsService.hasSmsPermission();
      return result.granted;
    } catch {
      return false;
    }
  }

  private async checkNotifications(): Promise<boolean> {
    if (!this.isNative()) return true;
    try {
      const status = await androidNotificationService.checkPermission();
      return status === 'granted';
    } catch {
      return false;
    }
  }

  private async checkActivityRecognition(): Promise<{ granted: boolean; required: boolean }> {
    if (!this.isNative()) return { granted: true, required: false };
    try {
      return await PermissionsNative.checkActivityRecognition();
    } catch {
      return { granted: false, required: false };
    }
  }

  private async checkBodySensors(): Promise<boolean> {
    if (!this.isNative()) return false;
    try {
      const result = await PermissionsNative.checkBodySensors();
      return result.granted;
    } catch {
      return false;
    }
  }

  private async checkHealthConnect(): Promise<boolean> {
    if (!this.isNative()) return false;
    try {
      const result = await HealthConnectService.checkPermissions();
      return result.permissionsGranted;
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------
  // Individual permission requests
  // ---------------------------------------------------------------
  async requestPermission(group: PermissionGroupKey): Promise<boolean> {
    switch (group) {
      case 'location':
        return this.requestLocation();
      case 'phone':
        return this.requestPhone();
      case 'sms':
        return this.requestSms();
      case 'notifications':
        return this.requestNotifications();
      case 'activityRecognition':
        return this.requestActivityRecognition();
      case 'bodySensors':
        return this.requestBodySensors();
      case 'healthConnect':
        return this.requestHealthConnect();
      default:
        return false;
    }
  }

  private async requestLocation(): Promise<boolean> {
    if (!this.isNative()) return true;
    try {
      return await AndroidLocationService.requestPermission();
    } catch {
      return false;
    }
  }

  private async requestPhone(): Promise<boolean> {
    if (!this.isNative()) return false;
    try {
      return await EmergencyCallService.requestCallPermission();
    } catch {
      return false;
    }
  }

  private async requestSms(): Promise<boolean> {
    if (!this.isNative()) return false;
    try {
      const result = await emergencySmsService.requestSmsPermission();
      return result.granted;
    } catch {
      return false;
    }
  }

  private async requestNotifications(): Promise<boolean> {
    if (!this.isNative()) return true;
    try {
      const status = await androidNotificationService.requestPermission();
      return status === 'granted';
    } catch {
      return false;
    }
  }

  private async requestActivityRecognition(): Promise<boolean> {
    if (!this.isNative()) return true;
    try {
      const result = await PermissionsNative.requestActivityRecognition();
      return result.granted;
    } catch {
      return false;
    }
  }

  private async requestBodySensors(): Promise<boolean> {
    if (!this.isNative()) return false;
    try {
      const result = await PermissionsNative.requestBodySensors();
      return result.granted;
    } catch {
      return false;
    }
  }

  private async requestHealthConnect(): Promise<boolean> {
    if (!this.isNative()) return false;
    try {
      const result = await HealthConnectService.requestPermissions();
      return result.permissionsGranted;
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------
  // Open app settings (for permanently-denied permissions)
  // ---------------------------------------------------------------
  async openAppSettings(): Promise<boolean> {
    if (!this.isNative()) return false;
    try {
      const result = await PermissionsNative.openAppSettings();
      return result.opened;
    } catch {
      return false;
    }
  }

  async openHealthConnectSettings(): Promise<boolean> {
    if (!this.isNative()) return false;
    try {
      const result = await HealthConnectService.openSettings();
      return result.opened;
    } catch {
      return false;
    }
  }
}

export const permissionService = new PermissionService();
