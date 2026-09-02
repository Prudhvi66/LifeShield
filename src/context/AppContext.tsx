import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { VitalsData, HistoricalHealthDataPoint } from '../types/health';
import { EnvironmentalData, OfficialDisasterAlert } from '../types/environment';
import { UserProfile, PrivacyPreferences, LanguageCode } from '../types/user';
import { FallDetectionEvent, EmergencyDispatchPayload } from '../types/emergency';
import { AIRiskEngine, AIAnalysisResult } from '../services/aiRiskEngine';
import { SensorSimulator, SimulationScenario } from '../services/sensorSimulator';
import { DisasterService } from '../services/disasterService';
import { StorageService } from '../services/storageService';
import { soundService } from '../services/soundService';
import { LocationService, GeoLocationResult } from '../services/locationService';
import { EmergencyService } from '../services/emergencyService';
import { translations, TranslationDict } from '../services/i18nService';

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

  // Simulation & Demo
  activeScenario: SimulationScenario;
  demoPanelOpen: boolean;
  setDemoPanelOpen: (open: boolean) => void;

  // Actions
  triggerSimulatedFall: () => void;
  handleUserOk: () => void;
  handleUserNeedHelp: () => void;
  triggerManualSos: () => void;
  exitEmergencyMode: () => void;
  changeScenario: (scenario: SimulationScenario) => void;
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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [user, setUser] = useState<UserProfile>(() => StorageService.getUserProfile());
  const [privacyPrefs, setPrivacyPrefs] = useState<PrivacyPreferences>(() => StorageService.getPrivacyPrefs());
  const [language, setLanguageState] = useState<LanguageCode>(user.primaryLanguage || 'en');

  const [vitals, setVitals] = useState<VitalsData>(() => SensorSimulator.generateLiveVitals());
  const [environment, setEnvironment] = useState<EnvironmentalData>(() => {
    const savedRegion = StorageService.getSelectedRegion();
    if (savedRegion) return SensorSimulator.generateEnvironmentForRegion(savedRegion);
    return SensorSimulator.generateLiveEnvironment();
  });
  const [disasterAlerts, setDisasterAlerts] = useState<OfficialDisasterAlert[]>(() => DisasterService.getActiveAlerts());
  const [historicalTrends] = useState<HistoricalHealthDataPoint[]>(() => StorageService.getMockHistoricalTrends());

  const [currentLocation, setCurrentLocation] = useState<GeoLocationResult>({
    latitude: 17.3850,
    longitude: 78.4867,
    accuracyMeters: 15,
    cityName: 'Hyderabad',
    stateName: 'Telangana',
    formattedAddress: 'Gachibowli Financial District, Hyderabad, Telangana 500032',
    source: 'SIMULATED_REGION'
  });

  const [activeScenario, setActiveScenario] = useState<SimulationScenario>('NORMAL_BASELINE');
  const [demoPanelOpen, setDemoPanelOpen] = useState(false);

  // Region selection — persisted in localStorage
  const [selectedRegion, setSelectedRegionState] = useState<string>(() => {
    const saved = StorageService.getSelectedRegion();
    return saved ?? 'Gachibowli, Hyderabad, Telangana';
  });

  // Fall Alert Modal & Countdown
  const [fallAlertOpen, setFallAlertOpen] = useState(false);
  const [fallCountdown, setFallCountdown] = useState(30);
  const [activeFallEvent, setActiveFallEvent] = useState<FallDetectionEvent | null>(null);

  // Emergency Mode
  const [emergencyModeActive, setEmergencyModeActive] = useState(false);
  const [emergencyDispatchPayload, setEmergencyDispatchPayload] = useState<EmergencyDispatchPayload | null>(null);
  const [isBeaconActive, setIsBeaconActive] = useState(false);

  // Ref to hold countdown timer interval
  const countdownIntervalRef = useRef<number | null>(null);

  // Ref so polling loop can read the latest selectedRegion without stale closure
  const selectedRegionRef = useRef<string>(selectedRegion);
  useEffect(() => { selectedRegionRef.current = selectedRegion; }, [selectedRegion]);

  // Periodic GPS location refresh
  useEffect(() => {
    LocationService.getCurrentLocation().then(loc => {
      setCurrentLocation(loc);
    });
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

  // Update user profile wrapper
  const updateUser = useCallback((updater: (prev: UserProfile) => UserProfile) => {
    setUser(prev => {
      const next = updater(prev);
      StorageService.saveUserProfile(next);
      return next;
    });
  }, []);

  // Update privacy preferences wrapper
  const updatePrivacy = useCallback((updater: (prev: PrivacyPreferences) => PrivacyPreferences) => {
    setPrivacyPrefs(prev => {
      const next = updater(prev);
      StorageService.savePrivacyPrefs(next);
      return next;
    });
  }, []);

  // Update live vitals from real Bluetooth sensors or manual input
  const updateLiveVitals = useCallback((partial: Partial<VitalsData>) => {
    setVitals(prev => ({
      ...prev,
      ...partial,
      timestamp: new Date().toISOString()
    }));
  }, []);

  // Continuous live sensor telemetry loop (every 3 seconds).
  // When a region is pinned we re-generate environment from that region's profile
  // (preserving its locationName/AQI/heat data) rather than letting the simulator
  // overwrite it with the scenario default.
  useEffect(() => {
    const interval = setInterval(() => {
      setVitals(prev => SensorSimulator.generateLiveVitals(prev));
      setEnvironment(() => SensorSimulator.generateEnvironmentForRegion(selectedRegionRef.current));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Edge AI Risk Engine Analysis (Evaluates on every vitals or environment change)
  const aiAnalysis = AIRiskEngine.evaluateOverallSafety(
    vitals,
    environment,
    user.baseline,
    fallAlertOpen,
    emergencyModeActive
  );

  // Switch simulation scenario
  const changeScenario = useCallback((scenario: SimulationScenario) => {
    setActiveScenario(scenario);
    SensorSimulator.setScenario(scenario);
    setVitals(SensorSimulator.generateLiveVitals());
    setEnvironment(SensorSimulator.generateLiveEnvironment());
    if (scenario === 'DISASTER_WARNING') {
      setDisasterAlerts(DisasterService.getActiveAlerts());
    }
  }, []);

  /**
   * setRegion — called when the user picks a city from the Change Region modal.
   * 1. Persists the selection in localStorage so it survives page refresh.
   * 2. Updates selectedRegion state (displayed in the button & modal).
   * 3. Immediately loads that city's weather/AQI/heat profile into environment state
   *    — this propagates to EnvironmentCard, EnvironmentDashboard, and the AI risk engine.
   * 4. Refreshes disasterAlerts from DisasterService (simulated; in production would be geo-filtered).
   * 5. Updates the selectedRegionRef so the 3-second polling loop also respects the new city.
   */
  const setRegion = useCallback((cityName: string) => {
    StorageService.saveSelectedRegion(cityName);
    setSelectedRegionState(cityName);
    selectedRegionRef.current = cityName;
    setEnvironment(SensorSimulator.generateEnvironmentForRegion(cityName));
    setDisasterAlerts(DisasterService.getActiveAlerts());
  }, []);

  // Start Emergency Mode
  const enterEmergencyMode = useCallback((reason = 'Possible Fall / Medical Distress Detected') => {
    setFallAlertOpen(false);
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    soundService.stopEmergencySiren();

    setEmergencyModeActive(true);
    setActiveTab('emergency');

    const notified = user.emergencyContacts.filter(c => c.autoNotify);
    const payload = EmergencyService.createDispatchPayload(
      user,
      vitals,
      {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        accuracyMeters: currentLocation.accuracyMeters,
        addressDescription: currentLocation.formattedAddress
      },
      reason,
      notified
    );
    setEmergencyDispatchPayload(payload);
    StorageService.logDispatchEvent(payload);
  }, [user, vitals, currentLocation]);

  // Handle countdown step
  useEffect(() => {
    if (fallAlertOpen) {
      soundService.startEmergencySiren();
      countdownIntervalRef.current = window.setInterval(() => {
        setFallCountdown(prev => {
          if (prev <= 1) {
            // Countdown expired without response -> auto escalate!
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

  // Trigger Simulated Fall (Step 1 -> Step 2)
  const triggerSimulatedFall = useCallback(() => {
    const event: FallDetectionEvent = {
      id: `fall-${Date.now()}`,
      timestamp: new Date().toISOString(),
      accelerationPeakG: 3.72,
      tiltAngleDeg: 76,
      inactivityDurationSec: 4.2,
      status: 'PENDING_CONFIRMATION'
    };
    setActiveFallEvent(event);
    setFallCountdown(30);
    setFallAlertOpen(true);
  }, []);

  // User presses [ I'M OK ] (Step 3)
  const handleUserOk = useCallback(() => {
    setFallAlertOpen(false);
    soundService.playSafeChime();
    if (activeFallEvent) {
      const updated: FallDetectionEvent = {
        ...activeFallEvent,
        status: 'CANCELLED_BY_USER',
        userResponseTimeSec: 30 - fallCountdown
      };
      StorageService.logFallEvent(updated);
      setActiveFallEvent(null);
    }
  }, [activeFallEvent, fallCountdown]);

  // User presses [ NEED HELP NOW ] (Step 4)
  const handleUserNeedHelp = useCallback(() => {
    enterEmergencyMode('User confirmed Fall / Medical Distress');
    if (activeFallEvent) {
      const updated: FallDetectionEvent = {
        ...activeFallEvent,
        status: 'CONFIRMED_SOS',
        userResponseTimeSec: 30 - fallCountdown
      };
      StorageService.logFallEvent(updated);
      setActiveFallEvent(null);
    }
  }, [enterEmergencyMode, activeFallEvent, fallCountdown]);

  // Manual SOS Button Trigger
  const triggerManualSos = useCallback(() => {
    enterEmergencyMode('Manual User Emergency SOS Button');
  }, [enterEmergencyMode]);

  // Exit Emergency Mode
  const exitEmergencyMode = useCallback(() => {
    setEmergencyModeActive(false);
    setEmergencyDispatchPayload(null);
    soundService.stopAudioBeacon();
    setIsBeaconActive(false);
    soundService.playSafeChime();
    changeScenario('NORMAL_BASELINE');
  }, [changeScenario]);

  // Toggle SOS Audio Beacon
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
        activeScenario,
        demoPanelOpen,
        setDemoPanelOpen,
        triggerSimulatedFall,
        handleUserOk,
        handleUserNeedHelp,
        triggerManualSos,
        exitEmergencyMode,
        changeScenario,
        toggleAudioBeacon,
        updateUser,
        updatePrivacy,
        updateLiveVitals,
        language,
        setLanguage,
        t,
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
