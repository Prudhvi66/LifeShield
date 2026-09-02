import { EmergencyContact, EmergencyServiceConfig, EmergencyDispatchPayload } from '../types/emergency';
import { VitalsData } from '../types/health';
import { UserProfile } from '../types/user';

export const INDIAN_EMERGENCY_DIRECTORY: EmergencyServiceConfig[] = [
  {
    id: 'in-112',
    name: 'National Emergency Helpline (ERSS)',
    number: '112',
    category: 'national',
    region: 'All India',
    isVerified: true,
    description: 'Unified 24/7 all-in-one emergency response support system across India.'
  },
  {
    id: 'in-108',
    name: 'Emergency Medical Service / Ambulance',
    number: '108',
    category: 'ambulance',
    region: 'Major Indian States',
    isVerified: true,
    description: 'Free emergency ambulance service available in over 23 Indian states & UTs.'
  },
  {
    id: 'in-102',
    name: 'Maternal & Infant Ambulance Helpline',
    number: '102',
    category: 'ambulance',
    region: 'All India',
    isVerified: true,
    description: 'National rural health mission referral transport service.'
  },
  {
    id: 'in-100',
    name: 'Police Control Room',
    number: '100',
    category: 'police',
    region: 'All India',
    isVerified: true,
    description: 'Immediate police intervention and crime response.'
  },
  {
    id: 'in-101',
    name: 'Fire & Rescue Service',
    number: '101',
    category: 'fire',
    region: 'All India',
    isVerified: true,
    description: 'Firefighting and structural collapse rescue.'
  },
  {
    id: 'in-1070',
    name: 'NDMA / State Disaster Response Control',
    number: '1070',
    category: 'disaster',
    region: 'All India',
    isVerified: true,
    description: 'National Disaster Management Authority emergency helpline.'
  }
];

export class EmergencyService {
  /**
   * Build the structured emergency broadcast message
   */
  public static generateEmergencyMessage(
    user: UserProfile,
    vitals: Partial<VitalsData>,
    coords: { latitude: number; longitude: number; accuracyMeters: number; addressDescription?: string },
    emergencyType = 'Possible accident/fall or medical distress'
  ): string {
    const timeString = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    const mapsLink = `https://maps.google.com/?q=${coords.latitude.toFixed(6)},${coords.longitude.toFixed(6)}`;

    return [
      `🚨 LIFESHIELD EMERGENCY ALERT`,
      `---------------------------------`,
      `A critical health-safety emergency has been detected.`,
      ``,
      `👤 User: ${user.fullName} (${user.age} yrs, Blood: ${user.bloodGroup})`,
      `⚠️ Incident: ${emergencyType}`,
      `🕒 Time: ${timeString}`,
      `📍 Location: ${coords.addressDescription || 'Coordinates'}`,
      `🔗 Live Map Pin: ${mapsLink} (±${Math.round(coords.accuracyMeters)}m)`,
      ``,
      `📊 Vitals Snapshot at Trigger:`,
      `- Heart Rate: ${vitals.heartRate ? vitals.heartRate + ' BPM' : 'N/A'}`,
      `- SpO2: ${vitals.spO2 ? vitals.spO2 + '%' : 'N/A'}`,
      `- Temp: ${vitals.bodyTemperature ? vitals.bodyTemperature + '°C' : 'N/A'}`,
      `- Respiration: ${vitals.respirationRate ? vitals.respirationRate + ' bpm' : 'N/A'}`,
      `- Known Medical Conditions: ${user.medicalConditions.length > 0 ? user.medicalConditions.join(', ') : 'None reported'}`,
      ``,
      `Please provide immediate emergency medical assistance.`,
      `Location sharing was enabled by user for LifeShield emergency protocol.`
    ].join('\n');
  }

  /**
   * Generate an SMS intent link
   */
  public static generateSmsLink(phone: string, text: string): string {
    return `sms:${phone}?body=${encodeURIComponent(text)}`;
  }

  /**
   * Generate a WhatsApp share link
   */
  public static generateWhatsAppLink(phone: string, text: string): string {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone) {
      return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    }
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

  /**
   * Generate telephone call action URI
   */
  public static generateTelLink(phone: string): string {
    return `tel:${phone.replace(/[^0-9+]/g, '')}`;
  }

  /**
   * Create emergency payload object for local storage or logging
   */
  public static createDispatchPayload(
    user: UserProfile,
    vitals: VitalsData,
    coords: { latitude: number; longitude: number; accuracyMeters: number; addressDescription?: string },
    emergencyType: string,
    notifiedContacts: EmergencyContact[]
  ): EmergencyDispatchPayload {
    return {
      incidentId: `LS-EMG-${Date.now()}`,
      userName: user.fullName,
      bloodGroup: user.bloodGroup,
      age: user.age,
      emergencyType,
      detectedAt: new Date().toISOString(),
      coordinates: coords,
      vitalsSnapshot: {
        heartRate: vitals.heartRate,
        spO2: vitals.spO2,
        bodyTemperature: vitals.bodyTemperature,
        respirationRate: vitals.respirationRate,
        activityLevel: vitals.activityLevel,
      },
      medicalNotes: user.medicalConditions.join(', '),
      contactsNotified: notifiedContacts.map(c => `${c.name} (${c.phone})`)
    };
  }
}
