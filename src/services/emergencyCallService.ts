/**
 * LifeShield Emergency Call Service.
 * JavaScript bridge to the Android EmergencyCallPlugin.
 * Provides native automatic phone calling on Android.
 * On web, returns honest limitation message.
 */
import { registerPlugin, Capacitor } from '@capacitor/core';

export interface EmergencyCallPluginInterface {
  hasCallPermission(): Promise<{ granted: boolean }>;
  requestCallPermission(): Promise<{ granted: boolean }>;
  validatePhoneNumber(options: { phoneNumber: string }): Promise<{ valid: boolean }>;
  callNumber(options: { phoneNumber: string }): Promise<{
    success: boolean;
    phoneNumber?: string;
    message?: string;
    error?: string;
    requiresPermission?: boolean;
  }>;
}

const EmergencyCallNative = registerPlugin<EmergencyCallPluginInterface>('EmergencyCall');

export class EmergencyCallService {
  /**
   * Check if running on native Android with call plugin available.
   */
  public static isNativeAndroid(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  }

  /**
   * Check if CALL_PHONE permission is granted.
   */
  public static async hasCallPermission(): Promise<boolean> {
    if (!this.isNativeAndroid()) {
      return false;
    }
    try {
      const result = await EmergencyCallNative.hasCallPermission();
      return result.granted;
    } catch {
      return false;
    }
  }

  /**
   * Request CALL_PHONE permission at runtime.
   */
  public static async requestCallPermission(): Promise<boolean> {
    if (!this.isNativeAndroid()) {
      return false;
    }
    try {
      const result = await EmergencyCallNative.requestCallPermission();
      return result.granted;
    } catch {
      return false;
    }
  }

  /**
   * Ensure we have call permission, requesting if needed.
   */
  public static async ensureCallPermission(): Promise<boolean> {
    if (!this.isNativeAndroid()) {
      return false;
    }

    let granted = await this.hasCallPermission();
    if (granted) return true;

    granted = await this.requestCallPermission();
    return granted;
  }

  /**
   * Place an automatic phone call.
   * On Android: uses native ACTION_CALL for automatic calling.
   * On web: returns honest limitation message.
   */
  public static async callNumber(phoneNumber: string): Promise<{
    success: boolean;
    message: string;
    platform: 'android' | 'web';
    requiresPermission?: boolean;
  }> {
    if (!this.isNativeAndroid()) {
      return {
        success: false,
        message: 'Automatic calling requires the LifeShield Android app.',
        platform: 'web',
      };
    }

    // Validate phone number format
    try {
      const validation = await EmergencyCallNative.validatePhoneNumber({ phoneNumber });
      if (!validation.valid) {
        return {
          success: false,
          message: `Invalid phone number format: ${phoneNumber}`,
          platform: 'android',
        };
      }
    } catch {
      // Continue anyway - let the plugin handle validation
    }

    // Ensure permission
    const hasPermission = await this.ensureCallPermission();
    if (!hasPermission) {
      return {
        success: false,
        message: 'Phone call permission was denied. Please grant CALL_PHONE permission in Android Settings.',
        platform: 'android',
        requiresPermission: true,
      };
    }

    // Make the actual native call
    try {
      const result = await EmergencyCallNative.callNumber({ phoneNumber });

      if (result.success) {
        return {
          success: true,
          message: result.message || `Call initiated to ${phoneNumber}`,
          platform: 'android',
        };
      } else {
        return {
          success: false,
          message: result.error || 'Failed to place call',
          platform: 'android',
          requiresPermission: result.requiresPermission,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: `Call failed: ${err.message || String(err)}`,
        platform: 'android',
      };
    }
  }
}
