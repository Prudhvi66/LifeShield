import { VitalsData } from '../types/health';
import { EnvironmentalData, HeatRiskCategory, PollutionCategory } from '../types/environment';

// ---------------------------------------------------------------------------
// Region-specific realistic weather profiles (used when user changes region)
// ---------------------------------------------------------------------------
interface RegionProfile {
  ambientTempC: number;
  humidityPercent: number;
  heatIndexC: number;
  wetBulbTempC: number;
  heatRiskLevel: HeatRiskCategory;
  aqi: number;
  pm25: number;
  pm10: number;
  pollutionCategory: PollutionCategory;
  uvIndex: number;
  isOutdoor: boolean;
  sunExposureMins: number;
}

export const REGION_PROFILES: Record<string, RegionProfile> = {
  'Gachibowli, Hyderabad, Telangana': {
    ambientTempC: 29.5, humidityPercent: 52, heatIndexC: 31.0, wetBulbTempC: 22.4,
    heatRiskLevel: 'LOW', aqi: 68, pm25: 22, pm10: 54,
    pollutionCategory: 'SATISFACTORY', uvIndex: 6, isOutdoor: false, sunExposureMins: 15,
  },
  'Banjara Hills, Hyderabad, Telangana': {
    ambientTempC: 31.0, humidityPercent: 55, heatIndexC: 33.5, wetBulbTempC: 23.8,
    heatRiskLevel: 'MODERATE', aqi: 82, pm25: 30, pm10: 68,
    pollutionCategory: 'SATISFACTORY', uvIndex: 7, isOutdoor: false, sunExposureMins: 20,
  },
  'Mumbai, Maharashtra': {
    ambientTempC: 30.2, humidityPercent: 83, heatIndexC: 38.5, wetBulbTempC: 27.1,
    heatRiskLevel: 'MODERATE', aqi: 110, pm25: 45, pm10: 90,
    pollutionCategory: 'MODERATE', uvIndex: 5, isOutdoor: true, sunExposureMins: 25,
  },
  'Andheri, Mumbai, Maharashtra': {
    ambientTempC: 31.5, humidityPercent: 85, heatIndexC: 40.2, wetBulbTempC: 28.0,
    heatRiskLevel: 'HIGH', aqi: 148, pm25: 62, pm10: 115,
    pollutionCategory: 'MODERATE', uvIndex: 5, isOutdoor: true, sunExposureMins: 30,
  },
  'Delhi, NCT of Delhi': {
    ambientTempC: 36.8, humidityPercent: 38, heatIndexC: 42.0, wetBulbTempC: 26.5,
    heatRiskLevel: 'HIGH', aqi: 245, pm25: 135, pm10: 270,
    pollutionCategory: 'POOR', uvIndex: 9, isOutdoor: true, sunExposureMins: 50,
  },
  'Connaught Place, Delhi': {
    ambientTempC: 37.5, humidityPercent: 35, heatIndexC: 43.1, wetBulbTempC: 27.0,
    heatRiskLevel: 'HIGH', aqi: 278, pm25: 158, pm10: 310,
    pollutionCategory: 'POOR', uvIndex: 9, isOutdoor: true, sunExposureMins: 55,
  },
  'Bengaluru, Karnataka': {
    ambientTempC: 26.0, humidityPercent: 60, heatIndexC: 27.8, wetBulbTempC: 20.2,
    heatRiskLevel: 'LOW', aqi: 58, pm25: 18, pm10: 42,
    pollutionCategory: 'SATISFACTORY', uvIndex: 6, isOutdoor: false, sunExposureMins: 10,
  },
  'Whitefield, Bengaluru, Karnataka': {
    ambientTempC: 27.2, humidityPercent: 62, heatIndexC: 29.1, wetBulbTempC: 21.0,
    heatRiskLevel: 'LOW', aqi: 70, pm25: 24, pm10: 52,
    pollutionCategory: 'SATISFACTORY', uvIndex: 6, isOutdoor: false, sunExposureMins: 12,
  },
  'Chennai, Tamil Nadu': {
    ambientTempC: 33.5, humidityPercent: 78, heatIndexC: 43.2, wetBulbTempC: 28.8,
    heatRiskLevel: 'HIGH', aqi: 95, pm25: 38, pm10: 78,
    pollutionCategory: 'SATISFACTORY', uvIndex: 8, isOutdoor: true, sunExposureMins: 40,
  },
  'Kolkata, West Bengal': {
    ambientTempC: 32.0, humidityPercent: 80, heatIndexC: 41.5, wetBulbTempC: 27.5,
    heatRiskLevel: 'HIGH', aqi: 130, pm25: 52, pm10: 102,
    pollutionCategory: 'MODERATE', uvIndex: 6, isOutdoor: true, sunExposureMins: 30,
  },
  'Pune, Maharashtra': {
    ambientTempC: 28.5, humidityPercent: 58, heatIndexC: 30.2, wetBulbTempC: 21.8,
    heatRiskLevel: 'LOW', aqi: 75, pm25: 26, pm10: 58,
    pollutionCategory: 'SATISFACTORY', uvIndex: 7, isOutdoor: false, sunExposureMins: 18,
  },
  'Ahmedabad, Gujarat': {
    ambientTempC: 38.5, humidityPercent: 30, heatIndexC: 44.0, wetBulbTempC: 26.8,
    heatRiskLevel: 'HIGH', aqi: 168, pm25: 78, pm10: 155,
    pollutionCategory: 'MODERATE', uvIndex: 10, isOutdoor: true, sunExposureMins: 60,
  },
  'Jaipur, Rajasthan': {
    ambientTempC: 40.2, humidityPercent: 22, heatIndexC: 46.5, wetBulbTempC: 25.5,
    heatRiskLevel: 'CRITICAL', aqi: 195, pm25: 88, pm10: 178,
    pollutionCategory: 'MODERATE', uvIndex: 11, isOutdoor: true, sunExposureMins: 75,
  },
  'Lucknow, Uttar Pradesh': {
    ambientTempC: 35.5, humidityPercent: 45, heatIndexC: 40.8, wetBulbTempC: 26.0,
    heatRiskLevel: 'HIGH', aqi: 210, pm25: 105, pm10: 210,
    pollutionCategory: 'POOR', uvIndex: 8, isOutdoor: true, sunExposureMins: 45,
  },
  'Bhopal, Madhya Pradesh': {
    ambientTempC: 34.0, humidityPercent: 48, heatIndexC: 39.2, wetBulbTempC: 25.4,
    heatRiskLevel: 'HIGH', aqi: 128, pm25: 50, pm10: 98,
    pollutionCategory: 'MODERATE', uvIndex: 8, isOutdoor: true, sunExposureMins: 35,
  },
  'Chandigarh, Punjab': {
    ambientTempC: 32.5, humidityPercent: 50, heatIndexC: 36.5, wetBulbTempC: 24.5,
    heatRiskLevel: 'MODERATE', aqi: 118, pm25: 46, pm10: 94,
    pollutionCategory: 'MODERATE', uvIndex: 7, isOutdoor: false, sunExposureMins: 25,
  },
  'Visakhapatnam, Andhra Pradesh': {
    ambientTempC: 31.0, humidityPercent: 75, heatIndexC: 39.0, wetBulbTempC: 26.5,
    heatRiskLevel: 'MODERATE', aqi: 88, pm25: 32, pm10: 70,
    pollutionCategory: 'SATISFACTORY', uvIndex: 7, isOutdoor: true, sunExposureMins: 28,
  },
  'Kochi, Kerala': {
    ambientTempC: 28.0, humidityPercent: 88, heatIndexC: 35.5, wetBulbTempC: 26.0,
    heatRiskLevel: 'MODERATE', aqi: 48, pm25: 15, pm10: 36,
    pollutionCategory: 'GOOD', uvIndex: 6, isOutdoor: false, sunExposureMins: 12,
  },
};

