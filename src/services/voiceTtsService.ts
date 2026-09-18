/**
 * LifeShield Native Device Voice Text-to-Speech Service.
 * Implements real device voice reminders using the phone / browser's native Text-to-Speech capability.
 * Supports: English, Telugu (te-IN), and Hindi (hi-IN) with system voice selection and adjustable speech rates.
 */

export type VoiceLanguage = 'en' | 'te' | 'hi';

export interface VoiceSettings {
  masterVoiceEnabled: boolean;
  language: VoiceLanguage;
  speechRate: number; // 0.75 to 1.5
  selectedVoiceName?: string;
}

export type TtsEventType = 'requested' | 'started' | 'ended' | 'error' | 'voices-loaded';

export interface TtsEvent {
  type: TtsEventType;
  message: string;
  voice?: string;
  language?: string;
  timestamp: number;
}

import { androidNotificationService, NotificationPermissionStatus } from './androidNotificationService';

const VOICE_SETTINGS_KEY = 'lifeshield_voice_settings';
const LOG_PREFIX = '[LifeShield TTS]';

class VoiceTtsService {
  private settings: VoiceSettings = {
    masterVoiceEnabled: true,
    language: 'en',
    speechRate: 1.0,
  };

  private voices: SpeechSynthesisVoice[] = [];
  private voicesLoaded = false;
  private listeners: Array<(event: TtsEvent) => void> = [];
  private unlocked = false;

