import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { VitalsData, HistoricalHealthDataPoint, DataSourceMode, DataSourceConnection } from '../types/health';
import { EnvironmentalData, OfficialDisasterAlert } from '../types/environment';
import { UserProfile, PrivacyPreferences, LanguageCode } from '../types/user';
import { FallDetectionEvent, EmergencyDispatchPayload } from '../types/emergency';
import { AIRiskEngine, AIAnalysisResult } from '../services/aiRiskEngine';
import { apiClient } from '../services/apiClient';
import { soundService } from '../services/soundService';
import { fallDetectionService } from '../services/fallDetectionService';
import { LocationService, GeoLocationResult } from '../services/locationService';
import { StorageService } from '../services/storageService';
import { translations, TranslationDict } from '../services/i18nService';
import { SimulationScenario, SensorSimulator } from '../services/sensorSimulator';

export type ActiveTab = 'home' | 'health' | 'environment' | 'emergency' | 'profile' | 'privacy';

interface AppContextType {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  vitals: VitalsData;
  environment: EnvironmentalData;
  user: UserProfile;
  privacyPrefs: PrivacyPreferences;
  aiAnalysis: AIAnalysisResult;
  disasterAlerts: OfficialDisasterAlert[];
  historicalTrends: HistoricalHealthDataPoint[];
  currentLocation: GeoLocationResult;

  // Fall & Countdown State
  fallAlertOpen: boolean;
  fallCountdown: number;
  activeFallEvent: FallDetectionEvent | null;

  // Emergency Mode
  emergencyModeActive: boolean;
  emergencyDispatchPayload: EmergencyDispatchPayload | null;

  // Audio Beacon
  isBeaconActive: boolean;

  // Demo Suite / Presentation controls
  demoPanelOpen: boolean;
  setDemoPanelOpen: (open: boolean) => void;
  activeScenario: SimulationScenario;
  changeScenario: (scenario: SimulationScenario) => void;

  // Actions
  triggerSimulatedFall: () => void;
  handleUserOk: () => void;
  handleUserNeedHelp: () => void;
  triggerManualSos: () => void;
  exitEmergencyMode: () => void;
  toggleAudioBeacon: () => void;
  updateUser: (updater: (prev: UserProfile) => UserProfile) => void;
  updatePrivacy: (updater: (prev: PrivacyPreferences) => PrivacyPreferences) => void;
  updateLiveVitals: (partial: Partial<VitalsData>) => void;

  // Region Selection
  selectedRegion: string;
  setRegion: (cityName: string) => void;

  // Internationalization
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: TranslationDict;

  // Backend Sync Status
  backendConnected: boolean;
  refreshBackendData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [user, setUser] = useState<UserProfile>(() => StorageService.getUserProfile());
  const [privacyPrefs, setPrivacyPrefs] = useState<PrivacyPreferences>(() => StorageService.getPrivacyPrefs());
  const [language, setLanguageState] = useState<LanguageCode>(user.primaryLanguage || 'en');
  const [backendConnected, setBackendConnected] = useState<boolean>(true);

  // Demo / Simulation suite
  const [demoPanelOpen, setDemoPanelOpen] = useState(false);
  const [activeScenario, setActiveScenario] = useState<SimulationScenario>('NORMAL_BASELINE');

  // Initialize with demo vitals so dashboard always has values immediately.
  // These get replaced with real data when backend/sync provides it.
  console.log('[LifeShield Health] Initializing vitals with DEMO data');
  const [vitals, setVitals] = useState<VitalsData>({
    heartRate: 72,
    spO2: 98,
    bodyTemperature: 36.6,
    activityLevel: 'light',
    stepsCount: 4250,
    sleepHours: 7.33,
    hydrationIndex: 55,
    fatigueIndex: null,
    respirationRate: 16,
    bloodPressureSys: 118,
    bloodPressureDia: 76,
    timestamp: new Date().toISOString(),
    source: 'manual',
    dataSource: 'demo',
    connectionState: 'NOT_CONNECTED_DEMO',
  });

  const [environment, setEnvironment] = useState<EnvironmentalData>({
    locationName: 'Gachibowli, Hyderabad, Telangana',
    ambientTempC: 30.2,
    humidityPercent: 58,
    heatIndexC: 32.1,
    wetBulbTempC: 24.5,
    heatRiskLevel: 'LOW',
    aqi: 68,
    pm25: 20.4,
    pm10: 45.0,
    pollutionCategory: 'MODERATE',
    uvIndex: 6,
    isOutdoor: false,
    sunExposureMins: 0,
    lastUpdated: new Date().toLocaleTimeString(),
  });

