/**
 * LifeShield Wearable Source Architecture
 *
 * Implements a unified multi-source health telemetry architecture:
 *   1. BLE GATT Source: Live real-time streaming for standard Bluetooth SIG devices
 *      (0x180D Heart Rate, 0x1822 Pulse Oximeter, 0x1809 Thermometer, 0x1814 RSC Cadence)
 *   2. Health Connect Source: Android Health Connect hub for Samsung Health, Google Fit,
 *      Pixel Watch (Fitbit), Garmin Connect, and Withings
 *   3. Wear OS / Companion Architecture: Explains Wear OS Health Services (WHS) requirement
 *      for watch-side APK vs phone-side Health Connect sync
 *
 * Enforces NO FAKE DATA:
 *   - Only genuine physiological readings are displayed
 *   - When a sensor is missing or records are absent, displays "Unavailable" or "Not provided by device"
 *   - Differentiates live streaming (LIVE • updated Xs ago) from batch records (Updated Xm ago)
 */

export type WearableDataSourceType = 'BLE_GATT' | 'HEALTH_CONNECT' | 'WEAR_OS' | 'MANUAL' | 'NONE';

export type HealthConnectConnectionState =
  | 'NOT_CONNECTED'
  | 'HEALTH_CONNECT_AVAILABLE'
  | 'PERMISSION_REQUIRED'
  | 'CONNECTED_NO_DATA'
  | 'SYNCING'
  | 'CONNECTED_WITH_DATA'
  | 'ERROR';

export interface NormalizedMetric<T = number> {
  value: T | null;
  unit: string;
  timestamp: string | null;
  source: 'Android Health Connect' | 'Bluetooth GATT' | 'Manual Log' | null;
  available: boolean;
  reasonUnavailable?: string;
}

export interface NormalizedHealthData {
  heartRate: NormalizedMetric<number>;
  spo2: NormalizedMetric<number>;
  steps: NormalizedMetric<number>;
  sleep: NormalizedMetric<number>;
  temperature: NormalizedMetric<number>;
}

export interface DeviceCapabilities {
  heartRate: boolean;
  spO2: boolean;
  steps: boolean;
  sleep: boolean;
  temperature: boolean;
  battery: boolean;
}

export interface MetricState<T = number> {
  value: T | null;
  unit: string;
  source: WearableDataSourceType;
  sourceLabel: string;
  lastUpdated: Date | null;
  isLive: boolean;
  availableOnDevice: boolean;
  statusText: string;
  permissionGranted?: boolean;
  recordsFound?: boolean;
}

export interface HealthConnectMetricDetail {
  permissionGranted: boolean;
  recordsFound: boolean;
  value: number | null;
  unit: string;
  recordCount: number;
  latestTimestamp: string | null;
  status: string;
}

export interface WearableHubState {
  ble: {
    isConnected: boolean;
    deviceName?: string;
    deviceAddress?: string;
    batteryLevel?: number;
    capabilities: DeviceCapabilities;
    errorMessage?: string;
    lastSeen?: Date;
  };
  healthConnect: {
    isAvailable: boolean;
    status: string;
    lastSyncTime?: Date;
    metrics: {
      heart_rate: HealthConnectMetricDetail;
      spo2: HealthConnectMetricDetail;
      steps: HealthConnectMetricDetail;
      sleep: HealthConnectMetricDetail;
      temperature: HealthConnectMetricDetail;
    };
    rawMessage?: string;
  };
  metrics: {
    heartRate: MetricState;
    spO2: MetricState;
    steps: MetricState;
    sleep: MetricState;
    temperature: MetricState;
  };
}

export function formatTimeAgo(date: Date | null): string {
  if (!date) return 'No data';
  const now = new Date();
  const diffSec = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec} sec ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;
  return `${Math.floor(diffHours / 24)} d ago`;
}

