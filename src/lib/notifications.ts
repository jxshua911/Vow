import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type PermissionStatus } from '@capacitor/local-notifications';
import type { Session } from '@/types/database';

export type NotificationPermission = PermissionStatus['display'];
export type NotificationPreferences = { sound: boolean; vibration: boolean };

type NotificationChannel = 'sound-vibration' | 'sound-only' | 'vibration-only' | 'silent';
const PREF_KEY = 'vow:notification-preferences';
const CHANNELS: Record<NotificationChannel, string> = {
  'sound-vibration': 'vow-reminders-sound-vibration-v4',
  'sound-only': 'vow-reminders-sound-v4',
  'vibration-only': 'vow-reminders-vibration-v4',
  silent: 'vow-reminders-silent-v4',
};
const DEFAULT_PREFERENCES: NotificationPreferences = { sound: true, vibration: true };
const VOW_NOTIFICATION_ICON = 'ic_vow_monochrome';

export function getNotificationPreferences(): NotificationPreferences {
  try {
    const stored = localStorage.getItem(PREF_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<NotificationPreferences>;
      return { sound: parsed.sound !== false, vibration: parsed.vibration !== false };
    }
  } catch { /* fall through to defaults */ }
  return DEFAULT_PREFERENCES;
}

export async function setNotificationPreferences(preferences: NotificationPreferences): Promise<void> {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(preferences)); } catch { /* ignore */ }
  if (Capacitor.isNativePlatform()) await setupNotifications(preferences);
}

function channelFor(preferences: NotificationPreferences): NotificationChannel {
  if (preferences.sound && preferences.vibration) return 'sound-vibration';
  if (preferences.sound) return 'sound-only';
  if (preferences.vibration) return 'vibration-only';
  return 'silent';
}

export async function setupNotifications(preferences = getNotificationPreferences()): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await LocalNotifications.createChannel({
    id: CHANNELS['sound-vibration'], name: 'VOW reminders', description: 'VOW reminders with sound and vibration.', importance: 4, visibility: 1, vibration: true, sound: 'default',
  });
  await LocalNotifications.createChannel({
    id: CHANNELS['sound-only'], name: 'VOW reminders · sound', description: 'VOW reminders with sound and no vibration.', importance: 4, visibility: 1, vibration: false, sound: 'default',
  });
  await LocalNotifications.createChannel({
    id: CHANNELS['vibration-only'], name: 'VOW reminders · vibration', description: 'VOW reminders with vibration and no sound.', importance: 4, visibility: 1, vibration: true, sound: undefined,
  });
  await LocalNotifications.createChannel({
    id: CHANNELS.silent, name: 'VOW reminders · silent', description: 'VOW reminders without sound or vibration.', importance: 3, visibility: 1, vibration: false, sound: undefined,
  });
  void preferences;
}

export async function getNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!Capacitor.isNativePlatform()) return 'unsupported';
  const result = await LocalNotifications.checkPermissions();
  return result.display;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!Capacitor.isNativePlatform()) return 'unsupported';
  const current = await LocalNotifications.checkPermissions();
  if (current.display === 'granted') { await setupNotifications(); return current.display; }
  const result = await LocalNotifications.requestPermissions();
  if (result.display === 'granted') await setupNotifications();
  return result.display;
}

export async function scheduleReminder(id: number, title: string, body: string, at: Date): Promise<void> {
  if (!Capacitor.isNativePlatform() || at.getTime() <= Date.now()) return;
  if (await getNotificationPermission() !== 'granted') return;
  const preferences = getNotificationPreferences();
  await setupNotifications(preferences);
  await LocalNotifications.schedule({ notifications: [{ id, title, body, channelId: CHANNELS[channelFor(preferences)], smallIcon: VOW_NOTIFICATION_ICON, schedule: { at, allowWhileIdle: true } }] });
}

export async function cancelReminder(id: number): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await LocalNotifications.cancel({ notifications: [{ id }] });
}

function notificationId(sessionId: string): number {
  let hash = 0;
  for (let i = 0; i < sessionId.length; i += 1) hash = ((hash << 5) - hash + sessionId.charCodeAt(i)) | 0;
  return Math.abs(hash || 1);
}

export async function syncUpcomingSessionNotifications(sessions: Session[]): Promise<void> {
  if (!Capacitor.isNativePlatform() || await getNotificationPermission() !== 'granted') return;
  const upcoming = sessions.filter((session) => session.status === 'scheduled' && new Date(session.scheduled_at).getTime() > Date.now());
  await Promise.all(upcoming.map((session) => scheduleReminder(notificationId(session.id), `VOW · ${session.title}`, `${session.duration_minutes} min commitment. This is the time you set aside for it.`, new Date(session.scheduled_at))));
}
