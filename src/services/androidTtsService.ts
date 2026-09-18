/**
 * LifeShield Android Native Text-to-Speech Service.
 * JavaScript bridge to the Android TextToSpeechPlugin.
 * Uses native Android TTS for reliable voice reminders.
 * Falls back to web SpeechSynthesis when not on Android.
 */
import { registerPlugin, Capacitor } from '@capacitor/core';
import { voiceTtsService, VoiceLanguage } from './voiceTtsService';

export interface TextToSpeechPluginInterface {
  isAvailable(): Promise<{ available: boolean }>;
  getAvailableLanguages(): Promise<{ languages: string[] }>;
  speak(options: {
    text: string;
    lang: string;
    rate: number;
    masterVoiceEnabled: boolean;
  }): Promise<{
    success: boolean;
    skipped?: boolean;
    reason?: string;
    language?: string;
    utteranceId?: string;
    error?: string;
  }>;
  stop(): Promise<{ stopped: boolean }>;
  shutdown(): Promise<{ shutdown: boolean }>;
}

const NativeTtsPlugin = registerPlugin<TextToSpeechPluginInterface>('TextToSpeech');

export class AndroidTtsService {
  private static isNative(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  }

  /**
   * Check if native TTS is available on this device.
   */
  public static async isNativeAvailable(): Promise<boolean> {
    if (!this.isNative()) return false;
    try {
      const result = await NativeTtsPlugin.isAvailable();
      return result.available;
    } catch {
      return false;
    }
  }

  /**
   * Speak a reminder using native Android TTS.
   * Falls back to web SpeechSynthesis if not on Android or native TTS fails.
   */
  public static async speakReminder(options: {
    title: string;
    dosage?: string;
    reminderType?: string;
    language?: VoiceLanguage;
    masterVoiceEnabled?: boolean;
    voiceEnabled?: boolean;
  }): Promise<void> {
    // Check master voice setting
    const settings = voiceTtsService.getSettings();
    const masterEnabled = options.masterVoiceEnabled ?? settings.masterVoiceEnabled;

    if (!masterEnabled) {
      console.log('[AndroidTts] Master voice OFF, skipping');
      return;
    }

    // Check per-reminder voice setting
    if (options.voiceEnabled === false) {
      console.log('[AndroidTts] Reminder voice OFF, skipping');
      return;
    }

    const lang = options.language || settings.language || 'en';
    const textToSpeak = this.buildReminderText(options, lang);

    if (!textToSpeak) {
      console.warn('[AndroidTts] No text to speak');
      return;
    }

    // Try native TTS on Android
    if (this.isNative()) {
      try {
        const available = await NativeTtsPlugin.isAvailable();
        if (!available.available) {
          console.warn('[AndroidTts] Native TTS not available, falling back to web');
          voiceTtsService.speakReminder({ ...options, force: true });
          return;
        }

        const rate = settings.speechRate || 1.0;
        const result = await NativeTtsPlugin.speak({
          text: textToSpeak,
          lang,
          rate,
          masterVoiceEnabled: masterEnabled,
        });

        if (result.skipped) {
          console.log('[AndroidTts] Skipped:', result.reason);
        } else if (result.success) {
          console.log('[AndroidTts] Native TTS started, lang:', result.language);
        } else {
          console.warn('[AndroidTts] Native TTS failed:', result.error);
          // Fall back to web TTS
          voiceTtsService.speakReminder({ ...options, force: true });
        }
      } catch (err) {
        console.error('[AndroidTts] Native TTS error, falling back to web:', err);
        voiceTtsService.speakReminder({ ...options, force: true });
      }
      return;
    }

    // Web fallback
    voiceTtsService.speakReminder({ ...options, force: true });
  }

  /**
   * Speak raw text.
   */
  public static async speakRaw(text: string, lang?: VoiceLanguage): Promise<void> {
    const settings = voiceTtsService.getSettings();
    const targetLang = lang || settings.language || 'en';

    if (this.isNative()) {
      try {
        const available = await NativeTtsPlugin.isAvailable();
        if (available.available) {
          await NativeTtsPlugin.speak({
            text,
            lang: targetLang,
            rate: settings.speechRate || 1.0,
            masterVoiceEnabled: settings.masterVoiceEnabled,
          });
          return;
        }
      } catch {
        // Fall through to web
      }
    }

    voiceTtsService.speakRaw(text, targetLang);
  }

  /**
   * Stop any ongoing speech.
   */
  public static async stop(): Promise<void> {
    if (this.isNative()) {
      try {
        await NativeTtsPlugin.stop();
      } catch {
        // ignore
      }
    }
    voiceTtsService.stop();
  }

  /**
   * Build reminder text for the given language.
   */
  private static buildReminderText(options: {
    title: string;
    dosage?: string;
    reminderType?: string;
  }, lang: string): string {
    const type = options.reminderType || 'Medicine';
    const doseStr = options.dosage || '';

    if (lang === 'te') {
      if (type.toLowerCase() === 'water') {
        return 'లైఫ్\u200Cషీల్డ్ జ్ఞాపిక. నీరు త్రాగడానికి సమయమైంది. దయచేసి ఒక గ్లాసు నీరు త్రాగండి.';
      }
      if (type.toLowerCase() === 'meal') {
        return 'లైఫ్\u200Cషీల్డ్ జ్ఞాపిక. ఆహారం లేదా భోజనం సమయమైంది.';
      }
      return `లైఫ్\u200Cషీల్డ్ మందుల జ్ఞాపిక. ${options.title} తీసుకోవడానికి సమయమైంది. ${doseStr ? 'మోతాదు ' + doseStr + '.' : ''}`;
    }

    if (lang === 'hi') {
      if (type.toLowerCase() === 'water') {
        return 'लाइफशील्ड रिमाइंडर। पानी पीने का समय हो गया है। कृपया एक गिलास पानी पिएं।';
      }
      if (type.toLowerCase() === 'meal') {
        return 'लाइफशील्ड रिमाइंडर। भोजन करने का समय हो गया है।';
      }
      return `लाइफशील्ड दवा रिमाइंडर। ${options.title} लेने का समय हो गया है। ${doseStr ? 'खुराक: ' + doseStr + '।' : ''}`;
    }

    // English
    if (type.toLowerCase() === 'water') {
      return 'LifeShield reminder. It is time to drink water.';
    }
    if (type.toLowerCase() === 'meal') {
      return 'LifeShield reminder. It is time for your meal.';
    }
    return `LifeShield reminder. It is time for your medicine. ${options.title}. ${doseStr ? doseStr + '.' : ''}`;
  }
}
