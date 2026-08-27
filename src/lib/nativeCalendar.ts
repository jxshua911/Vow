import { Capacitor } from '@capacitor/core';
import { CapacitorCalendar } from '@ebarooni/capacitor-calendar';
import type { Session } from '@/types/database';

const SYNCED_PREFIX = 'vow:native-calendar-session:';

function isSynced(sessionId: string): boolean {
  return localStorage.getItem(`${SYNCED_PREFIX}${sessionId}`) === 'true';
}

function markSynced(sessionId: string): void {
  localStorage.setItem(`${SYNCED_PREFIX}${sessionId}`, 'true');
}

export async function requestNativeCalendarAccess(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  const { result } = await CapacitorCalendar.requestFullCalendarAccess();
  return result === 'granted';
}

async function getCalendarId(): Promise<string | undefined> {
  const { result: calendars } = await CapacitorCalendar.listCalendars();
  const { result: defaultCalendar } = await CapacitorCalendar.getDefaultCalendar();
  return defaultCalendar?.id ?? calendars[0]?.id;
}

export async function addSessionToNativeCalendar(session: Session): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;
  const permission = await requestNativeCalendarAccess();
  if (!permission) throw new Error('Calendar access was not granted.');
  const calendarId = await getCalendarId();
  const startDate = new Date(session.scheduled_at).getTime();
  const endDate = startDate + Math.max(15, session.duration_minutes || 60) * 60_000;
  const { id } = await CapacitorCalendar.createEvent({ calendarId, title: `VOW · ${session.title}`, description: `${session.duration_minutes} min commitment created from VOW.`, startDate, endDate, alerts: [-15, 0] });
  markSynced(session.id);
  return id;
}

export async function syncSessionsToNativeCalendar(sessions: Session[]): Promise<number> {
  if (!Capacitor.isNativePlatform()) return 0;
  const upcoming = sessions.filter((session) => session.status === 'scheduled' && new Date(session.scheduled_at).getTime() > Date.now() && !isSynced(session.id));
  if (!upcoming.length) return 0;
  if (!await requestNativeCalendarAccess()) return 0;
  const calendarId = await getCalendarId();
  let created = 0;
  for (const session of upcoming) {
    const startDate = new Date(session.scheduled_at).getTime();
    const endDate = startDate + Math.max(15, session.duration_minutes || 60) * 60_000;
    await CapacitorCalendar.createEvent({ calendarId, title: `VOW · ${session.title}`, description: `${session.duration_minutes} min commitment created from VOW.`, startDate, endDate, alerts: [-15, 0] });
    markSynced(session.id);
    created += 1;
  }
  return created;
}