export type SimulationScenario =
  | 'NORMAL_BASELINE'
  | 'HEAT_STRESS_OUTDOORS'
  | 'LOW_SPO2_HYPOXIA'
  | 'TACHYCARDIA_ARRHYTHMIA'
  | 'POST_FALL_EMERGENCY'
  | 'DISASTER_WARNING';

export class SensorSimulator {
  private static currentScenario: SimulationScenario = 'NORMAL_BASELINE';

  public static setScenario(scenario: SimulationScenario) {
    this.currentScenario = scenario;
  }

  public static getScenario(): SimulationScenario {
    return this.currentScenario;
  }

  public static generateLiveVitals(prev?: VitalsData): VitalsData {
    const timestamp = new Date().toISOString();

    if (this.currentScenario === 'HEAT_STRESS_OUTDOORS') {
      return {
        heartRate: Math.floor(108 + Math.random() * 8),
        spO2: Math.floor(95 + Math.random() * 2),
        bodyTemperature: Number((38.4 + Math.random() * 0.4).toFixed(1)),
        activityLevel: 'moderate',
        stepsCount: (prev?.stepsCount || 6800) + Math.floor(Math.random() * 8),
        sleepHours: 5.4,
        hydrationIndex: Math.max(22, (prev?.hydrationIndex || 38) - 0.2),
        fatigueIndex: 84,
        respirationRate: 22,
        bloodPressureSys: 138,
        bloodPressureDia: 88,
        timestamp
      };
    }

    if (this.currentScenario === 'LOW_SPO2_HYPOXIA') {
      return {
        heartRate: Math.floor(98 + Math.random() * 6),
        spO2: Math.floor(87 + Math.random() * 3), // Hypoxic level < 90%
        bodyTemperature: 37.1,
        activityLevel: 'rest',
        stepsCount: prev?.stepsCount || 2300,
        sleepHours: 6.8,
        hydrationIndex: 72,
        fatigueIndex: 68,
        respirationRate: 26, // Tachypneic
        bloodPressureSys: 124,
        bloodPressureDia: 82,
        timestamp
      };
    }

    if (this.currentScenario === 'TACHYCARDIA_ARRHYTHMIA') {
      return {
        heartRate: Math.floor(132 + Math.random() * 10), // Resting Tachycardia
        spO2: 97,
        bodyTemperature: 36.9,
        activityLevel: 'rest', // inactive but heart is racing!
        stepsCount: prev?.stepsCount || 3100,
        sleepHours: 4.8,
        hydrationIndex: 65,
        fatigueIndex: 74,
        respirationRate: 20,
        bloodPressureSys: 142,
        bloodPressureDia: 92,
        timestamp
      };
    }

    if (this.currentScenario === 'POST_FALL_EMERGENCY') {
      return {
        heartRate: Math.floor(118 + Math.random() * 6),
        spO2: 94,
        bodyTemperature: 36.7,
        activityLevel: 'inactive', // no movement after impact
        stepsCount: prev?.stepsCount || 4200,
        sleepHours: 7.0,
        hydrationIndex: 60,
        fatigueIndex: 80,
        respirationRate: 24,
        bloodPressureSys: 130,
        bloodPressureDia: 85,
        timestamp
      };
    }

    // Default: NORMAL_BASELINE
    const hrVariance = (Math.random() - 0.5) * 3;
    const baseHR = prev?.heartRate ? Math.min(84, Math.max(64, prev.heartRate + hrVariance)) : 72;

    return {
      heartRate: Math.round(baseHR),
      spO2: Math.min(99, Math.max(96, Math.floor(98 + (Math.random() - 0.5) * 2))),
      bodyTemperature: Number((36.7 + (Math.random() - 0.5) * 0.2).toFixed(1)),
      activityLevel: 'rest',
      stepsCount: (prev?.stepsCount || 4820) + (Math.random() > 0.6 ? 2 : 0),
      sleepHours: 7.4,
      hydrationIndex: 82,
      fatigueIndex: 22,
      respirationRate: 15,
      bloodPressureSys: 118,
      bloodPressureDia: 78,
      timestamp
    };
  }

