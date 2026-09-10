import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type PermissionStatus } from '@capacitor/local-notifications';
import type { GoalContext } from '@/lib/goalContext';
import type { Goal, GoalClarificationAnswer, Session } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { buildGoalContext } from '@/lib/goalContext';

export type NotificationPermission = PermissionStatus['display'];
export type NotificationPreferences = { sound: true; vibration: true };

const CHANNEL_ID = 'vow-reminders-default-v3';
const VOW_NOTIFICATION_ICON = 'ic_vow_monochrome';
const PREF_KEY = 'vow:notification-preferences';
const DEFAULT_PREFERENCES: NotificationPreferences = { sound: true, vibration: true };

export function getNotificationPreferences(): NotificationPreferences {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(DEFAULT_PREFERENCES)); } catch { /* ignore */ }
  return DEFAULT_PREFERENCES;
}

export async function setNotificationPreferences(): Promise<void> {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(DEFAULT_PREFERENCES)); } catch { /* ignore */ }
  if (Capacitor.isNativePlatform()) await setupNotifications();
}

export async function setupNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await LocalNotifications.createChannel({ id: CHANNEL_ID, name: 'VOW reminders', description: 'Scheduled VOW reminders with sound and vibration.', importance: 4, visibility: 1, vibration: true, sound: 'default' });
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

function notificationId(sessionId: string): number {
  let hash = 0;
  for (let i = 0; i < sessionId.length; i += 1) hash = ((hash << 5) - hash + sessionId.charCodeAt(i)) | 0;
  return Math.abs(hash || 1);
}

export async function scheduleReminder(id: number, title: string, body: string, at: Date): Promise<void> {
  if (!Capacitor.isNativePlatform() || at.getTime() <= Date.now()) return;
  if (await getNotificationPermission() !== 'granted') return;
  await setupNotifications();
  await LocalNotifications.schedule({ notifications: [{ id, title, body, channelId: CHANNEL_ID, smallIcon: VOW_NOTIFICATION_ICON, schedule: { at, allowWhileIdle: true } }] });
}

export async function cancelReminder(id: number): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await LocalNotifications.cancel({ notifications: [{ id }] });
}

async function loadContexts(sessions: Session[]): Promise<Record<string, GoalContext>> {
  const goalIds = [...new Set(sessions.map((session) => session.goal_id))];
  if (!goalIds.length) return {};
  const [{ data: goals }, { data: answers }] = await Promise.all([
    supabase.from('goals').select('*').in('id', goalIds),
    supabase.from('goal_clarification_answers').select('*').in('goal_id', goalIds).order('question_order', { ascending: true }),
  ]);
  const answerRows = (answers || []) as GoalClarificationAnswer[];
  return Object.fromEntries(((goals || []) as Goal[]).map((goal) => [goal.id, buildGoalContext(goal, answerRows.filter((answer) => answer.goal_id === goal.id))]));
}

export async function syncUpcomingSessionNotifications(sessions: Session[], providedContexts: Record<string, GoalContext> = {}): Promise<void> {
  if (!Capacitor.isNativePlatform() || await getNotificationPermission() !== 'granted') return;
  const upcoming = sessions.filter((session) => session.status === 'scheduled' && new Date(session.scheduled_at).getTime() > Date.now());
  if (!upcoming.length) return;
  let contexts = providedContexts;
  if (Object.keys(contexts).length === 0) {
    try { contexts = await loadContexts(upcoming); } catch { contexts = {}; }
  }
  await Promise.all(upcoming.map(async (session) => {
    const context = contexts[session.goal_id];
    const step = context?.activeStep ? ` Step: ${context.activeStep}.` : '';
    const body = `${session.duration_minutes} min commitment.${step} This is the time you set aside for it.`;
    await scheduleReminder(notificationId(session.id), `VOW · ${session.title}`, body, new Date(session.scheduled_at));
  }));
}
