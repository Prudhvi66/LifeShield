/**
 * LifeShield Reminder Scheduler.
 * Reliable frontend scheduler that triggers reminders at the correct local time.
 * Handles page visibility, window focus, and prevents duplicate firings.
 */

import { voiceTtsService } from './voiceTtsService';

export interface SchedulerReminder {
  id: string;
  title: string;
  reminder_type: string;
  time: string; // HH:MM format
  dosage?: string;
  repeat?: string;
  voice_enabled?: boolean;
  is_active?: boolean;
}

export type SchedulerEventType = 'triggered' | 'error' | 'status';

export interface SchedulerEvent {
  type: SchedulerEventType;
  reminder?: SchedulerReminder;
  message: string;
  timestamp: number;
}

const LOG_PREFIX = '[LifeShield Scheduler]';
const CHECK_INTERVAL_MS = 5000; // Check every 5 seconds
const STORAGE_KEY = 'lifeshield_fired_reminders';

class ReminderScheduler {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler: (() => void) | null = null;
  private focusHandler: (() => void) | null = null;
  private reminders: SchedulerReminder[] = [];
  private firedToday: Set<string> = new Set();
  private listeners: Array<(event: SchedulerEvent) => void> = [];
  private active = false;
  private lastCheckTime = '';
  private _nextReminder: SchedulerReminder | null = null;

  constructor() {
    this.loadFiredToday();
  }

  private emit(event: SchedulerEvent) {
    this.listeners.forEach((l) => l(event));
  }

  public onEvent(listener: (event: SchedulerEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public get isActive(): boolean {
    return this.active;
  }

  public get nextReminder(): SchedulerReminder | null {
    return this._nextReminder;
  }

  public get currentBrowserTime(): string {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  }

  /**
   * Load fired reminders from localStorage for today
   */
  private loadFiredToday(): void {
    try {
      const today = this.getTodayKey();
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.date === today) {
          this.firedToday = new Set(data.keys);
          console.log(`${LOG_PREFIX} Loaded ${this.firedToday.size} fired reminders for today`);
        } else {
          // New day, reset
          this.firedToday = new Set();
          this.saveFiredToday();
          console.log(`${LOG_PREFIX} New day, cleared fired reminders`);
        }
      }
    } catch {
      this.firedToday = new Set();
    }
  }