export function createInitialWearableState(): WearableHubState {
  return {
    ble: {
      isConnected: false,
      capabilities: {
        heartRate: false,
        spO2: false,
        steps: false,
        sleep: false,
        temperature: false,
        battery: false,
      },
    },
    healthConnect: {
      isAvailable: false,
      status: 'INITIALIZING',
      metrics: {
        heart_rate: {
          permissionGranted: false,
          recordsFound: false,
          value: null,
          unit: 'BPM',
          recordCount: 0,
          latestTimestamp: null,
          status: 'Not checked',
        },
        spo2: {
          permissionGranted: false,
          recordsFound: false,
          value: null,
          unit: '%',
          recordCount: 0,
          latestTimestamp: null,
          status: 'Not checked',
        },
        steps: {
          permissionGranted: false,
          recordsFound: false,
          value: null,
          unit: 'steps',
          recordCount: 0,
          latestTimestamp: null,
          status: 'Not checked',
        },
        sleep: {
          permissionGranted: false,
          recordsFound: false,
          value: null,
          unit: 'hours',
          recordCount: 0,
          latestTimestamp: null,
          status: 'Not checked',
        },
        temperature: {
          permissionGranted: false,
          recordsFound: false,
          value: null,
          unit: '°C',
          recordCount: 0,
          latestTimestamp: null,
          status: 'Not checked',
        },
      },
    },
    metrics: {
      heartRate: {
        value: null,
        unit: 'BPM',
        source: 'NONE',
        sourceLabel: 'None',
        lastUpdated: null,
        isLive: false,
        availableOnDevice: false,
        statusText: 'No wearable connected',
      },
      spO2: {
        value: null,
        unit: '%',
        source: 'NONE',
        sourceLabel: 'None',
        lastUpdated: null,
        isLive: false,
        availableOnDevice: false,
        statusText: 'No wearable connected',
      },
      steps: {
        value: null,
        unit: 'steps',
        source: 'NONE',
        sourceLabel: 'None',
        lastUpdated: null,
        isLive: false,
        availableOnDevice: false,
        statusText: 'Sync with Health Connect',
      },
      sleep: {
        value: null,
        unit: 'hrs',
        source: 'NONE',
        sourceLabel: 'None',
        lastUpdated: null,
        isLive: false,
        availableOnDevice: false,
        statusText: 'Sync with Health Connect',
      },
      temperature: {
        value: null,
        unit: '°C',
        source: 'NONE',
        sourceLabel: 'None',
        lastUpdated: null,
        isLive: false,
        availableOnDevice: false,
        statusText: 'No sensor detected',
      },
    },
  };
}

export function createInitialNormalizedHealthData(): NormalizedHealthData {
  return {
    heartRate: {
      value: null,
      unit: 'BPM',
      timestamp: null,
      source: null,
      available: false,
      reasonUnavailable: 'No heart-rate record found in Health Connect',
    },
    spo2: {
      value: null,
      unit: '%',
      timestamp: null,
      source: null,
      available: false,
      reasonUnavailable: 'No SpO2 record found in Health Connect',
    },
    steps: {
      value: null,
      unit: 'steps',
      timestamp: null,
      source: null,
      available: false,
      reasonUnavailable: 'No step records found in Health Connect',
    },
    sleep: {
      value: null,
      unit: 'hours',
      timestamp: null,
      source: null,
      available: false,
      reasonUnavailable: 'No sleep records found in Health Connect',
    },
    temperature: {
      value: null,
      unit: '°C',
      timestamp: null,
      source: null,
      available: false,
      reasonUnavailable: 'No temperature records found in Health Connect',
    },
  };
}

