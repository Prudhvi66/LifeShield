import { UserProfile, PrivacyPreferences } from '../types/user';
import { FallDetectionEvent, EmergencyDispatchPayload } from '../types/emergency';
import { HistoricalHealthDataPoint } from '../types/health';

const STORAGE_KEYS = {
  USER_PROFILE: 'lifeshield_user_profile_v1',
  PRIVACY_PREFS: 'lifeshield_privacy_prefs_v1',
  FALL_LOGS: 'lifeshield_fall_events_v1',
  DISPATCH_LOGS: 'lifeshield_dispatch_history_v1',
  HEALTH_HISTORY: 'lifeshield_health_history_v1',
  SELECTED_REGION: 'lifeshield_selected_region_v1',
};

export const DEFAULT_USER_PROFILE: UserProfile = {
  id: 'usr-demo-01',
  fullName: 'Rajesh Sharma',
  age: 64,
  gender: 'male',
  bloodGroup: 'O+',
  primaryLanguage: 'en',
  phoneNumber: '+91 98765 43210',
  medicalConditions: ['Mild Hypertension', 'Occasional Vertigo'],
  currentMedications: ['Amlodipine 5mg (Morning)'],
  allergies: ['Penicillin'],
  doctorName: 'Dr. A. K. Verma',
  doctorPhone: '+91 98200 11223',
  isOutdoorWorker: false,
  baseline: {
    restingHeartRate: 70,
    activeHeartRateMax: 135,
    normalSpO2Min: 95,
    normalTempRange: [36.2, 37.2],
    typicalSleepHours: 7.2,
    typicalDailySteps: 5500,
    heatSensitivity: 'moderate',
    knownConditions: ['Mild Hypertension'],
    calibratedDays: 14,
  },
  emergencyContacts: [
    {
      id: 'cnt-1',
      name: 'Sunita Sharma',
      relationship: 'Spouse',
      phone: '+91 98765 00112',
      priority: 1,
      autoNotify: true,
    },
    {
      id: 'cnt-2',
      name: 'Vikram Sharma',
      relationship: 'Son',
      phone: '+91 98123 45678',
      priority: 2,
      autoNotify: true,
    },
    {
      id: 'cnt-3',
      name: 'Dr. A. K. Verma',
      relationship: 'Family Physician',
      phone: '+91 98200 11223',
      priority: 3,
      autoNotify: false,
    }
  ],
  wearableConnected: {
    deviceName: 'LifeShield Band Pro (BLE 5.2)',
    isConnected: true,
    batteryPercent: 88,
    protocol: 'BLE'
  }
};

export const DEFAULT_PRIVACY_PREFS: PrivacyPreferences = {
  onDeviceOnlyProcessing: true,
  locationPermissionGranted: true,
  motionSensorsPermissionGranted: true,
  microphonePermissionGranted: false,
  emergencyAutoShareLocation: true,
  emergencyAutoNotifyContacts: true,
  emergencyAutoCallService: false,
  dataEncryptedLocally: true,
  cloudSyncEnabled: false, // 100% On-Device by default!
};

export class StorageService {
  public static getUserProfile(): UserProfile {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Storage read error:', e);
    }
    return DEFAULT_USER_PROFILE;
  }

  public static saveUserProfile(profile: UserProfile): void {
    try {
      localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
    } catch (e) {
      console.warn('Storage write error:', e);
    }
  }

  public static getPrivacyPrefs(): PrivacyPreferences {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PRIVACY_PREFS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Storage read error:', e);
    }
    return DEFAULT_PRIVACY_PREFS;
  }

  public static savePrivacyPrefs(prefs: PrivacyPreferences): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PRIVACY_PREFS, JSON.stringify(prefs));
    } catch (e) {
      console.warn('Storage write error:', e);
    }
  }

  public static logFallEvent(event: FallDetectionEvent): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.FALL_LOGS);
      const list: FallDetectionEvent[] = saved ? JSON.parse(saved) : [];
      list.unshift(event);
      localStorage.setItem(STORAGE_KEYS.FALL_LOGS, JSON.stringify(list.slice(0, 50)));
    } catch (e) {
      console.warn('Fall log error:', e);
    }
  }

  public static logDispatchEvent(payload: EmergencyDispatchPayload): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DISPATCH_LOGS);
      const list: EmergencyDispatchPayload[] = saved ? JSON.parse(saved) : [];
      list.unshift(payload);
      localStorage.setItem(STORAGE_KEYS.DISPATCH_LOGS, JSON.stringify(list.slice(0, 30)));
    } catch (e) {
      console.warn('Dispatch log error:', e);
    }
  }

  public static getMockHistoricalTrends(): HistoricalHealthDataPoint[] {
    const points: HistoricalHealthDataPoint[] = [];
    const hours = ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];
    
    hours.forEach((h, i) => {
      points.push({
        timeLabel: h,
        heartRate: 68 + Math.floor(Math.sin(i * 0.8) * 12 + Math.random() * 4),
        spO2: 97 + Math.floor((Math.random() - 0.3) * 2),
        temperature: Number((36.6 + (i > 3 ? 0.3 : 0.1)).toFixed(1)),
        activityScore: 20 + Math.floor(Math.sin(i) * 35 + 20),
        riskScore: 10 + (i === 4 ? 35 : 0) // mild spike at 14:00 afternoon
      });
    });
    return points;
  }

  public static exportAllUserData(): string {
    const exportObject = {
      app: 'LifeShield Companion',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      profile: this.getUserProfile(),
      privacy: this.getPrivacyPrefs(),
      history: this.getMockHistoricalTrends(),
      audit: 'Processed 100% on-device with zero cloud telemetry'
    };
    return JSON.stringify(exportObject, null, 2);
  }

  public static getSelectedRegion(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEYS.SELECTED_REGION);
    } catch (e) {
      console.warn('Region read error:', e);
      return null;
    }
  }

  public static saveSelectedRegion(region: string): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SELECTED_REGION, region);
    } catch (e) {
      console.warn('Region save error:', e);
    }
  }

  public static clearSelectedRegion(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.SELECTED_REGION);
    } catch (e) {
      console.warn('Region clear error:', e);
    }
  }

  public static clearAllData(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.USER_PROFILE);
      localStorage.removeItem(STORAGE_KEYS.PRIVACY_PREFS);
      localStorage.removeItem(STORAGE_KEYS.FALL_LOGS);
      localStorage.removeItem(STORAGE_KEYS.DISPATCH_LOGS);
      localStorage.removeItem(STORAGE_KEYS.HEALTH_HISTORY);
      localStorage.removeItem(STORAGE_KEYS.SELECTED_REGION);
    } catch (e) {
      console.warn('Clear data error:', e);
    }
  }
}
