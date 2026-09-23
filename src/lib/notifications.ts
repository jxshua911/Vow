import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type PermissionStatus } from '@capacitor/local-notifications';
import { supabase } from '@/lib/supabase';
import type { Session } from '@/types/database';

export type NotificationPermission = PermissionStatus['display'];
export type NotificationPreferences = { enabled: boolean; sound: boolean; vibration: boolean };

const CHANNEL_ID = 'vow-reminders-default-v4';
const VOW_NOTIFICATION_ICON = 'ic_vow_monochrome';
const PREF_KEY = 'vow:notification-preferences';
const DEFAULT_PREFERENCES: NotificationPreferences = { enabled: true, sound: true, vibration: true };

export function getNotificationPreferences(): NotificationPreferences {
  try {
    const stored = localStorage.getItem(PREF_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<NotificationPreferences>;
      return { ...DEFAULT_PREFERENCES, ...parsed };
    }
  } catch {
    // Notification delivery should not depend on localStorage being available.
  }
  return DEFAULT_PREFERENCES;
}

export async function setNotificationPreferences(preferences: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
  const next = { ...getNotificationPreferences(), ...preferences };
  try { localStorage.setItem(PREF_KEY, JSON.stringify(next)); } catch { /* ignore */ }

  if (!Capacitor.isNativePlatform()) return next;

  if (!next.enabled) {
    await cancelAllVowNotifications();
    return next;
  }

  if (await getNotificationPermission() === 'granted') await setupNotifications();
  return next;
}

export async function setupNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await LocalNotifications.createChannel({
    id: CHANNEL_ID,
    name: 'VOW reminders',
    description: 'Scheduled VOW reminders with sound and vibration.',
    importance: 4,
    visibility: 1,
    vibration: getNotificationPreferences().vibration,
    sound: getNotificationPreferences().sound ? 'default' : undefined,
  });
}

export async function getNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!Capacitor.isNativePlatform()) return 'unsupported';
  const result = await LocalNotifications.checkPermissions();
  return result.display;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!Capacitor.isNativePlatform()) return 'unsupported';
  const current = await LocalNotifications.checkPermissions();
  if (current.display === 'granted') {
    await setupNotifications();
    return current.display;
  }
  const result = await LocalNotifications.requestPermissions();
  if (result.display === 'granted') await setupNotifications();
  return result.display;
}

export async function scheduleReminder(id: number, title: string, body: string, at: Date): Promise<void> {
  if (!Capacitor.isNativePlatform() || at.getTime() <= Date.now()) return;
  const preferences = getNotificationPreferences();
  if (!preferences.enabled || await getNotificationPermission() !== 'granted') return;
  await setupNotifications();
  await LocalNotifications.schedule({
    notifications: [{
      id,
      title,
      body,
      channelId: CHANNEL_ID,
      smallIcon: VOW_NOTIFICATION_ICON,
      sound: preferences.sound ? 'default' : undefined,
      schedule: { at, allowWhileIdle: true },
    }],
  });
}

export async function cancelReminder(id: number): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await LocalNotifications.cancel({ notifications: [{ id }] });
}

export async function cancelAllVowNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const pending = await LocalNotifications.getPending();
  const ids = pending.notifications
    .filter((notification) => notification.channelId === CHANNEL_ID)
    .map((notification) => notification.id);
  if (ids.length > 0) await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
}

export function notificationId(sessionId: string): number {
  let hash = 0;
  for (let i = 0; i < sessionId.length; i += 1) hash = ((hash << 5) - hash + sessionId.charCodeAt(i)) | 0;
  return Math.abs(hash || 1);
}

export async function syncUpcomingSessionNotifications(sessions: Session[]): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const preferences = getNotificationPreferences();
  if (!preferences.enabled) {
    await cancelAllVowNotifications();
    return;
  }

  if (await getNotificationPermission() !== 'granted') return;
  await setupNotifications();

  const now = Date.now();
  const upcoming = sessions.filter((session) => session.status === 'scheduled' && new Date(session.scheduled_at).getTime() > now);
  const desiredIds = new Set(upcoming.map((session) => notificationId(session.id)));

  // Reconcile rather than only adding reminders: moved, completed, skipped,
  // deleted and otherwise stale sessions must no longer leave old reminders behind.
  const pending = await LocalNotifications.getPending();
  const staleIds = pending.notifications
    .filter((notification) => notification.channelId === CHANNEL_ID && !desiredIds.has(notification.id))
    .map((notification) => notification.id);
  if (staleIds.length > 0) {
    await LocalNotifications.cancel({ notifications: staleIds.map((id) => ({ id })) });
  }

  await Promise.all(upcoming.map((session) =>
    scheduleReminder(
      notificationId(session.id),
      `VOW · ${session.title}`,
      `${session.duration_minutes} min commitment. This is the time you set aside for it.`,
      new Date(session.scheduled_at),
    )
  ));
}

export async function syncUserUpcomingSessionNotifications(userId: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const preferences = getNotificationPreferences();
  if (!preferences.enabled) {
    await cancelAllVowNotifications();
    return;
  }

  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'scheduled')
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true });

  if (error) throw error;
  await syncUpcomingSessionNotifications((data || []) as Session[]);
}
