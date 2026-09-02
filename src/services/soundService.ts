/**
 * Web Audio API synthesizer for LifeShield
 * Enables offline, zero-latency emergency sirens, countdown beeps, and audio distress beacons.
 */
class SoundService {
  private audioCtx: AudioContext | null = null;
  private sirenOscillator: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;
  private isSirenPlaying = false;
  private beaconIntervalId: number | null = null;

  private getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Play single short countdown tick
   */
  public playCountdownTick(isUrgent = false) {
    try {
      const ctx = this.getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = isUrgent ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(isUrgent ? 880 : 440, ctx.currentTime); // A5 or A4

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.15);

      // Trigger mobile haptic if supported
      if ('vibrate' in navigator) {
        navigator.vibrate(isUrgent ? [80, 50, 80] : 60);
      }
    } catch (e) {
      console.warn('Audio feedback error:', e);
    }
  }

  /**
   * Start continuous high-decibel emergency siren
   */
  public startEmergencySiren() {
    if (this.isSirenPlaying) return;
    try {
      const ctx = this.getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      gain.gain.setValueAtTime(0.35, ctx.currentTime);

      // Frequency modulation for European/Indian emergency siren (wa-wa 600Hz <-> 1200Hz)
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.setValueAtTime(1.5, ctx.currentTime); // 1.5Hz sweep
      lfoGain.gain.setValueAtTime(300, ctx.currentTime);

      osc.frequency.setValueAtTime(800, ctx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      osc.connect(gain);
      gain.connect(ctx.destination);

      lfo.start();
      osc.start();

      this.sirenOscillator = osc;
      this.sirenGain = gain;
      this.isSirenPlaying = true;

      // Pulse vibration
      if ('vibrate' in navigator) {
        navigator.vibrate([500, 200, 500, 200, 500]);
      }
    } catch (e) {
      console.warn('Could not start emergency siren:', e);
    }
  }

  /**
   * Stop emergency siren
   */
  public stopEmergencySiren() {
    if (!this.isSirenPlaying) return;
    try {
      if (this.sirenOscillator) {
        this.sirenOscillator.stop();
        this.sirenOscillator.disconnect();
        this.sirenOscillator = null;
      }
      if (this.sirenGain) {
        this.sirenGain.disconnect();
        this.sirenGain = null;
      }
      this.isSirenPlaying = false;
      if ('vibrate' in navigator) {
        navigator.vibrate(0);
      }
    } catch (e) {
      console.warn('Error stopping siren:', e);
    }
  }

  /**
   * Play positive safe/cancel confirmation chime
   */
  public playSafeChime() {
    this.stopEmergencySiren();
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;
      
      const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        gain.gain.setValueAtTime(0.15, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.3);
      });
    } catch (e) {
      console.warn('Safe chime error:', e);
    }
  }

  /**
   * Start Morse code SOS Audio Distress Beacon (· · · — — — · · ·) for search & rescue
   */
  public startAudioBeacon() {
    this.stopAudioBeacon();
    let index = 0;
    // SOS rhythm: 3 short (100ms), 3 long (300ms), 3 short (100ms)
    const pattern = [100, 100, 100, 300, 300, 300, 100, 100, 100];
    
    this.beaconIntervalId = window.setInterval(() => {
      const duration = pattern[index % pattern.length];
      this.playTone(1800, duration / 1000); // 1.8kHz piercing whistle
      index++;
    }, 450);
  }

  public stopAudioBeacon() {
    if (this.beaconIntervalId !== null) {
      clearInterval(this.beaconIntervalId);
      this.beaconIntervalId = null;
    }
  }

  private playTone(freq: number, durationSec: number) {
    try {
      const ctx = this.getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationSec);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + durationSec);
    } catch (e) {
      // ignore
    }
  }
}

export const soundService = new SoundService();
