import { registerPlugin } from '@capacitor/core';

export interface EmergencyCallPlugin {
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

export interface EmergencySmsPlugin {
  hasSmsPermission(): Promise<{ granted: boolean }>;
  requestSmsPermission(): Promise<{ granted: boolean }>;
  validatePhoneNumber(options: { phoneNumber: string }): Promise<{ valid: boolean }>;
  sendSms(options: { phoneNumber: string; message: string }): Promise<{
    success: boolean;
    phoneNumber?: string;
    message?: string;
    error?: string;
    requiresPermission?: boolean;
    status: 'SENT' | 'DELIVERY_CONFIRMED' | 'SENT_NO_DELIVERY_CONFIRMATION' | 'FAILED' | 'PERMISSION_REQUIRED' | 'SIMULATED';
    resultCode?: number;
  }>;
}

export interface LocationPlugin {
  checkPermissions(): Promise<{
    granted: boolean;
    fineLocation: boolean;
    coarseLocation: boolean;
  }>;
  requestPermission(): Promise<{ granted: boolean }>;
  getCurrentLocation(options?: { timeout?: number }): Promise<{
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude: number;
    speed: number;
    bearing: number;
    timestamp: number;
    fromCache?: boolean;
    timedOut?: boolean;
  }>;
  stopWatch(): Promise<{ stopped: boolean }>;
}

export interface TextToSpeechPlugin {
  speak(options: {
    text: string;
    lang?: string;
    rate?: number;
    pitch?: number;
    volume?: number;
  }): Promise<{ success: boolean }>;
  stop(): Promise<{ success: boolean }>;
  isSpeaking(): Promise<{ speaking: boolean }>;
}

export interface HealthConnectPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  requestPermissions(): Promise<{ granted: boolean }>;
  readHeartRate(options?: { startTime?: number; endTime?: number }): Promise<{ records: any[] }>;
  readSteps(options?: { startTime?: number; endTime?: number }): Promise<{ records: any[] }>;
  readOxygenSaturation(options?: { startTime?: number; endTime?: number }): Promise<{ records: any[] }>;
  readSleep(options?: { startTime?: number; endTime?: number }): Promise<{ records: any[] }>;
  readBodyTemperature(options?: { startTime?: number; endTime?: number }): Promise<{ records: any[] }>;
}

export const EmergencyCall = registerPlugin<EmergencyCallPlugin>('EmergencyCall');
export const EmergencySms = registerPlugin<EmergencySmsPlugin>('EmergencySms');
export const Location = registerPlugin<LocationPlugin>('Location');
export const TextToSpeech = registerPlugin<TextToSpeechPlugin>('TextToSpeech');
export const HealthConnect = registerPlugin<HealthConnectPlugin>('HealthConnect');