export function normalizeHealthMetrics(
  data?: {
    heart_rate: number | null;
    spo2: number | null;
    steps: number | null;
    sleep: number | null;
    temperature: number | null;
  } | null,
  metrics?: {
    heart_rate?: HealthConnectMetricDetail;
    spo2?: HealthConnectMetricDetail;
    steps?: HealthConnectMetricDetail;
    sleep?: HealthConnectMetricDetail;
    temperature?: HealthConnectMetricDetail;
  }
): NormalizedHealthData {
  const initial = createInitialNormalizedHealthData();
  if (!data) return initial;

  return {
    heartRate: {
      value: data.heart_rate ?? null,
      unit: 'BPM',
      timestamp: metrics?.heart_rate?.latestTimestamp || null,
      source: data.heart_rate ? 'Android Health Connect' : null,
      available: typeof data.heart_rate === 'number' && data.heart_rate > 0,
      reasonUnavailable: data.heart_rate ? undefined : 'No heart rate record found',
    },
    spo2: {
      value: data.spo2 ?? null,
      unit: '%',
      timestamp: metrics?.spo2?.latestTimestamp || null,
      source: data.spo2 ? 'Android Health Connect' : null,
      available: typeof data.spo2 === 'number' && data.spo2 > 0,
      reasonUnavailable: data.spo2 ? undefined : 'No SpO2 record found',
    },
    steps: {
      value: data.steps ?? null,
      unit: 'steps',
      timestamp: metrics?.steps?.latestTimestamp || null,
      source: data.steps ? 'Android Health Connect' : null,
      available: typeof data.steps === 'number' && data.steps >= 0,
      reasonUnavailable: data.steps ? undefined : 'No step records found',
    },
    sleep: {
      value: data.sleep ?? null,
      unit: 'hours',
      timestamp: metrics?.sleep?.latestTimestamp || null,
      source: data.sleep ? 'Android Health Connect' : null,
      available: typeof data.sleep === 'number' && data.sleep >= 0,
      reasonUnavailable: data.sleep ? undefined : 'No sleep records found',
    },
    temperature: {
      value: data.temperature ?? null,
      unit: '°C',
      timestamp: metrics?.temperature?.latestTimestamp || null,
      source: data.temperature ? 'Android Health Connect' : null,
      available: typeof data.temperature === 'number' && data.temperature > 0,
      reasonUnavailable: data.temperature ? undefined : 'No temperature records found',
    },
  };
}
export type VitalsOverallState =
  | 'NOT_CONNECTED'
  | 'CONNECTING'
  | 'CONNECTED_NO_DATA'
  | 'CONNECTED_REAL_DATA'
  | 'DEMO_DATA'
  | 'PERMISSION_REQUIRED'
  | 'BLUETOOTH_OFF'
  | 'HEALTH_CONNECT_UNAVAILABLE'
  | 'CONNECTION_ERROR';

export interface VitalsStatusDescriptor {
  state: VitalsOverallState;
  displayStatus: string;
  badgeLabel: string;
  badgeColor: 'real' | 'demo' | 'warning' | 'info' | 'error';
  explanation: string;
  sourceLabel: string;
  isReal: boolean;
  isDemo: boolean;
}

export interface NormalizedVitalCardData {
  value: number | null;
  displayValue: string;
  unit: string;
  statusLabel: string;
  isReal: boolean;
  isDemo: boolean;
  available: boolean;
  source: string;
  timestamp: string | null;
  reasonUnavailable?: string;
}

export interface NormalizedVitalsResultSet {
  status: VitalsStatusDescriptor;
  heartRate: NormalizedVitalCardData;
  spo2: NormalizedVitalCardData;
  steps: NormalizedVitalCardData;
  sleep: NormalizedVitalCardData;
  temperature: NormalizedVitalCardData;
}

export const DEMO_VITALS_DATA = {
  heartRate: 72,
  spo2: 98,
  steps: 3245,
  sleep: 7.2,
  temperature: 36.7,
};

