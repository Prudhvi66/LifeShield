import React, { useEffect, useState, useRef, useCallback } from "react";
import "./index.css";
import { Capacitor } from "@capacitor/core";
import { apiClient } from "./services/apiClient";
import { bluetoothService, BLEDeviceStatus } from "./services/bluetoothService";
import { voiceTtsService, VoiceSettings } from "./services/voiceTtsService";
import { reminderScheduler, SchedulerReminder } from "./services/reminderScheduler";
import { soundService } from "./services/soundService";
import { LocationService, GeoLocationResult, MedicalCenterPoint } from "./services/locationService";
import { StorageService } from "./services/storageService";
import { HealthConnectService } from "./services/healthConnectService";
import { EmergencyCallService } from "./services/emergencyCallService";
import { emergencySmsService, SmsSendResult } from "./services/emergencySmsService";
import { AndroidLocationService } from "./services/androidLocationService";
import { androidNotificationService, NotificationPermissionStatus } from "./services/androidNotificationService";
import { nativeFallDetection } from "./services/nativeFallDetectionService";
import { permissionService, PermissionGroupInfo, PermissionGroupKey } from "./services/permissionService";
import { PermissionSetupScreen } from "./components/PermissionSetupScreen";
import { LandingPage } from "./components/landing/LandingPage";
import { RiskAnalysisView } from "./components/risk/RiskAnalysisView";
import { WearablesView } from "./components/wearables/WearablesView";
import { HealthHistoryView } from "./components/history/HealthHistoryView";
import { AlertsView } from "./components/alerts/AlertsView";
import { HealthConnectMetricDetail, formatTimeAgo, formatHumanSourceLabel, formatHealthConnectStatus } from "./services/wearableSource";
import { demoHealthService, DataSourceStatus } from "./services/demoHealthData";

type Tab =
  | "home"
  | "health"
  | "safety"
  | "ai"
  | "profile"
  | "landing"
  | "risk"
  | "wearables"
  | "history"
  | "alerts"
  | "settings";

type ActiveModal =
  | "none"
  | "info"
  | "auth"
  | "reminders"
  | "contacts"
  | "device"
  | "map"
  | "sos_countdown"
  | "fall_siren"
  | "high_hr_alert"
  | "manual_vitals"
  | "permissions"
  | "environment"
  | "sos_status"
  | "emergency_settings";

type HealthData = {
  heart_rate?: number | null;
  spo2?: number | null;
  temperature?: number | null;
  steps?: number | null;
  sleep?: number | null;
  hydration?: number | null;
  systolic_bp?: number | null;
  diastolic_bp?: number | null;
  calories?: number | null;
  respiratory_rate?: number | null;
  activity?: string | null;
  source?: string | null;
  timestamp?: string | null;
};

type EnvironmentData = {
  temperature?: number | null;
  humidity?: number | null;
  aqi?: number | null;
  aqi_level?: string | null;
  weather?: string | null;
  heat_index?: number | null;
  flood_risk_level?: string | null;
  wind_speed_kmh?: number | null;
  uv_index?: number | null;
  pm2_5?: number | null;
  pm10?: number | null;
  advisories?: Array<{ id: string; title: string; severity: string; description: string; category?: string }>;
};

type UserAccount = {
  id?: string;
  email?: string;
  full_name?: string;
  age?: number;
  blood_group?: string;
  primary_language?: string;
  resting_hr_baseline?: number;
  spo2_floor_baseline?: number;
};

type ReminderItem = {
  id: string;
  title: string;
  reminder_type: string;
  time: string;
  dosage?: string;
  repeat?: string;
  voice_enabled?: boolean;
  is_active?: boolean;
};

type EmergencyContactItem = {
  id: string;
  name: string;
  phone: string;
  relation: string;
  priority: 1 | 2 | 3;
  auto_notify: boolean;
};

type ChatMessage = {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
  source?: string;
};

export type HealthDataSource = "real" | "demo" | "unavailable" | "not_connected";

export const EMPTY_HEALTH_VITALS: HealthData = {
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
  source: null,
  timestamp: null,
};

