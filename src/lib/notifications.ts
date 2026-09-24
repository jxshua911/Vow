import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type PermissionStatus } from '@capacitor/local-notifications';
import { supabase } from '@/lib/supabase';
import type { Session } from '@/types/database';

export type NotificationPermission = PermissionStatus['display'];
export type NotificationPreferences = { enabled: boolean; sound: boolean; vibration: boolean };

const CHANNEL_PREFIX = 'vow-reminders';
const VOW_NOTIFICATION_ICON = 'ic_vow_monochrome';
const PREF_KEY = 'vow:notification-preferences';
const DEFAULT_PREFERENCES: NotificationPreferences = { enabled: true, sound: true, vibration: true };

function channelId(preferences: NotificationPreferences): string {
  const sound = preferences.sound ? 'sound' : 'silent';
  const vibration = preferences.vibration ? 'vibrate' : 'quiet';
  return `${CHANNEL_PREFIX}-${sound}-${vibration}-v1`;
}

function isVowNotification(notification: { title: string; extra?: unknown }): boolean {
  if (notification.extra && typeof notification.extra === 'object' && 'vow' in notification.extra) {
    return (notification.extra as { vow?: unknown }).vow === true;
  }
  // Legacy VOW reminders did not persist channelId in pending notification
  // records, so retain a title-based fallback for reminders created by older builds.
  return notification.title.startsWith('VOW ·');
}

export function getNotificationPreferences(): NotificationPreferences {
  try {
    const stored = localStorage.getItem(PREF_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<NotificationPreferences>;
      return {
        enabled: parsed.enabled !== false,
        sound: parsed.sound !== false,
        vibration: parsed.vibration !== false,
      };
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

  if (await getNotificationPermission() === 'granted') {
    await syncCurrentUserUpcomingSessionNotifications();
  }
  return next;
}

export async function setupNotifications(preferences = getNotificationPreferences()): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  await LocalNotifications.createChannel({
    id: channelId(preferences),
    name: 'VOW reminders',
    description: 'Scheduled VOW commitment reminders.',
    importance: 4,
    visibility: 1,
    vibration: preferences.vibration,
    sound: preferences.sound ? 'default' : undefined,
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

  await setupNotifications(preferences);

  // Always replace an existing reminder with the same stable ID. This is
  // essential when a session is moved or its notification settings change.
  await LocalNotifications.cancel({ notifications: [{ id }] }).catch(() => undefined);

  await LocalNotifications.schedule({
    notifications: [{
      id,
      title,
      body,
      channelId: channelId(preferences),
      smallIcon: VOW_NOTIFICATION_ICON,
      sound: preferences.sound ? 'default' : undefined,
      extra: { vow: true },
      schedule: { at, allowWhileIdle: true },
    }],
  });
}

export async function cancelReminder(id: number): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await LocalNotifications.cancel({ notifications: [{ id }] }).catch(() => undefined);
}

export async function cancelAllVowNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const pending = await LocalNotifications.getPending();
  const ids = pending.notifications
    .filter((notification) => isVowNotification(notification))
    .map((notification) => notification.id);

  if (ids.length > 0) {
    await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
  }
}

export function notificationId(sessionId: string): number {
  let hash = 2166136261;
  for (let i = 0; i < sessionId.length; i += 1) {
    hash ^= sessionId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  // Android notification IDs are signed 32-bit integers; keep the value
  // positive and never use zero.
  const id = (hash >>> 0) & 0x7fffffff;
  return id || 1;
}

export async function syncUpcomingSessionNotifications(sessions: Session[]): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const preferences = getNotificationPreferences();
  if (!preferences.enabled) {
    await cancelAllVowNotifications();
    return;
  }

  if (await getNotificationPermission() !== 'granted') return;

  await setupNotifications(preferences);

  const now = Date.now();
  const upcoming = sessions.filter((session) => {
    const at = new Date(session.scheduled_at).getTime();
    return session.status === 'scheduled' && Number.isFinite(at) && at > now;
  });

  const desiredIds = new Set(upcoming.map((session) => notificationId(session.id)));

  // Reconcile every VOW channel, including the previous v4 channel. This
  // cleans up reminders created by older app builds and catches deleted,
  // completed, skipped and moved sessions.
  const pending = await LocalNotifications.getPending();
  const staleIds = pending.notifications
    .filter((notification) => isVowNotification(notification) && !desiredIds.has(notification.id))
    .map((notification) => notification.id);

  if (staleIds.length > 0) {
    await LocalNotifications.cancel({ notifications: staleIds.map((id) => ({ id })) });
  }

  // Cancel + recreate desired IDs as well. This makes a sync authoritative:
  // changed session times, text, sound and vibration are actually applied.
  const desiredPendingIds = upcoming.map((session) => notificationId(session.id));
  if (desiredPendingIds.length > 0) {
    await LocalNotifications.cancel({ notifications: desiredPendingIds.map((id) => ({ id })) }).catch(() => undefined);
  }

  for (const session of upcoming) {
    await scheduleReminder(
      notificationId(session.id),
      `VOW · ${session.title}`,
      `${session.duration_minutes} min commitment. This is the time you set aside for it.`,
      new Date(session.scheduled_at),
    );
  }
}

async function syncCurrentUserUpcomingSessionNotifications(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await syncUserUpcomingSessionNotifications(user.id);
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