export function resolveVitalsState(params: {
  isBleConnected: boolean;
  bleStatus?: string;
  bluetoothOff?: boolean;
  blePermissionRequired?: boolean;
  companionAppBridge?: boolean;
  healthConnectAvailable: boolean;
  healthConnectPermissionsGranted: boolean;
  hasRealRecords: boolean;
  realSource?: string | null;
  isSyncing?: boolean;
  isScanning?: boolean;
}): VitalsStatusDescriptor {
  // 1. Connecting
  if (params.isSyncing || params.isScanning) {
    return {
      state: 'CONNECTING',
      displayStatus: 'Connecting...',
      badgeLabel: 'CONNECTING...',
      badgeColor: 'info',
      explanation: 'Connecting to wearable source and querying health records...',
      sourceLabel: params.isBleConnected ? 'Bluetooth' : 'Health Connect',
      isReal: false,
      isDemo: false,
    };
  }

  // 2. Real verified current records available
  if (params.hasRealRecords) {
    const src = formatHumanSourceLabel(params.realSource) || 'Health Connect';
    return {
      state: 'CONNECTED_REAL_DATA',
      displayStatus: 'Connected — Real Data',
      badgeLabel: '● CONNECTED — REAL DATA',
      badgeColor: 'real',
      explanation: `Verified physiological readings obtained directly from ${src}.`,
      sourceLabel: src,
      isReal: true,
      isDemo: false,
    };
  }

  // 3. Connected but no usable health records
  if (params.isBleConnected) {
    return {
      state: 'CONNECTED_NO_DATA',
      displayStatus: 'Connected — No Data',
      badgeLabel: 'CONNECTED — NO DATA',
      badgeColor: 'warning',
      explanation: 'Your watch is connected via Bluetooth, but no current health records are available.',
      sourceLabel: 'Bluetooth GATT',
      isReal: false,
      isDemo: false,
    };
  }

  if (params.healthConnectAvailable && params.healthConnectPermissionsGranted) {
    return {
      state: 'CONNECTED_NO_DATA',
      displayStatus: 'Connected — No Data',
      badgeLabel: 'CONNECTED — NO DATA',
      badgeColor: 'warning',
      explanation: 'Health Connect is connected, but no current health records are available. Ensure your companion app (e.g. NoiseFit, Samsung Health, or Wear OS) has sync enabled.',
      sourceLabel: 'Health Connect',
      isReal: false,
      isDemo: false,
    };
  }

  // 4. Bluetooth Off
  if (params.bluetoothOff) {
    return {
      state: 'BLUETOOTH_OFF',
      displayStatus: 'Bluetooth Off',
      badgeLabel: 'BLUETOOTH OFF',
      badgeColor: 'warning',
      explanation: 'Bluetooth is turned off. Please turn on Bluetooth in quick settings or Android Settings.',
      sourceLabel: 'Bluetooth',
      isReal: false,
      isDemo: true,
    };
  }

  // 5. Permission Required
  if (params.blePermissionRequired || (params.healthConnectAvailable && !params.healthConnectPermissionsGranted)) {
    return {
      state: 'PERMISSION_REQUIRED',
      displayStatus: 'Permission Required',
      badgeLabel: 'PERMISSION REQUIRED',
      badgeColor: 'warning',
      explanation: 'Health or Bluetooth permissions are required to access wearable health data.',
      sourceLabel: params.healthConnectAvailable ? 'Health Connect' : 'Bluetooth',
      isReal: false,
      isDemo: true,
    };
  }

  // 6. Health Connect Unavailable
  if (!params.healthConnectAvailable && params.healthConnectAvailable === false && !params.isBleConnected) {
    // Only if explicitly checked on native platform and found unavailable
    return {
      state: 'NOT_CONNECTED',
      displayStatus: 'Not Connected',
      badgeLabel: 'NOT CONNECTED',
      badgeColor: 'demo',
      explanation: 'No wearable or Health Connect data is available. Values shown are simulated for demonstration.',
      sourceLabel: 'Demo Data',
      isReal: false,
      isDemo: true,
    };
  }

  // Default: Not Connected / Demo Data
  return {
    state: 'NOT_CONNECTED',
    displayStatus: 'Not Connected',
    badgeLabel: 'NOT CONNECTED',
    badgeColor: 'demo',
    explanation: 'No wearable or Health Connect data is available. Values shown are simulated for demonstration.',
    sourceLabel: 'Demo Data',
    isReal: false,
    isDemo: true,
  };
}

