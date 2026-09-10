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
const NOTIFICATION_GROUP = 'vow-reminders';

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

export async function scheduleReminder(id: number, title: string, body: string, at: Date, group = NOTIFICATION_GROUP, groupSummary = false): Promise<void> {
  if (!Capacitor.isNativePlatform() || at.getTime() <= Date.now()) return;
  if (await getNotificationPermission() !== 'granted') return;
  await setupNotifications();
  await LocalNotifications.schedule({ notifications: [{ id, title, body, channelId: CHANNELS['sound-vibration'], smallIcon: VOW_NOTIFICATION_ICON, group, groupSummary, schedule: { at, allowWhileIdle: true } }] });
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

function notificationGroupKey(at: Date): string {
  return `${NOTIFICATION_GROUP}-${at.getFullYear()}-${at.getMonth()}-${at.getDate()}-${at.getHours()}-${at.getMinutes()}`;
}

function groupNotificationId(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  return Math.abs(hash || 1);
}

export async function syncUpcomingSessionNotifications(sessions: Session[]): Promise<void> {
  if (!Capacitor.isNativePlatform() || await getNotificationPermission() !== 'granted') return;
  const upcoming = sessions.filter((session) => session.status === 'scheduled' && new Date(session.scheduled_at).getTime() > Date.now());
  const groups = new Map<string, Session[]>();
  for (const session of upcoming) {
    const at = new Date(session.scheduled_at);
    const key = notificationGroupKey(at);
    const bucket = groups.get(key) || [];
    bucket.push(session);
    groups.set(key, bucket);
  }
  await Promise.all([...groups.entries()].map(async ([key, bucket]) => {
    const at = new Date(bucket[0].scheduled_at);
    if (bucket.length === 1) {
      const session = bucket[0];
      await scheduleReminder(notificationId(session.id), `VOW · ${session.title}`, `${session.duration_minutes} min commitment. This is the time you set aside for it.`, at, NOTIFICATION_GROUP, false);
      return;
    }
    const detail = bucket.slice(0, 3).map((session) => session.title).join(' · ');
    const suffix = bucket.length > 3 ? ` +${bucket.length - 3} more` : '';
    await scheduleReminder(groupNotificationId(key), `VOW · ${bucket.length} commitments`, `${detail}${suffix}`, at, key, true);
  }));
}
