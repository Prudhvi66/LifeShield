/**
 * LifeShield Android Native Notification Service.
 * Uses @capacitor/local-notifications for reliable Android notifications.
 * Falls back to browser Notification API on web.
 */
import { LocalNotifications, ScheduleOptions } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

const LOG_PREFIX = '[LifeShield Notif]';

export type NotificationPermissionStatus = 'granted' | 'denied' | 'default' | 'unsupported';

class AndroidNotificationService {
  private channelCreated = false;
  private permissionGranted = false;

  /**
   * Check if running on native Android.
   */
  isNativeAndroid(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  }

  /**
   * Check current notification permission status.
   */
  async checkPermission(): Promise<NotificationPermissionStatus> {
    if (!this.isNativeAndroid()) {
      return this.webPermissionStatus();
    }

    try {
      const result = await LocalNotifications.checkPermissions();
      this.permissionGranted = result.display === 'granted';
      console.log(`${LOG_PREFIX} Native permission check: ${result.display}`);
      return result.display as NotificationPermissionStatus;
    } catch (err) {
      console.warn(`${LOG_PREFIX} Permission check failed:`, err);
      return 'default';
    }
  }

  /**
   * Request notification permission at runtime.
   */
  async requestPermission(): Promise<NotificationPermissionStatus> {
    if (!this.isNativeAndroid()) {
      return this.webRequestPermission();
    }

    try {
      const result = await LocalNotifications.requestPermissions();
      this.permissionGranted = result.display === 'granted';
      console.log(`${LOG_PREFIX} Native permission request: ${result.display}`);

      if (this.permissionGranted && !this.channelCreated) {
        await this.createChannel();
      }

      return result.display as NotificationPermissionStatus;
    } catch (err) {
      console.warn(`${LOG_PREFIX} Permission request failed:`, err);
      return 'default';
    }
  }

  /**
   * Ensure permission is granted, requesting if needed.
   */
  async ensurePermission(): Promise<boolean> {
    let status = await this.checkPermission();
    if (status === 'granted') return true;

    status = await this.requestPermission();
    return status === 'granted';
  }

  /**
   * Create the Android notification channel.
   * Only called once per app session.
   */
  async createChannel(): Promise<void> {
    if (this.channelCreated) return;
    if (!this.isNativeAndroid()) return;

    try {
      await LocalNotifications.createChannel({
        id: 'lifeshield-reminders',
        name: 'LifeShield Reminders',
        description: 'Medication, hydration, and routine reminders',
        importance: 4, // HIGH - shows heads-up notification
        visibility: 1, // PUBLIC
        sound: 'default',
        vibration: true,
        lights: true,
        lightColor: '#7c3aed',
      });
      this.channelCreated = true;
      console.log(`${LOG_PREFIX} Notification channel created`);
    } catch (err) {
      console.warn(`${LOG_PREFIX} Channel creation failed:`, err);
    }
  }

  /**
   * Send an immediate notification.
   */
  async sendNotification(options: {
    title: string;
    body: string;
    id?: number;
  }): Promise<boolean> {
    if (!this.isNativeAndroid()) {
      return this.webSendNotification(options.title, options.body);
    }

    const granted = await this.ensurePermission();
    if (!granted) {
      console.warn(`${LOG_PREFIX} Cannot send notification: permission denied`);
      return false;
    }

    await this.createChannel();

    const notifId = options.id || Math.floor(Date.now() / 1000) % 2147483647;

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            title: options.title,
            body: options.body,
            id: notifId,
            channelId: 'lifeshield-reminders',
            smallIcon: 'ic_launcher',
            largeIcon: 'ic_launcher',
            schedule: { at: new Date(Date.now() + 100) }, // Fire almost immediately
          },
        ],
      });
      console.log(`${LOG_PREFIX} Notification sent: "${options.title}" (id=${notifId})`);
      return true;
    } catch (err) {
      console.error(`${LOG_PREFIX} Failed to send notification:`, err);
      return false;
    }
  }

  /**
   * Schedule a future notification.
   */
  async scheduleNotification(options: {
    title: string;
    body: string;
    id: number;
    triggerAt: Date;
  }): Promise<boolean> {
    if (!this.isNativeAndroid()) {
      console.log(`${LOG_PREFIX} Web fallback: notification scheduling not supported`);
      return false;
    }

    const granted = await this.ensurePermission();
    if (!granted) {
      console.warn(`${LOG_PREFIX} Cannot schedule notification: permission denied`);
      return false;
    }

    await this.createChannel();

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            title: options.title,
            body: options.body,
            id: options.id,
            channelId: 'lifeshield-reminders',
            smallIcon: 'ic_launcher',
            largeIcon: 'ic_launcher',
            schedule: { at: options.triggerAt },
          },
        ],
      });
      console.log(`${LOG_PREFIX} Notification scheduled: "${options.title}" at ${options.triggerAt.toISOString()} (id=${options.id})`);
      return true;
    } catch (err) {
      console.error(`${LOG_PREFIX} Failed to schedule notification:`, err);
      return false;
    }
  }

  /**
   * Cancel a scheduled notification by ID.
   */
  async cancelNotification(id: number): Promise<void> {
    if (!this.isNativeAndroid()) return;

    try {
      await LocalNotifications.cancel({ notifications: [{ id }] });
      console.log(`${LOG_PREFIX} Notification cancelled (id=${id})`);
    } catch (err) {
      console.warn(`${LOG_PREFIX} Cancel notification failed:`, err);
    }
  }

  /**
   * Cancel all scheduled notifications.
   */
  async cancelAll(): Promise<void> {
    if (!this.isNativeAndroid()) return;

    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({
          notifications: pending.notifications.map((n) => ({ id: n.id })),
        });
        console.log(`${LOG_PREFIX} All notifications cancelled (${pending.notifications.length})`);
      }
    } catch (err) {
      console.warn(`${LOG_PREFIX} Cancel all failed:`, err);
    }
  }

  /**
   * Get count of pending notifications.
   */
  async getPendingCount(): Promise<number> {
    if (!this.isNativeAndroid()) return 0;

    try {
      const pending = await LocalNotifications.getPending();
      return pending.notifications.length;
    } catch {
      return 0;
    }
  }

  /**
   * Generate a stable notification ID from a reminder string.
   * Uses a simple hash to keep IDs consistent for the same reminder.
   */
  generateNotificationId(reminderId: string): number {
    let hash = 0;
    for (let i = 0; i < reminderId.length; i++) {
      const char = reminderId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % 2147483647;
  }

  // --- Web fallback methods ---

  private webPermissionStatus(): NotificationPermissionStatus {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission as NotificationPermissionStatus;
  }

  private async webRequestPermission(): Promise<NotificationPermissionStatus> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }

    try {
      const result = await Notification.requestPermission();
      return result as NotificationPermissionStatus;
    } catch {
      return 'default';
    }
  }

  private webSendNotification(title: string, body: string): boolean {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }
    if (Notification.permission !== 'granted') {
      return false;
    }

    try {
      const n = new Notification(title, { body, icon: '/favicon.ico' });
      n.onclick = () => {
        window.focus();
        n.close();
      };
      setTimeout(() => n.close(), 10000);
      return true;
    } catch {
      return false;
    }
  }
}

export const androidNotificationService = new AndroidNotificationService();
