import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type PermissionStatus } from '@capacitor/local-notifications';
import type { Session } from '@/types/database';

export type NotificationPermission = PermissionStatus['display'];
const CHANNEL_ID = 'vow-reminders-v2';
const VOW_NOTIFICATION_ICON = 'ic_vow_monochrome';

export async function setupNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await LocalNotifications.createChannel({
    id: CHANNEL_ID,
    name: 'VOW reminders',
    description: 'Goal, calendar and review reminders from VOW.',
    importance: 3,
    visibility: 1,
    vibration: false,
    sound: undefined,
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
  if (current.display === 'granted') return current.display;
  const result = await LocalNotifications.requestPermissions();
  if (result.display === 'granted') await setupNotifications();
  return result.display;
}

export async function scheduleReminder(id: number, title: string, body: string, at: Date): Promise<void> {
  if (!Capacitor.isNativePlatform() || at.getTime() <= Date.now()) return;
  const permission = await getNotificationPermission();
  if (permission !== 'granted') return;
  await setupNotifications();
  await LocalNotifications.schedule({
    notifications: [{
      id,
      title,
      body,
      channelId: CHANNEL_ID,
      smallIcon: VOW_NOTIFICATION_ICON,
      sound: undefined,
      schedule: { at, allowWhileIdle: true },
    }],
  });
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
  if (!Capacitor.isNativePlatform()) return;
  if (await getNotificationPermission() !== 'granted') return;
  const upcoming = sessions.filter((session) => session.status === 'scheduled' && new Date(session.scheduled_at).getTime() > Date.now());
  await Promise.all(upcoming.map((session) => scheduleReminder(
    notificationId(session.id),
    `VOW · ${session.title}`,
    `${session.duration_minutes} min commitment. This is the time you set aside for it.`,
    new Date(session.scheduled_at),
  )));
}
