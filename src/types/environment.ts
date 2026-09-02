export type HeatRiskCategory = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
export type PollutionCategory = 'GOOD' | 'SATISFACTORY' | 'MODERATE' | 'POOR' | 'VERY POOR' | 'SEVERE';

export interface EnvironmentalData {
  ambientTempC: number; // e.g. 41.5
  humidityPercent: number; // e.g. 65%
  heatIndexC: number; // computed apparent temp
  wetBulbTempC: number; // estimated wet-bulb temp
  heatRiskLevel: HeatRiskCategory;
  aqi: number; // Indian AQI index (0-500)
  pm25: number; // ug/m3
  pm10: number; // ug/m3
  pollutionCategory: PollutionCategory;
  uvIndex: number;
  locationName: string;
  isOutdoor: boolean;
  sunExposureMins: number;
  lastUpdated: string;
}

export interface OfficialDisasterAlert {
  id: string;
  agency: 'NDMA' | 'IMD' | 'SDMA' | 'CWC' | 'INCOIS';
  hazardType: 'HEAT_WAVE' | 'CYCLONE' | 'FLOOD' | 'SEVERE_POLLUTION' | 'EARTHQUAKE' | 'THUNDERSTORM';
  headline: string;
  severity: 'YELLOW_WATCH' | 'ORANGE_ALERT' | 'RED_WARNING';
  affectedRegion: string;
  effectiveUntil: string;
  instructions: string[];
  helpline: string;
  isOfficialSource: boolean;
}
