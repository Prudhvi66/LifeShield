/**
 * LifeShield Android Native Location Service.
 * JavaScript bridge to the Android LocationPlugin.
 * Uses FusedLocationProviderClient for reliable GPS.
 * Falls back to browser geolocation when not on Android.
 */
import { registerPlugin, Capacitor } from '@capacitor/core';
import { LocationService, GeoLocationResult } from './locationService';

export interface LocationPluginInterface {
  checkPermissions(): Promise<{
    granted: boolean;
    fineLocation: boolean;
    coarseLocation: boolean;
  }>;
  requestPermission(): Promise<{ granted: boolean }>;
  getCurrentLocation(options?: {
    timeout?: number;
  }): Promise<{
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude: number;
    speed: number;
    bearing: number;
    timestamp: number;
    fromCache: boolean;
    timedOut?: boolean;
  }>;
  stopWatch(): Promise<{ stopped: boolean }>;
}

const NativeLocationPlugin = registerPlugin<LocationPluginInterface>('Location');

export interface NativeLocationResult {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  source: 'native_gps' | 'native_cache' | 'web_gps' | 'simulated_region';
  fromCache: boolean;
}

export class AndroidLocationService {
  private static isNative(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  }

  /**
   * Check if location permission is granted.
   */
  public static async checkPermission(): Promise<boolean> {
    if (!this.isNative()) return true;
    try {
      const result = await NativeLocationPlugin.checkPermissions();
      return result.granted;
    } catch {
      return false;
    }
  }

  /**
   * Request location permission at runtime.
   */
  public static async requestPermission(): Promise<boolean> {
    if (!this.isNative()) return true;
    try {
      const result = await NativeLocationPlugin.requestPermission();
      return result.granted;
    } catch {
      return false;
    }
  }

  /**
   * Ensure location permission is granted.
   */
  public static async ensurePermission(): Promise<boolean> {
    if (!this.isNative()) return true;

    let granted = await this.checkPermission();
    if (granted) return true;

    granted = await this.requestPermission();
    return granted;
  }

  /**
   * Get current location for emergency events.
   * Tries native GPS first, falls back to web browser geolocation.
   * Never blocks - returns as soon as available or after timeout.
   */
  public static async getEmergencyLocation(timeoutMs: number = 10000): Promise<NativeLocationResult> {
    // Android native location
    if (this.isNative()) {
      try {
        const hasPermission = await this.ensurePermission();
        if (!hasPermission) {
          console.warn('[AndroidLocation] Permission not granted, trying web fallback');
          return this.webFallback(timeoutMs);
        }

        const result = await NativeLocationPlugin.getCurrentLocation({ timeout: timeoutMs });

        return {
          latitude: result.latitude,
          longitude: result.longitude,
          accuracy: result.accuracy,
          timestamp: result.timestamp,
          source: result.fromCache ? 'native_cache' : 'native_gps',
          fromCache: result.fromCache,
        };
      } catch (err: any) {
        console.warn('[AndroidLocation] Native location failed:', err.message || err);

        // Try web fallback on error
        if (err.message === 'location_permission_not_granted') {
          console.warn('[AndroidLocation] Permission denied, trying web fallback');
        }
        return this.webFallback(timeoutMs);
      }
    }

    // Web fallback
    return this.webFallback(timeoutMs);
  }

  /**
   * Get location using browser geolocation API.
   */
  private static async webFallback(timeoutMs: number): Promise<NativeLocationResult> {
    try {
      const loc = await LocationService.getCurrentLocation();
      return {
        latitude: loc.latitude,
        longitude: loc.longitude,
        accuracy: loc.accuracyMeters,
        timestamp: Date.now(),
        source: loc.source === 'GPS_HARDWARE' ? 'web_gps' : 'simulated_region',
        fromCache: false,
      };
    } catch {
      // Return default Hyderabad as last resort
      return {
        latitude: 17.3850,
        longitude: 78.4867,
        accuracy: 25,
        timestamp: Date.now(),
        source: 'simulated_region',
        fromCache: false,
      };
    }
  }

  /**
   * Format location as Google Maps link.
   */
  public static formatGoogleMapsLink(lat: number, lng: number): string {
    return `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
  }

  /**
   * Format location for SOS event payload.
   */
  public static formatSosLocation(loc: NativeLocationResult): {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
    maps_link: string;
    source: string;
  } {
    return {
      latitude: loc.latitude,
      longitude: loc.longitude,
      accuracy: loc.accuracy,
      timestamp: loc.timestamp,
      maps_link: this.formatGoogleMapsLink(loc.latitude, loc.longitude),
      source: loc.source,
    };
  }
}
