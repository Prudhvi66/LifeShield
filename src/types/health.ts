export type SafetyRiskLevel = 'SAFE' | 'CAUTION' | 'HIGH RISK' | 'EMERGENCY';

export interface VitalsData {
  heartRate: number; // in BPM (e.g. 72)
  spO2: number; // in percentage (e.g. 98%)
  bodyTemperature: number; // in Celsius (e.g. 36.8)
  activityLevel: 'rest' | 'light' | 'moderate' | 'intense' | 'inactive'; // current exertion
  stepsCount: number;
  sleepHours: number; // last night sleep (e.g. 7.2)
  hydrationIndex: number; // 0 - 100%
  fatigueIndex: number; // 0 - 100%
  respirationRate: number; // breaths / min
  bloodPressureSys: number;
  bloodPressureDia: number;
  timestamp: string;
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
  heartRate: number;
  spO2: number;
  temperature: number;
  activityScore: number;
  riskScore: number;
}
