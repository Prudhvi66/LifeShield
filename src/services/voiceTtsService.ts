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

const VOICE_SETTINGS_KEY = 'lifeshield_voice_settings';

class VoiceTtsService {
  private settings: VoiceSettings = {
    masterVoiceEnabled: true,
    language: 'en',
    speechRate: 1.0,
  };

  private voices: SpeechSynthesisVoice[] = [];

  constructor() {
    this.loadSettings();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.populateVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        this.populateVoices();
      };
    }
  }

  private loadSettings() {
    try {
      const saved = localStorage.getItem(VOICE_SETTINGS_KEY);
      if (saved) {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Could not load voice settings from localStorage:', e);
    }
  }

  public saveSettings(newSettings: Partial<VoiceSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    try {
      localStorage.setItem(VOICE_SETTINGS_KEY, JSON.stringify(this.settings));
    } catch (e) {
      console.warn('Could not save voice settings to localStorage:', e);
    }
  }

  public getSettings(): VoiceSettings {
    return { ...this.settings };
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
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
    const filtered = all.filter(v => v.lang.toLowerCase().startsWith(langPrefix));
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
  }) {
    if (!options.force && !this.settings.masterVoiceEnabled) {
      return;
    }

    if (!this.isSupported()) {
      console.warn('SpeechSynthesis is not supported on this device.');
      return;
    }

    const lang = options.language || this.settings.language || 'en';
    let textToSpeak = '';

    const doseStr = options.dosage ? options.dosage : '';

    if (lang === 'te') {
      // Telugu
      if (options.reminderType === 'water') {
        textToSpeak = `లైఫ్‌షీల్డ్ జ్ఞాపిక. నీరు త్రాగడానికి సమయమైంది. దయచేసి ఒక గ్లాసు నీరు త్రాగండి.`;
      } else if (options.reminderType === 'meal') {
        textToSpeak = `లైఫ్‌షీల్డ్ జ్ఞాపిక. ఆహారం లేదా భోజనం సమయమైంది.`;
      } else {
        textToSpeak = `లైఫ్‌షీల్డ్ మందుల జ్ఞాపిక. ${options.title} తీసుకోవడానికి సమయమైంది. మోతాదు ${doseStr}.`;
      }
    } else if (lang === 'hi') {
      // Hindi
      if (options.reminderType === 'water') {
        textToSpeak = `लाइफशील्ड रिमाइंडर। पानी पीने का समय हो गया है। कृपया एक गिलास पानी पिएं।`;
      } else if (options.reminderType === 'meal') {
        textToSpeak = `लाइफशील्ड रिमाइंडर। भोजन करने का समय हो गया है।`;
      } else {
        textToSpeak = `लाइफशील्ड दवा रिमाइंडर। ${options.title} लेने का समय हो गया है। खुराक: ${doseStr}।`;
      }
    } else {
      // English
      if (options.reminderType === 'water') {
        textToSpeak = `LifeShield hydration reminder. It is time to drink a glass of water.`;
      } else if (options.reminderType === 'meal') {
        textToSpeak = `LifeShield reminder. It is time for your scheduled meal.`;
      } else {
        textToSpeak = `LifeShield reminder. It is time to take your ${options.title}. ${doseStr ? 'Prescribed schedule: ' + doseStr : ''}.`;
      }
    }

    this.speakRaw(textToSpeak, lang);
  }

  /**
   * Speak raw text using native device speech synthesis
   */
  public speakRaw(text: string, lang?: VoiceLanguage) {
    if (!this.isSupported()) return;

    window.speechSynthesis.cancel(); // Stop any overlapping utterance

    const utterance = new SpeechSynthesisUtterance(text);
    const targetLang = lang || this.settings.language || 'en';

    utterance.rate = this.settings.speechRate || 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Resolve system voice
    const voices = this.populateVoices();
    let selectedVoice: SpeechSynthesisVoice | undefined;

    if (this.settings.selectedVoiceName) {
      selectedVoice = voices.find(v => v.name === this.settings.selectedVoiceName);
    }

    if (!selectedVoice) {
      const prefix = targetLang === 'te' ? 'te' : targetLang === 'hi' ? 'hi' : 'en';
      selectedVoice = voices.find(v => v.lang.toLowerCase().startsWith(prefix));
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang;
    } else {
      utterance.lang = targetLang === 'te' ? 'te-IN' : targetLang === 'hi' ? 'hi-IN' : 'en-US';
    }

    window.speechSynthesis.speak(utterance);
  }

  public stop() {
    if (this.isSupported()) {
      window.speechSynthesis.cancel();
    }
  }
}

export const voiceTtsService = new VoiceTtsService();