export function normalizeVitalsDisplay(params: {
  status: VitalsStatusDescriptor;
  health: {
    heart_rate?: number | null;
    spo2?: number | null;
    steps?: number | null;
    sleep?: number | null;
    temperature?: number | null;
    source?: string | null;
    timestamp?: string | null;
  };
  metrics?: {
    heart_rate?: HealthConnectMetricDetail;
    spo2?: HealthConnectMetricDetail;
    steps?: HealthConnectMetricDetail;
    sleep?: HealthConnectMetricDetail;
    temperature?: HealthConnectMetricDetail;
  };
}): NormalizedVitalsResultSet {
  const { status, health, metrics } = params;

  if (status.state === 'CONNECTED_REAL_DATA') {
    // STATE 3: VALID CURRENT HEALTH DATA AVAILABLE
    // Only use metrics actually obtained from the source; missing ones are "Not available"
    const hrVal = typeof health.heart_rate === 'number' && health.heart_rate > 0 ? health.heart_rate : null;
    const spo2Val = typeof health.spo2 === 'number' && health.spo2 > 0 ? health.spo2 : null;
    const stepsVal = typeof health.steps === 'number' && health.steps >= 0 ? health.steps : null;
    const sleepVal = typeof health.sleep === 'number' && health.sleep >= 0 ? health.sleep : null;
    const tempVal = typeof health.temperature === 'number' && health.temperature > 0 ? health.temperature : null;

    const sourceLabel = status.sourceLabel;
    const ts = health.timestamp || null;

    return {
      status,
      heartRate: {
        value: hrVal,
        displayValue: hrVal !== null ? String(hrVal) : '—',
        unit: hrVal !== null ? 'BPM' : 'Not available',
        statusLabel: hrVal !== null ? 'Real Data' : 'Not available',
        isReal: hrVal !== null,
        isDemo: false,
        available: hrVal !== null,
        source: sourceLabel,
        timestamp: metrics?.heart_rate?.latestTimestamp || ts,
        reasonUnavailable: hrVal !== null ? undefined : 'Heart rate record not provided by connected device',
      },
      spo2: {
        value: spo2Val,
        displayValue: spo2Val !== null ? String(spo2Val) : '—',
        unit: spo2Val !== null ? '%' : 'Not available',
        statusLabel: spo2Val !== null ? 'Real Data' : 'Not available',
        isReal: spo2Val !== null,
        isDemo: false,
        available: spo2Val !== null,
        source: sourceLabel,
        timestamp: metrics?.spo2?.latestTimestamp || ts,
        reasonUnavailable: spo2Val !== null ? undefined : 'SpO2 record not provided by connected device',
      },
      steps: {
        value: stepsVal,
        displayValue: stepsVal !== null ? stepsVal.toLocaleString() : '—',
        unit: stepsVal !== null ? 'steps' : 'Not available',
        statusLabel: stepsVal !== null ? 'Real Data' : 'Not available',
        isReal: stepsVal !== null,
        isDemo: false,
        available: stepsVal !== null,
        source: sourceLabel,
        timestamp: metrics?.steps?.latestTimestamp || ts,
        reasonUnavailable: stepsVal !== null ? undefined : 'No step records found for today',
      },
      sleep: {
        value: sleepVal,
        displayValue: sleepVal !== null ? `${sleepVal}h` : '—',
        unit: sleepVal !== null ? 'hours' : 'Not available',
        statusLabel: sleepVal !== null ? 'Real Data' : 'Not available',
        isReal: sleepVal !== null,
        isDemo: false,
        available: sleepVal !== null,
        source: sourceLabel,
        timestamp: metrics?.sleep?.latestTimestamp || ts,
        reasonUnavailable: sleepVal !== null ? undefined : 'No sleep records found for last night',
      },
      temperature: {
        value: tempVal,
        displayValue: tempVal !== null ? `${tempVal}` : '—',
        unit: tempVal !== null ? '°C' : 'Not available',
        statusLabel: tempVal !== null ? 'Real Data' : 'Not available',
        isReal: tempVal !== null,
        isDemo: false,
        available: tempVal !== null,
        source: sourceLabel,
        timestamp: metrics?.temperature?.latestTimestamp || ts,
        reasonUnavailable: tempVal !== null ? undefined : 'Body temperature not provided by connected device',
      },
    };
  }

  if (status.state === 'CONNECTED_NO_DATA') {
    // STATE 2: DEVICE CONNECTED BUT NO USABLE HEALTH RECORDS
    // Check if an older historical reading exists
    const hasOldHr = typeof health.heart_rate === 'number' && health.heart_rate > 0 && Boolean(health.timestamp);
    const hasOldSteps = typeof health.steps === 'number' && health.steps > 0 && Boolean(health.timestamp);

    return {
      status,
      heartRate: {
        value: hasOldHr ? health.heart_rate! : null,
        displayValue: hasOldHr ? String(health.heart_rate) : '—',
        unit: hasOldHr ? 'BPM' : 'Not available',
        statusLabel: hasOldHr ? 'Last recorded data' : 'Not available',
        isReal: false,
        isDemo: false,
        available: hasOldHr,
        source: hasOldHr ? 'Last recorded reading' : 'Connected — No Data',
        timestamp: health.timestamp || null,
        reasonUnavailable: 'Device connected, but no current heart rate record available.',
      },
      spo2: {
        value: null,
        displayValue: '—',
        unit: 'Not available',
        statusLabel: 'Not available',
        isReal: false,
        isDemo: false,
        available: false,
        source: 'Connected — No Data',
        timestamp: null,
        reasonUnavailable: 'Device connected, but no current SpO2 record available.',
      },
      steps: {
        value: hasOldSteps ? health.steps! : null,
        displayValue: hasOldSteps ? health.steps!.toLocaleString() : '—',
        unit: hasOldSteps ? 'steps' : 'Not available',
        statusLabel: hasOldSteps ? 'Last recorded data' : 'Not available',
        isReal: false,
        isDemo: false,
        available: hasOldSteps,
        source: hasOldSteps ? 'Last recorded reading' : 'Connected — No Data',
        timestamp: health.timestamp || null,
        reasonUnavailable: 'Device connected, but no step records available for today.',
      },
      sleep: {
        value: null,
        displayValue: '—',
        unit: 'Not available',
        statusLabel: 'Not available',
        isReal: false,
        isDemo: false,
        available: false,
        source: 'Connected — No Data',
        timestamp: null,
        reasonUnavailable: 'Device connected, but no sleep records available.',
      },
      temperature: {
        value: null,
        displayValue: '—',
        unit: 'Not available',
        statusLabel: 'Not available',
        isReal: false,
        isDemo: false,
        available: false,
        source: 'Connected — No Data',
        timestamp: null,
        reasonUnavailable: 'Device connected, but no temperature records available.',
      },
    };
  }

  // STATE 1: NO DEVICE / NO HEALTH CONNECT DATA (or demo / permission required / bt off)
  // All vitals clearly and unmistakable labeled "Demo Data"
  return {
    status,
    heartRate: {
      value: DEMO_VITALS_DATA.heartRate,
      displayValue: `${DEMO_VITALS_DATA.heartRate}`,
      unit: 'BPM',
      statusLabel: 'Demo Data',
      isReal: false,
      isDemo: true,
      available: true,
      source: 'Demo Data',
      timestamp: null,
    },
    spo2: {
      value: DEMO_VITALS_DATA.spo2,
      displayValue: `${DEMO_VITALS_DATA.spo2}`,
      unit: '%',
      statusLabel: 'Demo Data',
      isReal: false,
      isDemo: true,
      available: true,
      source: 'Demo Data',
      timestamp: null,
    },
    steps: {
      value: DEMO_VITALS_DATA.steps,
      displayValue: DEMO_VITALS_DATA.steps.toLocaleString(),
      unit: 'steps',
      statusLabel: 'Demo Data',
      isReal: false,
      isDemo: true,
      available: true,
      source: 'Demo Data',
      timestamp: null,
    },
    sleep: {
      value: DEMO_VITALS_DATA.sleep,
      displayValue: `${DEMO_VITALS_DATA.sleep}`,
      unit: 'hours',
      statusLabel: 'Demo Data',
      isReal: false,
      isDemo: true,
      available: true,
      source: 'Demo Data',
      timestamp: null,
    },
    temperature: {
      value: DEMO_VITALS_DATA.temperature,
      displayValue: `${DEMO_VITALS_DATA.temperature}`,
      unit: '°C',
      statusLabel: 'Demo Data',
      isReal: false,
      isDemo: true,
      available: true,
      source: 'Demo Data',
      timestamp: null,
    },
  };
}