  private saveFiredToday(): void {
    try {
      const today = this.getTodayKey();
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ date: today, keys: Array.from(this.firedToday) })
      );
    } catch {
      // ignore
    }
  }

  private getTodayKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  /**
   * Create a unique trigger key for a reminder on a given day
   */
  private getTriggerKey(reminderId: string): string {
    return `${reminderId}-${this.getTodayKey()}`;
  }

  /**
   * Build the next reminder info for diagnostics
   */
  private updateNextReminder(): void {
    const now = new Date();
    const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const activeReminders = this.reminders
      .filter((r) => r.is_active !== false)
      .sort((a, b) => a.time.localeCompare(b.time));

    this._nextReminder = null;

    for (const r of activeReminders) {
      const key = this.getTriggerKey(r.id);
      if (this.firedToday.has(key)) continue;

      if (r.time >= currentHHMM) {
        this._nextReminder = r;
        break;
      }
    }

    // If no upcoming reminder today, find the earliest tomorrow
    if (!this._nextReminder && activeReminders.length > 0) {
      this._nextReminder = activeReminders[0];
    }
  }

  /**
   * Check all reminders and trigger any that match the current time
   */
  public checkReminders(): void {
    const now = new Date();
    const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const currentSecond = now.getSeconds();

    // Only check during the first 50 seconds of the minute to avoid edge cases
    if (currentSecond > 50) {
      console.log(`${LOG_PREFIX} Skipping check at second ${currentSecond} to avoid boundary issues`);
      return;
    }

    // Avoid checking the same minute repeatedly (unless it's a fresh check)
    if (currentHHMM === this.lastCheckTime) {
      return;
    }

    this.lastCheckTime = currentHHMM;
    console.log(`${LOG_PREFIX} Checking reminders at ${currentHHMM}:${String(currentSecond).padStart(2, '0')}`);

    this.reminders.forEach((r) => {
      if (r.is_active === false) return;
      if (r.time !== currentHHMM) return;

      const triggerKey = this.getTriggerKey(r.id);

      if (this.firedToday.has(triggerKey)) {
        return; // Already fired today
      }

      // Mark as fired immediately to prevent duplicates
      this.firedToday.add(triggerKey);
      this.saveFiredToday();

      console.log(`${LOG_PREFIX} TRIGGERED: ${r.title} at ${r.time}`);

      // Build reminder message
      const message = this.buildReminderMessage(r);

      // Browser notification
      const notifSent = voiceTtsService.sendBrowserNotification(
        'LifeShield Reminder',
        `${r.title}${r.dosage ? ' - ' + r.dosage : ''}`
      );

      // TTS
      if (r.voice_enabled !== false) {
        voiceTtsService.speakReminder({
          title: r.title,
          dosage: r.dosage,
          reminderType: r.reminder_type,
        });
      }

      // Emit event
      this.emit({
        type: 'triggered',
        reminder: r,
        message: message,
        timestamp: Date.now(),
      });
    });

    this.updateNextReminder();
  }

  /**
   * Build a spoken reminder message
   */
  private buildReminderMessage(r: SchedulerReminder): string {
    const type = (r.reminder_type || '').toLowerCase();
    const title = r.title || '';
    const dosage = r.dosage || '';

    if (type === 'water') {
      return 'LifeShield reminder. It is time to drink water.';
    }
    if (type === 'meal') {
      return 'LifeShield reminder. It is time for your meal.';
    }
    if (dosage) {
      return `LifeShield reminder. It is time for your medicine. ${title}. ${dosage}.`;
    }
    return `LifeShield reminder. ${title}.`;
  }

  /**
   * Start the scheduler
   */
  public start(reminders: SchedulerReminder[]): void {
    this.reminders = reminders;
    this.loadFiredToday();

    if (this.active) {
      console.log(`${LOG_PREFIX} Already active, updating reminders`);
      this.updateNextReminder();
      return;
    }

    this.active = true;
    console.log(`${LOG_PREFIX} Starting scheduler with ${reminders.length} reminders`);

    // Check immediately
    this.checkReminders();

    // Set up interval
    this.intervalId = setInterval(() => {
      this.checkReminders();
    }, CHECK_INTERVAL_MS);

    // Handle page visibility change
    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        console.log(`${LOG_PREFIX} Page became visible, checking reminders`);
        // Reset last check time so we re-check immediately
        this.lastCheckTime = '';
        this.checkReminders();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);

    // Handle window focus
    this.focusHandler = () => {
      console.log(`${LOG_PREFIX} Window received focus, checking reminders`);
      this.lastCheckTime = '';
      this.checkReminders();
    };
    window.addEventListener('focus', this.focusHandler);

    this.updateNextReminder();

    this.emit({
      type: 'status',
      message: `Scheduler active with ${reminders.length} reminders`,
      timestamp: Date.now(),
    });
  }

  /**
   * Update the reminder list without restarting
   */
  public updateReminders(reminders: SchedulerReminder[]): void {
    this.reminders = reminders;
    this.updateNextReminder();
  }

  /**
   * Stop the scheduler
   */
  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }

    if (this.focusHandler) {
      window.removeEventListener('focus', this.focusHandler);
      this.focusHandler = null;
    }

    this.active = false;
    this.lastCheckTime = '';
    console.log(`${LOG_PREFIX} Scheduler stopped`);

    this.emit({
      type: 'status',
      message: 'Scheduler stopped',
      timestamp: Date.now(),
    });
  }

  /**
   * Force a re-check (e.g., after page reload or tab switch)
   */
  public forceCheck(): void {
    this.lastCheckTime = '';
    this.loadFiredToday();
    this.checkReminders();
  }

  /**
   * Trigger a test reminder immediately (does NOT persist to backend)
   */
  public triggerTestReminder(title: string, dosage?: string, reminderType?: string): void {
    console.log(`${LOG_PREFIX} Test reminder triggered: ${title}`);

    const notifSent = voiceTtsService.sendBrowserNotification(
      'LifeShield Reminder (Test)',
      `${title}${dosage ? ' - ' + dosage : ''}`
    );

    voiceTtsService.speakReminder({
      title,
      dosage,
      reminderType: reminderType || 'Medicine',
      force: true,
    });

    this.emit({
      type: 'triggered',
      message: `Test reminder: ${title}`,
      timestamp: Date.now(),
    });
  }

  /**
   * Reset fired state for a specific reminder (for debugging)
   */
  public resetFiredState(reminderId?: string): void {
    if (reminderId) {
      const key = this.getTriggerKey(reminderId);
      this.firedToday.delete(key);
    } else {
      this.firedToday.clear();
    }
    this.saveFiredToday();
    console.log(`${LOG_PREFIX} Reset fired state${reminderId ? ` for ${reminderId}` : ' for all'}`);
  }
}

export const reminderScheduler = new ReminderScheduler();