export function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [activeModal, setActiveModal] = useState<ActiveModal>("none");

  // Core Application State - Live telemetry when available or honest labeled demo vitals
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => demoHealthService.isDemoModeEnabled());
  const [dataSource, setDataSource] = useState<HealthDataSource>(() =>
    demoHealthService.isDemoModeEnabled() ? "demo" : "not_connected"
  );
  const [health, setHealth] = useState<HealthData>(() =>
    demoHealthService.isDemoModeEnabled() ? demoHealthService.getDemoHealthData() : EMPTY_HEALTH_VITALS
  );
  const [isAuthBootstrapping, setIsAuthBootstrapping] = useState<boolean>(() => Boolean(apiClient.getToken()));
  const [environment, setEnvironment] = useState<EnvironmentData>({});
  const [envLoading, setEnvLoading] = useState<boolean>(false);
  const [envError, setEnvError] = useState<boolean>(false);
  const [selectedRegion, setSelectedRegion] = useState<string>("Hyderabad");
  const [trends, setTrends] = useState<any[]>([]);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [contacts, setContacts] = useState<EmergencyContactItem[]>([]);
  const [user, setUser] = useState<UserAccount | null>(() => {
    // Restore user from localStorage on app startup
    try {
      const stored = apiClient.getStoredUser();
      if (stored && apiClient.getToken()) {
        return {
          id: stored.id,
          email: stored.email,
          full_name: stored.full_name,
          age: stored.age,
          blood_group: stored.blood_group,
          primary_language: stored.primary_language,
        };
      }
    } catch { /* ignore */ }
    return null;
  });
  const [currentLocation, setCurrentLocation] = useState<GeoLocationResult | null>(null);
  const [nearbyHospitals, setNearbyHospitals] = useState<MedicalCenterPoint[]>([]);

  // Diagnostics & Status
  const [backendOnline, setBackendOnline] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [bleStatus, setBleStatus] = useState<BLEDeviceStatus>({ isConnected: false });
  const [isScanningBle, setIsScanningBle] = useState(false);
  const [isBleLive, setIsBleLive] = useState(false);
  const [healthConnectStatus, setHealthConnectStatus] = useState<string>("Ready to check");
  const [healthConnectMetrics, setHealthConnectMetrics] = useState<{
    heart_rate: HealthConnectMetricDetail;
    spo2: HealthConnectMetricDetail;
    steps: HealthConnectMetricDetail;
    sleep: HealthConnectMetricDetail;
    temperature: HealthConnectMetricDetail;
  } | undefined>(undefined);
  const [isSyncingHealthConnect, setIsSyncingHealthConnect] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [statusToast, setStatusToast] = useState<{ message: string; type: "info" | "success" | "warning" } | null>(null);

  // Permission Setup (first-launch flow)
  const [needsPermissionSetup, setNeedsPermissionSetup] = useState(() => {
    return !permissionService.isSetupComplete();
  });

  // Fall Detection & Emergency Countdown
  const [fallDetectionActive, setFallDetectionActive] = useState(() => {
    // Restore persisted state, default OFF
    try {
      const saved = localStorage.getItem("lifeshield_fall_detection_active");
      return saved === "true";
    } catch { return false; }
  });
  const [emergencyCountdown, setEmergencyCountdown] = useState<number>(10);
  const [fallSirenCountdown, setFallSirenCountdown] = useState<number>(30);
  const [highHrCountdown, setHighHrCountdown] = useState<number>(30);
  const [highHrValue, setHighHrValue] = useState<number | null>(null);
  const lastHrAlertTimeRef = useRef<number>(0);
  const countdownTimerRef = useRef<any>(null);

  // SOS Status & Duplicate Prevention
  const [sosStatus, setSosStatus] = useState<{
    recorded: boolean;
    locationObtained: boolean;
    locationAccuracy: number | null;
    locationTimestamp: string | null;
    lat: number | null;
    lon: number | null;
    primaryContactStatus: string;
    otherContactsStatus: string;
    emergencyServiceStatus: string;
    locationShared: boolean;
    message: string;
    cancelled: boolean;
    contactsAttempted: number;
    sosEventId: string | null;
    dispatchTarget?: string;
    dispatchTargetNumber?: string;
    callStatus?: string;
    callResults?: Array<{ target: string; number: string; status: string; detail: string }>;
    smsResults?: Array<{ target: string; number: string; status: string; detail: string }>;
    smsStatus?: string;
    telephonyLive?: boolean;
  } | null>(null);
  const sosInProgressRef = useRef<boolean>(false);

  // GPS data acquired during SOS countdown
  const [sosGpsData, setSosGpsData] = useState<{ lat: number; lon: number; accuracy: number; timestamp: string } | null>(null);
  const sosGpsRequestedRef = useRef<boolean>(false);

  // Emergency Service Configuration
  const [emergencyServiceNumber, setEmergencyServiceNumber] = useState<string>(
    () => localStorage.getItem("lifeshield_emergency_number") || "112"
  );

  // Emergency Dispatch Preferences
  const [dispatchPrefs, setDispatchPrefs] = useState<{
    auto_call_police: boolean;
    auto_call_ambulance: boolean;
    police_number: string;
    ambulance_number: string;
    unified_emergency_number: string;
  }>(() => {
    const saved = localStorage.getItem("lifeshield_dispatch_prefs");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch { /* ignore */ }
    }
    return {
      auto_call_police: false,
      auto_call_ambulance: false,
      police_number: "100",
      ambulance_number: "108",
      unified_emergency_number: "112",
    };
  });

  // AI Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "msg-welcome",
      sender: "assistant",
      text: "Hello! I am your LifeShield clinical safety companion. I can help explain your health metrics, environmental hazards, and emergency protocols.",
      timestamp: "Just now",
      source: "clinical_safety_engine",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const isAiSendingRef = useRef(false);
  const voiceSettingsState = voiceTtsService.getSettings();
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(voiceSettingsState);

  // Forms State
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authFullName, setAuthFullName] = useState("");
  const [authAge, setAuthAge] = useState<number>(35);
  const [authBloodGroup, setAuthBloodGroup] = useState("O+");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Manual Vitals Form
  const [manualHr, setManualHr] = useState("");
  const [manualSpo2, setManualSpo2] = useState("");
  const [manualBpSys, setManualBpSys] = useState("");
  const [manualBpDia, setManualBpDia] = useState("");
  const [manualTemp, setManualTemp] = useState("");
  const [manualSteps, setManualSteps] = useState("");
  const [manualLogging, setManualLogging] = useState(false);

  // New Reminder Form
  const [newReminderTitle, setNewReminderTitle] = useState("");
  const [newReminderTime, setNewReminderTime] = useState("08:00");
  const [newReminderType, setNewReminderType] = useState("Medicine");
  const [newReminderDosage, setNewReminderDosage] = useState("");

  // Reminder Scheduler Diagnostics
  const [notifPermission, setNotifPermission] = useState<NotificationPermissionStatus>(() =>
    voiceTtsService.getNotificationPermission()
  );
  const [schedulerActive, setSchedulerActive] = useState(false);
  const [schedulerNextReminder, setSchedulerNextReminder] = useState<string>("None");
  const [browserTime, setBrowserTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
  });
  const [reminderToast, setReminderToast] = useState<string | null>(null);

  // New Contact Form
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newContactRel, setNewContactRel] = useState("Family");
  const [newContactPriority, setNewContactPriority] = useState<1 | 2 | 3>(1);

  // Edit Contact Form
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editContactName, setEditContactName] = useState("");
  const [editContactPhone, setEditContactPhone] = useState("");
  const [editContactRel, setEditContactRel] = useState("Family");
  const [editContactPriority, setEditContactPriority] = useState<1 | 2 | 3>(1);

  // Baseline Form
  const [baselineRestingHr, setBaselineRestingHr] = useState(72);
  const [baselineSpo2Floor, setBaselineSpo2Floor] = useState(95);
  const [baselineSaving, setBaselineSaving] = useState(false);
  const [baselineSavedSuccess, setBaselineSavedSuccess] = useState(false);

  // Toast Notification Helper
  const showToast = (message: string, type: "info" | "success" | "warning" = "info") => {
    setStatusToast({ message, type });
    setTimeout(() => {
      setStatusToast(null);
    }, 4500);
  };

  // -------------------------------------------------------------
  // REMINDER SCHEDULER (reliable frontend execution)
  // -------------------------------------------------------------
  const triggeredRemindersRef = useRef<Set<string>>(new Set());

  // Initialize and manage the reminder scheduler
  useEffect(() => {
    if (reminders.length === 0) {
      reminderScheduler.stop();
      setSchedulerActive(false);
      setSchedulerNextReminder("None");
      return;
    }

    // Map reminders to scheduler format
    const schedulerReminders: SchedulerReminder[] = reminders.map((r) => ({
      id: r.id,
      title: r.title,
      reminder_type: r.reminder_type,
      time: r.time,
      dosage: r.dosage,
      repeat: r.repeat,
      voice_enabled: r.voice_enabled,
      is_active: r.is_active,
    }));

    reminderScheduler.start(schedulerReminders);
    setSchedulerActive(true);

    // Listen for triggered reminders to show in-app toast
    const unsub = reminderScheduler.onEvent((event) => {
      if (event.type === "triggered" && event.reminder) {
        const r = event.reminder;
        const msg = `Reminder: ${r.title}${r.dosage ? " - " + r.dosage : ""} at ${r.time}`;
        setReminderToast(msg);
        setTimeout(() => setReminderToast(null), 8000);
      }
    });

    // Update diagnostic info
    const updateDiagnostics = () => {
      const next = reminderScheduler.nextReminder;
      setSchedulerNextReminder(next ? `${next.title} at ${next.time}` : "None");
      setBrowserTime(reminderScheduler.currentBrowserTime);
      setSchedulerActive(reminderScheduler.isActive);
    };

    updateDiagnostics();
    const diagInterval = setInterval(updateDiagnostics, 1000);

    return () => {
      unsub();
      clearInterval(diagInterval);
      reminderScheduler.stop();
      setSchedulerActive(false);
    };
  }, [reminders]);

  // Unlock speech synthesis on first user interaction
  useEffect(() => {
    const unlock = () => {
      voiceTtsService.unlock();
      window.removeEventListener("click", unlock);
      window.removeEventListener("touchstart", unlock);
    };
    window.addEventListener("click", unlock);
    window.addEventListener("touchstart", unlock);
    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  // -------------------------------------------------------------
  // DEMO DATA MODE SUBSCRIPTION & SUBTLE VALUE PROGRESSION
  // -------------------------------------------------------------
  useEffect(() => {
    const unsub = demoHealthService.subscribe(() => {
      const isEnabled = demoHealthService.isDemoModeEnabled();
      setIsDemoMode(isEnabled);
      setDataSource((prev) => {
        if (prev === "real" || prev === "unavailable") return prev; // Real hardware always takes precedence!
        return isEnabled ? "demo" : "not_connected";
      });
      setHealth((prev) => {
        if (!demoHealthService.isDemoModeEnabled()) {
          return prev.source === "Simulated Demonstration" ? EMPTY_HEALTH_VITALS : prev;
        }
        if (prev.source === "Simulated Demonstration" || !prev.source) {
          return demoHealthService.getDemoHealthData();
        }
        return prev;
      });
    });
    return unsub;
  }, []);

  const handleToggleDemoMode = (enabled: boolean) => {
    demoHealthService.setDemoModeEnabled(enabled);
    setIsDemoMode(enabled);
    if (dataSource === "real") {
      showToast(
        enabled
          ? "Demo Mode set to ON (Real wearable telemetry currently has active priority)"
          : "Demo Mode turned off",
        "info"
      );
      return;
    }
    if (enabled) {
      setDataSource("demo");
      setHealth(demoHealthService.getDemoHealthData());
      showToast("Demo Data Mode activated (Simulated data for presentation)", "info");
    } else {
      setDataSource("not_connected");
      setHealth(EMPTY_HEALTH_VITALS);
      showToast("Demo Data Mode disabled (Not Connected)", "info");
    }
  };

  // Check native Android notification permission on mount
  useEffect(() => {
    if (androidNotificationService.isNativeAndroid()) {
      // Create channel and check permission on startup
      androidNotificationService.ensurePermission().then((granted) => {
        androidNotificationService.createChannel();
        androidNotificationService.checkPermission().then((status) => {
          setNotifPermission(status);
          console.log("[LifeShield] Android notification permission:", status);
        });
      });
    }
  }, []);

  // Register auth failure handler — clears user state on genuine 401
  useEffect(() => {
    apiClient.setAuthFailureHandler(() => {
      setUser(null);
      setAuthError("Your session has expired. Please log in again.");
      setActiveModal("auth");
      showToast("Your session has expired. Please log in again.", "warning");
    });
    return () => apiClient.setAuthFailureHandler(null);
  }, []);

  // Authentication Bootstrap on App Mount
  useEffect(() => {
    const bootstrapAuth = async () => {
      const token = apiClient.getToken();
      if (!token) {
        setIsAuthBootstrapping(false);
        return;
      }
      try {
        const me = await apiClient.auth.getMe();
        if (me) {
          const userData = {
            id: me.id,
            email: me.email,
            full_name: me.full_name,
            age: me.age,
            blood_group: me.blood_group,
            primary_language: me.primary_language,
          };
          setUser(userData);
          apiClient.setStoredUser(userData);
          console.log("[LifeShield Auth] Session verified on bootstrap for:", me.email);
        }
      } catch (err: any) {
        if (err.message?.includes("401") || !apiClient.getToken()) {
          console.warn("[LifeShield Auth] Stored session expired or invalid on startup:", err.message);
          setUser(null);
          apiClient.clearToken("bootstrap_session_expired");
          setAuthError("Your session has expired. Please log in again.");
          showToast("Your session has expired. Please log in again.", "warning");
        } else {
          // Temporary network failure or server startup delay: preserve cached session!
          console.warn("[LifeShield Auth] Backend unavailable during bootstrap, preserving offline session:", err.message);
          const cached = apiClient.getStoredUser();
          if (cached) setUser(cached);
        }
      } finally {
        setIsAuthBootstrapping(false);
      }
    };

    bootstrapAuth();
  }, []);

  // Update browser time every second for diagnostics
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setBrowserTime(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // -------------------------------------------------------------
  // INITIALIZATION & REAL DATA SYNC
  // -------------------------------------------------------------
  const loadData = useCallback(async () => {
    console.log("[LifeShield Health] loadData() starting — evaluating real vs demo data sources");
    setIsRefreshing(true);
    try {
      // 1. Auth & Profile
      if (apiClient.getToken()) {
        try {
          const me = await apiClient.auth.getMe();
          if (me) {
            const userData = {
              id: me.id,
              email: me.email,
              full_name: me.full_name,
              age: me.age,
              blood_group: me.blood_group,
              primary_language: me.primary_language,
            };
            setUser(userData);
            apiClient.setStoredUser(userData);
            console.log("[LifeShield Auth] Session verified via /me for:", me.email);
          }
        } catch (err: any) {
          // If token was rejected with 401, apiClient already invalidated it.
          // If network / server error, preserve cached session!
          console.warn("[LifeShield Auth] /me verification note:", err.message);
        }
      }

      // 2. Health Data Resolution (Priority: Real Data -> Connected No Data -> Demo Data -> Not Connected)
      let resolvedDataSource: HealthDataSource = "not_connected";
      let resolvedHealth: HealthData = EMPTY_HEALTH_VITALS;
      let resolvedSyncTime: string | null = null;
      let hasRealHealthData = false;

      // Check native Android Health Connect first
      if (HealthConnectService.isNativeAndroid()) {
        try {
          const perms = await HealthConnectService.checkPermissions();
          if (perms.permissionsGranted) {
            const hcRes = await HealthConnectService.readAggregatedData();
            if (hcRes.metrics) {
              setHealthConnectMetrics(hcRes.metrics);
            }

            if (hcRes.hasData && hcRes.data) {
              const hr = hcRes.data.heart_rate;
              const spo2 = hcRes.data.spo2;
              const steps = hcRes.data.steps;
              const sleep = hcRes.data.sleep;
              const temp = hcRes.data.temperature;

              const hasHR = typeof hr === "number" && hr > 0 && hr < 300;
              const hasSpO2 = typeof spo2 === "number" && spo2 > 0 && spo2 <= 100;
              const hasSteps = typeof steps === "number" && steps >= 0;
              const hasSleep = typeof sleep === "number" && sleep >= 0;
              const hasTemp = typeof temp === "number" && temp > 30 && temp < 45;

              if (hasHR || hasSpO2 || hasSteps || hasSleep || hasTemp) {
                hasRealHealthData = true;
                resolvedDataSource = "real";
                const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                resolvedSyncTime = timeStr;
                resolvedHealth = {
                  heart_rate: hasHR ? hr : null,
                  spo2: hasSpO2 ? spo2 : null,
                  steps: hasSteps ? steps : null,
                  sleep: hasSleep ? sleep : null,
                  temperature: hasTemp ? temp : null,
                  hydration: 68,
                  systolic_bp: null,
                  diastolic_bp: null,
                  source: formatHumanSourceLabel(hcRes.source),
                  timestamp: new Date().toISOString(),
                };
                setHealthConnectStatus("Connected — Real Data");
                console.log("[LifeShield Health] STATE: Connected — Real Data from", hcRes.source);
              }
            }

            if (!hasRealHealthData) {
              // Connected/authorized, but no current health records found yet
              resolvedDataSource = "unavailable";
              resolvedHealth = {
                heart_rate: null,
                spo2: null,
                steps: null,
                sleep: null,
                temperature: null,
                hydration: null,
                systolic_bp: null,
                diastolic_bp: null,
                source: "Health Connect",
                timestamp: null,
              };
              setHealthConnectStatus("Connected — No Data");
              console.log("[LifeShield Health] STATE: Connected — No Data (Health Connect has no current records)");
            }
          } else {
            setHealthConnectStatus("Not Connected");
          }
        } catch (hcErr: any) {
          console.warn("[LifeShield Health] Health Connect check error:", hcErr);
          setHealthConnectStatus("Not Connected");
        }
      } else {
        setHealthConnectStatus("Not Connected");
      }

      // Check if Bluetooth GATT is actively streaming live data
      if (bleStatus.isConnected && isBleLive) {
        resolvedDataSource = "real";
        resolvedHealth = {
          ...resolvedHealth,
          source: "Bluetooth GATT",
          timestamp: new Date().toISOString(),
        };
      } else if (bleStatus.isConnected && !hasRealHealthData) {
        resolvedDataSource = "unavailable";
        resolvedHealth = {
          heart_rate: null,
          spo2: null,
          steps: null,
          sleep: null,
          temperature: null,
          hydration: null,
          systolic_bp: null,
          diastolic_bp: null,
          source: "Bluetooth GATT",
          timestamp: null,
        };
      }

      // Priority 3 & 4: If no real source is active and no device is connected
      if (!hasRealHealthData && resolvedDataSource !== "unavailable") {
        if (demoHealthService.isDemoModeEnabled()) {
          resolvedDataSource = "demo";
          resolvedHealth = demoHealthService.getDemoHealthData();
          setHealthConnectStatus((prev) =>
            prev.includes("Connected") ? "Not Connected" : prev
          );
          console.log("[LifeShield Health] STATE: Demo Data Mode active for presentation.");
        } else {
          resolvedDataSource = "not_connected";
          resolvedHealth = EMPTY_HEALTH_VITALS;
          setHealthConnectStatus((prev) =>
            prev.includes("Connected") ? "Not Connected" : prev
          );
          console.log("[LifeShield Health] STATE: Not Connected (Demo Mode disabled).");
        }
      }

      setBackendOnline(true);
      setHealth(resolvedHealth);
      setDataSource(resolvedDataSource);
      setLastSyncTime(resolvedSyncTime);

      // 3. Environment (Real Open-Meteo)
      setEnvLoading(true);
      setEnvError(false);
      try {
        const env = await apiClient.environment.get({ region: selectedRegion });
        if (env) {
          setEnvironment({
            temperature: env.temperature_c,
            humidity: env.humidity_percent,
            aqi: env.aqi,
            aqi_level: env.aqi_level,
            weather: env.weather_condition,
            heat_index: env.heat_index_c,
            flood_risk_level: env.flood_risk_level,
            wind_speed_kmh: env.wind_speed_kmh,
            uv_index: env.uv_index,
            pm2_5: env.pm2_5,
            pm10: env.pm10,
            advisories: env.advisories || [],
          });
          setEnvError(false);
        }
      } catch (envErr) {
        console.warn("[LifeShield Environment] Failed to fetch live environment data:", envErr);
        setEnvError(true);
      } finally {
        setEnvLoading(false);
      }

      // 4. Trends
      const trendData = await apiClient.health.getTrends(24).catch(() => []);
      setTrends(trendData || []);

      // 5. Reminders
      const rems = await apiClient.reminders.list().catch((err: any) => {
        console.warn("Reminders unavailable (login required):", err.message);
        return [];
      });
      if (rems && rems.length > 0) {
        setReminders(
          rems.map((r: any) => ({
            id: r.id,
            title: r.title,
            reminder_type: r.reminder_type || "Medicine",
            time: r.time,
            dosage: r.dosage,
            repeat: r.repeat,
            voice_enabled: r.voice_enabled ?? true,
            is_active: r.is_active ?? true,
          }))
        );
      }

      // 6. Emergency Contacts
      const cnts = await apiClient.contacts.list().catch((err: any) => {
        console.warn("Contacts unavailable (login required):", err.message);
        return [];
      });
      if (cnts && cnts.length > 0) {
        setContacts(
          cnts.map((c: any) => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            relation: c.relation || "Contact",
            priority: (c.priority || 1) as 1 | 2 | 3,
            auto_notify: c.auto_notify ?? true,
          }))
        );
      }

      // 7. Baseline
      const bl = await apiClient.profile.getBaseline().catch(() => null);
      if (bl) {
        setBaselineRestingHr(bl.resting_heart_rate || 72);
        setBaselineSpo2Floor(bl.normal_spo2_min || 95);
      }

      // 8. Emergency Dispatch Preferences
      const dp = await apiClient.dispatch.get().catch(() => null);
      if (dp) {
        setDispatchPrefs({
          auto_call_police: dp.auto_call_police ?? false,
          auto_call_ambulance: dp.auto_call_ambulance ?? false,
          police_number: dp.police_number || "100",
          ambulance_number: dp.ambulance_number || "108",
          unified_emergency_number: dp.unified_emergency_number || "112",
        });
      }
    } catch (e) {
      console.warn("[LifeShield Health] Data loading error, keeping demo vitals:", e);
    } finally {
      setIsRefreshing(false);
    }
  }, [selectedRegion]);

  useEffect(() => {
    loadData();

    // Fetch live hardware location
    LocationService.getCurrentLocation()
      .then((loc) => {
        setCurrentLocation(loc);
        const facilities = LocationService.getNearbyMedicalCenters(loc.latitude, loc.longitude);
        setNearbyHospitals(facilities);
      })
      .catch((err) => console.warn("GPS Location fetch:", err));

    // Hardware Fall Detection Listener
    let lastZ = 0;
    const handleMotion = (e: DeviceMotionEvent) => {
      if (!fallDetectionActive) return;
      const acc = e.accelerationIncludingGravity;
      if (!acc || acc.z === null) return;
      const deltaZ = Math.abs((acc.z || 0) - lastZ);
      lastZ = acc.z || 0;

      // Spike detection threshold (> 25 m/s^2 change)
      if (deltaZ > 25) {
        triggerFallSirenModal();
      }
    };

    if (typeof window !== "undefined" && "ondevicemotion" in window) {
      window.addEventListener("devicemotion", handleMotion);
    }

    // App Resume / Foreground refresh listener:
    // When user returns from granting permissions in Android Settings or from companion app
    const handleForegroundResume = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        console.log("[LifeShield Lifecycle] Returned to foreground — auto-checking health permissions & records");
        loadData();
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleForegroundResume);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("focus", handleForegroundResume);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("devicemotion", handleMotion);
        window.removeEventListener("focus", handleForegroundResume);
      }
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleForegroundResume);
      }
    };
  }, [loadData, fallDetectionActive]);

  // -------------------------------------------------------------
  // NATIVE FALL DETECTION SERVICE — STARTUP RESTORATION
  // On app mount, if fall detection was left ON in localStorage,
  // ensure the foreground service is running. This handles:
  //   - App restart after process kill by Android
  //   - App reopen after screen-off
  //   - Cold start from notification tap
  // The toggle handler (onToggleFallDetection) is the single source
  // of truth for start/stop during the session. This effect only
  // restores service state on mount.
  // -------------------------------------------------------------
  useEffect(() => {
    if (!nativeFallDetection.isNativeAndroid()) return;
    if (fallDetectionActive) {
      nativeFallDetection.start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------------------------------------------
  // EMERGENCY SOS & FALL DETECTION ENGINE
  // -------------------------------------------------------------
  const requestBrowserGeolocation = (): Promise<{ lat: number; lon: number; accuracy: number; timestamp: string } | null> => {
    // On Android, use native GPS for reliability
    if (Capacitor.isNativePlatform()) {
      return AndroidLocationService.getEmergencyLocation(8000)
        .then((loc) => ({
          lat: loc.latitude,
          lon: loc.longitude,
          accuracy: loc.accuracy,
          timestamp: new Date(loc.timestamp).toISOString(),
        }))
        .catch((err) => {
          console.warn("Native location failed, trying browser geolocation:", err);
          return fallbackBrowserGeo();
        });
    }
    return fallbackBrowserGeo();
  };

  const fallbackBrowserGeo = (): Promise<{ lat: number; lon: number; accuracy: number; timestamp: string } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        console.warn("Geolocation not supported by browser");
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date(position.timestamp).toISOString(),
          });
        },
        (error) => {
          console.warn("Geolocation error:", error.message);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    });
  };

  const buildEmergencyMessage = (
    userName: string,
    gpsData: { lat: number; lon: number; accuracy: number } | null
  ): string => {
    const timeStr = new Date().toLocaleString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    const lines = [
      "LIFESHIELD EMERGENCY ALERT",
      "",
      "Emergency SOS triggered.",
      "",
    ];

    if (gpsData) {
      const mapsLink = `https://www.google.com/maps?q=${gpsData.lat},${gpsData.lon}`;
      lines.push(
        "Current location:",
        `Latitude: ${gpsData.lat.toFixed(6)}`,
        `Longitude: ${gpsData.lon.toFixed(6)}`,
        `Accuracy: ${Math.round(gpsData.accuracy)} meters`,
        `Map: ${mapsLink}`,
      );
    } else {
      lines.push(
        "Current location:",
        "Latitude: unavailable",
        "Longitude: unavailable",
        "Accuracy: unavailable",
        "Map: Location could not be obtained",
      );
    }

    lines.push(
      "",
      `Time: ${timeStr}`,
      `Name: ${userName}`,
      "",
      "Please contact the person immediately.",
      "",
      "This is an automated emergency alert from LifeShield.",
    );

    return lines.join("\n");
  };

  const startSosCountdown = () => {
    // Prevent duplicate SOS
    if (sosInProgressRef.current) {
      showToast("Emergency SOS is already in progress.", "warning");
      return;
    }
    sosInProgressRef.current = true;
    sosGpsRequestedRef.current = false;
    setSosGpsData(null);

    // Request GPS immediately when countdown starts
    requestBrowserGeolocation().then((gps) => {
      setSosGpsData(gps);
      sosGpsRequestedRef.current = true;
    });

    setEmergencyCountdown(10);
    setActiveModal("sos_countdown");
    soundService.startEmergencySiren();

    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = setInterval(() => {
      setEmergencyCountdown((prev) => {
        soundService.playCountdownTick(true);
        if (prev <= 1) {
          clearInterval(countdownTimerRef.current);
          dispatchEmergencySos();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const triggerFallSirenModal = () => {
    if (sosInProgressRef.current) {
      showToast("Emergency SOS is already in progress.", "warning");
      return;
    }
    sosInProgressRef.current = true;
    sosGpsRequestedRef.current = false;
    setSosGpsData(null);

    // Request GPS immediately
    requestBrowserGeolocation().then((gps) => {
      setSosGpsData(gps);
      sosGpsRequestedRef.current = true;
    });

    setFallSirenCountdown(30);
    setActiveModal("fall_siren");
    soundService.startEmergencySiren();

    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = setInterval(() => {
      setFallSirenCountdown((prev) => {
        soundService.playCountdownTick(prev <= 10);
        if (prev <= 1) {
          clearInterval(countdownTimerRef.current);
          dispatchEmergencySos();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // -------------------------------------------------------------
  // NATIVE FALL DETECTION LISTENER (foreground service events)
  // Must be defined after triggerFallSirenModal
  // -------------------------------------------------------------
  useEffect(() => {
    if (!nativeFallDetection.isNativeAndroid()) return;

    // Check for pending fall event from a cold start (notification tap)
    nativeFallDetection.getPendingFall().then((pending) => {
      if (pending && pending.hasPending) {
        console.log("[LifeShield] Pending native fall detected on cold start — peakG:", pending.peakG);
        triggerFallSirenModal();
      }
    });

    const listener = nativeFallDetection.onFallDetected((data) => {
      console.log("[LifeShield] Native fall detected — peakG:", data.peakG, "source:", data.source);
      triggerFallSirenModal();
    });

    return () => {
      listener.remove();
    };
  }, [triggerFallSirenModal]);

  const triggerHighHrAlertModal = (hrValue: number) => {
    if (sosInProgressRef.current) return;
    sosInProgressRef.current = true;
    sosGpsRequestedRef.current = false;
    setSosGpsData(null);

    // Request GPS immediately
    requestBrowserGeolocation().then((gps) => {
      setSosGpsData(gps);
      sosGpsRequestedRef.current = true;
    });

    setHighHrValue(hrValue);
    setHighHrCountdown(30);
    setActiveModal("high_hr_alert");
    soundService.startEmergencySiren();

    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = setInterval(() => {
      setHighHrCountdown((prev) => {
        soundService.playCountdownTick(prev <= 10);
        if (prev <= 1) {
          clearInterval(countdownTimerRef.current);
          dispatchEmergencySos();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Monitor vitals for high heart rate anomaly threshold (> baseline + 30 or > 120 BPM)
  useEffect(() => {
    if (health.heart_rate && health.heart_rate > Math.max(120, baselineRestingHr + 30)) {
      const now = Date.now();
      if (now - lastHrAlertTimeRef.current > 300000 && activeModal === "none") {
        lastHrAlertTimeRef.current = now;
        triggerHighHrAlertModal(health.heart_rate);
      }
    }
  }, [health.heart_rate, baselineRestingHr, activeModal]);

  const cancelEmergencyAlert = async () => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    soundService.stopEmergencySiren();
    soundService.playSafeChime();
    nativeFallDetection.stopAlarm();
    sosInProgressRef.current = false;

    // Record cancellation to backend if authenticated
    if (apiClient.getToken()) {
      try {
        const gpsData = await requestBrowserGeolocation();
        await apiClient.sos.cancel({
          lat: gpsData?.lat || undefined,
          lon: gpsData?.lon || undefined,
          location_accuracy: gpsData?.accuracy || undefined,
          location_timestamp: gpsData?.timestamp || undefined,
        });
      } catch (err) {
        console.warn("Failed to record SOS cancellation:", err);
      }
    }

    setActiveModal("none");
    setSosStatus({
      recorded: true,
      locationObtained: false,
      locationAccuracy: null,
      locationTimestamp: null,
      lat: null,
      lon: null,
      primaryContactStatus: "Not attempted",
      otherContactsStatus: "Not attempted",
      emergencyServiceStatus: "Not attempted",
      locationShared: false,
      message: "SOS cancelled by user. No emergency contacts were notified.",
      cancelled: true,
      contactsAttempted: 0,
      sosEventId: null,
      dispatchTarget: "Cancelled",
      dispatchTargetNumber: "",
      callStatus: "Cancelled by user",
    });
    setActiveModal("sos_status");
    showToast("SOS cancelled. You are safe.", "info");
  };

  const dispatchEmergencySos = async () => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    soundService.stopEmergencySiren();
    setActiveModal("none");

    // Use pre-acquired GPS data from countdown, or try to get it now
    const gpsData = sosGpsData || await requestBrowserGeolocation();

    // Build the emergency message with real or unavailable coordinates
    const userName = user?.full_name || "LifeShield User";
    const emergencyMessage = buildEmergencyMessage(userName, gpsData);

    // Prepare status tracking
    let dispatchTargetName = "Not configured";
    let dispatchTargetNumber = "";
    let callStatus = "Not attempted";
    let locationShared = false;
    let recordedToBackend = false;
    let sosEventId: string | null = null;
    let telephonyLive = false;
    const callResults: Array<{ target: string; number: string; status: string; detail: string }> = [];
    const smsResults: Array<{ target: string; number: string; status: string; detail: string }> = [];

    // Step 1: Determine dispatch targets based on user preferences
    const targetsToCall: Array<{ target: string; number: string; name: string }> = [];

    if (dispatchPrefs.auto_call_police) {
      targetsToCall.push({
        target: "Police",
        number: dispatchPrefs.police_number,
        name: `Police (${dispatchPrefs.police_number})`,
      });
    }

    if (dispatchPrefs.auto_call_ambulance) {
      targetsToCall.push({
        target: "Ambulance",
        number: dispatchPrefs.ambulance_number,
        name: `Ambulance (${dispatchPrefs.ambulance_number})`,
      });
    }

    // If neither police nor ambulance enabled, use primary emergency contact
    if (targetsToCall.length === 0) {
      const primaryContact = contacts.find((c) => c.priority === 1) || contacts[0];
      if (primaryContact) {
        targetsToCall.push({
          target: "PrimaryContact",
          number: primaryContact.phone,
          name: primaryContact.name,
        });
        dispatchTargetName = primaryContact.name;
        dispatchTargetNumber = primaryContact.phone;
      }
    } else {
      dispatchTargetName = targetsToCall.map((t) => t.name).join(", ");
      dispatchTargetNumber = targetsToCall.map((t) => t.number).join(", ");
    }

    // Step 2: Save SOS event to backend if authenticated
    if (apiClient.getToken()) {
      try {
        const result = await apiClient.sos.trigger({
          lat: gpsData?.lat || undefined,
          lon: gpsData?.lon || undefined,
          location_accuracy: gpsData?.accuracy || undefined,
          location_timestamp: gpsData?.timestamp || undefined,
          risk_tier: "Emergency",
          risk_score: 95,
          emergency_message: emergencyMessage,
        });

        recordedToBackend = true;
        sosEventId = result.id || null;
        telephonyLive = Boolean(result.telephony_live);

        if (gpsData) {
          locationShared = true;
        }
      } catch (err: any) {
        console.error("SOS backend record error:", err);
        recordedToBackend = false;
      }
    }

    // Step 3: Place automatic calls using native Android plugin or show web limitation
    if (targetsToCall.length > 0) {
      // Deduplicate: only call each unique number once
      const uniqueNumbers = new Set<string>();

      for (const target of targetsToCall) {
        if (uniqueNumbers.has(target.number)) continue;
        uniqueNumbers.add(target.number);

        const result = await EmergencyCallService.callNumber(target.number);

        callResults.push({
          target: target.target,
          number: target.number,
          status: result.success ? "Call initiated" : "Call failed",
          detail: result.message,
        });

        if (result.success) {
          callStatus = "Call initiated";
        } else if (result.requiresPermission) {
          callStatus = "Permission required";
        } else if (result.platform === "web") {
          callStatus = "Android app required for auto-calling";
        } else {
          callStatus = "Call failed: " + result.message;
        }

        // Small delay between sequential calls to avoid overwhelming the phone
        if (targetsToCall.indexOf(target) < targetsToCall.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }
    } else {
      callStatus = "No dispatch target configured";
    }

    // Step 3b: Send emergency SMS using native Android plugin (independent of calls)
    if (targetsToCall.length > 0) {
      const uniqueNumbersSms = new Set<string>();

      for (const target of targetsToCall) {
        if (uniqueNumbersSms.has(target.number)) continue;
        uniqueNumbersSms.add(target.number);

        const smsResult = await emergencySmsService.sendSms(target.number, emergencyMessage);

        smsResults.push({
          target: target.target,
          number: target.number,
          status: smsResult.success ? "SMS sent" : "SMS failed",
          detail: smsResult.message || (smsResult.error || "Unknown error"),
        });
      }
    }

    // Step 4: Build and show SOS status
    const primaryContact = contacts.find((c) => c.priority === 1) || contacts[0];
    const primaryContactStatus = callResults.find((r) => r.target === "PrimaryContact")
      ? `${callResults.find((r) => r.target === "PrimaryContact")!.status}: ${callResults.find((r) => r.target === "PrimaryContact")!.detail}`
      : targetsToCall.some((t) => t.target === "PrimaryContact")
        ? "No primary contact configured"
        : "Not selected (Police/Ambulance enabled)";

    const policeStatus = callResults.find((r) => r.target === "Police")
      ? `${callResults.find((r) => r.target === "Police")!.status}: ${callResults.find((r) => r.target === "Police")!.detail}`
      : dispatchPrefs.auto_call_police
        ? "Not attempted"
        : "Not enabled by user";

    const ambulanceStatus = callResults.find((r) => r.target === "Ambulance")
      ? `${callResults.find((r) => r.target === "Ambulance")!.status}: ${callResults.find((r) => r.target === "Ambulance")!.detail}`
      : dispatchPrefs.auto_call_ambulance
        ? "Not attempted"
        : "Not enabled by user";

    const statusMessage = recordedToBackend
      ? (gpsData
        ? "Emergency SOS recorded with GPS location. Check dispatch status below."
        : "Emergency SOS recorded. Location was unavailable.")
      : "Emergency SOS processed locally. Backend not available or not authenticated.";

    // Build SMS status summary
    const primaryContactSmsStatus = smsResults.find((r) => r.target === "PrimaryContact")
      ? `${smsResults.find((r) => r.target === "PrimaryContact")!.status}: ${smsResults.find((r) => r.target === "PrimaryContact")!.detail}`
      : targetsToCall.some((t) => t.target === "PrimaryContact")
        ? "SMS not sent"
        : "Not selected (Police/Ambulance enabled)";

    const policeSmsStatus = smsResults.find((r) => r.target === "Police")
      ? `${smsResults.find((r) => r.target === "Police")!.status}: ${smsResults.find((r) => r.target === "Police")!.detail}`
      : dispatchPrefs.auto_call_police
        ? "SMS not sent"
        : "Not enabled by user";

    const ambulanceSmsStatus = smsResults.find((r) => r.target === "Ambulance")
      ? `${smsResults.find((r) => r.target === "Ambulance")!.status}: ${smsResults.find((r) => r.target === "Ambulance")!.detail}`
      : dispatchPrefs.auto_call_ambulance
        ? "SMS not sent"
        : "Not enabled by user";

    const overallSmsStatus = smsResults.length > 0
      ? smsResults.map((r) => `${r.target}: ${r.status}`).join("; ")
      : "No SMS targets";

    setSosStatus({
      recorded: recordedToBackend,
      locationObtained: !!gpsData,
      locationAccuracy: gpsData?.accuracy || null,
      locationTimestamp: gpsData?.timestamp || null,
      lat: gpsData?.lat || null,
      lon: gpsData?.lon || null,
      primaryContactStatus,
      otherContactsStatus: callResults.length > 1
        ? callResults.slice(1).map((r) => `${r.target}: ${r.status}`).join("; ")
        : "No other targets",
      emergencyServiceStatus: `${policeStatus} | ${ambulanceStatus}`,
      locationShared,
      message: statusMessage,
      cancelled: false,
      contactsAttempted: callResults.length,
      sosEventId,
      dispatchTarget: dispatchTargetName,
      dispatchTargetNumber,
      callStatus,
      callResults,
      smsResults,
      smsStatus: overallSmsStatus,
      telephonyLive,
    });

    sosInProgressRef.current = false;
    setActiveModal("sos_status");
  };

  // -------------------------------------------------------------
  // REAL BLUETOOTH WEARABLE PAIRING
  // -------------------------------------------------------------
  const handlePairSmartwatch = async () => {
    setIsScanningBle(true);
    try {
      const status = await bluetoothService.connect(
        (vitals) => {
          const hasValidHR = typeof vitals.heartRate === 'number' && vitals.heartRate > 0 && vitals.heartRate < 300;
          const hasValidSpO2 = typeof vitals.spO2 === 'number' && vitals.spO2 > 0 && vitals.spO2 <= 100;
          const hasValidTemp = typeof vitals.temperature === 'number' && vitals.temperature > 30 && vitals.temperature < 45;

          setHealth((prev) => ({
            ...prev,
            heart_rate: hasValidHR ? vitals.heartRate! : prev.heart_rate,
            spo2: hasValidSpO2 ? vitals.spO2! : prev.spo2,
            temperature: hasValidTemp ? vitals.temperature! : prev.temperature,
            source: "Bluetooth GATT",
            timestamp: new Date().toISOString(),
          }));

          setDataSource("real");
          setIsBleLive(true);
          setLastSyncTime(new Date().toLocaleTimeString());

          console.log("[LifeShield Health] Bluetooth real-time vitals received:", {
            heartRate: vitals.heartRate,
            spO2: vitals.spO2,
            temperature: vitals.temperature,
          });

          // Commit reading to database
          apiClient.health
            .ingestReading({
              heart_rate: hasValidHR ? vitals.heartRate : undefined,
              spo2: hasValidSpO2 ? vitals.spO2 : undefined,
              body_temperature: hasValidTemp ? vitals.temperature : undefined,
              source: "Bluetooth GATT",
            })
            .catch(() => { });
        },
        () => {
          setBleStatus({ isConnected: false });
          setIsBleLive(false);
          showToast("Bluetooth Smartwatch disconnected.", "warning");
        }
      );

      setIsScanningBle(false);
      setBleStatus(status);
      if (status.isConnected) {
        setIsBleLive(true);
        setLastSyncTime(new Date().toLocaleTimeString());
        showToast(`Connected to ${status.deviceName || "BLE Health Device"}`, "success");
      } else if (status.errorMessage) {
        showToast(status.errorMessage, "warning");
      }
    } catch (err: any) {
      setIsScanningBle(false);
      showToast("Bluetooth pairing cancelled or failed: " + err.message, "warning");
    }
  };

  const handleDisconnectSmartwatch = async () => {
    try {
      await bluetoothService.disconnect();
    } catch { /* ignore */ }
    setBleStatus({ isConnected: false });
    setIsBleLive(false);
    showToast("Bluetooth Smartwatch disconnected.", "info");
    loadData();
  };

  // -------------------------------------------------------------
  // REAL ANDROID HEALTH CONNECT SYNC
  // -------------------------------------------------------------
  const handleHealthConnectSync = async () => {
    setIsSyncingHealthConnect(true);
    setHealthConnectStatus("Querying Health Connect records...");

    try {
      const syncResult = await HealthConnectService.syncRealData();

      if (syncResult.metrics) {
        setHealthConnectMetrics(syncResult.metrics);
      }

      if (syncResult.success) {
        const syncTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setLastSyncTime(syncTimeStr);

        if (syncResult.hasData && syncResult.data) {
          const hr = syncResult.data.heart_rate;
          const spo2 = syncResult.data.spo2;
          const steps = syncResult.data.steps;
          const temp = syncResult.data.temperature;
          const sleep = syncResult.data.sleep;

          const hasValidHR = typeof hr === 'number' && hr > 0 && hr < 300;
          const hasValidSpO2 = typeof spo2 === 'number' && spo2 > 0 && spo2 <= 100;
          const hasValidSteps = typeof steps === 'number' && steps >= 0;
          const hasValidTemp = typeof temp === 'number' && temp > 30 && temp < 45;
          const hasValidSleep = typeof sleep === 'number' && sleep >= 0;

          let updatedMetricsCount = 0;
          if (hasValidHR) updatedMetricsCount++;
          if (hasValidSpO2) updatedMetricsCount++;
          if (hasValidSteps) updatedMetricsCount++;
          if (hasValidSleep) updatedMetricsCount++;
          if (hasValidTemp) updatedMetricsCount++;

          setHealth({
            heart_rate: hasValidHR ? hr : null,
            spo2: hasValidSpO2 ? spo2 : null,
            steps: hasValidSteps ? steps : null,
            sleep: hasValidSleep ? sleep : null,
            temperature: hasValidTemp ? temp : null,
            hydration: 68,
            systolic_bp: null,
            diastolic_bp: null,
            source: formatHumanSourceLabel((syncResult as any).source),
            timestamp: new Date().toISOString(),
          });

          setDataSource("real");
          setHealthConnectStatus("Connected — Real Data");

          // Ingest into backend database
          await apiClient.health.ingestReading({
            heart_rate: hasValidHR ? hr : undefined,
            spo2: hasValidSpO2 ? spo2 : undefined,
            steps: hasValidSteps ? steps : undefined,
            sleep_hours: hasValidSleep ? sleep : undefined,
            body_temperature: hasValidTemp ? temp : undefined,
            source: "Android Health Connect",
          }).catch(() => {});

          showToast(`Health Connect Synced: ${updatedMetricsCount} health metrics updated (Last synced: ${syncTimeStr})`, "success");
        } else {
          // STATE 2: Connected, but no usable health records
          setDataSource("unavailable");
          setHealth({
            heart_rate: null,
            spo2: null,
            steps: null,
            sleep: null,
            temperature: null,
            hydration: null,
            systolic_bp: null,
            diastolic_bp: null,
            source: "Health Connect",
            timestamp: null,
          });
          const emptyMsg = "Connected — No Data: Device connected, but no current health data is available in Health Connect.";
          setHealthConnectStatus("Connected — No Data");
          showToast(emptyMsg, "info");
        }
      } else {
        const isPerm = syncResult.message?.toLowerCase().includes("permission");
        setHealthConnectStatus(isPerm ? "Permission Required" : formatHealthConnectStatus(syncResult.message));
        showToast(syncResult.message, "warning");
      }
    } catch (err: any) {
      const msg = "Health Connect sync error: " + (err.message || String(err));
      setHealthConnectStatus(msg);
      showToast(msg, "warning");
    } finally {
      setIsSyncingHealthConnect(false);
    }
  };

  // -------------------------------------------------------------
  // REAL HYDRATION TRACKING & LOGGING
  // -------------------------------------------------------------
  const handleLogHydration = async () => {
    const currentHydration = health.hydration || 40;
    const newHydration = Math.min(100, currentHydration + 10);

    setHealth((prev) => ({
      ...prev,
      hydration: newHydration,
    }));

    try {
      await apiClient.health.ingestReading({
        hydration_index: newHydration,
        source: "Manual Hydration Log",
      });
      voiceTtsService.speakRaw("Hydration confirmed. 250 milliliters added to daily baseline.", voiceSettings.language);
      showToast("+250ml water recorded for today's fluid baseline.", "success");
    } catch (e: any) {
      showToast("Could not sync hydration reading: " + e.message, "warning");
    }
  };

  // -------------------------------------------------------------
  // MANUAL VITALS LOGGING
  // -------------------------------------------------------------
  const handleManualVitalsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualLogging(true);

    const payload: any = {
      source: "Manual Log",
    };
    if (manualHr) payload.heart_rate = Number(manualHr);
    if (manualSpo2) payload.spo2 = Number(manualSpo2);
    if (manualBpSys) payload.systolic_bp = Number(manualBpSys);
    if (manualBpDia) payload.diastolic_bp = Number(manualBpDia);
    if (manualTemp) payload.body_temperature = Number(manualTemp);
    if (manualSteps) payload.steps = Number(manualSteps);

    if (!apiClient.getToken()) {
      showToast("Please sign in first to log vitals to the database.", "warning");
      setActiveModal("auth");
      setManualLogging(false);
      return;
    }

    try {
      await apiClient.health.ingestReading(payload);
      await loadData();
      setActiveModal("none");
      setManualHr("");
      setManualSpo2("");
      setManualBpSys("");
      setManualBpDia("");
      setManualTemp("");
      setManualSteps("");
      showToast("Manual vitals recorded and verified in database.", "success");
    } catch (err: any) {
      showToast("Error logging vitals: " + err.message, "warning");
    } finally {
      setManualLogging(false);
    }
  };

  // -------------------------------------------------------------
  // REMINDERS ACTIONS & VOICE TTS
  // -------------------------------------------------------------
  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReminderTitle.trim()) return;

    if (!apiClient.getToken()) {
      showToast("Please sign in first to save reminders. Tap the avatar icon in the top right.", "warning");
      setActiveModal("auth");
      return;
    }

    try {
      const created = await apiClient.reminders.create({
        title: newReminderTitle.trim(),
        time: newReminderTime,
        reminder_type: newReminderType,
        dosage: newReminderDosage.trim() || undefined,
        repeat: "Daily",
      });

      setReminders((prev) => [
        ...prev,
        {
          id: created.id || `rem-${Date.now()}`,
          title: created.title,
          reminder_type: created.reminder_type || "Medicine",
          time: created.time,
          dosage: created.dosage,
          repeat: "Daily",
          voice_enabled: true,
          is_active: true,
        },
      ]);

      setNewReminderTitle("");
      setNewReminderDosage("");
      showToast(`Scheduled: ${created.title} at ${created.time}`, "success");
    } catch (err: any) {
      showToast("Could not save reminder: " + err.message, "warning");
    }
  };

  const handleSpeakReminder = (item: ReminderItem) => {
    voiceTtsService.unlock();
    voiceTtsService.speakReminder({
      title: item.title,
      dosage: item.dosage,
      reminderType: item.reminder_type,
      force: true,
    });
  };

  const handleLogReminderAction = async (id: string, action: "Taken" | "Skipped") => {
    const rem = reminders.find((r) => r.id === id);
    if (!rem) return;

    try {
      await apiClient.reminders.logAction(id, {
        medicine_name: rem.title,
        scheduled_time: rem.time,
        action,
      });
      showToast(`Recorded: ${rem.title} marked as ${action}`, "success");
    } catch (err: any) {
      showToast("Could not log action: " + err.message, "warning");
    }
  };

  const handleDeleteReminder = async (id: string) => {
    if (apiClient.getToken()) {
      try {
        await apiClient.reminders.delete(id);
      } catch (err: any) {
        console.warn("Backend reminder delete skipped:", err?.message);
      }
    }
    setReminders((prev) => prev.filter((r) => r.id !== id));
    showToast("Reminder removed.", "info");
  };

  // -------------------------------------------------------------
  // EMERGENCY CONTACTS ACTIONS
  // -------------------------------------------------------------
  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName.trim() || !newContactPhone.trim()) return;

    if (!apiClient.getToken()) {
      showToast("Please sign in first to save contacts. Tap the avatar icon in the top right.", "warning");
      setActiveModal("auth");
      return;
    }

    try {
      const created = await apiClient.contacts.create({
        name: newContactName.trim(),
        phone: newContactPhone.trim(),
        relation: newContactRel.trim(),
        priority: newContactPriority,
        auto_notify: true,
      });

      setContacts((prev) => [
        ...prev,
        {
          id: created.id || `cnt-${Date.now()}`,
          name: created.name,
          phone: created.phone,
          relation: created.relation || "Contact",
          priority: created.priority || 1,
          auto_notify: true,
        },
      ]);

      setNewContactName("");
      setNewContactPhone("");
      showToast(`Added emergency contact: ${created.name}`, "success");
    } catch (err: any) {
      showToast("Could not save contact: " + err.message, "warning");
    }
  };

  const handleDeleteContact = async (id: string) => {
    if (apiClient.getToken()) {
      try {
        await apiClient.contacts.delete(id);
      } catch (err) {
        console.warn("Backend contact delete skipped:", err);
      }
    }
    setContacts((prev) => prev.filter((c) => c.id !== id));
    showToast("Contact removed.", "info");
  };

  const handleEditContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContactId || !editContactName.trim() || !editContactPhone.trim()) return;

    if (!apiClient.getToken()) {
      showToast("Please sign in first to edit contacts.", "warning");
      setActiveModal("auth");
      return;
    }

    try {
      await apiClient.contacts.update(editingContactId, {
        name: editContactName.trim(),
        phone: editContactPhone.trim(),
        relation: editContactRel.trim(),
        priority: editContactPriority,
      });

      setContacts((prev) =>
        prev.map((c) =>
          c.id === editingContactId
            ? {
                ...c,
                name: editContactName.trim(),
                phone: editContactPhone.trim(),
                relation: editContactRel.trim(),
                priority: editContactPriority,
              }
            : c
        )
      );

      setEditingContactId(null);
      showToast("Contact updated.", "success");
    } catch (err: any) {
      showToast("Could not update contact: " + err.message, "warning");
    }
  };

  // -------------------------------------------------------------
  // AUTHENTICATION & PROFILE
  // -------------------------------------------------------------
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");

    try {
      if (authMode === "register") {
        const res = await apiClient.auth.register({
          email: authEmail,
          password: authPassword,
          full_name: authFullName,
          age: Number(authAge),
          blood_group: authBloodGroup,
        });
        if (res.access_token) {
          apiClient.setToken(res.access_token);
          setUser(res.user);
          apiClient.setStoredUser(res.user);
          setActiveModal("none");
          loadData();
          showToast(`Welcome, ${res.user.full_name}! Account created.`, "success");
        }
      } else {
        const res = await apiClient.auth.login({
          email: authEmail,
          password: authPassword,
        });
        if (res.access_token) {
          apiClient.setToken(res.access_token);
          setUser(res.user);
          apiClient.setStoredUser(res.user);
          setActiveModal("none");
          loadData();
          showToast(`Welcome back, ${res.user.full_name}!`, "success");
        }
      }
    } catch (err: any) {
      setAuthError(err.message || "Authentication failed. Check your credentials.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    apiClient.clearToken();
    setUser(null);
    setActiveModal("none");
    loadData();
    showToast("Signed out successfully.", "info");
  };

  const handleSaveBaseline = async () => {
    setBaselineSaving(true);
    setBaselineSavedSuccess(false);

    try {
      await apiClient.profile.updateBaseline({
        resting_heart_rate: baselineRestingHr,
        normal_spo2_min: baselineSpo2Floor,
      });
      setBaselineSavedSuccess(true);
      showToast("Personal clinical baseline saved to database.", "success");
      setTimeout(() => setBaselineSavedSuccess(false), 4000);
    } catch (err: any) {
      showToast("Could not save baseline: " + err.message, "warning");
    } finally {
      setBaselineSaving(false);
    }
  };

  // -------------------------------------------------------------
  // AI CONVERSATION ENGINE
  // -------------------------------------------------------------
  const handleSendAiMessage = async (textToSend?: string) => {
    const text = textToSend || chatInput;
    if (!text.trim() || isAiLoading || isAiSendingRef.current) return;
    isAiSendingRef.current = true;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: "user",
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setIsAiLoading(true);

    if (!apiClient.getToken()) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `ai-auth-${Date.now()}`,
          sender: "assistant",
          text: "Please sign in to use the AI Health Assistant. Tap the avatar icon in the top right corner to sign in or register. The AI assistant needs your account to access your health data and provide personalized guidance.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          source: "auth_required",
        },
      ]);
      setIsAiLoading(false);
      isAiSendingRef.current = false;
      setActiveModal("auth");
      return;
    }

    try {
      const response = await apiClient.ai.chat(text.trim(), {
        language: voiceSettings.language,
        dataSource: dataSource,
        vitals: {
          heartRate: health.heart_rate,
          spO2: health.spo2,
          steps: health.steps,
          bodyTemperature: health.temperature,
          sleepHours: health.sleep,
          systolicBp: health.systolic_bp,
          diastolicBp: health.diastolic_bp,
          hydrationIndex: health.hydration,
          isDemo: dataSource === "demo",
          dataSourceStatus:
            dataSource === "real"
              ? "CONNECTED_REAL_DATA"
              : dataSource === "demo"
              ? "DEMO_DATA"
              : dataSource === "unavailable"
              ? "CONNECTED_NO_DATA"
              : "NOT_CONNECTED",
          simulationNote:
            dataSource === "demo"
              ? "These are simulated demo readings for presentation/testing. Not from a real wearable."
              : undefined,
        },
        environment: {
          region: selectedRegion,
          temperature: environment.temperature,
          aqi: environment.aqi,
          heatIndex: environment.heat_index,
          floodRisk: environment.flood_risk_level,
          humidity: environment.humidity,
        },
        reminders: reminders.map((r) => ({
          title: r.title,
          time: r.time,
          dosage: r.dosage,
          type: r.reminder_type,
        })),
      });

      const replyText = response.reply || (response as any).message || (response as any).text || '';

      const assistantMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: "assistant",
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        source: response.source || "gemini",
      };

      setChatMessages((prev) => [...prev, assistantMsg]);

      // Speak AI response if master voice is enabled
      if (voiceSettings.masterVoiceEnabled && replyText) {
        voiceTtsService.speakRaw(replyText, voiceSettings.language);
      }
    } catch (err: any) {
      const is422 = err?.status === 422 || (typeof err?.message === 'string' && (err.message.includes('422') || err.message.includes('Field required') || err.message.includes('json_invalid')));
      const isNetworkFailure = !err?.status || err?.status === 0 || err?.name === 'AbortError' || (typeof err?.message === 'string' && (
        err.message.includes('Failed to fetch') ||
        err.message.includes('NetworkError') ||
        err.message.includes('unreachable') ||
        err.message.includes('aborted')
      ));

      if (is422) {
        console.error('[LifeShield AI] Request validation error (HTTP 422):', err?.message);
        setChatMessages((prev) => [
          ...prev,
          {
            id: `ai-err-${Date.now()}`,
            sender: "assistant",
            text: `Request validation error: ${err.message || 'Invalid request schema'}. Please verify the question parameter format.`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            source: "schema_validation_error",
          },
        ]);
      } else if (isNetworkFailure) {
        setChatMessages((prev) => [
          ...prev,
          {
            id: `ai-err-${Date.now()}`,
            sender: "assistant",
            text: "I am unable to reach the clinical reasoning backend right now. Please verify your connection or consult emergency services directly at 112 / 108.",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            source: "offline_fallback",
          },
        ]);
      } else {
        setChatMessages((prev) => [
          ...prev,
          {
            id: `ai-err-${Date.now()}`,
            sender: "assistant",
            text: `LifeShield AI error: ${err.message || "An unexpected error occurred."}`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            source: "error",
          },
        ]);
      }
    } finally {
      setIsAiLoading(false);
      isAiSendingRef.current = false;
    }
  };

  // -------------------------------------------------------------
  // HELPER FORMATTERS
  // -------------------------------------------------------------
  const display = (value: number | null | undefined, suffix = "") => {
    if (value === null || value === undefined) return "—";
    return `${value}${suffix}`;
  };

  const available = (value: number | null | undefined) => value !== null && value !== undefined;

  // Multi-factor transparent risk score calculation
  const calculateRiskScore = () => {
    if (dataSource === "not_connected") {
      return { score: 0, factors: [] };
    }
    let score = 8; // Baseline healthy score
    let factors: string[] = [];

    // Heart rate: elevated if > resting + 25
    if (health.heart_rate && health.heart_rate > baselineRestingHr + 25) {
      score += 18;
      factors.push("Elevated heart rate");
    }

    // SpO2: critical if < 90, warning if < 95
    if (health.spo2) {
      if (health.spo2 < 90) { score += 30; factors.push("Critically low SpO2"); }
      else if (health.spo2 < baselineSpo2Floor) { score += 15; factors.push("Low SpO2"); }
    }

    // Temperature: elevated if > 38, high fever if > 39.5
    if (health.temperature) {
      if (health.temperature > 39.5) { score += 20; factors.push("High fever"); }
      else if (health.temperature > 38) { score += 10; factors.push("Elevated temperature"); }
    }

    // Sleep: poor if < 5 hours
    if (health.sleep && health.sleep < 5) {
      score += 8;
      factors.push("Insufficient sleep");
    }

    // Blood pressure: elevated if systolic > 140 or diastolic > 90
    if (health.systolic_bp && health.systolic_bp > 140) {
      score += 12;
      factors.push("High systolic BP");
    }
    if (health.diastolic_bp && health.diastolic_bp > 90) {
      score += 10;
      factors.push("High diastolic BP");
    }

    // Environment: AQI
    if (environment.aqi) {
      if (environment.aqi > 300) { score += 25; factors.push("Hazardous AQI"); }
      else if (environment.aqi > 200) { score += 18; factors.push("Very unhealthy AQI"); }
      else if (environment.aqi > 150) { score += 12; factors.push("Unhealthy AQI"); }
      else if (environment.aqi > 100) { score += 6; factors.push("Moderate AQI"); }
    }

    // Environment: Heat index
    if (environment.heat_index) {
      if (environment.heat_index > 45) { score += 20; factors.push("Extreme heat index"); }
      else if (environment.heat_index > 40) { score += 12; factors.push("Very high heat index"); }
      else if (environment.heat_index > 35) { score += 6; factors.push("High heat index"); }
    }

    // Environment: Flood risk
    if (environment.flood_risk_level && environment.flood_risk_level.toLowerCase().includes("high")) {
      score += 10;
      factors.push("High flood risk");
    }

    // Environment: UV index
    if (environment.uv_index && environment.uv_index > 8) {
      score += 5;
      factors.push("Very high UV");
    }

    return { score: Math.min(100, score), factors };
  };

  const riskCalc = calculateRiskScore();
  const currentRiskScore = riskCalc.score;
  const riskFactors = riskCalc.factors;
  const riskTier =
    dataSource === "not_connected"
      ? "Inactive"
      : currentRiskScore >= 70
      ? "Critical"
      : currentRiskScore >= 45
      ? "High"
      : currentRiskScore >= 25
      ? "Moderate"
      : "Low";

  return (
    <div className="lifeshield-app">
      {/* =========================================================
          IN-APP TOAST BANNER
      ========================================================= */}
      {statusToast && (
        <div
          style={{
            position: "fixed",
            top: "84px",
            left: "50%",
            transform: "translateX(-50%)",
            background:
              statusToast.type === "success"
                ? "#268e5e"
                : statusToast.type === "warning"
                  ? "#c53030"
                  : "#6c65b5",
            color: "#ffffff",
            padding: "10px 20px",
            borderRadius: "18px",
            fontSize: "12px",
            fontWeight: 700,
            boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            zIndex: 300,
            maxWidth: "90%",
            textAlign: "center",
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          {statusToast.message}
        </div>
      )}

      {/* In-app Reminder Toast */}
      {reminderToast && (
        <div
          style={{
            position: "fixed",
            top: statusToast ? "124px" : "84px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "linear-gradient(135deg, #7c3aed, #6c63ff)",
            color: "#ffffff",
            padding: "12px 24px",
            borderRadius: "18px",
            fontSize: "13px",
            fontWeight: 700,
            boxShadow: "0 10px 30px rgba(124,58,237,0.4)",
            zIndex: 301,
            maxWidth: "90%",
            textAlign: "center",
            animation: "fadeIn 0.2s ease-out",
            border: "2px solid #a78bfa",
          }}
        >
          {reminderToast}
        </div>
      )}

      {/* Permission Setup Screen (first launch) */}
      {needsPermissionSetup && (
        <PermissionSetupScreen onComplete={() => setNeedsPermissionSetup(false)} />
      )}

      {/* Session Bootstrap Overlay */}
      {isAuthBootstrapping && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(248, 246, 255, 0.96)",
            backdropFilter: "blur(6px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "20px",
              background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: "26px",
              boxShadow: "0 10px 25px rgba(124, 58, 237, 0.35)",
              marginBottom: "20px",
            }}
          >
            ♥
          </div>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              border: "3px solid #e2e8f0",
              borderTopColor: "#7c3aed",
              animation: "spin 0.8s linear infinite",
              marginBottom: "16px",
            }}
          />
          <strong style={{ fontSize: "16px", color: "#1e1b4b", marginBottom: "6px" }}>
            Restoring your LifeShield session...
          </strong>
          <span style={{ fontSize: "12px", color: "#64748b" }}>
            Verifying secure clinical credentials
          </span>
        </div>
      )}

      {/* =========================================================
          TOP APP HEADER
      ========================================================= */}
      <header className="app-header">
        <div className="header-left">
          <div className="lifeshield-logo">
            <span>♥</span>
          </div>
          <div>
            <div className="logo-title">LifeShield</div>
            <div className="logo-subtitle">Clinical Safety • Disaster Resilience • Health AI</div>
          </div>
        </div>

        <div className="header-actions">
          <div
            className={`online-indicator ${backendOnline ? "connected" : ""}`}
            title={
              backendOnline
                ? `Backend Connected at ${apiClient.getBaseUrl()} (Tap to refresh)`
                : `Backend Offline at ${apiClient.getBaseUrl()} (Tap to retry)`
            }
            onClick={() => {
              loadData();
              showToast(backendOnline ? "Backend is connected and healthy." : "Attempting reconnect to backend...", "info");
            }}
            style={{ cursor: "pointer" }}
          />

          <button
            className="round-button"
            type="button"
            onClick={() => setActiveModal("info")}
            aria-label="Medical Disclaimer & System Information"
            title="System Information"
          >
            ♡
          </button>

          <button
            className="avatar-button"
            type="button"
            onClick={() => setActiveModal("auth")}
            aria-label="User Account"
            title={user ? `Signed in as ${user.full_name}` : "Sign In / Register"}
          >
            {user?.full_name ? user.full_name.charAt(0).toUpperCase() : "P"}
          </button>
        </div>
      </header>

      {/* =========================================================
          MAIN PAGE CONTENT
      ========================================================= */}
      <main className="page-container">
        {activeTab === "home" && (
          <HomeScreen
            health={health}
            environment={environment}
            user={user}
            riskScore={currentRiskScore}
            riskTier={riskTier}
            riskFactors={riskFactors}
            reminders={reminders}
            display={display}
            available={available}
            onNavigate={setActiveTab}
            onOpenReminders={() => setActiveModal("reminders")}
            onOpenLogVitals={() => setActiveModal("manual_vitals")}
            onOpenEnvironment={() => setActiveModal("environment")}
            onLogHydration={handleLogHydration}
            dataSource={dataSource}
            lastSyncTime={lastSyncTime}
            selectedRegion={selectedRegion}
            onRegionChange={setSelectedRegion}
            envLoading={envLoading}
            envError={envError}
            isDemoMode={isDemoMode}
            onToggleDemoMode={handleToggleDemoMode}
          />
        )}

        {activeTab === "health" && (
          <HealthScreen
            health={health}
            trends={trends}
            bleStatus={bleStatus}
            healthConnectStatus={healthConnectStatus}
            lastSyncTime={lastSyncTime}
            isRefreshing={isRefreshing}
            display={display}
            available={available}
            onRefresh={loadData}
            onOpenDeviceModal={() => setActiveModal("device")}
            onOpenLogVitals={() => setActiveModal("manual_vitals")}
            dataSource={dataSource}
            isDemoMode={isDemoMode}
            onToggleDemoMode={handleToggleDemoMode}
          />
        )}

        {activeTab === "safety" && (
          <SafetyScreen
            contacts={contacts}
            currentLocation={currentLocation}
            fallDetectionActive={fallDetectionActive}
            onToggleFallDetection={() => {
              const next = !fallDetectionActive;
              setFallDetectionActive(next);
              try { localStorage.setItem("lifeshield_fall_detection_active", String(next)); } catch {}
              // Start/stop native foreground service for background fall detection
              if (next) {
                nativeFallDetection.start().then((started) => {
                  if (started) {
                    showToast("Fall detection activated — monitoring continues in background.", "success");
                  } else {
                    showToast("Hardware fall detection activated (foreground only).", "info");
                  }
                });
              } else {
                nativeFallDetection.stop();
                showToast("Hardware fall detection paused.", "info");
              }
            }}
            onStartSos={startSosCountdown}
            onTestFall={triggerFallSirenModal}
            onOpenContacts={() => setActiveModal("contacts")}
            onOpenMap={() => setActiveModal("map")}
            onRefreshLocation={() => {
              LocationService.getCurrentLocation()
                .then((loc) => {
                  setCurrentLocation(loc);
                  showToast(`GPS fix updated: ${loc.formattedAddress}`, "success");
                })
                .catch((e) => showToast("GPS error: " + e.message, "warning"));
            }}
          />
        )}

        {activeTab === "ai" && (
          <AIScreen
            messages={chatMessages}
            input={chatInput}
            setInput={setChatInput}
            isLoading={isAiLoading}
            voiceSettings={voiceSettings}
            onSendMessage={handleSendAiMessage}
            onToggleVoice={() => {
              const updated = { ...voiceSettings, masterVoiceEnabled: !voiceSettings.masterVoiceEnabled };
              setVoiceSettings(updated);
              voiceTtsService.saveSettings(updated);
              showToast(`Master Voice output ${updated.masterVoiceEnabled ? "enabled" : "muted"}.`, "info");
            }}
            onToast={showToast}
          />
        )}

        {activeTab === "profile" && (
          <ProfileScreen
            user={user}
            baselineRestingHr={baselineRestingHr}
            baselineSpo2Floor={baselineSpo2Floor}
            baselineSaving={baselineSaving}
            baselineSavedSuccess={baselineSavedSuccess}
            onSetBaselineHr={setBaselineRestingHr}
            onSetBaselineSpo2={setBaselineSpo2Floor}
            onSaveBaseline={handleSaveBaseline}
            onOpenAuth={() => setActiveModal("auth")}
            onOpenPermissions={() => setActiveModal("permissions")}
            onOpenReminders={() => setActiveModal("reminders")}
            onOpenDeviceModal={() => setActiveModal("device")}
            onOpenEmergencySettings={() => setActiveModal("emergency_settings")}
            onLogout={handleLogout}
            onExportRecords={() => {
              const data = StorageService.exportAllUserData();
              const blob = new Blob([data], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "lifeshield_health_records.json";
              a.click();
              showToast("Health records exported as JSON.", "success");
            }}
            onClearCache={() => {
              if (window.confirm("Erase locally cached offline records? This cannot be undone.")) {
                StorageService.clearAllData();
                showToast("Local data cache wiped.", "info");
              }
            }}
            isDemoMode={isDemoMode}
            onToggleDemoMode={handleToggleDemoMode}
          />
        )}

        {activeTab === "wearables" && (
          <div className="p-4 md:p-6">
            <WearablesView
              bleStatus={bleStatus}
              healthConnectStatus={healthConnectStatus}
              healthConnectMetrics={healthConnectMetrics}
              isScanningBle={isScanningBle}
              isSyncingHealthConnect={isSyncingHealthConnect}
              lastSyncTime={lastSyncTime}
              onPairBluetooth={handlePairSmartwatch}
              onSyncHealthConnect={handleHealthConnectSync}
              onDisconnectBluetooth={handleDisconnectSmartwatch}
              environment={environment}
              health={health}
              dataSource={dataSource}
              isDemoMode={isDemoMode}
              onToggleDemoMode={handleToggleDemoMode}
            />
          </div>
        )}
      </main>

      {/* =========================================================
          BOTTOM NAVIGATION BAR
      ========================================================= */}
      <nav className="bottom-navigation">
        <NavButton icon="⌂" label="Home" active={activeTab === "home"} onClick={() => setActiveTab("home")} />
        <NavButton icon="♡" label="Health" active={activeTab === "health"} onClick={() => setActiveTab("health")} />
        <NavButton icon="✦" label="Safety" active={activeTab === "safety"} onClick={() => setActiveTab("safety")} />
        <NavButton icon="✧" label="AI" active={activeTab === "ai"} onClick={() => setActiveTab("ai")} />
        <NavButton icon="○" label="Profile" active={activeTab === "profile"} onClick={() => setActiveTab("profile")} />
      </nav>

      {/* =========================================================
          INTERACTIVE MODALS
      ========================================================= */}

      {/* 1. INFO & MEDICAL DISCLAIMER MODAL */}
      {activeModal === "info" && (
        <div className="ls-modal-overlay" onClick={() => setActiveModal("none")}>
          <div className="ls-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="ls-modal-header">
              <h3>LifeShield Mission & Disclaimers</h3>
              <button className="ls-close-btn" onClick={() => setActiveModal("none")}>
                ✕
              </button>
            </div>
            <div style={{ textAlign: "left", fontSize: "12px", color: "#4f4a64", lineHeight: "1.7" }}>
              <div
                style={{
                  background: "#feebee",
                  padding: "12px 16px",
                  borderRadius: "16px",
                  color: "#992330",
                  fontWeight: 700,
                  marginBottom: "14px",
                }}
              >
                ⚠️ IMPORTANT MEDICAL NOTICE:
                <br />
                LifeShield is a personal health tracking, environmental awareness, and emergency notification system.
                It is NOT a certified medical device and does NOT provide clinical diagnoses, treatments, or prescriptions.
              </div>
              <p>
                <strong>Zero Mock Readings Guarantee:</strong> LifeShield never invents or synthesizes fake health
                values. When an external Bluetooth monitor or Health Connect is not providing telemetry, metrics remain
                clearly displayed as "Not available from connected device".
              </p>
              <p>
                <strong>Disaster Safety Integration:</strong> Real-time atmospheric metrics and hazardous pollution
                alerts are queried directly from the Open-Meteo meteorological API for your active location.
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "18px" }}>
                <button className="ls-btn-primary" onClick={() => setActiveModal("none")}>
                  Understood
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. AUTHENTICATION / ACCOUNT MODAL */}
      {activeModal === "auth" && (
        <div className="ls-modal-overlay" onClick={() => setActiveModal("none")}>
          <div className="ls-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="ls-modal-header">
              <h3>{user ? "Your LifeShield Account" : authMode === "login" ? "Sign In to LifeShield" : "Create Account"}</h3>
              <button className="ls-close-btn" onClick={() => setActiveModal("none")}>
                ✕
              </button>
            </div>

            {user ? (
              <div style={{ textAlign: "left", fontSize: "13px" }}>
                <div
                  style={{
                    background: "#eeecff",
                    padding: "16px",
                    borderRadius: "18px",
                    marginBottom: "15px",
                  }}
                >
                  <strong style={{ fontSize: "16px", color: "#352e64" }}>{user.full_name}</strong>
                  <div style={{ color: "#7770bd", fontSize: "12px", marginTop: "3px" }}>{user.email}</div>
                  <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                    <span className="ls-badge ls-badge-info">Blood Group: {user.blood_group || "O+"}</span>
                    <span className="ls-badge ls-badge-info">Age: {user.age || 35}</span>
                  </div>
                </div>
                <button className="ls-btn-danger" style={{ width: "100%" }} onClick={handleLogout}>
                  Sign Out of Device
                </button>
              </div>
            ) : (
              <form onSubmit={handleAuthSubmit}>
                {authError && (
                  <div
                    style={{
                      background: "#feebee",
                      color: "#c53030",
                      padding: "10px 14px",
                      borderRadius: "12px",
                      fontSize: "12px",
                      marginBottom: "12px",
                    }}
                  >
                    {authError}
                  </div>
                )}

                {authMode === "register" && (
                  <>
                    <div className="ls-form-group">
                      <label className="ls-label">Full Name</label>
                      <input
                        className="ls-input"
                        required
                        value={authFullName}
                        onChange={(e) => setAuthFullName(e.target.value)}
                        placeholder="e.g. Dr. Ramesh Kumar"
                      />
                    </div>
                    <div style={{ display: "flex", gap: "12px" }}>
                      <div className="ls-form-group" style={{ flex: 1 }}>
                        <label className="ls-label">Age</label>
                        <input
                          className="ls-input"
                          type="number"
                          value={authAge}
                          onChange={(e) => setAuthAge(Number(e.target.value))}
                        />
                      </div>
                      <div className="ls-form-group" style={{ flex: 1 }}>
                        <label className="ls-label">Blood Group</label>
                        <select
                          className="ls-select"
                          value={authBloodGroup}
                          onChange={(e) => setAuthBloodGroup(e.target.value)}
                        >
                          {["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"].map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </>
                )}

                <div className="ls-form-group">
                  <label className="ls-label">Email Address</label>
                  <input
                    className="ls-input"
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="user@example.com"
                  />
                </div>

                <div className="ls-form-group">
                  <label className="ls-label">Password</label>
                  <input
                    className="ls-input"
                    type="password"
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>

                <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                  <button
                    type="button"
                    className="ls-btn-secondary"
                    onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
                  >
                    {authMode === "login" ? "Need an account? Register" : "Already registered? Log in"}
                  </button>
                  <button type="submit" className="ls-btn-primary" style={{ flex: 1 }} disabled={authLoading}>
                    {authLoading ? "Authenticating..." : authMode === "login" ? "Sign In" : "Register"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 3. MEDICINE & WELLNESS REMINDERS MODAL */}
      {activeModal === "reminders" && (
        <div className="ls-modal-overlay" onClick={() => setActiveModal("none")}>
          <div className="ls-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="ls-modal-header">
              <h3>Reminders & Medicine Schedules</h3>
              <button className="ls-close-btn" onClick={() => setActiveModal("none")}>
                ✕
              </button>
            </div>

            {/* Voice & Notification Controls */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px", alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: "11px", color: "#6a6486", fontWeight: 600 }}>Voice: {voiceSettings.masterVoiceEnabled ? "ON" : "OFF"}</span>
              <span style={{ fontSize: "11px", color: notifPermission === "granted" ? "#38a169" : notifPermission === "denied" ? "#e53e3e" : "#d69e2e", fontWeight: 600 }}>
                Notifications: {notifPermission === "granted" ? "Enabled" : notifPermission === "denied" ? "Permission Required" : notifPermission === "unsupported" ? "Unsupported" : "Not Enabled"}
              </span>
              <button
                type="button"
                className="ls-btn-secondary"
                style={{ padding: "5px 10px", fontSize: "11px" }}
                onClick={() => {
                  const updated = { ...voiceSettings, masterVoiceEnabled: !voiceSettings.masterVoiceEnabled };
                  setVoiceSettings(updated);
                  voiceTtsService.saveSettings(updated);
                }}
              >
                {voiceSettings.masterVoiceEnabled ? "Mute Voice" : "Enable Voice"}
              </button>
              <button
                type="button"
                className="ls-btn-secondary"
                style={{ padding: "5px 10px", fontSize: "11px" }}
                onClick={async () => {
                  voiceTtsService.unlock();
                  await voiceTtsService.speakRaw("LifeShield reminder test. Your reminder voice is working.", "en");
                }}
              >
                Test Voice
              </button>
              <button
                type="button"
                className="ls-btn-secondary"
                style={{ padding: "5px 10px", fontSize: "11px", background: notifPermission === "granted" ? "#c6f6d5" : "#fefcbf" }}
                onClick={async () => {
                  if (androidNotificationService.isNativeAndroid()) {
                    const result = await androidNotificationService.requestPermission();
                    setNotifPermission(result);
                    if (result === "granted") {
                      showToast("Android notifications enabled!", "success");
                    } else {
                      showToast("Notification permission denied. Enable in Android Settings > Apps > LifeShield > Notifications.", "warning");
                    }
                  } else {
                    const result = await voiceTtsService.requestNotificationPermission();
                    setNotifPermission(result);
                    if (result === "denied") {
                      showToast("Browser notifications are blocked. You can still use LifeShield voice reminders.", "warning");
                    } else if (result === "granted") {
                      showToast("Notifications enabled!", "success");
                    }
                  }
                }}
              >
                {notifPermission === "granted" ? "Notifications Enabled" : "Enable Notifications"}
              </button>
            </div>

            {/* Scheduler Diagnostics */}
            <div style={{ background: "#f0f0ff", borderRadius: "12px", padding: "10px 14px", marginBottom: "12px", fontSize: "11px" }}>
              <div style={{ fontWeight: 700, color: "#6c65b5", marginBottom: "4px", fontSize: "12px" }}>Scheduler Diagnostics</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
                <span style={{ color: "#555" }}>Scheduler:</span>
                <span style={{ fontWeight: 600, color: schedulerActive ? "#38a169" : "#e53e3e" }}>{schedulerActive ? "ACTIVE" : "INACTIVE"}</span>
                <span style={{ color: "#555" }}>Current browser time:</span>
                <span style={{ fontWeight: 600, fontFamily: "monospace" }}>{browserTime}</span>
                <span style={{ color: "#555" }}>Next reminder:</span>
                <span style={{ fontWeight: 600 }}>{schedulerNextReminder}</span>
              </div>
            </div>

            {/* Test Reminder Now */}
            <div style={{ marginBottom: "12px" }}>
              <button
                type="button"
                className="ls-btn-primary"
                style={{ width: "100%", padding: "8px", fontSize: "12px", background: "linear-gradient(135deg, #7c3aed, #6c63ff)" }}
                onClick={() => {
                  reminderScheduler.triggerTestReminder("Test Medicine", "1 Tablet after food", "Medicine");
                  setReminderToast("Test reminder triggered! Check notification and voice.");
                  setTimeout(() => setReminderToast(null), 8000);
                }}
              >
                Test Reminder Now
              </button>
            </div>

            {/* List */}
            <div style={{ maxHeight: "220px", overflowY: "auto", marginBottom: "18px" }}>
              {reminders.length === 0 ? (
                <div style={{ textAlign: "center", color: "#8d87a4", padding: "20px", fontSize: "12px" }}>
                  No active reminders scheduled. Add your first medicine or hydration reminder below.
                </div>
              ) : (
                reminders.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      background: "#f9f8fe",
                      border: "1px solid #eeeaf7",
                      borderRadius: "16px",
                      padding: "12px 14px",
                      marginBottom: "9px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ textAlign: "left" }}>
                      <strong style={{ color: "#36324d", fontSize: "13px" }}>{r.title}</strong>
                      <div style={{ fontSize: "11px", color: "#7771bd", marginTop: "2px" }}>
                        ⏰ {r.time} • {r.dosage || r.reminder_type}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        className="ls-btn-secondary"
                        style={{ padding: "6px 10px", fontSize: "11px" }}
                        onClick={() => handleSpeakReminder(r)}
                        title="Speak reminder aloud"
                      >
                        🔊
                      </button>
                      <button
                        className="ls-btn-primary"
                        style={{ padding: "6px 12px", fontSize: "11px" }}
                        onClick={() => handleLogReminderAction(r.id, "Taken")}
                      >
                        ✓ Taken
                      </button>
                      <button
                        className="ls-btn-secondary"
                        style={{ padding: "6px 10px", fontSize: "11px" }}
                        onClick={() => handleLogReminderAction(r.id, "Skipped")}
                      >
                        Skip
                      </button>
                      <button
                        type="button"
                        style={{
                          background: "#fee2e2",
                          color: "#dc2626",
                          border: "1px solid #fecaca",
                          borderRadius: "8px",
                          padding: "6px 8px",
                          fontSize: "11px",
                          cursor: "pointer",
                        }}
                        onClick={() => handleDeleteReminder(r.id)}
                        title="Delete reminder"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Form */}
            <form onSubmit={handleAddReminder} style={{ borderTop: "1px solid #f0edf7", paddingTop: "14px" }}>
              <div style={{ fontSize: "12px", fontWeight: 800, color: "#6c65b5", marginBottom: "10px", textAlign: "left" }}>
                Add New Schedule
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <div className="ls-form-group" style={{ flex: 2 }}>
                  <label className="ls-label">Title / Medicine</label>
                  <input
                    className="ls-input"
                    required
                    value={newReminderTitle}
                    onChange={(e) => setNewReminderTitle(e.target.value)}
                    placeholder="e.g. Metformin 500mg"
                  />
                </div>
                <div className="ls-form-group" style={{ flex: 1 }}>
                  <label className="ls-label">Time</label>
                  <input
                    className="ls-input"
                    type="time"
                    required
                    value={newReminderTime}
                    onChange={(e) => setNewReminderTime(e.target.value)}
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <div className="ls-form-group" style={{ flex: 1 }}>
                  <label className="ls-label">Category</label>
                  <select
                    className="ls-select"
                    value={newReminderType}
                    onChange={(e) => setNewReminderType(e.target.value)}
                  >
                    <option value="Medicine">Medicine</option>
                    <option value="Water">Hydration</option>
                    <option value="Meal">Meal</option>
                    <option value="Wellness">Wellness</option>
                  </select>
                </div>
                <div className="ls-form-group" style={{ flex: 1 }}>
                  <label className="ls-label">Dosage / Details</label>
                  <input
                    className="ls-input"
                    value={newReminderDosage}
                    onChange={(e) => setNewReminderDosage(e.target.value)}
                    placeholder="e.g. 1 Tablet after food"
                  />
                </div>
              </div>
              <button type="submit" className="ls-btn-primary" style={{ width: "100%", marginTop: "6px" }}>
                Schedule Reminder
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 4. EMERGENCY CONTACTS MODAL */}
      {activeModal === "contacts" && (
        <div className="ls-modal-overlay" onClick={() => setActiveModal("none")}>
          <div className="ls-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="ls-modal-header">
              <h3>Emergency Contacts Directory</h3>
              <button className="ls-close-btn" onClick={() => setActiveModal("none")}>
                ✕
              </button>
            </div>

            <div style={{ maxHeight: "220px", overflowY: "auto", marginBottom: "18px" }}>
              {contacts.length === 0 ? (
                <div style={{ textAlign: "center", color: "#8d87a4", padding: "20px", fontSize: "12px" }}>
                  No emergency contacts configured yet. Add trusted family, doctors, or caregivers below.
                </div>
              ) : (
                contacts.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      background: "#f9f8fe",
                      border: "1px solid #eeeaf7",
                      borderRadius: "16px",
                      padding: "12px 14px",
                      marginBottom: "9px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ textAlign: "left" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <strong style={{ color: "#36324d", fontSize: "13px" }}>{c.name}</strong>
                        <span className="ls-badge ls-badge-info">P{c.priority}</span>
                      </div>
                      <div style={{ fontSize: "11px", color: "#7771bd", marginTop: "2px" }}>
                        {c.phone} • {c.relation}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <a
                        href={`tel:${c.phone}`}
                        className="ls-btn-primary"
                        style={{ textDecoration: "none", padding: "6px 12px", fontSize: "11px" }}
                      >
                        📞 Call
                      </a>
                      <a
                        href={`sms:${c.phone}?body=LifeShield%20Emergency%20Alert:%20I%20need%20assistance.%20My%20coordinates:%20https://maps.google.com/?q=${currentLocation?.latitude || 17.385},${currentLocation?.longitude || 78.4867}`}
                        className="ls-btn-secondary"
                        style={{ textDecoration: "none", padding: "6px 10px", fontSize: "11px" }}
                        title="Send SMS"
                      >
                        💬 SMS
                      </a>
                      <button
                        className="ls-btn-secondary"
                        style={{ padding: "6px 10px", fontSize: "11px", color: "#c53030" }}
                        onClick={() => handleDeleteContact(c.id)}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAddContact} style={{ borderTop: "1px solid #f0edf7", paddingTop: "14px" }}>
              <div style={{ fontSize: "12px", fontWeight: 800, color: "#6c65b5", marginBottom: "10px", textAlign: "left" }}>
                Add New Contact
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <div className="ls-form-group" style={{ flex: 1 }}>
                  <label className="ls-label">Contact Name</label>
                  <input
                    className="ls-input"
                    required
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    placeholder="e.g. Ramesh (Son)"
                  />
                </div>
                <div className="ls-form-group" style={{ flex: 1 }}>
                  <label className="ls-label">Phone Number</label>
                  <input
                    className="ls-input"
                    type="tel"
                    required
                    value={newContactPhone}
                    onChange={(e) => setNewContactPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <div className="ls-form-group" style={{ flex: 1 }}>
                  <label className="ls-label">Relationship</label>
                  <input
                    className="ls-input"
                    value={newContactRel}
                    onChange={(e) => setNewContactRel(e.target.value)}
                    placeholder="e.g. Caregiver"
                  />
                </div>
                <div className="ls-form-group" style={{ flex: 1 }}>
                  <label className="ls-label">Priority Tier</label>
                  <select
                    className="ls-select"
                    value={newContactPriority}
                    onChange={(e) => setNewContactPriority(Number(e.target.value) as 1 | 2 | 3)}
                  >
                    <option value={1}>Priority 1 (Primary)</option>
                    <option value={2}>Priority 2 (Secondary)</option>
                    <option value={3}>Priority 3 (Tertiary)</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="ls-btn-primary" style={{ width: "100%", marginTop: "6px" }}>
                Save Emergency Contact
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 5. SMARTWATCH & HEALTH CONNECT PAIRING MODAL */}
      {activeModal === "device" && (
        <div className="ls-modal-overlay" onClick={() => setActiveModal("none")}>
          <div
            className="ls-modal-content"
            style={{ maxWidth: "min(800px, 100%)", width: "100%", maxHeight: "90vh", overflowY: "auto", overflowX: "hidden", boxSizing: "border-box" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ls-modal-header" style={{ marginBottom: "18px" }}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "bold" }}>Connect Wearables & Health Sources</h3>
              <button className="ls-close-btn" onClick={() => setActiveModal("none")}>
                ✕
              </button>
            </div>

            <WearablesView
              bleStatus={bleStatus}
              healthConnectStatus={healthConnectStatus}
              healthConnectMetrics={healthConnectMetrics}
              isScanningBle={isScanningBle}
              isSyncingHealthConnect={isSyncingHealthConnect}
              lastSyncTime={lastSyncTime}
              onPairBluetooth={handlePairSmartwatch}
              onSyncHealthConnect={handleHealthConnectSync}
              onDisconnectBluetooth={handleDisconnectSmartwatch}
              environment={environment}
              health={health}
              dataSource={dataSource}
              isDemoMode={isDemoMode}
              onToggleDemoMode={handleToggleDemoMode}
            />
          </div>
        </div>
      )}

      {/* 6. MANUAL VITALS LOGGING MODAL */}
      {activeModal === "manual_vitals" && (
        <div className="ls-modal-overlay" onClick={() => setActiveModal("none")}>
          <div className="ls-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="ls-modal-header">
              <h3>Log Verified Health Vitals</h3>
              <button className="ls-close-btn" onClick={() => setActiveModal("none")}>
                ✕
              </button>
            </div>

            <form onSubmit={handleManualVitalsSubmit}>
              <div style={{ display: "flex", gap: "10px" }}>
                <div className="ls-form-group" style={{ flex: 1 }}>
                  <label className="ls-label">Heart Rate (BPM)</label>
                  <input
                    className="ls-input"
                    type="number"
                    placeholder="e.g. 74"
                    value={manualHr}
                    onChange={(e) => setManualHr(e.target.value)}
                  />
                </div>
                <div className="ls-form-group" style={{ flex: 1 }}>
                  <label className="ls-label">SpO2 Oxygen (%)</label>
                  <input
                    className="ls-input"
                    type="number"
                    placeholder="e.g. 98"
                    value={manualSpo2}
                    onChange={(e) => setManualSpo2(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <div className="ls-form-group" style={{ flex: 1 }}>
                  <label className="ls-label">Systolic BP (mmHg)</label>
                  <input
                    className="ls-input"
                    type="number"
                    placeholder="e.g. 120"
                    value={manualBpSys}
                    onChange={(e) => setManualBpSys(e.target.value)}
                  />
                </div>
                <div className="ls-form-group" style={{ flex: 1 }}>
                  <label className="ls-label">Diastolic BP (mmHg)</label>
                  <input
                    className="ls-input"
                    type="number"
                    placeholder="e.g. 80"
                    value={manualBpDia}
                    onChange={(e) => setManualBpDia(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <div className="ls-form-group" style={{ flex: 1 }}>
                  <label className="ls-label">Temperature (°C)</label>
                  <input
                    className="ls-input"
                    type="number"
                    step="0.1"
                    placeholder="e.g. 36.8"
                    value={manualTemp}
                    onChange={(e) => setManualTemp(e.target.value)}
                  />
                </div>
                <div className="ls-form-group" style={{ flex: 1 }}>
                  <label className="ls-label">Step Count</label>
                  <input
                    className="ls-input"
                    type="number"
                    placeholder="e.g. 5200"
                    value={manualSteps}
                    onChange={(e) => setManualSteps(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="ls-btn-primary"
                style={{ width: "100%", marginTop: "10px" }}
                disabled={manualLogging}
              >
                {manualLogging ? "Saving Reading..." : "Commit Telemetry to Database"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 7. EMERGENCY SOS 10-SECOND COUNTDOWN MODAL */}
      {activeModal === "sos_countdown" && (
        <div className="ls-modal-overlay">
          <div className="ls-modal-content" style={{ textAlign: "center" }}>
            <div className="ls-badge ls-badge-danger" style={{ fontSize: "12px", padding: "6px 14px" }}>
              EMERGENCY SOS IN PROGRESS
            </div>
            <div className="ls-countdown-ring">
              <span className="ls-countdown-number">{emergencyCountdown}</span>
            </div>
            <h3 style={{ margin: "0 0 8px", color: "#3d1f24" }}>Emergency SOS activating</h3>
            <p style={{ fontSize: "12px", color: "#8a5860", margin: "0 auto 6px", maxWidth: "340px" }}>
              Real browser GPS is being acquired. Your emergency contacts will receive your live location.
            </p>
            {/* Show live GPS coordinates */}
            <div style={{
              background: sosGpsData ? "#f0fdf4" : "#fff8f0",
              padding: "10px 14px",
              borderRadius: "12px",
              margin: "0 auto 8px",
              maxWidth: "340px",
              fontSize: "11px",
              textAlign: "left",
            }}>
              {sosGpsData ? (
                <>
                  <div style={{ fontWeight: 700, color: "#2d7a3a", marginBottom: "4px" }}>GPS Location Acquired</div>
                  <div>Lat: {sosGpsData.lat.toFixed(6)}</div>
                  <div>Lon: {sosGpsData.lon.toFixed(6)}</div>
                  <div>Accuracy: ±{Math.round(sosGpsData.accuracy)}m</div>
                  <a
                    href={`https://www.google.com/maps?q=${sosGpsData.lat},${sosGpsData.lon}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#2563eb", textDecoration: "underline" }}
                  >
                    Open in Google Maps
                  </a>
                </>
              ) : (
                <div style={{ color: "#b45309" }}>
                  <div style={{ fontWeight: 600 }}>Acquiring GPS location...</div>
                  <div>Please allow location permission when prompted</div>
                </div>
              )}
            </div>
            <p style={{ fontSize: "10px", color: "#b89", margin: "0 auto 12px", maxWidth: "340px" }}>
              {contacts.length > 0
                ? `${contacts.length} emergency contact(s) configured`
                : "No emergency contacts configured — SOS will still be recorded"}
            </p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button className="ls-btn-primary" style={{ flex: 1 }} onClick={cancelEmergencyAlert}>
                I'M OK / CANCEL
              </button>
              <button className="ls-btn-danger" style={{ flex: 1 }} onClick={dispatchEmergencySos}>
                Dispatch Immediately
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. FALL DETECTION 30-SECOND SIREN COUNTDOWN MODAL */}
      {activeModal === "fall_siren" && (
        <div className="ls-modal-overlay">
          <div className="ls-modal-content" style={{ textAlign: "center" }}>
            <div className="ls-badge ls-badge-danger" style={{ fontSize: "12px", padding: "6px 14px" }}>
              POTENTIAL FALL IMPACT DETECTED
            </div>
            <div className="ls-countdown-ring">
              <span className="ls-countdown-number">{fallSirenCountdown}</span>
            </div>
            <h3 style={{ margin: "0 0 8px", color: "#3d1f24" }}>Are you okay?</h3>
            <p style={{ fontSize: "12px", color: "#8a5860", margin: "0 auto 6px", maxWidth: "340px" }}>
              High-G accelerometer impact registered. If you do not tap "I'M OK" before the timer expires, automated
              emergency dispatch will trigger with your real GPS location.
            </p>
            <p style={{ fontSize: "10px", color: "#b89", margin: "0 auto 16px", maxWidth: "340px" }}>
              {contacts.length > 0
                ? `${contacts.length} emergency contact(s) will be notified`
                : "No emergency contacts configured"}
            </p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                className="ls-btn-primary"
                style={{ flex: 1, padding: "16px", fontSize: "14px", fontWeight: 900 }}
                onClick={cancelEmergencyAlert}
              >
                I'M OK (Cancel Siren)
              </button>
              <button className="ls-btn-danger" style={{ flex: 1 }} onClick={dispatchEmergencySos}>
                I Need Help
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8b. HIGH HEART RATE 30-SECOND COUNTDOWN ALERT MODAL */}
      {activeModal === "high_hr_alert" && (
        <div className="ls-modal-overlay">
          <div className="ls-modal-content" style={{ textAlign: "center" }}>
            <div className="ls-badge ls-badge-danger" style={{ fontSize: "12px", padding: "6px 14px" }}>
              CRITICAL HIGH HEART RATE DETECTED
            </div>
            <div className="ls-countdown-ring" style={{ borderColor: "#e53e3e" }}>
              <span className="ls-countdown-number" style={{ color: "#e53e3e" }}>{highHrCountdown}</span>
            </div>
            <h3 style={{ margin: "0 0 8px", color: "#3d1f24" }}>Elevated Heart Rate: {highHrValue || health.heart_rate || "—"} BPM</h3>
            <p style={{ fontSize: "12px", color: "#8a5860", margin: "0 auto 6px", maxWidth: "340px" }}>
              Your heart rate significantly exceeds your resting baseline threshold ({baselineRestingHr + 30} BPM).
              If you do not press "I'M OK" before timer expires, emergency contacts will be notified with your real GPS location.
            </p>
            <p style={{ fontSize: "10px", color: "#b89", margin: "0 auto 16px", maxWidth: "340px" }}>
              {contacts.length > 0
                ? `${contacts.length} emergency contact(s) will be notified`
                : "No emergency contacts configured"}
            </p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                className="ls-btn-primary"
                style={{ flex: 1, padding: "16px", fontSize: "14px", fontWeight: 900 }}
                onClick={cancelEmergencyAlert}
              >
                I'M OK (Cancel Alert)
              </button>
              <button className="ls-btn-danger" style={{ flex: 1 }} onClick={dispatchEmergencySos}>
                Dispatch SOS Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. SAFETY MAP MODAL */}
      {activeModal === "map" && (
        <div className="ls-modal-overlay" onClick={() => setActiveModal("none")}>
          <div className="ls-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="ls-modal-header">
              <h3>Nearby Emergency Medical Facilities</h3>
              <button className="ls-close-btn" onClick={() => setActiveModal("none")}>
                ✕
              </button>
            </div>

            <div style={{ textAlign: "left", fontSize: "12px", color: "#544f6d" }}>
              <div style={{ background: "#eeecff", padding: "10px 14px", borderRadius: "14px", marginBottom: "12px" }}>
                📍 Your Location:{" "}
                <strong>{currentLocation?.formattedAddress || "Hyderabad, Telangana (GPS Resolved)"}</strong>
              </div>

              <div style={{ maxHeight: "260px", overflowY: "auto" }}>
                {nearbyHospitals.map((h) => (
                  <div
                    key={h.id}
                    style={{
                      background: "#f9f8fe",
                      border: "1px solid #eeeaf7",
                      borderRadius: "16px",
                      padding: "12px 14px",
                      marginBottom: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <strong style={{ color: "#36324d", fontSize: "13px" }}>{h.name}</strong>
                      <div style={{ fontSize: "11px", color: "#7771bd", marginTop: "2px" }}>
                        {h.type} • {h.distanceKm.toFixed(1)} km away
                      </div>
                    </div>
                    <a
                      href={`tel:${h.phone}`}
                      className="ls-btn-primary"
                      style={{ textDecoration: "none", padding: "6px 12px", fontSize: "11px" }}
                    >
                      Call {h.phone}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 10. ENVIRONMENTAL HAZARD DETAILS MODAL */}
      {activeModal === "environment" && (
        <div className="ls-modal-overlay" onClick={() => setActiveModal("none")}>
          <div className="ls-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="ls-modal-header">
              <h3>Atmospheric & Environmental Hazards</h3>
              <button className="ls-close-btn" onClick={() => setActiveModal("none")}>
                ✕
              </button>
            </div>

            <div style={{ textAlign: "left", fontSize: "12px", color: "#47415e" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "10px",
                  marginBottom: "16px",
                }}
              >
                <div style={{ background: "#f8f6fd", padding: "12px", borderRadius: "14px" }}>
                  <span style={{ fontSize: "10px", color: "#8d87a4" }}>TEMPERATURE</span>
                  <div style={{ fontSize: "20px", fontWeight: 800, color: "#322e4c" }}>
                    {environment.temperature ?? "—"}°C
                  </div>
                  <span style={{ fontSize: "10px", color: "#7770bd" }}>
                    Heat Index: {environment.heat_index ?? "—"}°C
                  </span>
                </div>

                <div style={{ background: "#f8f6fd", padding: "12px", borderRadius: "14px" }}>
                  <span style={{ fontSize: "10px", color: "#8d87a4" }}>AIR QUALITY (AQI)</span>
                  <div style={{ fontSize: "20px", fontWeight: 800, color: "#322e4c" }}>
                    {available(environment.aqi) ? `${environment.aqi}` : "—"}
                  </div>
                  <span style={{ fontSize: "10px", color: "#7770bd" }}>
                    Status: {environment.aqi_level || "—"}
                  </span>
                </div>

                <div style={{ background: "#f8f6fd", padding: "12px", borderRadius: "14px" }}>
                  <span style={{ fontSize: "10px", color: "#8d87a4" }}>RELATIVE HUMIDITY</span>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: "#322e4c" }}>
                    {available(environment.humidity) ? `${environment.humidity}%` : "—"}
                  </div>
                  <span style={{ fontSize: "10px", color: "#7770bd" }}>
                    {available(environment.wind_speed_kmh) ? `Wind: ${environment.wind_speed_kmh} km/h` : "Wind: —"}
                  </span>
                </div>

                <div style={{ background: "#f8f6fd", padding: "12px", borderRadius: "14px" }}>
                  <span style={{ fontSize: "10px", color: "#8d87a4" }}>FLOOD / DISASTER RISK</span>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: "#322e4c" }}>
                    {environment.flood_risk_level || "—"}
                  </div>
                  <span style={{ fontSize: "10px", color: "#7770bd" }}>
                    {available(environment.uv_index) ? `UV Index: ${environment.uv_index}` : "UV Index: —"}
                  </span>
                </div>
              </div>

              {/* Official Bulletins */}
              <div style={{ marginBottom: "14px" }}>
                <strong style={{ fontSize: "13px", color: "#332f48" }}>Official Public Safety Bulletins</strong>
                <div style={{ marginTop: "8px" }}>
                  {environment.advisories && environment.advisories.length > 0 ? (
                    environment.advisories.map((a, i) => (
                      <div
                        key={i}
                        style={{
                          background: "#eeecff",
                          border: "1px solid #dfdafa",
                          borderRadius: "14px",
                          padding: "12px",
                          marginBottom: "8px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <strong style={{ color: "#362f5e", fontSize: "12px" }}>{a.title}</strong>
                          <span className="ls-badge ls-badge-info">{a.severity || "Info"}</span>
                        </div>
                        <p style={{ margin: "4px 0 0", color: "#615c7e", fontSize: "11px", lineHeight: "1.5" }}>
                          {a.description}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div style={{ color: "#8a859e", fontSize: "11px" }}>No active hazard advisories for this region.</div>
                  )}
                </div>
              </div>

              <button
                className="ls-btn-primary"
                style={{ width: "100%" }}
                onClick={() => {
                  setActiveModal("none");
                  setActiveTab("safety");
                }}
              >
                View Safety & Emergency Protocols
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 11. PERMISSIONS MANAGER MODAL */}
      {activeModal === "permissions" && (
        <PermissionsModal onClose={() => setActiveModal("none")} />
      )}

      {/* 12. SOS STATUS PANEL MODAL */}
      {activeModal === "sos_status" && sosStatus && (
        <div className="ls-modal-overlay" onClick={() => setActiveModal("none")}>
          <div className="ls-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "420px" }}>
            <div className="ls-modal-header">
              <h3 style={{ color: sosStatus.cancelled ? "#8a5860" : "#3d1f24" }}>
                {sosStatus.cancelled ? "SOS Cancelled" : "SOS Status"}
              </h3>
              <button className="ls-close-btn" onClick={() => setActiveModal("none")}>✕</button>
            </div>

            <div style={{ textAlign: "left", fontSize: "12px", color: "#47415e" }}>
              {/* Overall message */}
              <div style={{
                background: sosStatus.cancelled ? "#fff8f0" : (sosStatus.recorded ? "#f0fdf4" : "#fef3f2"),
                padding: "12px 14px",
                borderRadius: "14px",
                marginBottom: "14px",
                fontWeight: 600,
              }}>
                {sosStatus.cancelled ? "⚠" : (sosStatus.recorded ? "✓" : "✗")} {sosStatus.message}
              </div>

              {/* Telephony configuration reality indicator */}
              {!sosStatus.telephonyLive && !sosStatus.cancelled && (
                <div style={{
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  borderRadius: "14px",
                  padding: "10px 14px",
                  marginBottom: "14px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                }}>
                  <span style={{ fontSize: "18px", marginTop: "1px" }}>⚠️</span>
                  <div>
                    <strong style={{ color: "#92400e", display: "block", fontSize: "12px" }}>
                      Demo SOS — messaging service is not configured.
                    </strong>
                    <span style={{ color: "#b45309", fontSize: "11px", lineHeight: "1.4", display: "block", marginTop: "2px" }}>
                      Telephony provider credentials (Twilio) are not configured on the backend server. The SOS incident was logged in the database without dispatching real cellular SMS or voice calls.
                    </span>
                  </div>
                </div>
              )}

              {/* Status rows */}
              {[
                {
                  label: "SOS Event",
                  value: sosStatus.recorded
                    ? `✓ Recorded${sosStatus.sosEventId ? ` (${sosStatus.sosEventId.slice(0, 8)}...)` : ""}`
                    : "✗ Not recorded (backend unavailable or not authenticated)",
                  ok: sosStatus.recorded,
                },
                {
                  label: "GPS Location",
                  value: sosStatus.locationObtained
                    ? `✓ Obtained (±${Math.round(sosStatus.locationAccuracy || 0)}m)`
                    : "⚠ Unavailable",
                  ok: sosStatus.locationObtained,
                },
                ...(sosStatus.lat && sosStatus.lon ? [{
                  label: "Coordinates",
                  value: `${sosStatus.lat.toFixed(6)}, ${sosStatus.lon.toFixed(6)}`,
                  ok: true,
                }] : []),
                {
                  label: "Dispatch Target",
                  value: sosStatus.dispatchTarget || "Not configured",
                  ok: !!sosStatus.dispatchTarget,
                },
                ...(sosStatus.dispatchTargetNumber ? [{
                  label: "Phone Number",
                  value: sosStatus.dispatchTargetNumber,
                  ok: true,
                }] : []),
                {
                  label: "Call Status",
                  value: sosStatus.callStatus || "Not attempted",
                  ok: sosStatus.callStatus?.includes("initiated") || false,
                },
                {
                  label: "Police",
                  value: sosStatus.emergencyServiceStatus?.split("|")[0]?.trim() || "Not enabled",
                  ok: false,
                },
                {
                  label: "Ambulance",
                  value: sosStatus.emergencyServiceStatus?.split("|")[1]?.trim() || "Not enabled",
                  ok: false,
                },
                {
                  label: "Location Shared",
                  value: sosStatus.locationShared ? "✓ Yes (included in emergency message)" : "✗ No",
                  ok: sosStatus.locationShared,
                },
                ...(sosStatus.smsResults && sosStatus.smsResults.length > 0 ? [{
                  label: "SMS Status",
                  value: sosStatus.smsStatus || "Not sent",
                  ok: sosStatus.smsResults.some(r => r.status.includes("sent")),
                }] : []),
                ...(sosStatus.smsResults && sosStatus.smsResults.length > 0 ? sosStatus.smsResults.map((sms, idx) => ({
                  label: `SMS ${idx + 1} (${sms.target})`,
                  value: `${sms.status}: ${sms.detail}`,
                  ok: sms.status.includes("sent"),
                })) : []),
              ].map((row, i) => (
                <div key={i} style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  padding: "10px 0",
                  borderBottom: "1px solid #f0edf7",
                  gap: "10px",
                }}>
                  <span style={{ fontWeight: 600, color: "#342f4c", flexShrink: 0 }}>{row.label}</span>
                  <span style={{
                    textAlign: "right",
                    color: row.ok ? "#2d7a3a" : "#b45309",
                    fontSize: "11px",
                  }}>
                    {row.value}
                  </span>
                </div>
              ))}

              {/* Action buttons */}
              <div style={{ display: "flex", gap: "10px", marginTop: "16px", flexWrap: "wrap" }}>
                {sosStatus.dispatchTargetNumber && !sosStatus.cancelled && (
                  <a
                    href={`tel:${sosStatus.dispatchTargetNumber.split(",")[0].trim()}`}
                    className="ls-btn-danger"
                    style={{ flex: 1, textAlign: "center", textDecoration: "none", padding: "10px", fontSize: "12px" }}
                  >
                    Call {sosStatus.dispatchTarget || "Emergency"}
                  </a>
                )}
                <a
                  href={`tel:${dispatchPrefs.unified_emergency_number}`}
                  className="ls-btn-danger"
                  style={{ flex: 1, textAlign: "center", textDecoration: "none", padding: "10px", fontSize: "12px" }}
                >
                  Call {dispatchPrefs.unified_emergency_number} (Unified Emergency)
                </a>
                {sosStatus.lat && sosStatus.lon && (
                  <a
                    href={`https://www.google.com/maps?q=${sosStatus.lat},${sosStatus.lon}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ls-btn-secondary"
                    style={{ flex: 1, textAlign: "center", textDecoration: "none", padding: "10px", fontSize: "12px" }}
                  >
                    Open Location in Maps
                  </a>
                )}
                <button
                  className="ls-btn-secondary"
                  style={{ flex: 1, padding: "10px", fontSize: "12px" }}
                  onClick={() => setActiveModal("none")}
                >
                  Close
                </button>
              </div>

              {/* Vitals source label */}
              <div style={{ marginTop: "12px", fontSize: "10px", color: "#999", textAlign: "center" }}>
                Vitals: {health.source?.includes("Demo") ? "Demo Data (Web Simulation)" : "Real Device Data"} &nbsp;|&nbsp;
                Emergency Location: {sosStatus.locationObtained ? "Browser GPS (Real)" : "Unavailable"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 13. EMERGENCY DISPATCH SETTINGS MODAL */}
      {activeModal === "emergency_settings" && (
        <div className="ls-modal-overlay" onClick={() => setActiveModal("none")}>
          <div className="ls-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="ls-modal-header">
              <h3>Emergency Dispatch Settings</h3>
              <button className="ls-close-btn" onClick={() => setActiveModal("none")}>✕</button>
            </div>

            <div style={{ textAlign: "left", fontSize: "12px", color: "#47415e" }}>
              <p style={{ marginBottom: "14px", color: "#6a6486", fontSize: "11px" }}>
                Configure which emergency services LifeShield will automatically contact during SOS.
                Enable only the services you want called automatically.
              </p>

              {/* Primary Emergency Contact Display */}
              <div style={{
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                padding: "12px 14px",
                borderRadius: "14px",
                marginBottom: "14px",
              }}>
                <div style={{ fontWeight: 700, color: "#166534", marginBottom: "4px" }}>Primary Emergency Contact</div>
                {contacts.length > 0 ? (
                  <>
                    <div style={{ color: "#15803d" }}>
                      {contacts.find((c) => c.priority === 1)?.name || contacts[0]?.name}
                    </div>
                    <div style={{ color: "#16a34a", fontSize: "11px" }}>
                      {contacts.find((c) => c.priority === 1)?.phone || contacts[0]?.phone}
                    </div>
                    <div style={{ fontSize: "10px", color: "#6a6486", marginTop: "4px" }}>
                      Called automatically when neither Police nor Ambulance is enabled.
                    </div>
                  </>
                ) : (
                  <div style={{ color: "#b45309" }}>No emergency contacts configured. Add contacts in the Emergency Contacts section.</div>
                )}
              </div>

              {/* Emergency Services Section */}
              <div style={{ fontWeight: 700, color: "#342f4c", marginBottom: "10px", fontSize: "13px" }}>
                Emergency Services
              </div>

              {/* Police Toggle */}
              <div style={{
                background: dispatchPrefs.auto_call_police ? "#eff6ff" : "#f9fafb",
                border: `1px solid ${dispatchPrefs.auto_call_police ? "#bfdbfe" : "#e5e7eb"}`,
                padding: "12px 14px",
                borderRadius: "14px",
                marginBottom: "10px",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                  <div>
                    <div style={{ fontWeight: 600, color: "#1e3a5f" }}>Automatically call Police</div>
                    <div style={{ fontSize: "10px", color: "#6b7280" }}>During SOS, call the configured police number</div>
                  </div>
                  <label style={{ position: "relative", display: "inline-block", width: "44px", height: "24px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={dispatchPrefs.auto_call_police}
                      onChange={(e) => setDispatchPrefs((p) => ({ ...p, auto_call_police: e.target.checked }))}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                      position: "absolute", inset: 0, borderRadius: "24px",
                      background: dispatchPrefs.auto_call_police ? "#2563eb" : "#d1d5db",
                      transition: "background 0.2s",
                    }} />
                    <span style={{
                      position: "absolute", top: "2px", left: dispatchPrefs.auto_call_police ? "22px" : "2px",
                      width: "20px", height: "20px", borderRadius: "50%",
                      background: "white", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                    }} />
                  </label>
                </div>
                {dispatchPrefs.auto_call_police && (
                  <div style={{ marginTop: "6px" }}>
                    <label style={{ fontSize: "10px", fontWeight: 600, color: "#374151" }}>Police Number</label>
                    <input
                      type="tel"
                      className="ls-input"
                      value={dispatchPrefs.police_number}
                      onChange={(e) => setDispatchPrefs((p) => ({ ...p, police_number: e.target.value }))}
                      placeholder="100"
                      style={{ width: "100%", marginTop: "4px", fontSize: "12px" }}
                    />
                    <div style={{ fontSize: "9px", color: "#6b7280", marginTop: "2px" }}>
                      India Police: 100 (legacy) | Unified: 112
                    </div>
                  </div>
                )}
              </div>

              {/* Ambulance Toggle */}
              <div style={{
                background: dispatchPrefs.auto_call_ambulance ? "#fef2f2" : "#f9fafb",
                border: `1px solid ${dispatchPrefs.auto_call_ambulance ? "#fecaca" : "#e5e7eb"}`,
                padding: "12px 14px",
                borderRadius: "14px",
                marginBottom: "10px",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                  <div>
                    <div style={{ fontWeight: 600, color: "#7f1d1d" }}>Automatically call Ambulance</div>
                    <div style={{ fontSize: "10px", color: "#6b7280" }}>During SOS, call the configured ambulance number</div>
                  </div>
                  <label style={{ position: "relative", display: "inline-block", width: "44px", height: "24px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={dispatchPrefs.auto_call_ambulance}
                      onChange={(e) => setDispatchPrefs((p) => ({ ...p, auto_call_ambulance: e.target.checked }))}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                      position: "absolute", inset: 0, borderRadius: "24px",
                      background: dispatchPrefs.auto_call_ambulance ? "#dc2626" : "#d1d5db",
                      transition: "background 0.2s",
                    }} />
                    <span style={{
                      position: "absolute", top: "2px", left: dispatchPrefs.auto_call_ambulance ? "22px" : "2px",
                      width: "20px", height: "20px", borderRadius: "50%",
                      background: "white", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                    }} />
                  </label>
                </div>
                {dispatchPrefs.auto_call_ambulance && (
                  <div style={{ marginTop: "6px" }}>
                    <label style={{ fontSize: "10px", fontWeight: 600, color: "#374151" }}>Ambulance Number</label>
                    <input
                      type="tel"
                      className="ls-input"
                      value={dispatchPrefs.ambulance_number}
                      onChange={(e) => setDispatchPrefs((p) => ({ ...p, ambulance_number: e.target.value }))}
                      placeholder="108"
                      style={{ width: "100%", marginTop: "4px", fontSize: "12px" }}
                    />
                    <div style={{ fontSize: "9px", color: "#6b7280", marginTop: "2px" }}>
                      India Ambulance: 108 | Unified: 112
                    </div>
                  </div>
                )}
              </div>

              {/* Unified Emergency Number */}
              <div style={{
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
                padding: "12px 14px",
                borderRadius: "14px",
                marginBottom: "14px",
              }}>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "#374151", display: "block", marginBottom: "6px" }}>
                  Unified Emergency Number
                </label>
                <input
                  type="tel"
                  className="ls-input"
                  value={dispatchPrefs.unified_emergency_number}
                  onChange={(e) => setDispatchPrefs((p) => ({ ...p, unified_emergency_number: e.target.value }))}
                  placeholder="112"
                  style={{ width: "100%", fontSize: "12px" }}
                />
                <div style={{ fontSize: "9px", color: "#6b7280", marginTop: "4px" }}>
                  India National Unified Emergency: 112 (always available as manual fallback)
                </div>
              </div>

              {/* Info Box */}
              <div style={{
                background: "#f8f6fd",
                padding: "10px 14px",
                borderRadius: "14px",
                marginBottom: "14px",
                fontSize: "11px",
              }}>
                <strong>How it works:</strong> When you trigger SOS, LifeShield will automatically call the numbers you have enabled above.
                If neither Police nor Ambulance is enabled, your Primary Emergency Contact will be called automatically.
                The unified emergency number (112) is always available as a manual fallback button.
              </div>

              <button
                className="ls-btn-primary"
                style={{ width: "100%" }}
                onClick={async () => {
                  // Save to backend if authenticated
                  if (apiClient.getToken()) {
                    try {
                      await apiClient.dispatch.update(dispatchPrefs);
                    } catch (err) {
                      console.warn("Failed to save dispatch preferences to backend:", err);
                    }
                  }
                  // Always save locally
                  localStorage.setItem("lifeshield_dispatch_prefs", JSON.stringify(dispatchPrefs));
                  showToast("Emergency dispatch settings saved.", "success");
                  setActiveModal("none");
                }}
              >
                Save Dispatch Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   1. HOME SCREEN COMPONENT
========================================================= */
function HomeScreen({
  health,
  environment,
  user,
  riskScore,
  riskTier,
  riskFactors,
  reminders,
  display,
  available,
  onNavigate,
  onOpenReminders,
  onOpenLogVitals,
  onOpenEnvironment,
  onLogHydration,
  dataSource,
  lastSyncTime,
  selectedRegion,
  onRegionChange,
  envLoading,
  envError,
  isDemoMode,
  onToggleDemoMode,
}: {
  health: HealthData;
  environment: EnvironmentData;
  user: UserAccount | null;
  riskScore: number;
  riskTier: string;
  riskFactors: string[];
  reminders: ReminderItem[];
  display: (v: number | null | undefined, s?: string) => string;
  available: (v: number | null | undefined) => boolean;
  onNavigate: (t: Tab) => void;
  onOpenReminders: () => void;
  onOpenLogVitals: () => void;
  onOpenEnvironment: () => void;
  onLogHydration: () => void;
  dataSource: HealthDataSource;
  lastSyncTime: string | null;
  selectedRegion: string;
  onRegionChange: (region: string) => void;
  envLoading?: boolean;
  envError?: boolean;
  isDemoMode?: boolean;
  onToggleDemoMode?: (enabled: boolean) => void;
}) {
  const nextMedicine = reminders.find((r) => r.reminder_type === "Medicine") || reminders[0];

  const [regionPickerOpen, setRegionPickerOpen] = useState(false);

  const SUPPORTED_LOCATIONS = [
    { key: "Hyderabad", label: "Hyderabad, Telangana" },
    { key: "Mumbai", label: "Mumbai, Maharashtra" },
    { key: "Delhi", label: "Delhi, NCT" },
    { key: "Bengaluru", label: "Bengaluru, Karnataka" },
    { key: "Chennai", label: "Chennai, Tamil Nadu" },
    { key: "Kolkata", label: "Kolkata, West Bengal" },
    { key: "Visakhapatnam", label: "Visakhapatnam, AP" },
    { key: "Vijayawada", label: "Vijayawada, AP" },
    { key: "Pune", label: "Pune, Maharashtra" },
  ];

  const currentLocation = SUPPORTED_LOCATIONS.find((l) => l.key === selectedRegion) || SUPPORTED_LOCATIONS[0];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "GOOD MORNING";
    if (hour < 17) return "GOOD AFTERNOON";
    return "GOOD EVENING";
  };

  return (
    <>
      {/* HERO GREETING */}
      <section className="hero-section">
        <div>
          <div className="small-heading">
            {getGreeting()}, {user?.full_name ? user.full_name.toUpperCase() : "LIFESHIELD USER"}
          </div>
          <h1>
            Your health,
            <br />
            <span>in your hands.</span>
          </h1>
          <p>
            Continuous clinical telemetry & environmental safety.
            <br />
            Protected by LifeShield Edge AI.
          </p>
        </div>

        <div className="hero-orbit">
          <div className="hero-circle circle-one" />
          <div className="hero-circle circle-two" />
          <div className="hero-heart">♥</div>
        </div>
      </section>

      {/* HEALTH RISK SCORE CARD */}
      <section className="health-score-card">
        <div className="score-content">
          <div className="score-label">
            {dataSource === "demo"
              ? "DEMO RISK ASSESSMENT"
              : dataSource === "not_connected"
              ? "CLINICAL RISK EVALUATION — NO TELEMETRY"
              : "DYNAMIC CLINICAL RISK EVALUATION"}
          </div>
          <div className="score-title">
            {dataSource === "demo"
              ? `Demo Assessment: ${riskTier} Risk (${riskScore}/100)`
              : dataSource === "not_connected"
              ? "Status: Telemetry Inactive"
              : `Status: ${riskTier} Risk (${riskScore}/100)`}
          </div>
          <div className="score-description">
            {dataSource === "demo"
              ? "Calculated from simulated demonstration vitals for presentation. Connect your watch or Health Connect to activate live clinical evaluation."
              : dataSource === "not_connected"
              ? "No live physiological telemetry or demo data active. Connect a wearable, sync Health Connect, or enable Demo Data mode to calculate clinical risk evaluation."
              : "Transparent composite based on heart rate, SpO2, temperature, sleep, blood pressure, AQI, heat index, and flood risk. Safety indicator only — not a clinical diagnosis."}
          </div>
          {riskFactors.length > 0 && (
            <div style={{ marginTop: "10px", fontSize: "11px", color: "rgba(255,255,255,0.85)" }}>
              <strong>Contributing factors:</strong> {riskFactors.join(", ")}
            </div>
          )}

          <div style={{ display: "flex", gap: "10px", marginTop: "16px", flexWrap: "wrap" }}>
            <button className="soft-button" type="button" onClick={() => onNavigate("health")}>
              View health telemetry <span>→</span>
            </button>
            <button
              className="soft-button"
              type="button"
              onClick={onOpenLogVitals}
              style={{ background: "rgba(255, 255, 255, 0.25)", color: "#ffffff" }}
            >
              + Log Reading
            </button>
          </div>
        </div>

        <div className="score-ring">
          <div className="score-ring-inner">
            <strong>{dataSource === "not_connected" ? "—" : riskScore}</strong>
            <span>Risk Score</span>
          </div>
        </div>
      </section>

      {/* TODAY'S OVERVIEW MINI CARDS */}
      <section className="section-title-row">
        <div>
          <span>LIVE TELEMETRY</span>
          <h2>Today's overview</h2>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "4px", flexWrap: "wrap" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "2px 8px",
                borderRadius: "12px",
                fontSize: "10px",
                fontWeight: 700,
                background:
                  dataSource === "real"
                    ? "#ecfdf5"
                    : dataSource === "demo"
                    ? "#f5f3ff"
                    : "#f1f5f9",
                color:
                  dataSource === "real"
                    ? "#16a34a"
                    : dataSource === "demo"
                    ? "#7c3aed"
                    : "#64748b",
                border: `1px solid ${
                  dataSource === "real"
                    ? "#bbf7d0"
                    : dataSource === "demo"
                    ? "#ddd6fe"
                    : "#e2e8f0"
                }`,
              }}
            >
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background:
                    dataSource === "real"
                      ? "#16a34a"
                      : dataSource === "demo"
                      ? "#7c3aed"
                      : "#94a3b8",
                }}
              />
              {dataSource === "real"
                ? "● LIVE DATA"
                : dataSource === "demo"
                ? "🟣 DEMO DATA"
                : dataSource === "unavailable"
                ? "— WAITING FOR RECORDS"
                : "⚪ NOT CONNECTED"}
            </span>
            <span style={{ fontSize: "11px", color: "#64748b" }}>
              {dataSource === "real"
                ? `Source: ${health.source || "Health Connect"}`
                : dataSource === "demo"
                ? "Simulated values for presentation"
                : dataSource === "unavailable"
                ? "Source: Connected — awaiting reading"
                : "No device connected • Demo mode OFF"}
            </span>
            {lastSyncTime && (
              <span style={{ fontSize: "10px", color: "#94a3b8" }}>
                Last synced: {lastSyncTime}
              </span>
            )}
          </div>
        </div>
        <button type="button" onClick={() => onNavigate("health")}>
          See all
        </button>
      </section>

      {/* DEMO NOTICE CALLOUT */}
      {dataSource === "demo" && (
        <div style={{
          background: "#f5f3ff",
          border: "1px solid #ddd6fe",
          borderRadius: "14px",
          padding: "12px 16px",
          margin: "12px 0 16px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
            <span style={{ fontSize: "20px", flexShrink: 0 }}>🟣</span>
            <div style={{ minWidth: 0 }}>
              <strong style={{ fontSize: "13px", color: "#5b21b6" }}>DEMO DATA MODE ACTIVE</strong>
              <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#6d28d9" }}>
                Simulating realistic vitals for presentation. Values are not real medical records.
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
            {onToggleDemoMode && (
              <button
                type="button"
                onClick={() => onToggleDemoMode(false)}
                style={{
                  background: "#ffffff",
                  color: "#6d28d9",
                  border: "1px solid #c4b5fd",
                  borderRadius: "8px",
                  padding: "6px 12px",
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Turn Off Demo
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate("health")}
              style={{
                background: "#7c3aed",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "6px 12px",
                fontSize: "11px",
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Manage Sources
            </button>
          </div>
        </div>
      )}

      {/* NOT CONNECTED NOTICE CALLOUT */}
      {dataSource === "not_connected" && (
        <div style={{
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: "14px",
          padding: "12px 16px",
          margin: "12px 0 16px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
            <span style={{ fontSize: "20px", flexShrink: 0 }}>⚪</span>
            <div style={{ minWidth: 0 }}>
              <strong style={{ fontSize: "13px", color: "#334155" }}>NO WEARABLE CONNECTED</strong>
              <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#64748b" }}>
                Demo mode is OFF. Enable Demo Mode for presentation or pair a wearable.
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
            {onToggleDemoMode && (
              <button
                type="button"
                onClick={() => onToggleDemoMode(true)}
                style={{
                  background: "#7c3aed",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "6px 12px",
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Enable Demo Mode
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate("wearables")}
              style={{
                background: "#ffffff",
                color: "#475569",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                padding: "6px 12px",
                fontSize: "11px",
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Pair Device
            </button>
          </div>
        </div>
      )}

      {/* UNAVAILABLE NOTICE CALLOUT */}
      {dataSource === "unavailable" && (
        <div style={{
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: "14px",
          padding: "12px 16px",
          margin: "12px 0 16px 0",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}>
          <span style={{ fontSize: "20px" }}>ℹ️</span>
          <div>
            <strong style={{ fontSize: "13px", color: "#334155" }}>NO LIVE DATA AVAILABLE</strong>
            <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#64748b" }}>
              Your health source is connected, but no recent reading is available.
            </p>
          </div>
        </div>
      )}

      <section className="health-mini-grid">
        <div onClick={() => onNavigate("health")} style={{ cursor: "pointer" }}>
          <MiniHealthCard
            icon="♥"
            title="Heart Rate"
            value={display(health.heart_rate)}
            unit={available(health.heart_rate) ? "BPM" : "Unavailable"}
            isLive={Boolean(dataSource === "real" && available(health.heart_rate))}
            isDemo={Boolean(dataSource === "demo")}
            variant="peach"
          />
        </div>
        <div onClick={() => onNavigate("health")} style={{ cursor: "pointer" }}>
          <MiniHealthCard
            icon="◉"
            title="Blood Oxygen"
            value={display(health.spo2)}
            unit={available(health.spo2) ? "%" : "Unavailable"}
            isLive={Boolean(dataSource === "real" && available(health.spo2))}
            isDemo={Boolean(dataSource === "demo")}
            variant="lavender"
          />
        </div>
        <div onClick={() => onNavigate("health")} style={{ cursor: "pointer" }}>
          <MiniHealthCard
            icon="⌁"
            title="Steps"
            value={display(health.steps)}
            unit={available(health.steps) ? "steps" : "Unavailable"}
            isLive={Boolean(dataSource === "real" && available(health.steps))}
            isDemo={Boolean(dataSource === "demo")}
            variant="cream"
          />
        </div>
        <div onClick={() => onNavigate("health")} style={{ cursor: "pointer" }}>
          <MiniHealthCard
            icon="◔"
            title="Sleep"
            value={display(health.sleep)}
            unit={available(health.sleep) ? "hours" : "Unavailable"}
            isLive={Boolean(dataSource === "real" && available(health.sleep))}
            isDemo={Boolean(dataSource === "demo")}
            variant="pink"
          />
        </div>
      </section>

      {/* MEDICINE / WATER ACTION CARDS */}
      <section className="section-title-row">
        <div>
          <span>DAILY PROTOCOLS</span>
          <h2>Stay on track</h2>
        </div>
      </section>

      <section className="feature-grid">
        <button className="medicine-card" type="button" onClick={onOpenReminders}>
          <div className="medicine-top">
            <div className="feature-icon orange">✚</div>
            <span className="arrow-circle">→</span>
          </div>
          <div className="medicine-time">
            {nextMedicine ? `SCHEDULED: ${nextMedicine.time}` : "NO ACTIVE DOSE"}
          </div>
          <h3>
            Medicine
            <br />
            reminders
          </h3>
          <p>{nextMedicine ? `${nextMedicine.title} (${nextMedicine.dosage || "Daily"})` : "Tap to schedule medical doses."}</p>
        </button>

        <button className="water-card" type="button" onClick={onLogHydration}>
          <div className="medicine-top">
            <div className="feature-icon blue">💧</div>
            <span className="arrow-circle">+</span>
          </div>
          <div className="medicine-time">WELLNESS TRACKING</div>
          <h3>
            Hydration
            <br />
            tracker
          </h3>
          <p>Tap to record +250ml water and listen to multi-lingual audio confirmation.</p>
        </button>
      </section>

      {/* YOUR ENVIRONMENT */}
      <section className="section-title-row">
        <div>
          <span>YOUR ENVIRONMENT</span>
          <h2>Atmosphere around you</h2>
          {environment.weather && (
            <div style={{ fontSize: "12px", color: "#8c8799", marginTop: "2px" }}>
              {environment.weather}
            </div>
          )}
        </div>
        <button type="button" onClick={onOpenEnvironment}>
          Details & Advisories
        </button>
      </section>

      <section
        className="env-metrics-card"
        onClick={onOpenEnvironment}
        role="button"
        tabIndex={0}
      >
        {/* Location & freshness */}
        <div className="env-metrics-header">
          <button
            className="env-metrics-region-btn"
            type="button"
            onClick={(e) => { e.stopPropagation(); setRegionPickerOpen(true); }}
          >
            📍 {currentLocation.label}
            <span className="env-metrics-chevron">▾</span>
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "2px 8px",
                borderRadius: "12px",
                fontSize: "10px",
                fontWeight: 700,
                background: envError ? "#fef2f2" : "#ecfdf5",
                color: envError ? "#dc2626" : "#16a34a",
                border: `1px solid ${envError ? "#fecaca" : "#bbf7d0"}`,
              }}
            >
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: envError ? "#dc2626" : "#16a34a" }} />
              {envLoading ? "UPDATING ENVIRONMENT..." : envError ? "Environmental data temporarily unavailable" : "● LIVE ENVIRONMENT"}
            </span>
            {!envError && !envLoading && (
              <span style={{ fontSize: "10px", color: "#64748b" }}>
                Source: Live environmental data
              </span>
            )}
          </div>
        </div>

        {/* Metric grid */}
        <div className="env-metrics-grid">
          {/* Temperature */}
          <div className="env-metric-item">
            <div className="env-metric-icon" style={{ background: "#fef3c7", color: "#d97706" }}>🌡️</div>
            <div className="env-metric-body">
              <span className="env-metric-label">Temperature</span>
              <strong className="env-metric-value">
                {available(environment.temperature) ? `${environment.temperature}°C` : "—"}
              </strong>
              <span className="env-metric-sub">
                {environment.weather || "Current temperature"}
              </span>
            </div>
          </div>

          {/* Air Quality */}
          <div className="env-metric-item">
            <div className="env-metric-icon" style={{
              background: (environment.aqi ?? 0) <= 50 ? "#dcfce7" : (environment.aqi ?? 0) <= 100 ? "#fef9c3" : "#fee2e2",
              color: (environment.aqi ?? 0) <= 50 ? "#16a34a" : (environment.aqi ?? 0) <= 100 ? "#ca8a04" : "#dc2626",
            }}>🫁</div>
            <div className="env-metric-body">
              <span className="env-metric-label">Air Quality</span>
              <strong className="env-metric-value">
                {available(environment.aqi) ? `${environment.aqi}` : "—"}
                {environment.aqi_level ? <span className="env-metric-tag">{environment.aqi_level}</span> : null}
              </strong>
              <span className="env-metric-sub">AQI · {environment.pm2_5 != null ? `PM2.5: ${environment.pm2_5}` : "Particulate matter"}</span>
            </div>
          </div>

          {/* UV Index */}
          <div className="env-metric-item">
            <div className="env-metric-icon" style={{
              background: (environment.uv_index ?? 0) < 3 ? "#dcfce7" : (environment.uv_index ?? 0) < 6 ? "#fef9c3" : (environment.uv_index ?? 0) < 8 ? "#ffedd5" : "#fee2e2",
              color: (environment.uv_index ?? 0) < 3 ? "#16a34a" : (environment.uv_index ?? 0) < 6 ? "#ca8a04" : (environment.uv_index ?? 0) < 8 ? "#ea580c" : "#dc2626",
            }}>☀️</div>
            <div className="env-metric-body">
              <span className="env-metric-label">UV Index</span>
              <strong className="env-metric-value">
                {available(environment.uv_index) ? `${environment.uv_index}` : "—"}
                {environment.uv_index != null && (
                  <span className="env-metric-tag">
                    {environment.uv_index < 3 ? "Low" : environment.uv_index < 6 ? "Moderate" : environment.uv_index < 8 ? "High" : "Very High"}
                  </span>
                )}
              </strong>
              <span className="env-metric-sub">Sun exposure risk</span>
            </div>
          </div>

          {/* Feels Like */}
          <div className="env-metric-item">
            <div className="env-metric-icon" style={{ background: "#fee2e2", color: "#dc2626" }}>🔥</div>
            <div className="env-metric-body">
              <span className="env-metric-label">Feels Like</span>
              <strong className="env-metric-value">
                {available(environment.heat_index) ? `${environment.heat_index}°C` : "—"}
              </strong>
              <span className="env-metric-sub">Heat index</span>
            </div>
          </div>

          {/* Humidity */}
          <div className="env-metric-item">
            <div className="env-metric-icon" style={{ background: "#dbeafe", color: "#2563eb" }}>💧</div>
            <div className="env-metric-body">
              <span className="env-metric-label">Humidity</span>
              <strong className="env-metric-value">
                {available(environment.humidity) ? `${environment.humidity}%` : "—"}
              </strong>
              <span className="env-metric-sub">Relative humidity</span>
            </div>
          </div>

          {/* Wind */}
          <div className="env-metric-item">
            <div className="env-metric-icon" style={{ background: "#f0fdf4", color: "#16a34a" }}>🌬️</div>
            <div className="env-metric-body">
              <span className="env-metric-label">Wind</span>
              <strong className="env-metric-value">
                {available(environment.wind_speed_kmh) ? `${environment.wind_speed_kmh} km/h` : "—"}
              </strong>
              <span className="env-metric-sub">Wind speed</span>
            </div>
          </div>
        </div>

        <span className="banner-arrow">→</span>
      </section>

      {/* SAFETY BANNER */}
      <button className="safety-banner" type="button" onClick={() => onNavigate("safety")}>
        <div className="safety-icon">!</div>
        <div>
          <span>EMERGENCY DISPATCH & SOS</span>
          <strong>Emergency tools, sirens & contacts are ready</strong>
        </div>
        <span className="banner-arrow">→</span>
      </button>

      {/* REGION PICKER MODAL */}
      {regionPickerOpen && (
        <div className="modal-overlay" onClick={() => setRegionPickerOpen(false)}>
          <div className="modal-content region-picker-modal" onClick={(e) => e.stopPropagation()}>
            <div className="region-picker-header">
              <h3>Select Location</h3>
              <button className="region-picker-close" type="button" onClick={() => setRegionPickerOpen(false)}>✕</button>
            </div>
            <p className="region-picker-sub">Choose a supported city for live environment data</p>
            <div className="region-picker-list">
              {SUPPORTED_LOCATIONS.map((loc) => (
                <button
                  key={loc.key}
                  className={`region-picker-item${selectedRegion === loc.key ? " active" : ""}`}
                  type="button"
                  onClick={() => { onRegionChange(loc.key); setRegionPickerOpen(false); }}
                >
                  <span className="region-picker-dot" />
                  <span>{loc.label}</span>
                  {selectedRegion === loc.key && <span className="region-picker-check">✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* =========================================================
   2. HEALTH SCREEN COMPONENT
========================================================= */
function HealthScreen({
  health,
  trends,
  bleStatus,
  healthConnectStatus,
  lastSyncTime,
  isRefreshing,
  display,
  available,
  onRefresh,
  onOpenDeviceModal,
  onOpenLogVitals,
  dataSource,
  isDemoMode,
  onToggleDemoMode,
}: {
  health: HealthData;
  trends: any[];
  bleStatus: BLEDeviceStatus;
  healthConnectStatus: string;
  lastSyncTime: string | null;
  isRefreshing: boolean;
  display: (v: number | null | undefined, s?: string) => string;
  available: (v: number | null | undefined) => boolean;
  onRefresh: () => void;
  onOpenDeviceModal: () => void;
  onOpenLogVitals: () => void;
  dataSource: HealthDataSource;
  isDemoMode?: boolean;
  onToggleDemoMode?: (enabled: boolean) => void;
}) {
  return (
    <>
      <PageHeading
        label="CLINICAL TELEMETRY"
        title="Your health"
        description="Verified health metrics from Bluetooth GATT wearables, Health Connect, and manual logs."
      />

      {/* DATA SOURCE MODE SELECTOR */}
      {onToggleDemoMode && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "16px",
            padding: "10px 16px",
            marginBottom: "14px",
            flexWrap: "wrap",
            gap: "10px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
            boxSizing: "border-box",
            width: "100%",
            maxWidth: "100%",
          }}
        >
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Data Source Mode
            </div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>
              {isDemoMode ? "🧪 Presentation Demo Mode" : "⌚ Real Hardware / Health Connect"}
            </div>
          </div>

          <div style={{ display: "inline-flex", background: "#f1f5f9", padding: "3px", borderRadius: "10px", gap: "3px" }}>
            <button
              type="button"
              onClick={() => onToggleDemoMode(false)}
              style={{
                padding: "6px 14px",
                borderRadius: "8px",
                border: "none",
                fontSize: "11px",
                fontWeight: 700,
                cursor: "pointer",
                background: !isDemoMode ? "#ffffff" : "transparent",
                color: !isDemoMode ? "#1e293b" : "#64748b",
                boxShadow: !isDemoMode ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              Real Device
            </button>
            <button
              type="button"
              onClick={() => onToggleDemoMode(true)}
              style={{
                padding: "6px 14px",
                borderRadius: "8px",
                border: "none",
                fontSize: "11px",
                fontWeight: 700,
                cursor: "pointer",
                background: isDemoMode ? "#7c3aed" : "transparent",
                color: isDemoMode ? "#ffffff" : "#64748b",
                boxShadow: isDemoMode ? "0 1px 3px rgba(124, 58, 237, 0.25)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              Demo Data
            </button>
          </div>
        </div>
      )}

      {/* 1. HEALTH SOURCES CARD (ALWAYS SEPARATE FROM DEMO READINGS) */}
      <section className="connect-card">
        <div className="connect-symbol">
          {bleStatus.isConnected ? "⌚" : "❤️"}
        </div>
        <div style={{ flex: "1 1 0%", minWidth: 0 }}>
          <span>HEALTH SOURCES</span>
          <strong style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>
            {bleStatus.isConnected
              ? `Connected: ${bleStatus.deviceName || "Smartwatch"}`
              : dataSource === "real"
              ? formatHumanSourceLabel(health.source) || "Health Connect"
              : "Health Connect"}
          </strong>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "4px", flexWrap: "wrap", minWidth: 0 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "2px 8px",
                borderRadius: "12px",
                fontSize: "10px",
                fontWeight: 700,
                background:
                  dataSource === "real"
                    ? "#ecfdf5"
                    : dataSource === "unavailable" || healthConnectStatus === "Connected — No Data"
                    ? "#fffbeb"
                    : "#f1f5f9",
                color:
                  dataSource === "real"
                    ? "#16a34a"
                    : dataSource === "unavailable" || healthConnectStatus === "Connected — No Data"
                    ? "#d97706"
                    : "#64748b",
                border: `1px solid ${
                  dataSource === "real"
                    ? "#bbf7d0"
                    : dataSource === "unavailable" || healthConnectStatus === "Connected — No Data"
                    ? "#fde68a"
                    : "#e2e8f0"
                }`,
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background:
                    dataSource === "real"
                      ? "#16a34a"
                      : dataSource === "unavailable" || healthConnectStatus === "Connected — No Data"
                      ? "#d97706"
                      : "#94a3b8",
                }}
              />
              {dataSource === "real"
                ? "Connected — Real Data"
                : dataSource === "unavailable" || healthConnectStatus === "Connected — No Data"
                ? "Connected — No Data"
                : "Not Connected"}
            </span>
            {dataSource === "real" && lastSyncTime && (
              <span style={{ fontSize: "10px", color: "#64748b", whiteSpace: "nowrap" }}>
                Last synced: {lastSyncTime}
              </span>
            )}
          </div>
          <p style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>
            {dataSource === "real"
              ? `Verified telemetry active via ${formatHumanSourceLabel(health.source)}.`
              : dataSource === "unavailable" || healthConnectStatus === "Connected — No Data"
              ? "Health source is connected, but no recent health records are available yet."
              : "No physical wearable or Health Connect records connected."}
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
          <button type="button" onClick={onOpenDeviceModal}>
            {bleStatus.isConnected ? "Manage Wearable" : "Connect Source"}
          </button>
        </div>
      </section>

      {/* 2. DEMO HEALTH READINGS CARD (SEPARATE, AS SPECIFIED IN REQUIREMENT 5) */}
      {dataSource === "demo" && (
        <section
          style={{
            background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)",
            border: "1px solid #ddd6fe",
            borderRadius: "20px",
            padding: "16px 20px",
            marginTop: "14px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            boxShadow: "0 2px 10px rgba(124, 58, 237, 0.06)",
            boxSizing: "border-box",
            width: "100%",
            maxWidth: "100%",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "20px" }}>🧪</span>
              <div>
                <strong style={{ fontSize: "14px", color: "#4c1d95" }}>Demo Health Readings</strong>
                <div style={{ fontSize: "11px", color: "#6d28d9" }}>Simulated for SIH Presentation & UI Demo</div>
              </div>
            </div>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "3px 10px",
                borderRadius: "20px",
                fontSize: "11px",
                fontWeight: 800,
                background: "#7c3aed",
                color: "#ffffff",
                letterSpacing: "0.04em",
              }}
            >
              ● DEMO DATA
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(90px, 100%), 1fr))",
              gap: "8px",
              marginTop: "4px",
            }}
          >
            <div style={{ background: "#ffffff", padding: "10px 12px", borderRadius: "12px", border: "1px solid #e9d5ff" }}>
              <div style={{ fontSize: "11px", color: "#7e22ce" }}>❤️ Heart Rate</div>
              <div style={{ fontSize: "15px", fontWeight: 800, color: "#1e1b4b" }}>{health.heart_rate ?? 72} BPM</div>
            </div>
            <div style={{ background: "#ffffff", padding: "10px 12px", borderRadius: "12px", border: "1px solid #e9d5ff" }}>
              <div style={{ fontSize: "11px", color: "#7e22ce" }}>🫁 SpO₂</div>
              <div style={{ fontSize: "15px", fontWeight: 800, color: "#1e1b4b" }}>{health.spo2 ?? 98}%</div>
            </div>
            <div style={{ background: "#ffffff", padding: "10px 12px", borderRadius: "12px", border: "1px solid #e9d5ff" }}>
              <div style={{ fontSize: "11px", color: "#7e22ce" }}>👟 Steps</div>
              <div style={{ fontSize: "15px", fontWeight: 800, color: "#1e1b4b" }}>{(health.steps ?? 4820).toLocaleString()}</div>
            </div>
            <div style={{ background: "#ffffff", padding: "10px 12px", borderRadius: "12px", border: "1px solid #e9d5ff" }}>
              <div style={{ fontSize: "11px", color: "#7e22ce" }}>💧 Hydration</div>
              <div style={{ fontSize: "15px", fontWeight: 800, color: "#1e1b4b" }}>{health.hydration ?? 62}%</div>
            </div>
            <div style={{ background: "#ffffff", padding: "10px 12px", borderRadius: "12px", border: "1px solid #e9d5ff" }}>
              <div style={{ fontSize: "11px", color: "#7e22ce" }}>😴 Sleep</div>
              <div style={{ fontSize: "15px", fontWeight: 800, color: "#1e1b4b" }}>7h 24m</div>
            </div>
            <div style={{ background: "#ffffff", padding: "10px 12px", borderRadius: "12px", border: "1px solid #e9d5ff" }}>
              <div style={{ fontSize: "11px", color: "#7e22ce" }}>🌡️ Temp</div>
              <div style={{ fontSize: "15px", fontWeight: 800, color: "#1e1b4b" }}>{health.temperature ?? 36.7} °C</div>
            </div>
            <div style={{ background: "#ffffff", padding: "10px 12px", borderRadius: "12px", border: "1px solid #e9d5ff" }}>
              <div style={{ fontSize: "11px", color: "#7e22ce" }}>🔥 Calories</div>
              <div style={{ fontSize: "15px", fontWeight: 800, color: "#1e1b4b" }}>{(health.calories ?? 1420).toLocaleString()} kcal</div>
            </div>
            <div style={{ background: "#ffffff", padding: "10px 12px", borderRadius: "12px", border: "1px solid #e9d5ff" }}>
              <div style={{ fontSize: "11px", color: "#7e22ce" }}>🫁 Resp Rate</div>
              <div style={{ fontSize: "15px", fontWeight: 800, color: "#1e1b4b" }}>{health.respiratory_rate ?? 16} /min</div>
            </div>
            <div style={{ background: "#ffffff", padding: "10px 12px", borderRadius: "12px", border: "1px solid #e9d5ff" }}>
              <div style={{ fontSize: "11px", color: "#7e22ce" }}>⚡ Activity</div>
              <div style={{ fontSize: "15px", fontWeight: 800, color: "#1e1b4b" }}>{health.activity || "Moderate"}</div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", marginTop: "4px" }}>
            <span style={{ fontSize: "10px", color: "#6d28d9" }}>
              Values breathe gently in real time • Not real medical data
            </span>
            {onToggleDemoMode && (
              <button
                type="button"
                onClick={() => onToggleDemoMode(false)}
                style={{
                  background: "transparent",
                  border: "1px solid #c4b5fd",
                  borderRadius: "8px",
                  padding: "4px 10px",
                  fontSize: "10px",
                  fontWeight: 700,
                  color: "#6d28d9",
                  cursor: "pointer",
                }}
              >
                Turn Off Demo
              </button>
            )}
          </div>
        </section>
      )}

      {/* REFRESH & LOG ACTIONS */}
      <div style={{ display: "flex", gap: "10px", margin: "16px 0", flexWrap: "wrap", minWidth: 0 }}>
        <button className="soft-button" type="button" onClick={onRefresh} disabled={isRefreshing}>
          {isRefreshing ? "Refreshing..." : "Refresh health data"} <span>↻</span>
        </button>
        <button className="soft-button" type="button" onClick={onOpenLogVitals}>
          + Manual Reading <span>✏️</span>
        </button>
      </div>

      {/* DETAILED HEALTH CARDS */}
      <section className="health-detail-grid">
        <DetailedHealthCard
          title="Heart Rate"
          icon="♥"
          value={display(health.heart_rate)}
          unit={available(health.heart_rate) ? "BPM" : "Unavailable"}
          reasonUnavailable={dataSource === "unavailable" ? "Your health source is connected, but no recent reading is available." : !isDemoMode ? "Demo mode is off. Enable Demo Mode or pair a watch to view readings." : "Connect your watch or Health Connect to see live readings."}
          source={available(health.heart_rate) ? (bleStatus.isConnected && health.source?.includes("Bluetooth") ? "Bluetooth Wearable" : formatHumanSourceLabel(health.source)) : undefined}
          isLive={Boolean(dataSource === "real" && available(health.heart_rate))}
          isDemo={Boolean(dataSource === "demo")}
          updatedAgo={health.timestamp ? formatTimeAgo(new Date(health.timestamp)) : undefined}
          onCheckHealthConnect={onOpenDeviceModal}
          variant="peach"
        />
        <DetailedHealthCard
          title="Blood Oxygen"
          icon="◉"
          value={display(health.spo2)}
          unit={available(health.spo2) ? "%" : "Unavailable"}
          reasonUnavailable={dataSource === "unavailable" ? "Your health source is connected, but no recent reading is available." : !isDemoMode ? "Demo mode is off. Enable Demo Mode or pair a watch to view readings." : "Connect your watch or Health Connect to see live readings."}
          source={available(health.spo2) ? (bleStatus.isConnected && health.source?.includes("Bluetooth") ? "Bluetooth Wearable" : formatHumanSourceLabel(health.source)) : undefined}
          isLive={Boolean(dataSource === "real" && available(health.spo2))}
          isDemo={Boolean(dataSource === "demo")}
          updatedAgo={health.timestamp ? formatTimeAgo(new Date(health.timestamp)) : undefined}
          onCheckHealthConnect={onOpenDeviceModal}
          variant="lavender"
        />
        <DetailedHealthCard
          title="Steps"
          icon="⌁"
          value={display(health.steps)}
          unit={available(health.steps) ? "steps" : "Unavailable"}
          reasonUnavailable={dataSource === "unavailable" ? "Your health source is connected, but no recent reading is available." : !isDemoMode ? "Demo mode is off. Enable Demo Mode or pair a watch to view readings." : "Connect your watch or Health Connect to see live readings."}
          source={available(health.steps) ? formatHumanSourceLabel(health.source) : undefined}
          isLive={Boolean(dataSource === "real" && available(health.steps))}
          isDemo={Boolean(dataSource === "demo")}
          updatedAgo={health.timestamp ? formatTimeAgo(new Date(health.timestamp)) : undefined}
          onCheckHealthConnect={onOpenDeviceModal}
          variant="blue"
        />
        <DetailedHealthCard
          title="Sleep Session"
          icon="◔"
          value={display(health.sleep)}
          unit={available(health.sleep) ? "hours" : "Unavailable"}
          reasonUnavailable={dataSource === "unavailable" ? "Your health source is connected, but no recent reading is available." : !isDemoMode ? "Demo mode is off. Enable Demo Mode or pair a watch to view readings." : "Connect your watch or Health Connect to see live readings."}
          source={available(health.sleep) ? formatHumanSourceLabel(health.source) : undefined}
          isLive={Boolean(dataSource === "real" && available(health.sleep))}
          isDemo={Boolean(dataSource === "demo")}
          updatedAgo={health.timestamp ? formatTimeAgo(new Date(health.timestamp)) : undefined}
          onCheckHealthConnect={onOpenDeviceModal}
          variant="pink"
        />
        <DetailedHealthCard
          title="Body Temperature"
          icon="♨"
          value={display(health.temperature)}
          unit={available(health.temperature) ? "°C" : "Unavailable"}
          reasonUnavailable={dataSource === "unavailable" ? "Your health source is connected, but no recent reading is available." : !isDemoMode ? "Demo mode is off. Enable Demo Mode or pair a watch to view readings." : "Connect your watch or Health Connect to see live readings."}
          source={available(health.temperature) ? (bleStatus.isConnected && health.source?.includes("Bluetooth") ? "Bluetooth Wearable" : formatHumanSourceLabel(health.source)) : undefined}
          isLive={Boolean(dataSource === "real" && available(health.temperature))}
          isDemo={Boolean(dataSource === "demo")}
          updatedAgo={health.timestamp ? formatTimeAgo(new Date(health.timestamp)) : undefined}
          onCheckHealthConnect={onOpenDeviceModal}
          variant="cream"
        />
      </section>

      {/* 24-HOUR TREND VISUALIZER */}
      <section className="notice-card" style={{ display: "block", marginTop: "22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong>24-Hour Heart Rate Baseline Trend</strong>
          <span className="ls-badge ls-badge-info">{trends.length} Readings Logged</span>
        </div>

        <div className="ls-trend-bar-wrapper">
          {trends.length > 0 ? (
            trends.map((t, idx) => (
              <div key={idx} className="ls-trend-bar-col">
                <div
                  className="ls-trend-bar-inner"
                  style={{ height: `${Math.min(100, Math.max(15, (t.heart_rate || 70) - 30))}%` }}
                  title={`${t.heart_rate || 70} BPM`}
                />
                <span style={{ fontSize: "9px", color: "#958fb4" }}>{t.heart_rate || 70}</span>
              </div>
            ))
          ) : (
            <div style={{ padding: "16px", color: "#94a3b8", fontSize: "12px", textAlign: "center", width: "100%" }}>
              No historical trend records logged yet. Synchronize your wearable or Health Connect to view real baseline trends.
            </div>
          )}
        </div>
      </section>

      {/* HONESTY NOTICE */}
      <section className="notice-card">
        <span>ⓘ</span>
        <div>
          <strong>LifeShield does not invent measurements.</strong>
          <p>
            If your phone or wearable does not expose a metric, it remains honest and unavailable until real data is
            received.
          </p>
        </div>
      </section>
    </>
  );
}

/* =========================================================
   3. SAFETY SCREEN COMPONENT
========================================================= */
function SafetyScreen({
  contacts,
  currentLocation,
  fallDetectionActive,
  onToggleFallDetection,
  onStartSos,
  onTestFall,
  onOpenContacts,
  onOpenMap,
  onRefreshLocation,
}: {
  contacts: EmergencyContactItem[];
  currentLocation: GeoLocationResult | null;
  fallDetectionActive: boolean;
  onToggleFallDetection: () => void;
  onStartSos: () => void;
  onTestFall: () => void;
  onOpenContacts: () => void;
  onOpenMap: () => void;
  onRefreshLocation: () => void;
}) {
  return (
    <>
      <PageHeading
        label="EMERGENCY DISPATCH"
        title="You're protected"
        description="Hardware fall detection (works in background), live GPS coordinates, and automated emergency contacts."
      />

      {/* EMERGENCY SOS CARD */}
      <section className="emergency-card">
        <div>
          <span>EMERGENCY SOS</span>
          <h2>Need help?</h2>
          <p>Triggers 10-second siren countdown before alerting emergency contacts.</p>
        </div>

        <button className="sos-button" type="button" onClick={onStartSos}>
          SOS
        </button>
      </section>

      {/* SAFETY OPTIONS DIRECTORY */}
      <section className="safety-options">
        <SafetyOption
          icon="🚨"
          title="Test SOS (10s countdown)"
          description="Simulate the full SOS flow: siren, GPS capture, emergency message, and contact dispatch (simulated)"
          onClick={onStartSos}
        />

        <SafetyOption
          icon="👥"
          title={`Emergency contacts (${contacts.length})`}
          description={
            contacts.length > 0
              ? `Primary: ${contacts[0].name} (${contacts[0].phone})`
              : "Configure family, caregivers, or physicians"
          }
          onClick={onOpenContacts}
        />

        <SafetyOption
          icon="📍"
          title="Hardware GPS Location"
          description={
            currentLocation
              ? `Lat: ${currentLocation.latitude.toFixed(4)}, Lng: ${currentLocation.longitude.toFixed(4)} (Accuracy: ${Math.round(currentLocation.accuracyMeters)}m)`
              : "Resolving GPS coordinates from device..."
          }
          onClick={onRefreshLocation}
        />

        {/* FALL DETECTION TOGGLE CARD */}
        <div
          style={{
            background: fallDetectionActive
              ? "linear-gradient(135deg, #065f46, #047857)"
              : "linear-gradient(135deg, #4a4458, #6a6486)",
            borderRadius: "18px",
            padding: "16px 18px",
            marginBottom: "12px",
            color: "#fff",
            cursor: "pointer",
            border: fallDetectionActive ? "2px solid #34d399" : "2px solid #8880a0",
            transition: "all 0.3s ease",
          }}
          onClick={onToggleFallDetection}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onToggleFallDetection(); }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "22px" }}>🏃</span>
              <div>
                <strong style={{ fontSize: "14px", fontWeight: 700 }}>Fall Detection</strong>
              </div>
            </div>
            {/* Toggle switch */}
            <div
              style={{
                width: "52px",
                height: "28px",
                borderRadius: "14px",
                background: fallDetectionActive ? "#34d399" : "#555",
                position: "relative",
                transition: "background 0.3s ease",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: "22px",
                  height: "22px",
                  borderRadius: "50%",
                  background: "#fff",
                  position: "absolute",
                  top: "3px",
                  left: fallDetectionActive ? "27px" : "3px",
                  transition: "left 0.3s ease",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                }}
              />
            </div>
          </div>
          <p style={{ margin: 0, fontSize: "12px", opacity: 0.9, lineHeight: 1.5 }}>
            {fallDetectionActive
              ? "Active — monitoring continues in background, with screen locked, and when display is off."
              : "Tap to enable. Monitors accelerometer for falls even when app is in the background."}
          </p>
          {fallDetectionActive && (
            <div style={{
              marginTop: "8px",
              padding: "4px 10px",
              background: "rgba(255,255,255,0.15)",
              borderRadius: "8px",
              display: "inline-block",
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.3px",
            }}>
              ● FALL DETECTION ACTIVE
            </div>
          )}
        </div>

        <SafetyOption
          icon="🚨"
          title="Test 30s fall countdown & siren"
          description="Simulate high-G fall impact with audible siren and I'M OK cancel button"
          onClick={onTestFall}
        />

        <SafetyOption
          icon="🏥"
          title="Safety map & trauma centers"
          description="Find closest hospitals, emergency rooms, and pharmacies"
          onClick={onOpenMap}
        />
      </section>
    </>
  );
}

/* =========================================================
   4. AI SCREEN COMPONENT
========================================================= */
function AIScreen({
  messages,
  input,
  setInput,
  isLoading,
  voiceSettings,
  onSendMessage,
  onToggleVoice,
  onToast,
}: {
  messages: ChatMessage[];
  input: string;
  setInput: (v: string) => void;
  isLoading: boolean;
  voiceSettings: VoiceSettings;
  onSendMessage: (text?: string) => void;
  onToggleVoice: () => void;
  onToast?: (message: string, type?: "info" | "success" | "warning") => void;
}) {
  const [isListening, setIsListening] = useState(false);

  const startVoiceInput = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      if (onToast) {
        onToast("Voice input is not supported in this browser. Please use Chrome or Edge.", "warning");
      }
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = voiceSettings.language === "te" ? "te-IN" : voiceSettings.language === "hi" ? "hi-IN" : "en-IN";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript?.trim();
        if (transcript) {
          setInput(transcript);
          onSendMessage(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("[LifeShield Voice] Speech recognition error:", event.error);
        setIsListening(false);
        if (event.error === "not-allowed") {
          if (onToast) onToast("Microphone access was denied. Please allow microphone permissions in browser settings.", "warning");
        } else if (event.error !== "no-speech") {
          if (onToast) onToast("Speech recognition note: " + event.error, "warning");
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (e: any) {
      console.warn("[LifeShield Voice] Could not start speech recognition:", e);
      setIsListening(false);
      if (onToast) onToast("Could not start speech recognition: " + (e.message || String(e)), "warning");
    }
  };

  return (
    <>
      <PageHeading
        label="CLINICAL AI COMPANION"
        title="LifeShield AI"
        description="Clinical reasoning engine with safety guardrails. In an emergency, always call 112 / 108."
      />

      <section className="ai-screen-card">
        {/* HEADER */}
        <div className="ai-top">
          <div className="ai-logo">✦</div>
          <div style={{ flex: 1 }}>
            <strong>LifeShield Clinical Engine</strong>
            <span>Context-aware • Multi-lingual • Evidence-based</span>
          </div>
          <button
            type="button"
            className="ls-btn-secondary"
            style={{ padding: "6px 12px", fontSize: "11px" }}
            onClick={onToggleVoice}
          >
            {voiceSettings.masterVoiceEnabled ? "🔊 Voice ON" : "🔇 Voice OFF"}
          </button>
        </div>

        {/* MESSAGES LIST */}
        <div style={{ maxHeight: "380px", overflowY: "auto", margin: "18px 0" }}>
          {messages.map((m) => (
            <div
              key={m.id}
              className="ai-bubble"
              style={{
                background: m.sender === "user" ? "#f5f3fc" : "#eeecff",
                marginLeft: m.sender === "user" ? "40px" : "0",
                marginRight: m.sender === "user" ? "0" : "40px",
                borderLeft: m.sender === "assistant" ? "4px solid #7c74c8" : "none",
              }}
            >
              <strong>{m.sender === "user" ? "You" : "LifeShield AI"}</strong>
              <p>{m.text}</p>
              <small>
                {m.timestamp} {m.source ? `• Engine: ${m.source}` : ""}
              </small>
            </div>
          ))}
          {isLoading && (
            <div className="ai-bubble" style={{ color: "#7771bd", fontStyle: "italic" }}>
              LifeShield AI is analyzing your clinical context...
            </div>
          )}
        </div>

        {/* PROMPT SUGGESTIONS */}
        <div className="ai-suggestions">
          <button type="button" onClick={() => onSendMessage("Explain my current heart rate and oxygen saturation.")}>
            Explain my health data
          </button>
          <button type="button" onClick={() => onSendMessage("How do today's weather and AQI affect my respiratory risk?")}>
            Environment today
          </button>
          <button type="button" onClick={() => onSendMessage("What should I do if I feel dehydrated in high heat?")}>
            Heat risk precautions
          </button>
        </div>

        {/* INPUT */}
        <div className="ai-input">
          <button
            type="button"
            onClick={startVoiceInput}
            style={{
              background: isListening ? "#ef4444" : "#f1f5f9",
              color: isListening ? "#ffffff" : "#64748b",
              border: "none",
              borderRadius: "10px",
              width: "36px",
              height: "36px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
              marginRight: "6px",
              transition: "all 0.2s ease",
              flexShrink: 0,
            }}
            title={isListening ? "Listening... speak now" : "Voice input"}
            aria-label="Voice input"
          >
            {isListening ? "🎙️" : "🎤"}
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isLoading) {
                e.preventDefault();
                onSendMessage();
              }
            }}
            placeholder={isListening ? "Listening... speak your question now" : "Ask LifeShield clinical assistant..."}
          />
          <button type="button" onClick={() => !isLoading && onSendMessage()} disabled={isLoading} aria-label="Send message">
            ↑
          </button>
        </div>
      </section>
    </>
  );
}

/* =========================================================
   5. PROFILE SCREEN COMPONENT
========================================================= */
function ProfileScreen({
  user,
  baselineRestingHr,
  baselineSpo2Floor,
  baselineSaving,
  baselineSavedSuccess,
  onSetBaselineHr,
  onSetBaselineSpo2,
  onSaveBaseline,
  onOpenAuth,
  onOpenPermissions,
  onOpenReminders,
  onOpenDeviceModal,
  onOpenEmergencySettings,
  onLogout,
  onExportRecords,
  onClearCache,
  isDemoMode,
  onToggleDemoMode,
}: {
  user: UserAccount | null;
  baselineRestingHr: number;
  baselineSpo2Floor: number;
  baselineSaving: boolean;
  baselineSavedSuccess: boolean;
  onSetBaselineHr: (v: number) => void;
  onSetBaselineSpo2: (v: number) => void;
  onSaveBaseline: () => void;
  onOpenAuth: () => void;
  onOpenPermissions: () => void;
  onOpenReminders: () => void;
  onOpenDeviceModal: () => void;
  onOpenEmergencySettings: () => void;
  onLogout: () => void;
  onExportRecords: () => void;
  onClearCache: () => void;
  isDemoMode?: boolean;
  onToggleDemoMode?: (enabled: boolean) => void;
}) {
  return (
    <>
      <PageHeading
        label="ACCOUNT & SETTINGS"
        title="Your profile"
        description="Personal baseline calibration and privacy controls."
      />

      {/* PROFILE BANNER */}
      <section className="profile-banner">
        <div className="profile-photo">{user?.full_name ? user.full_name.charAt(0).toUpperCase() : "P"}</div>
        <div style={{ flex: 1, textAlign: "left" }}>
          <h2>{user?.full_name || "LifeShield Guest"}</h2>
          <p>{user?.email || "Local zero-config resilience mode"}</p>
        </div>
        <button
          className="ls-btn-secondary"
          style={{ background: "rgba(255,255,255,0.9)" }}
          onClick={user ? onLogout : onOpenAuth}
        >
          {user ? "Sign Out" : "Sign In"}
        </button>
      </section>

      {/* PERSONAL BASELINE CALIBRATION */}
      <section className="notice-card" style={{ display: "block", marginTop: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <strong>Personal Learned Baseline Thresholds</strong>
          <button
            className="ls-btn-primary"
            style={{ padding: "6px 14px", fontSize: "11px" }}
            onClick={onSaveBaseline}
            disabled={baselineSaving}
          >
            {baselineSaving ? "Saving..." : baselineSavedSuccess ? "✓ Saved" : "Save Baseline"}
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#6a6486" }}>
              <span>Resting Heart Rate Floor</span>
              <strong>{baselineRestingHr} BPM</strong>
            </div>
            <input
              type="range"
              min={50}
              max={95}
              value={baselineRestingHr}
              onChange={(e) => onSetBaselineHr(Number(e.target.value))}
              style={{ width: "100%", marginTop: "6px" }}
            />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#6a6486" }}>
              <span>SpO2 Oxygen Floor</span>
              <strong>{baselineSpo2Floor}%</strong>
            </div>
            <input
              type="range"
              min={88}
              max={98}
              value={baselineSpo2Floor}
              onChange={(e) => onSetBaselineSpo2(Number(e.target.value))}
              style={{ width: "100%", marginTop: "6px" }}
            />
          </div>
        </div>
      </section>

      {/* SETTINGS MENU */}
      <section className="settings-container">
        {onToggleDemoMode && (
          <Setting
            icon="🧪"
            title="Presentation Demo Data Mode"
            description={
              isDemoMode
                ? "Active: Simulating clinical vitals for SIH evaluation"
                : "Disabled: Real wearable telemetry required"
            }
            badge={isDemoMode ? "DEMO ON" : "OFF"}
            onClick={() => onToggleDemoMode(!isDemoMode)}
          />
        )}
        <Setting icon="🔒" title="Native Android permissions" description="Location, body sensors, and Health Connect" onClick={onOpenPermissions} />
        <Setting icon="⌚" title="Connected smartwatches" description="Web Bluetooth GATT and Health Connect" onClick={onOpenDeviceModal} />
        <Setting icon="⏰" title="Medicine & wellness reminders" description="Manage reminders and dosage audit trail" onClick={onOpenReminders} />
        <Setting icon="🚨" title="Emergency service number" description="Configure ambulance / emergency phone number" onClick={onOpenEmergencySettings} />
        <Setting
          icon="📦"
          title="Export health records (JSON)"
          description="Download all locally recorded telemetry"
          onClick={onExportRecords}
        />
        <Setting
          icon="🗑️"
          title="Clear local data cache"
          description="Erase locally stored offline telemetry"
          onClick={onClearCache}
        />
      </section>
    </>
  );
}

/* =========================================================
   6. ATOMIC PASTEL CARDS & BUTTONS
========================================================= */
function PageHeading({ label, title, description }: { label: string; title: string; description: string }) {
  return (
    <section className="page-heading">
      <span>{label}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </section>
  );
}

function MiniHealthCard({
  icon,
  title,
  value,
  unit,
  variant,
  isLive,
  isDemo,
}: {
  icon: string;
  title: string;
  value: string;
  unit: string;
  variant: string;
  isLive?: boolean;
  isDemo?: boolean;
}) {
  const isUnavailable = value === "—" || value === "Unavailable" || !value;

  return (
    <div className={`mini-health-card ${variant}`}>
      <div className="mini-icon">{icon}</div>
      <span className="mini-title">{title}</span>
      <strong style={{ fontSize: isUnavailable ? "18px" : undefined, color: isUnavailable ? "#94a3b8" : undefined }}>
        {isUnavailable ? "Unavailable" : value}
      </strong>
      <small style={{ color: isUnavailable ? "#94a3b8" : undefined }}>
        {isUnavailable ? "No record found" : unit}
      </small>
      {isLive && !isUnavailable && (
        <div style={{ fontSize: "9px", color: "#10b981", fontWeight: "bold", display: "flex", alignItems: "center", gap: "3px", marginTop: "3px" }}>
          <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#10b981" }} />
          LIVE DATA
        </div>
      )}
      {isDemo && !isUnavailable && (
        <div style={{ fontSize: "9px", color: "#d97706", fontWeight: "bold", display: "flex", alignItems: "center", gap: "3px", marginTop: "3px" }}>
          <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#d97706" }} />
          DEMO DATA
        </div>
      )}
    </div>
  );
}

function DetailedHealthCard({
  title,
  icon,
  value,
  unit,
  variant,
  source,
  isLive,
  isDemo,
  updatedAgo,
  reasonUnavailable,
  onCheckHealthConnect,
}: {
  title: string;
  icon: string;
  value: string;
  unit: string;
  variant: string;
  source?: string;
  isLive?: boolean;
  isDemo?: boolean;
  updatedAgo?: string;
  reasonUnavailable?: string;
  onCheckHealthConnect?: () => void;
}) {
  const isUnavailable = value === "—" || value === "Unavailable" || !value;

  return (
    <div className={`detail-card ${variant}`}>
      <div className="detail-icon">{icon}</div>
      <span>{title}</span>
      <strong style={{ fontSize: isUnavailable ? "20px" : undefined, color: isUnavailable ? "#94a3b8" : undefined }}>
        {isUnavailable ? "Unavailable" : value}
      </strong>
      <small style={{ color: isUnavailable ? "#94a3b8" : undefined }}>
        {isUnavailable ? (reasonUnavailable || "No record found in Health Connect") : unit}
      </small>

      {isUnavailable && onCheckHealthConnect && (
        <button
          type="button"
          onClick={onCheckHealthConnect}
          style={{
            marginTop: "10px",
            padding: "6px 12px",
            fontSize: "11px",
            fontWeight: 600,
            borderRadius: "10px",
            background: "rgba(59, 130, 246, 0.12)",
            color: "#38bdf8",
            border: "1px solid rgba(56, 189, 248, 0.3)",
            cursor: "pointer",
            width: "100%",
            transition: "all 0.2s ease",
          }}
        >
          Check Health Connect
        </button>
      )}

      {!isUnavailable && (
        <div style={{ marginTop: "8px", paddingTop: "6px", borderTop: "1px solid rgba(148, 163, 184, 0.15)", fontSize: "10px", textAlign: "left" }}>
          <div style={{ color: "#94a3b8", overflowWrap: "anywhere", wordBreak: "break-word" }}>Source: {formatHumanSourceLabel(source) || (isDemo ? "Simulated Demo" : "Health Source")}</div>
          {isLive ? (
            <div style={{ color: "#10b981", fontWeight: "bold", display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981" }} />
              LIVE DATA • {updatedAgo || "active"}
            </div>
          ) : isDemo ? (
            <div style={{ color: "#d97706", fontWeight: "bold", display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#d97706" }} />
              DEMO DATA • Connect device for live
            </div>
          ) : (
            <div style={{ color: "#64748b", marginTop: "2px" }}>
              {updatedAgo ? `Updated ${updatedAgo}` : "Record verified"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SafetyOption({
  icon,
  title,
  description,
  onClick,
}: {
  icon: string;
  title: string;
  description: string;
  onClick?: () => void;
}) {
  return (
    <button className="safety-option" type="button" onClick={onClick}>
      <div className="safety-option-icon">{icon}</div>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <span>→</span>
    </button>
  );
}

function Setting({
  icon,
  title,
  description,
  badge,
  onClick,
}: {
  icon: string;
  title: string;
  description: string;
  badge?: string;
  onClick?: () => void;
}) {
  return (
    <button className="setting" type="button" onClick={onClick}>
      <div className="setting-icon">{icon}</div>
      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <strong>{title}</strong>
          {badge && (
            <span
              style={{
                fontSize: "10px",
                fontWeight: 800,
                padding: "2px 8px",
                borderRadius: "10px",
                background: badge.includes("ON") ? "#7c3aed" : "#f1f5f9",
                color: badge.includes("ON") ? "#ffffff" : "#64748b",
              }}
            >
              {badge}
            </span>
          )}
        </div>
        <span>{description}</span>
      </div>
      <b>→</b>
    </button>
  );
}

function NavButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`nav-button ${active ? "active" : ""}`} type="button" onClick={onClick}>
      <span>{icon}</span>
      <small>{label}</small>
    </button>
  );
}

function PermissionsModal({ onClose }: { onClose: () => void }) {
  const [groups, setGroups] = useState<PermissionGroupInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await permissionService.checkAllPermissions();
    setGroups(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleRequest = async (key: PermissionGroupKey) => {
    setRequesting(key);
    try {
      await permissionService.requestPermission(key);
      await refresh();
    } catch (err) {
      console.warn("[PermissionsModal] Request failed:", err);
    } finally {
      setRequesting(null);
    }
  };

  return (
    <div className="ls-modal-overlay" onClick={onClose}>
      <div className="ls-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "80vh", overflow: "auto" }}>
        <div className="ls-modal-header">
          <h3>Permissions Status</h3>
          <button className="ls-close-btn" onClick={onClose}>✕</button>
        </div>

        <div style={{ textAlign: "left", fontSize: "12px", color: "#4f4a64" }}>
          {loading ? (
            <div style={{ padding: "20px 0", textAlign: "center", color: "#7c3aed" }}>Checking permissions...</div>
          ) : (
            <>
              {groups.map((g) => (
                <div
                  key={g.key}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 0",
                    borderBottom: "1px solid #f0edf7",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span>{g.icon}</span>
                    <div>
                      <strong style={{ color: "#342f4c" }}>{g.title}</strong>
                      {g.critical && (
                        <span style={{ fontSize: "10px", color: "#dc2626", marginLeft: "6px" }}>Critical</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {g.status === "granted" ? (
                      <span className="ls-badge ls-badge-success">Granted</span>
                    ) : g.status === "not_required" ? (
                      <span className="ls-badge ls-badge-info">N/A</span>
                    ) : (
                      <>
                        <span className="ls-badge ls-badge-info">Not granted</span>
                        {g.key === "healthConnect" ? (
                          <button
                            className="ls-btn-secondary"
                            style={{ padding: "4px 10px", fontSize: "10px" }}
                            type="button"
                            onClick={() => permissionService.openHealthConnectSettings()}
                          >
                            Set up
                          </button>
                        ) : (
                          <button
                            className="ls-btn-secondary"
                            style={{ padding: "4px 10px", fontSize: "10px" }}
                            type="button"
                            disabled={requesting === g.key}
                            onClick={() => handleRequest(g.key)}
                          >
                            {requesting === g.key ? "..." : "Allow"}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}

              <div style={{ display: "flex", gap: "10px", marginTop: "18px" }}>
                <button
                  className="ls-btn-secondary"
                  style={{ flex: 1 }}
                  type="button"
                  onClick={() => permissionService.openAppSettings()}
                >
                  Android Settings
                </button>
                <button
                  className="ls-btn-secondary"
                  style={{ flex: 1 }}
                  type="button"
                  onClick={refresh}
                >
                  Refresh
                </button>
                <button
                  className="ls-btn-primary"
                  style={{ flex: 1 }}
                  type="button"
                  onClick={onClose}
                >
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;