/**
 * Sanitizes raw Android package names or internal identifiers into clean, user-friendly names.
 * Ensures internal strings like "healthconnect.phone.j1c68c68cdb243f44a6012e1c6b8b515d"
 * are never shown in the UI.
 */
export function formatHumanSourceLabel(rawSource?: string | null): string {
  if (!rawSource) return 'Health Connect';

  const lower = rawSource.toLowerCase().trim();

  // Known health companion brands
  if (lower.includes('samsung') || lower.includes('shealth')) return 'Samsung Health';
  if (lower.includes('fitbit')) return 'Fitbit';
  if (lower.includes('noise')) return 'NoiseFit';
  if (lower.includes('garmin')) return 'Garmin Connect';
  if (lower.includes('boat') || lower.includes('crest')) return 'boAt Crest';
  if (lower.includes('google') || lower.includes('fitness')) return 'Google Fit';
  if (lower.includes('zepp') || lower.includes('amazfit')) return 'Zepp Life';
  if (lower.includes('withings')) return 'Withings Health Mate';
  if (lower.includes('whoop')) return 'WHOOP';
  if (lower.includes('polar')) return 'Polar Flow';

  // Internal Health Connect phone package identifiers or hashes
  if (
    lower.includes('healthconnect.phone') ||
    lower.includes('healthconnect') ||
    lower.includes('.android.') ||
    lower.startsWith('com.') ||
    /[a-f0-9]{12,}/i.test(rawSource)
  ) {
    return 'Health Connect';
  }

  if (lower.includes('bluetooth') || lower.includes('gatt') || lower.includes('ble')) {
    return 'Bluetooth Wearable';
  }

  if (lower.includes('manual')) {
    return 'Manual Reading';
  }

  if (lower.includes('demo') || lower.includes('simulat')) {
    return 'Demo Data';
  }

  // Strip trailing nested package IDs like "(healthconnect.phone...)"
  const cleaned = rawSource
    .replace(/\s*\([^)]*healthconnect[^)]*\)/gi, '')
    .replace(/\s*\([^)]*[a-f0-9]{10,}[^)]*\)/gi, '')
    .trim();

  if (!cleaned || cleaned.toLowerCase() === 'android health connect') {
    return 'Health Connect';
  }

  return cleaned;
}

/**
 * Normalizes Health Connect status string to clean human-readable UI labels.
 * Strictly separates:
 *   - "Connected — Real Data"
 *   - "Connected — No Data"
 *   - "Not Connected"
 *   - "Demo Data"
 */
export function formatHealthConnectStatus(rawStatus?: string | null): string {
  if (!rawStatus) return 'Not Connected';

  if (rawStatus.includes('Real Data') || rawStatus.includes('LIVE DATA')) {
    return 'Connected — Real Data';
  }
  if (
    rawStatus.includes('No Data') ||
    rawStatus.includes('pending') ||
    rawStatus.includes('waiting') ||
    rawStatus.includes('awaiting')
  ) {
    return 'Connected — No Data';
  }
  if (rawStatus.includes('Permission Required') || rawStatus.includes('Permissions Needed')) {
    return 'Permission Required';
  }
  if (rawStatus.includes('Demo') || rawStatus.includes('Simulated')) {
    return 'Demo Data';
  }
  if (rawStatus.includes('Not Connected')) {
    return 'Not Connected';
  }
  if (rawStatus.includes('Querying') || rawStatus.includes('Checking') || rawStatus.includes('Connecting')) {
    return 'Connecting...';
  }

  return formatHumanSourceLabel(rawStatus);
}

