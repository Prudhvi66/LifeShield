export type SafetyRiskLevel = 'SAFE' | 'CAUTION' | 'HIGH RISK' | 'EMERGENCY';

export interface VitalsData {
  heartRate?: number | null; // in BPM (e.g. 72) or null if unavailable
  spO2?: number | null; // in percentage (e.g. 98%) or null if unavailable
  bodyTemperature?: number | null; // in Celsius (e.g. 36.8) or null if unavailable
  activityLevel?: 'rest' | 'light' | 'moderate' | 'intense' | 'inactive' | 'unknown';
  stepsCount?: number | null;
  sleepHours?: number | null;
  hydrationIndex?: number | null;
  fatigueIndex?: number | null;
  respirationRate?: number | null;
  bloodPressureSys?: number | null;
  bloodPressureDia?: number | null;
  timestamp: string;
  source?: 'ble' | 'health_connect' | 'manual' | 'unavailable';
  deviceName?: string;
  batteryLevel?: number;
}

export interface PersonalBaseline {
  restingHeartRate: number; // e.g. 68
  activeHeartRateMax: number; // e.g. 140
  normalSpO2Min: number; // e.g. 95%
  normalTempRange: [number, number]; // e.g. [36.2, 37.2]
  typicalSleepHours: number; // e.g. 7.5
  typicalDailySteps: number; // e.g. 6500
  heatSensitivity: 'low' | 'moderate' | 'high';
  knownConditions: string[]; // e.g. ["Asthma", "Hypertension"]
  calibratedDays: number;
}

export interface HealthAnomaly {
  id: string;
  type: 'FALL' | 'HEAT_STRESS' | 'HYPOXIA' | 'TACHYCARDIA' | 'BRADYCARDIA' | 'SEVERE_FATIGUE' | 'RESPIRATORY_DISTRESS';
  title: string;
  severity: SafetyRiskLevel;
  confidence: number; // 0-100%
  reason: string;
  actionableGuidance: string[];
  signals: {
    label: string;
    value: string;
    baselineComparison?: string;
  }[];
  detectedAt: string;
  isDismissed?: boolean;
}

export interface HistoricalHealthDataPoint {
  timeLabel: string;
  heartRate?: number | null;
  spO2?: number | null;
  temperature?: number | null;
  activityScore?: number;
  riskScore?: number;
}
