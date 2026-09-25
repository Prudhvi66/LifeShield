/**
 * LifeShield Demo Health Data & Central Source Selection Service
 *
 * SAFETY & INTEGRITY:
 * - Real wearable & Health Connect data always supersedes demo data.
 * - Demo data is NEVER presented as real data or written to the backend as real records.
 * - Simulated values are realistic, calm, non-alarming, and clearly labeled as SIMULATED DATA.
 * - Single source of truth throughout the entire application.
 */

import { formatHumanSourceLabel } from "./wearableSource";

export type HealthSourceState =
  | "NOT_CONNECTED"
  | "CONNECTED_NO_DATA"
  | "CONNECTED_REAL_DATA"
  | "SIMULATED_DATA"
  | "PERMISSION_REQUIRED"
  | "ERROR";

export type DataSourceStatus = HealthSourceState;

export const DATA_SOURCE_LABELS: Record<HealthSourceState, string> = {
  NOT_CONNECTED: "Not Connected",
  CONNECTED_NO_DATA: "Connected — No Data",
  CONNECTED_REAL_DATA: "Connected — Real Data",
  SIMULATED_DATA: "Simulated Data",
  PERMISSION_REQUIRED: "Permission Required",
  ERROR: "Connection Error",
};

export interface DemoVitals {
  heartRate: number;
  spo2: number;
  steps: number;
  hydration: number; // 62% (~1.8 L)
  temperature: number;
  sleepHours: number; // 7.33 = 7h 20m
  calories: number;
  respiratoryRate: number;
  activity: string;
  systolicBp: number;
  diastolicBp: number;
  source: string;
  timestamp: string;
}

export interface HealthSourceEvaluationInput {
  hasRealBle: boolean;
  bleVitals?: {
    heartRate?: number | null;
    spO2?: number | null;
    temperature?: number | null;
  };
  bleDeviceName?: string;
  bleTimestamp?: number | string | null;
  isBleConnected: boolean;

  isHealthConnectAvailable?: boolean;
  hasRealHealthConnect: boolean;
  healthConnectData?: {
    heart_rate?: number | null;
    spo2?: number | null;
    steps?: number | null;
    sleep?: number | null;
    temperature?: number | null;
  } | null;
  healthConnectSource?: string | null;
  healthConnectMetrics?: any;
  isHealthConnectAuthorized: boolean;

  isPermissionRequired?: boolean;
  isError?: boolean;
  errorMessage?: string;
  isExplicitSimulated?: boolean;
}

export interface CentralHealthSnapshot {
  status: HealthSourceState;
  statusLabel: string;
  isReal: boolean;
  isDemo: boolean;
  source: "bluetooth" | "health_connect" | "demo";
  sourceLabel: string;
  health: {
    heart_rate: number | null;
    spo2: number | null;
    temperature: number | null;
    steps: number | null;
    sleep: number | null;
    hydration: number | null;
    systolic_bp: number | null;
    diastolic_bp: number | null;
    calories: number | null;
    respiratory_rate: number | null;
    activity: string | null;
    source: string;
    timestamp: string | null;
  };
  metrics?: any;
  lastSyncTime: string | null;
}

const MODE_STORAGE_KEY = "lifeshield_health_source_mode";
const LEGACY_STORAGE_KEY = "lifeshield_demo_mode_enabled";

// Natural cyclical breathing variations for simulated vitals
const HR_VARIATIONS = [72, 73, 74, 73, 72, 71, 70, 71, 72, 74, 73, 72];
const SPO2_VARIATIONS = [98, 98, 99, 98, 98, 97, 98, 98];
const TEMP_VARIATIONS = [36.7, 36.7, 36.8, 36.7, 36.6, 36.7];