  constructor() {
    this.loadSettings();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.populateVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        this.populateVoices();
        this.voicesLoaded = true;
        console.log(`${LOG_PREFIX} Voices loaded: ${this.voices.length} available`);
        this.emit({ type: 'voices-loaded', message: `${this.voices.length} voices loaded`, timestamp: Date.now() });
      };
      // Some browsers need a small delay to populate voices
      setTimeout(() => {
        if (!this.voicesLoaded) {
          this.populateVoices();
          this.voicesLoaded = true;
          console.log(`${LOG_PREFIX} Voices loaded (delayed): ${this.voices.length} available`);
        }
      }, 500);
    }
  }

  private emit(event: TtsEvent) {
    this.listeners.forEach((l) => l(event));
  }

  public onEvent(listener: (event: TtsEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private loadSettings() {
    try {
      const saved = localStorage.getItem(VOICE_SETTINGS_KEY);
      if (saved) {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn(`${LOG_PREFIX} Could not load voice settings from localStorage:`, e);
    }
  }

  public saveSettings(newSettings: Partial<VoiceSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    try {
      localStorage.setItem(VOICE_SETTINGS_KEY, JSON.stringify(this.settings));
    } catch (e) {
      console.warn(`${LOG_PREFIX} Could not save voice settings to localStorage:`, e);
    }
  }

  public getSettings(): VoiceSettings {
    return { ...this.settings };
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  /**
   * Unlock speech synthesis by user interaction (required by some browsers).
   * Call this on any user click/tap before the first reminder fires.
   */
  public unlock(): void {
    if (this.unlocked) return;
    if (!this.isSupported()) return;

    try {
      // Chrome/Edge requires a user gesture to unlock speechSynthesis
      const test = new SpeechSynthesisUtterance('');
      test.volume = 0;
      test.rate = 1;
      window.speechSynthesis.speak(test);
      this.unlocked = true;
      console.log(`${LOG_PREFIX} Speech synthesis unlocked`);
    } catch {
      // Silently fail - some browsers don't need unlock
      this.unlocked = true;
    }
  }

  public populateVoices(): SpeechSynthesisVoice[] {
    if (!this.isSupported()) return [];
    this.voices = window.speechSynthesis.getVoices();
    return this.voices;
  }

  public getAvailableVoices(lang?: VoiceLanguage): SpeechSynthesisVoice[] {
    const all = this.populateVoices();
    if (!lang) return all;

    const langPrefix = lang === 'te' ? 'te' : lang === 'hi' ? 'hi' : 'en';
    const filtered = all.filter((v) => v.lang.toLowerCase().startsWith(langPrefix));
    return filtered.length > 0 ? filtered : all;
  }

  /**
   * Speak a medication or routine reminder in the configured or requested language
   */
  public speakReminder(options: {
    title: string;
    dosage?: string;
    reminderType?: string;
    language?: VoiceLanguage;
    force?: boolean;
  }): void {
    if (!options.force && !this.settings.masterVoiceEnabled) {
      console.log(`${LOG_PREFIX} TTS requested but master voice is OFF, skipping`);
      return;
    }

    if (!this.isSupported()) {
      console.warn(`${LOG_PREFIX} SpeechSynthesis is not supported on this device`);
      this.emit({ type: 'error', message: 'Voice reminders are not supported by this browser', timestamp: Date.now() });
      return;
    }

    const lang = options.language || this.settings.language || 'en';
    let textToSpeak = '';

    const doseStr = options.dosage ? options.dosage : '';

    if (lang === 'te') {
      // Telugu
      if (options.reminderType === 'water' || options.reminderType === 'Water') {
        textToSpeak = `లైఫ్‌షీల్డ్ జ్ఞాపిక. నీరు త్రాగడానికి సమయమైంది. దయచేసి ఒక గ్లాసు నీరు త్రాగండి.`;
      } else if (options.reminderType === 'meal' || options.reminderType === 'Meal') {
        textToSpeak = `లైఫ్‌షీల్డ్ జ్ఞాపిక. ఆహారం లేదా భోజనం సమయమైంది.`;
      } else {
        textToSpeak = `లైఫ్‌షీల్డ్ మందుల జ్ఞాపిక. ${options.title} తీసుకోవడానికి సమయమైంది. ${doseStr ? 'మోతాదు ' + doseStr + '.' : ''}`;
      }
    } else if (lang === 'hi') {
      // Hindi
      if (options.reminderType === 'water' || options.reminderType === 'Water') {
        textToSpeak = `लाइफशील्ड रिमाइंडर। पानी पीने का समय हो गया है। कृपया एक गिलास पानी पिएं।`;
      } else if (options.reminderType === 'meal' || options.reminderType === 'Meal') {
        textToSpeak = `लाइफशील्ड रिमाइंडर। भोजन करने का समय हो गया है।`;
      } else {
        textToSpeak = `लाइफशील्ड दवा रिमाइंडर। ${options.title} लेने का समय हो गया है। ${doseStr ? 'खुराक: ' + doseStr + '।' : ''}`;
      }
    } else {
      // English
      if (options.reminderType === 'water' || options.reminderType === 'Water') {
        textToSpeak = `LifeShield reminder. It is time to drink water.`;
      } else if (options.reminderType === 'meal' || options.reminderType === 'Meal') {
        textToSpeak = `LifeShield reminder. It is time for your meal.`;
      } else {
        textToSpeak = `LifeShield reminder. It is time for your medicine. ${options.title}. ${doseStr ? doseStr + '.' : ''}`;
      }
    }

    console.log(`${LOG_PREFIX} TTS requested: "${textToSpeak}" (lang=${lang})`);
    this.speakRaw(textToSpeak, lang);
  }

  /**
   * Speak raw text using native device speech synthesis
   */
  public speakRaw(text: string, lang?: VoiceLanguage): void {
    if (!this.isSupported()) {
      console.warn(`${LOG_PREFIX} speechSynthesis not available`);
      return;
    }

    // Cancel any ongoing speech first
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Some browsers throw on cancel
    }

    const utterance = new SpeechSynthesisUtterance(text);
    const targetLang = lang || this.settings.language || 'en';

    utterance.rate = this.settings.speechRate || 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Resolve system voice
    const voices = this.populateVoices();
    let selectedVoice: SpeechSynthesisVoice | undefined;

    if (this.settings.selectedVoiceName) {
      selectedVoice = voices.find((v) => v.name === this.settings.selectedVoiceName);
    }

    if (!selectedVoice) {
      const prefix = targetLang === 'te' ? 'te' : targetLang === 'hi' ? 'hi' : 'en';
      selectedVoice = voices.find((v) => v.lang.toLowerCase().startsWith(prefix));
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang;
      console.log(`${LOG_PREFIX} Selected voice: "${selectedVoice.name}" (${selectedVoice.lang})`);
    } else {
      const fallbackLang = targetLang === 'te' ? 'te-IN' : targetLang === 'hi' ? 'hi-IN' : 'en-US';
      utterance.lang = fallbackLang;
      console.log(`${LOG_PREFIX} No matching voice found for ${targetLang}, using default with lang=${fallbackLang}`);
      this.emit({
        type: 'error',
        message: `No ${targetLang} voice is installed. Using the browser's default voice.`,
        timestamp: Date.now(),
      });
    }

    console.log(`${LOG_PREFIX} Speech started: "${text.substring(0, 60)}..."`);

    utterance.onstart = () => {
      console.log(`${LOG_PREFIX} Speech started event`);
      this.emit({ type: 'started', message: 'Speech started', voice: utterance.voice?.name, language: utterance.lang, timestamp: Date.now() });
    };

    utterance.onend = () => {
      console.log(`${LOG_PREFIX} Speech ended`);
      this.emit({ type: 'ended', message: 'Speech completed', timestamp: Date.now() });
    };

    utterance.onerror = (event) => {
      // 'interrupted' and 'canceled' are expected when we cancel before speaking
      if (event.error === 'interrupted' || event.error === 'canceled') {
        console.log(`${LOG_PREFIX} Speech ${event.error} (expected)`);
        return;
      }
      console.error(`${LOG_PREFIX} Speech error:`, event.error);
      this.emit({ type: 'error', message: `Speech error: ${event.error}`, timestamp: Date.now() });
    };

    try {
      window.speechSynthesis.speak(utterance);

      // Chrome bug workaround: speechSynthesis may pause after ~15 seconds
      // Keep it alive by periodically resuming
      const keepAlive = setInterval(() => {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        } else {
          clearInterval(keepAlive);
        }
      }, 10000);

      // Auto-clear after 30 seconds max
      setTimeout(() => clearInterval(keepAlive), 30000);
    } catch (err) {
      console.error(`${LOG_PREFIX} Failed to start speech:`, err);
      this.emit({ type: 'error', message: `Failed to start speech: ${err}`, timestamp: Date.now() });
    }
  }

  public stop(): void {
    if (this.isSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
  }

  /**
   * Get current notification permission status
   */
  public getNotificationPermission(): NotificationPermissionStatus {
    if (androidNotificationService.isNativeAndroid()) {
      // On Android, check asynchronously — return 'default' initially
      // The real check happens async, but we need a sync initial value for UI
      return 'default';
    }
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  }

  /**
   * Request notification permission (must be called from user gesture)
   */
  public async requestNotificationPermission(): Promise<NotificationPermissionStatus> {
    if (androidNotificationService.isNativeAndroid()) {
      const result = await androidNotificationService.requestPermission();
      console.log(`${LOG_PREFIX} Android notification permission: ${result}`);
      return result;
    }
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.warn(`${LOG_PREFIX} Notifications not supported`);
      return 'unsupported';
    }

    try {
      const result = await Notification.requestPermission();
      console.log(`${LOG_PREFIX} Notification permission: ${result}`);
      return result;
    } catch (err) {
      console.error(`${LOG_PREFIX} Failed to request notification permission:`, err);
      return 'default';
    }
  }

  /**
   * Send a browser notification
   */
  public sendBrowserNotification(title: string, body: string): boolean {
    if (androidNotificationService.isNativeAndroid()) {
      // Fire-and-forget native notification
      androidNotificationService.sendNotification({ title, body }).catch((err) => {
        console.warn(`${LOG_PREFIX} Native notification failed:`, err);
      });
      return true;
    }

    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.warn(`${LOG_PREFIX} Notifications not supported`);
      return false;
    }

    if (Notification.permission !== 'granted') {
      console.warn(`${LOG_PREFIX} Notification permission not granted: ${Notification.permission}`);
      return false;
    }

    try {
      const n = new Notification(title, { body, icon: '/favicon.ico' });
      n.onclick = () => {
        window.focus();
        n.close();
      };
      setTimeout(() => n.close(), 10000);
      console.log(`${LOG_PREFIX} Browser notification sent: ${title}`);
      return true;
    } catch (err) {
      console.error(`${LOG_PREFIX} Failed to send notification:`, err);
      return false;
    }
  }
}

export const voiceTtsService = new VoiceTtsService();
