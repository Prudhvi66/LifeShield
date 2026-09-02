import { OfficialDisasterAlert } from '../types/environment';

export const MOCK_OFFICIAL_DISASTER_ALERTS: OfficialDisasterAlert[] = [
  {
    id: 'imd-heatwave-2026',
    agency: 'IMD',
    hazardType: 'HEAT_WAVE',
    headline: 'Severe Heat Wave Warning (Red Alert) – Maximum Temperature Exceeding 44°C',
    severity: 'RED_WARNING',
    affectedRegion: 'North & Central India (Telangana, Vidarbha, Rajasthan, Delhi-NCR)',
    effectiveUntil: 'Valid for next 48 Hours',
    instructions: [
      'Avoid heat exposure between 11:00 AM and 4:00 PM.',
      'Drink sufficient water / ORS / buttermilk even if not feeling thirsty.',
      'Wear lightweight, loose, light-colored cotton clothes.',
      'Outdoor workers are advised to pause high-intensity labor during peak sunshine.'
    ],
    helpline: '1070 (National Disaster Helpline) / 108 (EMS)',
    isOfficialSource: true
  },
  {
    id: 'ndma-cyclone-watch',
    agency: 'NDMA',
    hazardType: 'CYCLONE',
    headline: 'Severe Cyclonic Storm Alert – Coastal Storm Surge and Heavy Rainfall',
    severity: 'ORANGE_ALERT',
    affectedRegion: 'Bay of Bengal Coastal Districts (Andhra Pradesh, Odisha)',
    effectiveUntil: 'Next 24 Hours',
    instructions: [
      'Fishermen are strictly advised not to venture into deep sea areas.',
      'Keep mobile phones, emergency lamps, and power banks charged.',
      'Identify nearby cyclone relief shelters.'
    ],
    helpline: '1077 (District Disaster Control Room)',
    isOfficialSource: true
  },
  {
    id: 'cpcb-pollution-alert',
    agency: 'NDMA',
    hazardType: 'SEVERE_POLLUTION',
    headline: 'Air Quality Emergency Advisory – GRAP Stage IV Precautions',
    severity: 'RED_WARNING',
    affectedRegion: 'Delhi-NCR, Indo-Gangetic Plains',
    effectiveUntil: 'Until Further Notice',
    instructions: [
      'Children, elderly, and individuals with respiratory/cardiac ailments must stay indoors.',
      'Use certified N95 masks when stepping outdoors.',
      'Avoid morning and late evening outdoor jogging or strenuous workouts.'
    ],
    helpline: '1800-11-0031 (CPCB Central Pollution Helpline)',
    isOfficialSource: true
  }
];

export class DisasterService {
  public static getActiveAlerts(hazardTypeFilter?: string): OfficialDisasterAlert[] {
    if (!hazardTypeFilter) return MOCK_OFFICIAL_DISASTER_ALERTS;
    return MOCK_OFFICIAL_DISASTER_ALERTS.filter(a => a.hazardType === hazardTypeFilter);
  }
}
