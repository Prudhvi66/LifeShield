/**
 * LifeShield Demo Health Data Service
 * Professional simulated vitals service for SIH presentations, UI demos, and testing.
 *
 * SAFETY & INTEGRITY:
 * - Real wearable & Health Connect data always supersedes demo data.
 * - Demo data is NEVER written to the backend or Health Connect as real medical records.
 * - Simulated values are realistic, calm, non-alarming, and clearly labeled as DEMO DATA everywhere.
 */

export type DataSourceStatus =
  | "NOT_CONNECTED"
  | "CONNECTED_NO_DATA"
  | "CONNECTED_REAL_DATA"
  | "DEMO_DATA";

export interface DemoVitals {
  heartRate: number;
  spo2: number;
  steps: number;
  hydration: number;
  temperature: number;
  sleepHours: number;
  calories: number;
  respiratoryRate: number;
  activity: string;
  systolicBp: number;
  diastolicBp: number;
  source: string;
  timestamp: string;
}

const STORAGE_KEY = "lifeshield_demo_mode_enabled";

// Natural cyclical offsets for heart rate (BPM)
const HR_VARIATIONS = [72, 73, 74, 73, 72, 71, 70, 71, 72, 74, 73, 72];
const SPO2_VARIATIONS = [98, 98, 99, 98, 98, 97, 98, 98];
const TEMP_VARIATIONS = [36.7, 36.7, 36.8, 36.7, 36.6, 36.7];

class DemoHealthDataService {
  private baseSteps = 4820;
  private stepCounter = 0;
  private tickIndex = 0;
  private listeners: Set<() => void> = new Set();
  private timer: any = null;

  constructor() {
    this.startTicker();
  }

  private startTicker() {
    if (typeof window === "undefined") return;
    if (this.timer) clearInterval(this.timer);

    this.timer = setInterval(() => {
      this.tickIndex = (this.tickIndex + 1) % 120;
      // Gently increment steps every ~6 seconds
      if (this.tickIndex % 2 === 0) {
        this.stepCounter += 1;
      }
      this.notifyListeners();
    }, 3000);
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error("[DemoHealthData] Listener error:", err);
      }
    });
  }

  /**
   * Check if Demo Mode is explicitly enabled by the user.
   * Default is false (OFF) to ensure real/honest connection state.
   */
  public isDemoModeEnabled(): boolean {
    if (typeof window === "undefined") return false;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === "true";
    } catch {
      return false;
    }
  }

  /**
   * Enable or disable Demo Mode explicitly.
   */
  public setDemoModeEnabled(enabled: boolean): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, String(enabled));
      this.notifyListeners();
    } catch (err) {
      console.warn("[DemoHealthData] Failed to persist demo mode state:", err);
    }
  }

  /**
   * Generate realistic, slowly breathing demo vitals for SIH presentation.
   */
  public getDemoVitals(): DemoVitals {
    const hrIndex = this.tickIndex % HR_VARIATIONS.length;
    const spo2Index = this.tickIndex % SPO2_VARIATIONS.length;
    const tempIndex = this.tickIndex % TEMP_VARIATIONS.length;

    const currentSteps = this.baseSteps + this.stepCounter;
    const extraCalories = Math.floor(this.stepCounter * 0.04);

    return {
      heartRate: HR_VARIATIONS[hrIndex],
      spo2: SPO2_VARIATIONS[spo2Index],
      steps: currentSteps,
      hydration: 62,
      temperature: TEMP_VARIATIONS[tempIndex],
      sleepHours: 7.4, // 7h 24m
      calories: 1420 + extraCalories,
      respiratoryRate: 16,
      activity: "Moderate",
      systolicBp: 120,
      diastolicBp: 80,
      source: "Simulated Demonstration",
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Returns demo HealthData formatted for App.tsx consumption.
   */
  public getDemoHealthData() {
    const v = this.getDemoVitals();
    return {
      heart_rate: v.heartRate,
      spo2: v.spo2,
      temperature: v.temperature,
      steps: v.steps,
      sleep: v.sleepHours,
      hydration: v.hydration,
      systolic_bp: v.systolicBp,
      diastolic_bp: v.diastolicBp,
      calories: v.calories,
      respiratory_rate: v.respiratoryRate,
      activity: v.activity,
      source: "Simulated Demonstration",
      timestamp: v.timestamp,
    };
  }

  /**
   * Returns granular demo records for WearablesView metric summaries.
   */
  public getDemoMetrics() {
    const v = this.getDemoVitals();
    return {
      heartRateRecordsCount: 48,
      stepRecordsCount: 24,
      sleepRecordsCount: 1,
      spo2RecordsCount: 16,
      tempRecordsCount: 8,
      lastSyncTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      stepsTotal: v.steps,
      caloriesTotal: v.calories,
      distanceMeters: Math.round(v.steps * 0.76),
    };
  }

  /**
   * Determine overall Data Source Status strictly honoring priority:
   * 1. Real Health Connect / Bluetooth data (CONNECTED_REAL_DATA)
   * 2. Connected but no data (CONNECTED_NO_DATA)
   * 3. Demo Data when explicitly enabled (DEMO_DATA)
   * 4. Not connected (NOT_CONNECTED)
   */
  public resolveStatus(params: {
    hasRealData: boolean;
    isDeviceConnectedOrAuthorized: boolean;
    isDemoEnabled?: boolean;
  }): DataSourceStatus {
    if (params.hasRealData) {
      return "CONNECTED_REAL_DATA";
    }
    if (params.isDeviceConnectedOrAuthorized) {
      return "CONNECTED_NO_DATA";
    }
    const demoEnabled = params.isDemoEnabled ?? this.isDemoModeEnabled();
    if (demoEnabled) {
      return "DEMO_DATA";
    }
    return "NOT_CONNECTED";
  }
}

export const demoHealthService = new DemoHealthDataService();
