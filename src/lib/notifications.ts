import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type PermissionStatus } from '@capacitor/local-notifications';
import type { Session } from '@/types/database';

export type NotificationPermission = PermissionStatus['display'];
export type NotificationPreferences = { sound: boolean; vibration: boolean };

const CHANNELS = {
  silent: 'vow-reminders-silent-v2',
  sound: 'vow-reminders-sound-v2',
  vibration: 'vow-reminders-vibration-v2',
  soundVibration: 'vow-reminders-sound-vibration-v2',
} as const;
const VOW_NOTIFICATION_ICON = 'ic_vow_monochrome';
const PREF_KEY = 'vow:notification-preferences';
const DEFAULT_PREFERENCES: NotificationPreferences = { sound: false, vibration: false };

export function getNotificationPreferences(): NotificationPreferences {
  try {
    const stored = JSON.parse(localStorage.getItem(PREF_KEY) || '{}') as Partial<NotificationPreferences>;
    return { sound: stored.sound === true, vibration: stored.vibration === true };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export async function setNotificationPreferences(preferences: NotificationPreferences): Promise<void> {
  localStorage.setItem(PREF_KEY, JSON.stringify(preferences));
  if (Capacitor.isNativePlatform()) await setupNotifications();
}

function channelFor(preferences: NotificationPreferences): string {
  if (preferences.sound && preferences.vibration) return CHANNELS.soundVibration;
  if (preferences.sound) return CHANNELS.sound;
  if (preferences.vibration) return CHANNELS.vibration;
  return CHANNELS.silent;
}

export async function setupNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await Promise.all([
    LocalNotifications.createChannel({ id: CHANNELS.silent, name: 'VOW reminders · Silent', description: 'Quiet scheduled reminders from VOW.', importance: 3, visibility: 1, vibration: false }),
    LocalNotifications.createChannel({ id: CHANNELS.sound, name: 'VOW reminders · Sound', description: 'Scheduled VOW reminders with notification sound.', importance: 3, visibility: 1, vibration: false, sound: 'default' }),
    LocalNotifications.createChannel({ id: CHANNELS.vibration, name: 'VOW reminders · Vibration', description: 'Scheduled VOW reminders with vibration.', importance: 3, visibility: 1, vibration: true }),
    LocalNotifications.createChannel({ id: CHANNELS.soundVibration, name: 'VOW reminders · Sound & vibration', description: 'Scheduled VOW reminders with sound and vibration.', importance: 3, visibility: 1, vibration: true, sound: 'default' }),
  ]);
}

export async function getNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!Capacitor.isNativePlatform()) return 'unsupported';
  const result = await LocalNotifications.checkPermissions();
  return result.display;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!Capacitor.isNativePlatform()) return 'unsupported';
  const current = await LocalNotifications.checkPermissions();
  if (current.display === 'granted') return current.display;
  const result = await LocalNotifications.requestPermissions();
  if (result.display === 'granted') await setupNotifications();
  return result.display;
}

export async function scheduleReminder(id: number, title: string, body: string, at: Date): Promise<void> {
  if (!Capacitor.isNativePlatform() || at.getTime() <= Date.now()) return;
  if (await getNotificationPermission() !== 'granted') return;
  await setupNotifications();
  const preferences = getNotificationPreferences();
  await LocalNotifications.schedule({ notifications: [{ id, title, body, channelId: channelFor(preferences), smallIcon: VOW_NOTIFICATION_ICON, schedule: { at, allowWhileIdle: true } }] });
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
