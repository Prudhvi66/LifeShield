export interface GeoLocationResult {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  cityName: string;
  stateName: string;
  formattedAddress: string;
  source: 'GPS_HARDWARE' | 'SIMULATED_REGION';
}

export interface MedicalCenterPoint {
  id: string;
  name: string;
  type: 'Hospital' | 'Ambulance Base' | 'Trauma Center' | 'Clinic';
  distanceKm: number;
  latitude: number;
  longitude: number;
  phone: string;
}

export const INDIAN_REGIONS = [
  { city: 'Hyderabad', state: 'Telangana', lat: 17.3850, lng: 78.4867 },
  { city: 'Bengaluru', state: 'Karnataka', lat: 12.9716, lng: 77.5946 },
  { city: 'Mumbai', state: 'Maharashtra', lat: 19.0760, lng: 72.8777 },
  { city: 'New Delhi', state: 'Delhi NCR', lat: 28.6139, lng: 77.2090 },
  { city: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lng: 80.2707 },
  { city: 'Kolkata', state: 'West Bengal', lat: 22.5726, lng: 88.3639 },
  { city: 'Ahmedabad', state: 'Gujarat', lat: 23.0225, lng: 72.5714 },
  { city: 'Visakhapatnam', state: 'Andhra Pradesh', lat: 17.6868, lng: 83.2185 },
];

export class LocationService {
  /**
   * Request actual device GPS position or fallback to selected region
   */
  public static async getCurrentLocation(): Promise<GeoLocationResult> {
    if ('geolocation' in navigator) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 7000,
            maximumAge: 10000
          });
        });

        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = pos.coords.accuracy || 15;

        return {
          latitude: lat,
          longitude: lng,
          accuracyMeters: accuracy,
          cityName: 'Current Location',
          stateName: 'India',
          formattedAddress: `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`,
          source: 'GPS_HARDWARE'
        };
      } catch (err) {
        console.warn('Geolocation unavailable or denied, using regional reference:', err);
      }
    }

    // Default to Hyderabad / Telangana regional reference
    return {
      latitude: 17.3850,
      longitude: 78.4867,
      accuracyMeters: 25,
      cityName: 'Hyderabad',
      stateName: 'Telangana',
      formattedAddress: 'Near Gachibowli Ring Road, Hyderabad, Telangana 500032',
      source: 'SIMULATED_REGION'
    };
  }

  /**
   * Get simulated nearby hospitals/trauma centers around current coordinates
   */
  public static getNearbyMedicalCenters(lat: number, lng: number): MedicalCenterPoint[] {
    return [
      {
        id: 'hosp-1',
        name: 'Government General / District Hospital',
        type: 'Trauma Center',
        distanceKm: 1.4,
        latitude: lat + 0.007,
        longitude: lng + 0.005,
        phone: '108'
      },
      {
        id: 'hosp-2',
        name: '108 Emergency Ambulance Station Base',
        type: 'Ambulance Base',
        distanceKm: 2.1,
        latitude: lat - 0.008,
        longitude: lng + 0.009,
        phone: '108'
      },
      {
        id: 'hosp-3',
        name: 'Apollo / Max Multi-Speciality Emergency',
        type: 'Hospital',
        distanceKm: 3.8,
        latitude: lat + 0.015,
        longitude: lng - 0.012,
        phone: '112'
      }
    ];
  }
}
