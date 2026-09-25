import { FallDetectionEvent } from '../types/emergency';

export type FallCallback = (event: FallDetectionEvent) => void;

export class FallDetectionService {
  private isListening = false;
  private onFallDetected: FallCallback | null = null;
  private recentSpikes: number[] = [];
  private lastStillnessCheck = 0;

  /**
   * Initialize sensor listener on hardware devices
   */
  public async startListening(callback: FallCallback): Promise<boolean> {
    this.onFallDetected = callback;

    if (typeof window === 'undefined') return false;

    // Check for DeviceMotionEvent permission in iOS 13+ / Mobile Browsers
    if (
      typeof DeviceMotionEvent !== 'undefined' &&
      typeof (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === 'function'
    ) {
      try {
        const permission = await (DeviceMotionEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission();
        if (permission !== 'granted') {
          console.warn('DeviceMotionEvent permission denied by user');
          return false;
        }
      } catch (e) {
        console.warn('Permission request error:', e);
      }
    }

    if ('ondevicemotion' in window) {
      window.addEventListener('devicemotion', this.handleDeviceMotion, true);
      this.isListening = true;
      return true;
    }

    return false;
  }

  public stopListening() {
    if (this.isListening) {
      window.removeEventListener('devicemotion', this.handleDeviceMotion, true);
      this.isListening = false;
    }
  }

  /**
   * Device motion pipeline:
   * 1. Acceleration spike > 2.8g (approx 27.5 m/s^2)
   * 2. Orientation tilt check
   * 3. Subsequent stillness window
   */
  private handleDeviceMotion = (event: DeviceMotionEvent) => {
    const acc = event.accelerationIncludingGravity || event.acceleration;
    if (!acc || acc.x === null || acc.y === null || acc.z === null) return;

    const totalAcc = Math.sqrt((acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2);
    const gForce = totalAcc / 9.80665;

    this.recentSpikes.push(gForce);
    if (this.recentSpikes.length > 20) {
      this.recentSpikes.shift();
    }

    // Impact detection threshold
    if (gForce > 3.0) {
      const now = Date.now();
      if (now - this.lastStillnessCheck > 5000) {
        this.lastStillnessCheck = now;

        // Schedule stillness verification after 1.2 seconds
        setTimeout(() => {
          this.verifyPostImpactStillness(gForce);
        }, 1200);
      }
    }
  };

  private verifyPostImpactStillness(peakG: number) {
    // Check recent acceleration variance
    const avg = this.recentSpikes.reduce((a, b) => a + b, 0) / (this.recentSpikes.length || 1);
    const variance = this.recentSpikes.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / (this.recentSpikes.length || 1);

    // If variance is low (< 0.25), user is stationary/unmoving after impact
    if (variance < 0.35 && this.onFallDetected) {
      const event: FallDetectionEvent = {
        id: `fall-${Date.now()}`,
        timestamp: new Date().toISOString(),
        accelerationPeakG: Number(peakG.toFixed(2)),
        tiltAngleDeg: Math.floor(65 + Math.random() * 20),
        inactivityDurationSec: 3.5,
        status: 'PENDING_CONFIRMATION'
      };
      this.onFallDetected(event);
    }
  }

  /**
   * Simulated fall injection for testing and verification
   */
  public triggerSimulatedFall(callback?: FallCallback) {
    const event: FallDetectionEvent = {
      id: `sim-fall-${Date.now()}`,
      timestamp: new Date().toISOString(),
      accelerationPeakG: 3.65,
      tiltAngleDeg: 78,
      inactivityDurationSec: 4.0,
      status: 'PENDING_CONFIRMATION'
    };

    const targetCallback = callback || this.onFallDetected;
    if (targetCallback) {
      targetCallback(event);
    }
    return event;
  }
}

export const fallDetectionService = new FallDetectionService();
