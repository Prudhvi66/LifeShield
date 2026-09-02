import { VitalsData } from './health';

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  priority: 1 | 2 | 3;
  autoNotify: boolean;
}

export interface EmergencyServiceConfig {
  id: string;
  name: string;
  number: string;
  category: 'national' | 'ambulance' | 'police' | 'fire' | 'disaster' | 'women_safety';
  region: string;
  isVerified: boolean;
  description: string;
}

export interface FallDetectionEvent {
  id: string;
  timestamp: string;
  accelerationPeakG: number; // e.g. 3.4g
  tiltAngleDeg: number; // e.g. 78 deg
  inactivityDurationSec: number; // e.g. 5 sec
  status: 'PENDING_CONFIRMATION' | 'CANCELLED_BY_USER' | 'CONFIRMED_SOS' | 'AUTO_ESCALATED';
  userResponseTimeSec?: number;
  latitude?: number;
  longitude?: number;
}

export interface EmergencyDispatchPayload {
  incidentId: string;
  userName: string;
  bloodGroup: string;
  age: number;
  emergencyType: string;
  detectedAt: string;
  coordinates: {
    latitude: number;
    longitude: number;
    accuracyMeters: number;
    addressDescription?: string;
  };
  vitalsSnapshot: Partial<VitalsData>;
  medicalNotes: string;
  contactsNotified: string[];
}