  public static generateLiveEnvironment(): EnvironmentalData {
    const timestamp = new Date().toLocaleTimeString();

    if (this.currentScenario === 'HEAT_STRESS_OUTDOORS') {
      return {
        ambientTempC: 43.8,
        humidityPercent: 68,
        heatIndexC: 54.2,
        wetBulbTempC: 32.1,
        heatRiskLevel: 'CRITICAL',
        aqi: 185,
        pm25: 78,
        pm10: 142,
        pollutionCategory: 'MODERATE',
        uvIndex: 11,
        locationName: 'Nagpur / Vidarbha, Maharashtra',
        isOutdoor: true,
        sunExposureMins: 95,
        lastUpdated: timestamp
      };
    }

    if (this.currentScenario === 'LOW_SPO2_HYPOXIA') {
      return {
        ambientTempC: 31.0,
        humidityPercent: 55,
        heatIndexC: 34.0,
        wetBulbTempC: 24.5,
        heatRiskLevel: 'MODERATE',
        aqi: 382, // Severe AQI in Delhi/NCR
        pm25: 245,
        pm10: 410,
        pollutionCategory: 'SEVERE',
        uvIndex: 5,
        locationName: 'Anand Vihar, New Delhi',
        isOutdoor: true,
        sunExposureMins: 30,
        lastUpdated: timestamp
      };
    }

    if (this.currentScenario === 'DISASTER_WARNING') {
      return {
        ambientTempC: 28.5,
        humidityPercent: 94,
        heatIndexC: 33.2,
        wetBulbTempC: 27.8,
        heatRiskLevel: 'MODERATE',
        aqi: 45,
        pm25: 18,
        pm10: 35,
        pollutionCategory: 'GOOD',
        uvIndex: 2,
        locationName: 'Coastal Andhra / Odisha Coast',
        isOutdoor: true,
        sunExposureMins: 10,
        lastUpdated: timestamp
      };
    }

    // Default: NORMAL_BASELINE
    return {
      ambientTempC: 29.5,
      humidityPercent: 52,
      heatIndexC: 31.0,
      wetBulbTempC: 22.4,
      heatRiskLevel: 'LOW',
      aqi: 68,
      pm25: 22,
      pm10: 54,
      pollutionCategory: 'SATISFACTORY',
      uvIndex: 6,
      locationName: 'Gachibowli, Hyderabad, Telangana',
      isOutdoor: false,
      sunExposureMins: 15,
      lastUpdated: timestamp
    };
  }

  /**
   * Generate an EnvironmentalData snapshot for a specific region city name.
   * Used when the user manually selects a region from the Change Region modal.
   * Falls back to the default baseline if the city has no profile entry.
   */
  public static generateEnvironmentForRegion(cityName: string): EnvironmentalData {
    const timestamp = new Date().toLocaleTimeString();
    const profile = REGION_PROFILES[cityName];

    if (!profile) {
      // Unknown city → return default with updated name
      return {
        ...this.generateLiveEnvironment(),
        locationName: cityName,
        lastUpdated: timestamp,
      };
    }

    return {
      ambientTempC: profile.ambientTempC,
      humidityPercent: profile.humidityPercent,
      heatIndexC: profile.heatIndexC,
      wetBulbTempC: profile.wetBulbTempC,
      heatRiskLevel: profile.heatRiskLevel,
      aqi: profile.aqi,
      pm25: profile.pm25,
      pm10: profile.pm10,
      pollutionCategory: profile.pollutionCategory,
      uvIndex: profile.uvIndex,
      locationName: cityName,
      isOutdoor: profile.isOutdoor,
      sunExposureMins: profile.sunExposureMins,
      lastUpdated: timestamp,
    };
  }
}
