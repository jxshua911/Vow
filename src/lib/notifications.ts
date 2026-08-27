import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type PermissionStatus } from '@capacitor/local-notifications';

export type NotificationPermission = PermissionStatus['display'];
const CHANNEL_ID = 'vow-reminders';
const VOW_NOTIFICATION_ICON = 'ic_vow_monochrome';

export async function setupNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await LocalNotifications.createChannel({
    id: CHANNEL_ID,
    name: 'VOW reminders',
    description: 'Goal, calendar and review reminders from VOW.',
    importance: 4,
    visibility: 1,
    vibration: true,
    sound: 'default',
  });
}

export async function getNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!Capacitor.isNativePlatform()) return 'unsupported';
  const result = await LocalNotifications.checkPermissions();
  return result.display;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!Capacitor.isNativePlatform()) return 'unsupported';
  await setupNotifications();
  const current = await LocalNotifications.checkPermissions();
  if (current.display === 'granted') return current.display;
  const result = await LocalNotifications.requestPermissions();
  return result.display;
}

export async function scheduleReminder(id: number, title: string, body: string, at: Date): Promise<void> {
  if (!Capacitor.isNativePlatform() || at.getTime() <= Date.now()) return;
  const permission = await requestNotificationPermission();
  if (permission !== 'granted') return;
  await LocalNotifications.schedule({
    notifications: [{
      id,
      title,
      body,
      channelId: CHANNEL_ID,
      smallIcon: VOW_NOTIFICATION_ICON,
      sound: 'default',
      schedule: { at, allowWhileIdle: true },
    }],
  });
}

export async function cancelReminder(id: number): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await LocalNotifications.cancel({ notifications: [{ id }] });
}