class DemoHealthDataService {
  // Deterministic realistic baseline matching required specs:
  // HR: 72 bpm, SpO2: 98%, Steps: 6420, Hydration: 1.8 L (62%), Temp: 36.7 °C, Sleep: 7h 20m (7.33h)
  private baseSteps = 6420;
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
      // Gently increment steps every ~6 seconds so dashboard feels alive
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
   * Check if Simulated Data mode is enabled.
   */
  public isDemoModeEnabled(): boolean {
    if (typeof window === "undefined") return false;
    try {
      const mode = localStorage.getItem(MODE_STORAGE_KEY);
      if (mode === "simulated") return true;
      if (mode === "real") return false;
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy === "true") return true;
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Enable or disable Simulated Data mode explicitly.
   */
  public setDemoModeEnabled(enabled: boolean): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(MODE_STORAGE_KEY, enabled ? "simulated" : "real");
      localStorage.setItem(LEGACY_STORAGE_KEY, String(enabled));
      this.notifyListeners();
    } catch (err) {
      console.warn("[DemoHealthData] Failed to persist demo mode state:", err);
    }
  }

  /**
   * Generate realistic, gently breathing demo vitals.
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
      hydration: 62, // 62% (~1.8 L)
      temperature: TEMP_VARIATIONS[tempIndex],
      sleepHours: 7.33, // 7h 20m
      calories: 1420 + extraCalories,
      respiratoryRate: 16,
      activity: "Moderate",
      systolicBp: 120,
      diastolicBp: 80,
      source: "Simulated Data",
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Returns demo HealthData formatted for App consumption.
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
      source: "Simulated Data",
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
      heartRateAvg: v.heartRate,
      spo2Avg: v.spo2,
      sleepDurationMinutes: Math.round(v.sleepHours * 60),
    };
  }

  /**
   * Single Source of Truth: Evaluates all connected health hardware & services
   * and deterministically resolves the current active data and state.
   *
   * Allowed states:
   * - NOT_CONNECTED
   * - CONNECTED_NO_DATA
   * - CONNECTED_REAL_DATA
   * - SIMULATED_DATA
   * - PERMISSION_REQUIRED
   * - ERROR
   *
   * PARTIAL DATA IS FULLY VALID:
   * If Health Connect only contains Steps, only Steps is live data.
   * Missing metrics remain null (Unavailable, No record found).
   * Missing metrics are NEVER filled with fake demo values.
   */
  public evaluateHealthSource(input: HealthSourceEvaluationInput): CentralHealthSnapshot {
    const nowIso = new Date().toISOString();
    const demo = this.getDemoHealthData();

    // EXPLICIT DEMO / SIMULATED DATA MODE
    if (input.isExplicitSimulated) {
      return {
        status: "SIMULATED_DATA",
        statusLabel: DATA_SOURCE_LABELS.SIMULATED_DATA,
        isReal: false,
        isDemo: true,
        source: "demo",
        sourceLabel: "Simulated Data",
        health: {
          ...demo,
          source: "Simulated Data",
          timestamp: nowIso,
        },
        metrics: this.getDemoMetrics(),
        lastSyncTime: null,
      };
    }

    // PRIORITY 1: REAL BLUETOOTH BLE TELEMETRY
    if (input.hasRealBle && input.isBleConnected && input.bleVitals) {
      const hr = input.bleVitals.heartRate;
      const spo2 = input.bleVitals.spO2;
      const temp = input.bleVitals.temperature;

      const hasValidHr = typeof hr === "number" && hr > 0 && hr < 300;
      const hasValidSpo2 = typeof spo2 === "number" && spo2 > 0 && spo2 <= 100;
      const hasValidTemp = typeof temp === "number" && temp > 30 && temp < 45;

      let isStale = false;
      if (input.bleTimestamp) {
        const tsMs = typeof input.bleTimestamp === "number" ? input.bleTimestamp : new Date(input.bleTimestamp).getTime();
        if (Date.now() - tsMs > 120000) {
          isStale = true;
        }
      }

      if (!isStale && (hasValidHr || hasValidSpo2 || hasValidTemp)) {
        const sourceLabel = input.bleDeviceName ? `Bluetooth: ${input.bleDeviceName}` : "Bluetooth Wearable";
        return {
          status: "CONNECTED_REAL_DATA",
          statusLabel: DATA_SOURCE_LABELS.CONNECTED_REAL_DATA,
          isReal: true,
          isDemo: false,
          source: "bluetooth",
          sourceLabel,
          health: {
            heart_rate: hasValidHr ? hr! : null,
            spo2: hasValidSpo2 ? spo2! : null,
            temperature: hasValidTemp ? temp! : null,
            steps: null,
            sleep: null,
            hydration: null,
            systolic_bp: null,
            diastolic_bp: null,
            calories: null,
            respiratory_rate: null,
            activity: "Active",
            source: sourceLabel,
            timestamp: nowIso,
          },
          lastSyncTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
      }
    }

    // PRIORITY 2: REAL ANDROID HEALTH CONNECT RECORDS
    // Partial health data is valid: at least one metric exists
    if (input.hasRealHealthConnect && input.healthConnectData) {
      const hc = input.healthConnectData;
      const hasHr = typeof hc.heart_rate === "number" && hc.heart_rate > 0 && hc.heart_rate < 300;
      const hasSpo2 = typeof hc.spo2 === "number" && hc.spo2 > 0 && hc.spo2 <= 100;
      const hasSteps = typeof hc.steps === "number" && hc.steps >= 0;
      const hasSleep = typeof hc.sleep === "number" && hc.sleep >= 0;
      const hasTemp = typeof hc.temperature === "number" && hc.temperature > 30 && hc.temperature < 45;

      if (hasHr || hasSpo2 || hasSteps || hasSleep || hasTemp) {
        const humanSource = formatHumanSourceLabel(input.healthConnectSource) || "Health Connect";
        return {
          status: "CONNECTED_REAL_DATA",
          statusLabel: DATA_SOURCE_LABELS.CONNECTED_REAL_DATA,
          isReal: true,
          isDemo: false,
          source: "health_connect",
          sourceLabel: humanSource,
          health: {
            heart_rate: hasHr ? hc.heart_rate! : null,
            spo2: hasSpo2 ? hc.spo2! : null,
            steps: hasSteps ? hc.steps! : null,
            sleep: hasSleep ? hc.sleep! : null,
            temperature: hasTemp ? hc.temperature! : null,
            hydration: null, // DO NOT fake missing metrics
            systolic_bp: null,
            diastolic_bp: null,
            calories: hasSteps ? Math.round(hc.steps! * 0.04) : null,
            respiratory_rate: null,
            activity: hasSteps && hc.steps! > 0 ? "Active" : null,
            source: humanSource,
            timestamp: nowIso,
          },
          metrics: input.healthConnectMetrics,
          lastSyncTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
      }
    }

    // PRIORITY 3: CONNECTION ERROR
    if (input.isError) {
      return {
        status: "ERROR",
        statusLabel: DATA_SOURCE_LABELS.ERROR,
        isReal: false,
        isDemo: false,
        source: "health_connect",
        sourceLabel: "Connection Error",
        health: {
          heart_rate: null,
          spo2: null,
          temperature: null,
          steps: null,
          sleep: null,
          hydration: null,
          systolic_bp: null,
          diastolic_bp: null,
          calories: null,
          respiratory_rate: null,
          activity: null,
          source: "Connection Error",
          timestamp: null,
        },
        metrics: undefined,
        lastSyncTime: null,
      };
    }

    // PRIORITY 4: PERMISSIONS REQUIRED
    if (input.isPermissionRequired) {
      return {
        status: "PERMISSION_REQUIRED",
        statusLabel: DATA_SOURCE_LABELS.PERMISSION_REQUIRED,
        isReal: false,
        isDemo: false,
        source: "health_connect",
        sourceLabel: "Permission Required",
        health: {
          heart_rate: null,
          spo2: null,
          temperature: null,
          steps: null,
          sleep: null,
          hydration: null,
          systolic_bp: null,
          diastolic_bp: null,
          calories: null,
          respiratory_rate: null,
          activity: null,
          source: "Health Connect",
          timestamp: null,
        },
        metrics: undefined,
        lastSyncTime: null,
      };
    }

    // PRIORITY 5: CONNECTED BUT NO REAL DATA
    // Permissions granted (or BLE connected), but 0 records found in Health Connect
    if (input.isBleConnected || input.isHealthConnectAuthorized) {
      const connName = input.isBleConnected
        ? (input.bleDeviceName ? `Bluetooth (${input.bleDeviceName})` : "Bluetooth Wearable")
        : "Health Connect";
      return {
        status: "CONNECTED_NO_DATA",
        statusLabel: DATA_SOURCE_LABELS.CONNECTED_NO_DATA,
        isReal: false,
        isDemo: false,
        source: input.isBleConnected ? "bluetooth" : "health_connect",
        sourceLabel: connName,
        health: {
          heart_rate: null,
          spo2: null,
          temperature: null,
          steps: null,
          sleep: null,
          hydration: null,
          systolic_bp: null,
          diastolic_bp: null,
          calories: null,
          respiratory_rate: null,
          activity: null,
          source: connName,
          timestamp: null,
        },
        metrics: input.healthConnectMetrics,
        lastSyncTime: null,
      };
    }

    // PRIORITY 6: NOT CONNECTED (Health Connect unavailable or not configured)
    return {
      status: "NOT_CONNECTED",
      statusLabel: DATA_SOURCE_LABELS.NOT_CONNECTED,
      isReal: false,
      isDemo: false,
      source: "health_connect",
      sourceLabel: "Not Connected",
      health: {
        heart_rate: null,
        spo2: null,
        temperature: null,
        steps: null,
        sleep: null,
        hydration: null,
        systolic_bp: null,
        diastolic_bp: null,
        calories: null,
        respiratory_rate: null,
        activity: null,
        source: "Not Connected",
        timestamp: null,
      },
      metrics: undefined,
      lastSyncTime: null,
    };
  }

  /**
   * Determine overall Data Source Status strictly honoring priority.
   */
  public resolveStatus(params: {
    hasRealData: boolean;
    isDeviceConnectedOrAuthorized: boolean;
    isError?: boolean;
    isPermissionRequired?: boolean;
    isSimulated?: boolean;
  }): HealthSourceState {
    if (params.isSimulated) {
      return "SIMULATED_DATA";
    }
    if (params.hasRealData) {
      return "CONNECTED_REAL_DATA";
    }
    if (params.isPermissionRequired) {
      return "PERMISSION_REQUIRED";
    }
    if (params.isDeviceConnectedOrAuthorized) {
      return "CONNECTED_NO_DATA";
    }
    if (params.isError) {
      return "ERROR";
    }
    return "NOT_CONNECTED";
  }
}

export const demoHealthService = new DemoHealthDataService();