  const [disasterAlerts, setDisasterAlerts] = useState<OfficialDisasterAlert[]>([]);
  const [historicalTrends, setHistoricalTrends] = useState<HistoricalHealthDataPoint[]>([]);

  const [currentLocation, setCurrentLocation] = useState<GeoLocationResult>({
    latitude: 17.3850,
    longitude: 78.4867,
    accuracyMeters: 15,
    cityName: 'Hyderabad',
    stateName: 'Telangana',
    formattedAddress: 'Gachibowli, Hyderabad, Telangana 500032',
    source: 'GPS_HARDWARE',
  });

  const [selectedRegion, setSelectedRegionState] = useState<string>(() => {
    return StorageService.getSelectedRegion() || 'Hyderabad';
  });

  // Fall Alert Modal & Countdown
  const [fallAlertOpen, setFallAlertOpen] = useState(false);
  const [fallCountdown, setFallCountdown] = useState(30);
  const [activeFallEvent, setActiveFallEvent] = useState<FallDetectionEvent | null>(null);

  // Emergency Mode
  const [emergencyModeActive, setEmergencyModeActive] = useState(false);
  const [emergencyDispatchPayload, setEmergencyDispatchPayload] = useState<EmergencyDispatchPayload | null>(null);
  const [isBeaconActive, setIsBeaconActive] = useState(false);

  const countdownIntervalRef = useRef<number | null>(null);

