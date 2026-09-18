import { Capacitor } from '@capacitor/core';
import { EmergencySms } from './capacitor-plugins';

export interface SmsPermissionResult {
  granted: boolean;
}

export interface SmsSendResult {
  success: boolean;
  phoneNumber?: string;
  message?: string;
  error?: string;
  requiresPermission?: boolean;
  status: 'SENT' | 'DELIVERY_CONFIRMED' | 'SENT_NO_DELIVERY_CONFIRMATION' | 'FAILED' | 'PERMISSION_REQUIRED' | 'SIMULATED';
  resultCode?: number;
}

export interface PhoneValidationResult {
  valid: boolean;
}

class EmergencySmsService {
  private isNativeAndroid(): boolean {
    return Capacitor.getPlatform() === 'android';
  }

  async hasSmsPermission(): Promise<SmsPermissionResult> {
    if (!this.isNativeAndroid()) {
      return { granted: true };
    }

    return EmergencySms.hasSmsPermission();
  }

  async requestSmsPermission(): Promise<SmsPermissionResult> {
    if (!this.isNativeAndroid()) {
      return { granted: true };
    }

    return EmergencySms.requestSmsPermission();
  }

  async sendSms(phoneNumber: string, message: string): Promise<SmsSendResult> {
    if (!this.isNativeAndroid()) {
      // Web fallback - simulate SMS (cannot actually send from browser)
      console.warn('[EmergencySms] Web platform: SMS sending simulated');
      return {
        success: false,
        phoneNumber,
        message: 'SMS sending not supported on web platform',
        status: 'SIMULATED',
      };
    }

    return EmergencySms.sendSms({ phoneNumber, message });
  }

  async validatePhoneNumber(phoneNumber: string): Promise<PhoneValidationResult> {
    if (!this.isNativeAndroid()) {
      // Basic web validation
      const cleaned = phoneNumber.replace(/[\s\-\(\)\.]/g, '');
      const pattern = /^\+?[1-9]\d{6,14}$/;
      return { valid: pattern.test(cleaned) };
    }

    return EmergencySms.validatePhoneNumber({ phoneNumber });
  }
}

export const emergencySmsService = new EmergencySmsService();