import { PersonalBaseline } from './health';
import { EmergencyContact } from './emergency';

export type LanguageCode = 'en' | 'hi' | 'te' | 'ta' | 'mr' | 'bn' | 'kn';

export interface UserProfile {
  id: string;
  fullName: string;
  age: number;
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  bloodGroup: string; // e.g. 'O+', 'B+', 'A+', 'AB+'
  primaryLanguage: LanguageCode;
  phoneNumber: string;
  medicalConditions: string[];
  currentMedications: string[];
  allergies: string[];
  doctorName?: string;
  doctorPhone?: string;
  isOutdoorWorker: boolean;
  baseline: PersonalBaseline;
  emergencyContacts: EmergencyContact[];
  wearableConnected: {
    deviceName?: string;
    isConnected: boolean;
    batteryPercent?: number;
    protocol: 'BLE' | 'COMPANION_APP' | 'SIMULATED';
  };
}

export interface PrivacyPreferences {
  onDeviceOnlyProcessing: boolean;
  locationPermissionGranted: boolean;
  motionSensorsPermissionGranted: boolean;
  microphonePermissionGranted: boolean;
  emergencyAutoShareLocation: boolean;
  emergencyAutoNotifyContacts: boolean;
  emergencyAutoCallService: boolean;
  dataEncryptedLocally: boolean;
  cloudSyncEnabled: boolean;
}