  // Fetch real data from FastAPI Backend
  const refreshBackendData = useCallback(async () => {
    try {
      // 1. Fetch live environment from Open-Meteo via backend
      const envRes = await apiClient.environment.get({ region: selectedRegion });
      if (envRes) {
        setEnvironment({
          locationName: envRes.region_name || selectedRegion,
          ambientTempC: envRes.temperature_c,
          humidityPercent: envRes.humidity_percent,
          heatIndexC: envRes.heat_index_c,
          wetBulbTempC: Math.round(envRes.temperature_c * 0.7 + (envRes.humidity_percent / 100) * 8),
          heatRiskLevel: envRes.heat_index_c >= 40 ? 'CRITICAL' : envRes.heat_index_c >= 35 ? 'HIGH' : 'LOW',
          aqi: envRes.aqi,
          pm25: envRes.pm2_5,
          pm10: Math.round(envRes.pm2_5 * 2.1),
          pollutionCategory: (envRes.aqi_level || 'MODERATE').toUpperCase() as any,
          uvIndex: 6,
          isOutdoor: false,
          sunExposureMins: 15,
          lastUpdated: new Date().toLocaleTimeString(),
        });

        if (envRes.advisories && envRes.advisories.length > 0) {
          setDisasterAlerts(envRes.advisories.map((a: any) => ({
            id: a.id || `adv-${Date.now()}`,
            agency: (a.agency || 'IMD') as any,
            hazardType: (a.category?.toUpperCase() || 'HEAT_WAVE') as any,
            headline: a.title || 'Advisory Alert',
            severity: (a.severity?.toUpperCase() || 'RED_WARNING') as any,
            affectedRegion: a.affected_region || selectedRegion,
            effectiveUntil: a.effective_until || '24 hours',
            instructions: Array.isArray(a.description) ? a.description : [a.description || 'Follow safety protocols.'],
            helpline: '112 / 108',
            isOfficialSource: true,
          })));
        }
      }

      // 2. Fetch latest health summary if exists
      const healthSummary = await apiClient.health.getSummary();

      // Validate whether the backend reading contains real physiological data.
      // A reading with heart_rate=0 or all-null fields is NOT real data.
      const hasValidReading = (s: any): boolean => {
        if (!s || !s.latest) return false;
        const l = s.latest;
        const hr = l.heart_rate;
        const spo2 = l.spo2;
        const steps = l.steps;
        const temp = l.body_temperature;
        const hasHR = typeof hr === 'number' && hr > 0 && hr < 300;
        const hasSpO2 = typeof spo2 === 'number' && spo2 > 0 && spo2 <= 100;
        const hasSteps = typeof steps === 'number' && steps > 0;
        const hasTemp = typeof temp === 'number' && temp > 30 && temp < 45;
        return hasHR || hasSpO2 || hasSteps || hasTemp;
      };

      if (healthSummary && hasValidReading(healthSummary)) {
        const l = healthSummary.latest;
        const sourceIsReal = l.source && !l.source.toLowerCase().includes('demo');

        console.log('[LifeShield Health] Real health data found from backend:', {
          source: l.source,
          heart_rate: l.heart_rate,
          spo2: l.spo2,
          steps: l.steps,
          temperature: l.body_temperature,
        });

        setVitals(prev => ({
          ...prev,
          heartRate: l.heart_rate,
          spO2: l.spo2,
          stepsCount: healthSummary.total_steps_today || l.steps,
          bodyTemperature: l.body_temperature,
          bloodPressureSys: l.systolic_bp,
          bloodPressureDia: l.diastolic_bp,
          timestamp: l.timestamp,
          source: l.source || 'ble',
          dataSource: sourceIsReal ? 'real' : 'demo',
          lastSyncTime: new Date().toLocaleTimeString(),
          connectionState: sourceIsReal ? 'CONNECTED_REAL_DATA' : 'NOT_CONNECTED_DEMO',
        }));

        console.log('[LifeShield Health] Using', sourceIsReal ? 'REAL' : 'DEMO', 'vitals');
      } else {
        if (healthSummary && healthSummary.latest) {
          console.log('[LifeShield Health] Backend returned reading but it has no valid vital signs (e.g. heart_rate=0). Using DEMO.');
        } else {
          console.log('[LifeShield Health] No backend health data, using DEMO');
        }
        // No real data available - show demo for dashboard functionality
        setVitals(prev => ({
          ...prev,
          heartRate: 72,
          spO2: 98,
          bodyTemperature: 36.6,
          stepsCount: 4250,
          sleepHours: 7.33,
          activityLevel: 'light',
          timestamp: new Date().toISOString(),
          source: 'manual',
          dataSource: 'demo',
          lastSyncTime: new Date().toLocaleTimeString(),
          connectionState: 'NOT_CONNECTED_DEMO',
        }));
      }

      // 3. Fetch trends
      const trends = await apiClient.health.getTrends(24);
      if (trends && trends.length > 0) {
        setHistoricalTrends(trends.map((t: any) => ({
          timeLabel: t.timestamp,
          heartRate: t.heart_rate,
          spO2: t.spo2,
          temperature: t.body_temperature,
          activityScore: t.steps ? Math.min(100, Math.round(t.steps / 80)) : 40,
          riskScore: 20,
        })));
      }

      // 4. Fetch emergency contacts
      const contacts = await apiClient.contacts.list();
      if (contacts && contacts.length > 0) {
        setUser(prev => ({
          ...prev,
          emergencyContacts: contacts.map((c: any) => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            relationship: c.relation || 'Contact',
            priority: (c.priority || 1) as 1 | 2 | 3,
            autoNotify: c.auto_notify ?? true,
          })),
        }));
      }

      setBackendConnected(true);
    } catch (err) {
      console.warn('[LifeShield Health] Backend sync failed, using existing vitals:', err);
      console.log('[LifeShield Health] Data source: DEMO (backend unavailable)');
      setBackendConnected(false);
    }
  }, [selectedRegion]);

  // Initial load
  useEffect(() => {
    refreshBackendData();
    LocationService.getCurrentLocation().then(loc => {
      setCurrentLocation(loc);
    });
  }, [refreshBackendData]);

  // Start Real Hardware Fall Detection
  useEffect(() => {
    fallDetectionService.startListening((event) => {
      setActiveFallEvent(event);
      setFallCountdown(30);
      setFallAlertOpen(true);
    });

    return () => {
      fallDetectionService.stopListening();
    };
  }, []);

  // Sync language with user profile
  const setLanguage = useCallback((lang: LanguageCode) => {
    setLanguageState(lang);
    setUser(prev => {
      const updated = { ...prev, primaryLanguage: lang };
      StorageService.saveUserProfile(updated);
      return updated;
    });
  }, []);

  const updateUser = useCallback((updater: (prev: UserProfile) => UserProfile) => {
    setUser(prev => {
      const next = updater(prev);
      StorageService.saveUserProfile(next);
      return next;
    });
  }, []);

  const updatePrivacy = useCallback((updater: (prev: PrivacyPreferences) => PrivacyPreferences) => {
    setPrivacyPrefs(prev => {
      const next = updater(prev);
      StorageService.savePrivacyPrefs(next);
      return next;
    });
  }, []);

  // Update live vitals and sync to backend
  const updateLiveVitals = useCallback((partial: Partial<VitalsData>) => {
    setVitals(prev => {
      const next: VitalsData = {
        ...prev,
        ...partial,
        timestamp: new Date().toISOString(),
      };

      // Validate whether incoming data contains real physiological values.
      // A heart_rate of 0 or all-null fields is NOT real data.
      const hasValidVitals = (data: Partial<VitalsData>): boolean => {
        const hr = data.heartRate;
        const spo2 = data.spO2;
        const steps = data.stepsCount;
        const temp = data.bodyTemperature;
        const hasHR = typeof hr === 'number' && hr > 0 && hr < 300;
        const hasSpO2 = typeof spo2 === 'number' && spo2 > 0 && spo2 <= 100;
        const hasSteps = typeof steps === 'number' && steps > 0;
        const hasTemp = typeof temp === 'number' && temp > 30 && temp < 45;
        return hasHR || hasSpO2 || hasSteps || hasTemp;
      };

      // Determine data source based on incoming source AND data validity
      if (partial.source === 'ble' || partial.source === 'health_connect') {
        if (hasValidVitals(partial)) {
          next.dataSource = 'real';
          next.connectionState = 'CONNECTED_REAL_DATA';
        } else {
          next.dataSource = 'demo';
          next.connectionState = 'NOT_CONNECTED_DEMO';
        }
      } else if (partial.source === 'manual') {
        // Manual entries from user form are real user-logged data
        next.dataSource = 'real';
        next.connectionState = 'CONNECTED_REAL_DATA';
      }

      console.log('[LifeShield Health] updateLiveVitals:', {
        source: next.source,
        dataSource: next.dataSource,
        connectionState: next.connectionState,
      });

      // Ingest to backend asynchronously
      if (next.heartRate || next.spO2 || next.stepsCount || next.bodyTemperature) {
        apiClient.health.ingestReading({
          heart_rate: next.heartRate ?? undefined,
          spo2: next.spO2 ?? undefined,
          steps: next.stepsCount ?? undefined,
          body_temperature: next.bodyTemperature ?? undefined,
          systolic_bp: next.bloodPressureSys ?? undefined,
          diastolic_bp: next.bloodPressureDia ?? undefined,
          source: next.source || 'ble',
        }).catch(e => console.warn('Could not sync reading to backend:', e));
      }

      return next;
    });
  }, []);

  // Edge AI Risk Engine Analysis (Evaluates on every vitals or environment change)
  const aiAnalysis = AIRiskEngine.evaluateOverallSafety(
    vitals,
    environment,
    user.baseline,
    fallAlertOpen,
    emergencyModeActive
  );

  const setRegion = useCallback((cityName: string) => {
    StorageService.saveSelectedRegion(cityName);
    setSelectedRegionState(cityName);
    apiClient.environment.get({ region: cityName }).then(envRes => {
      if (envRes) {
        setEnvironment({
          locationName: envRes.region_name || cityName,
          ambientTempC: envRes.temperature_c,
          humidityPercent: envRes.humidity_percent,
          heatIndexC: envRes.heat_index_c,
          wetBulbTempC: Math.round(envRes.temperature_c * 0.7 + (envRes.humidity_percent / 100) * 8),
          heatRiskLevel: envRes.heat_index_c >= 40 ? 'CRITICAL' : envRes.heat_index_c >= 35 ? 'HIGH' : 'LOW',
          aqi: envRes.aqi,
          pm25: envRes.pm2_5,
          pm10: Math.round(envRes.pm2_5 * 2.1),
          pollutionCategory: (envRes.aqi_level || 'MODERATE').toUpperCase() as any,
          uvIndex: 6,
          isOutdoor: false,
          sunExposureMins: 15,
          lastUpdated: new Date().toLocaleTimeString(),
        });
      }
    }).catch(e => console.warn('Could not fetch region environment:', e));
  }, []);

  // Scenario Changer for Presentation / Simulation
  const changeScenario = useCallback((scenario: SimulationScenario) => {
    setActiveScenario(scenario);
    SensorSimulator.setScenario(scenario);
    if (scenario === 'NORMAL_BASELINE') {
      setVitals(SensorSimulator.generateLiveVitals());
      setEnvironment(SensorSimulator.generateLiveEnvironment());
    } else {
      setVitals(prev => SensorSimulator.generateLiveVitals(prev));
      setEnvironment(SensorSimulator.generateLiveEnvironment());
    }
  }, []);

  // Start Emergency Mode & Dispatch to Backend
  const enterEmergencyMode = useCallback(async (reason = 'Possible Fall / Medical Distress Detected') => {
    setFallAlertOpen(false);
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    soundService.stopEmergencySiren();

    setEmergencyModeActive(true);
    setActiveTab('emergency');

    const notified = user.emergencyContacts.filter(c => c.autoNotify);
    const payload: EmergencyDispatchPayload = {
      incidentId: `sos-${Date.now()}`,
      userName: user.fullName,
      bloodGroup: user.bloodGroup,
      age: user.age,
      emergencyType: reason,
      detectedAt: new Date().toISOString(),
      coordinates: {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        accuracyMeters: currentLocation.accuracyMeters,
        addressDescription: currentLocation.formattedAddress,
      },
      vitalsSnapshot: vitals,
      medicalNotes: user.medicalConditions.join(', '),
      contactsNotified: notified.map(c => `${c.name} (${c.phone})`),
    };
    setEmergencyDispatchPayload(payload);
    StorageService.logDispatchEvent(payload);

    // Call backend SOS endpoint
    try {
      await apiClient.sos.trigger({
        lat: currentLocation.latitude,
        lon: currentLocation.longitude,
        address: currentLocation.formattedAddress,
        risk_tier: 'Emergency',
        risk_score: 95,
        contacts: notified.map(c => ({ name: c.name, phone: c.phone })),
      });
    } catch (e) {
      console.warn('Backend SOS dispatch error:', e);
    }
  }, [user, vitals, currentLocation]);

  // Handle countdown step
  useEffect(() => {
    if (fallAlertOpen) {
      soundService.startEmergencySiren();
      countdownIntervalRef.current = window.setInterval(() => {
        setFallCountdown(prev => {
          if (prev <= 1) {
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
              countdownIntervalRef.current = null;
            }
            enterEmergencyMode('Unconfirmed Fall Detection (Timer Expired)');
            return 0;
          }
          soundService.playCountdownTick(prev <= 10);
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      soundService.stopEmergencySiren();
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [fallAlertOpen, enterEmergencyMode]);

  const triggerSimulatedFall = useCallback(() => {
    const event: FallDetectionEvent = {
      id: `fall-${Date.now()}`,
      timestamp: new Date().toISOString(),
      accelerationPeakG: 3.72,
      tiltAngleDeg: 76,
      inactivityDurationSec: 4.2,
      status: 'PENDING_CONFIRMATION',
    };
    setActiveFallEvent(event);
    setFallCountdown(30);
    setFallAlertOpen(true);
  }, []);

  const handleUserOk = useCallback(() => {
    setFallAlertOpen(false);
    soundService.playSafeChime();
    if (activeFallEvent) {
      const updated: FallDetectionEvent = {
        ...activeFallEvent,
        status: 'CANCELLED_BY_USER',
        userResponseTimeSec: 30 - fallCountdown,
      };
      StorageService.logFallEvent(updated);
      setActiveFallEvent(null);
    }
  }, [activeFallEvent, fallCountdown]);

  const handleUserNeedHelp = useCallback(() => {
    enterEmergencyMode('User confirmed Fall / Medical Distress');
    if (activeFallEvent) {
      const updated: FallDetectionEvent = {
        ...activeFallEvent,
        status: 'CONFIRMED_SOS',
        userResponseTimeSec: 30 - fallCountdown,
      };
      StorageService.logFallEvent(updated);
      setActiveFallEvent(null);
    }
  }, [enterEmergencyMode, activeFallEvent, fallCountdown]);

  const triggerManualSos = useCallback(() => {
    enterEmergencyMode('Manual User Emergency SOS Button');
  }, [enterEmergencyMode]);

  const exitEmergencyMode = useCallback(() => {
    setEmergencyModeActive(false);
    setEmergencyDispatchPayload(null);
    soundService.stopAudioBeacon();
    setIsBeaconActive(false);
    soundService.playSafeChime();
  }, []);

  const toggleAudioBeacon = useCallback(() => {
    if (isBeaconActive) {
      soundService.stopAudioBeacon();
      setIsBeaconActive(false);
    } else {
      soundService.startAudioBeacon();
      setIsBeaconActive(true);
    }
  }, [isBeaconActive]);

  const t = translations[language] || translations.en;

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        vitals,
        environment,
        user,
        privacyPrefs,
        selectedRegion,
        setRegion,
        aiAnalysis,
        disasterAlerts,
        historicalTrends,
        currentLocation,
        fallAlertOpen,
        fallCountdown,
        activeFallEvent,
        emergencyModeActive,
        emergencyDispatchPayload,
        isBeaconActive,
        demoPanelOpen,
        setDemoPanelOpen,
        activeScenario,
        changeScenario,
        triggerSimulatedFall,
        handleUserOk,
        handleUserNeedHelp,
        triggerManualSos,
        exitEmergencyMode,
        toggleAudioBeacon,
        updateUser,
        updatePrivacy,
        updateLiveVitals,
        language,
        setLanguage,
        t,
        backendConnected,
        refreshBackendData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
