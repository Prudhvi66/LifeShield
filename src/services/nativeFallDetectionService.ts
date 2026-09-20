/**
 * LifeShield Native Fall Detection Plugin.
 * JavaScript bridge to the Android FallDetectionService foreground service.
 * Provides background accelerometer monitoring that continues when the app is
 * backgrounded, screen is locked, or display is off.
 */
import { registerPlugin, Capacitor } from '@capacitor/core';

export interface FallDetectionNativePlugin {
  start(): Promise<{ started: boolean; message: string }>;
  stop(): Promise<{ stopped: boolean; message: string }>;
  stopAlarm(): Promise<{ stopped: boolean }>;
  isRunning(): Promise<{ running: boolean }>;
  getPendingFall(): Promise<{
    hasPending: boolean;
    peakG?: number;
    timestamp?: string;
    source?: string;
    id?: string;
  }>;
  addListener(eventName: 'fallDetected', handler: (data: {
    peakG: number;
    timestamp: string;
    source: string;
    id: string;
  }) => void): { remove: () => void };
}

const FallDetectionNative = registerPlugin<FallDetectionNativePlugin>('FallDetection');

export class NativeFallDetectionService {
  private listeners: Array<{ remove: () => void }> = [];
  private isStarted = false;

  /**
   * Check if running on native Android.
   */
  public isNativeAndroid(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  }

  /**
   * Start the native fall detection foreground service.
   * Returns true if started successfully.
   */
  public async start(): Promise<boolean> {
    if (!this.isNativeAndroid()) {
      console.log('[FallDetection] Not on Android — native fall detection unavailable');
      return false;
    }

    try {
      const result = await FallDetectionNative.start();
      this.isStarted = result.started;
      console.log('[FallDetection] Native service:', result.message);
      return result.started;
    } catch (err: any) {
      console.error('[FallDetection] Failed to start native service:', err);
      return false;
    }
  }

  /**
   * Stop the native fall detection foreground service.
   */
  public async stop(): Promise<boolean> {
    if (!this.isNativeAndroid()) return false;

    try {
      const result = await FallDetectionNative.stop();
      this.isStarted = false;
      console.log('[FallDetection] Native service:', result.message);
      return result.stopped;
    } catch (err: any) {
      console.error('[FallDetection] Failed to stop native service:', err);
      return false;
    }
  }

  /**
   * Stop any active native siren/vibrator and dismiss the alert notification.
   */
  public async stopAlarm(): Promise<boolean> {
    if (!this.isNativeAndroid()) return false;

    try {
      const result = await FallDetectionNative.stopAlarm();
      return result.stopped;
    } catch (err: any) {
      console.error('[FallDetection] Failed to stop native alarm:', err);
      return false;
    }
  }

  /**
   * Check if the native fall detection service is running.
   */
  public async isRunning(): Promise<boolean> {
    if (!this.isNativeAndroid()) return false;

    try {
      const result = await FallDetectionNative.isRunning();
      this.isStarted = result.running;
      return result.running;
    } catch {
      return false;
    }
  }

  /**
   * Check for a pending fall event from a cold start (notification tap).
   * Returns the data once and clears it.
   */
  public async getPendingFall(): Promise<{
    hasPending: boolean;
    peakG?: number;
    timestamp?: string;
    source?: string;
    id?: string;
  } | null> {
    if (!this.isNativeAndroid()) return null;

    try {
      return await FallDetectionNative.getPendingFall();
    } catch {
      return null;
    }
  }

  /**
   * Listen for fall detection events from the native service.
   * The callback receives fall data when the service detects a probable fall.
   */
  public onFallDetected(callback: (data: {
    peakG: number;
    timestamp: string;
    source: string;
    id: string;
  }) => void): { remove: () => void } {
    const listener = FallDetectionNative.addListener('fallDetected', (data) => {
      console.log('[FallDetection] Native fall detected — peakG:', data.peakG);
      callback(data);
    });
    this.listeners.push(listener);
    return listener;
  }

  /**
   * Remove all listeners.
   */
  public removeAllListeners(): void {
    this.listeners.forEach((l) => l.remove());
    this.listeners = [];
  }
}

export const nativeFallDetection = new NativeFallDetectionService();
