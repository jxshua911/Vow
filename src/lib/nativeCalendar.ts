import { Capacitor } from '@capacitor/core';
import { CapacitorCalendar } from '@ebarooni/capacitor-calendar';
import type { Session } from '@/types/database';

export async function requestNativeCalendarAccess(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  const { result } = await CapacitorCalendar.requestFullCalendarAccess();
  return result === 'granted';
}

export async function addSessionToNativeCalendar(session: Session): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;
  const startDate = new Date(session.scheduled_at).getTime();
  const endDate = startDate + Math.max(15, session.duration_minutes || 60) * 60_000;
  const permission = await requestNativeCalendarAccess();
  if (!permission) throw new Error('Calendar access was not granted.');
  const { result: calendars } = await CapacitorCalendar.listCalendars();
  const { result: defaultCalendar } = await CapacitorCalendar.getDefaultCalendar();
  const calendarId = defaultCalendar?.id ?? calendars[0]?.id;
  const { id } = await CapacitorCalendar.createEvent({
    calendarId,
    title: `VOW · ${session.title}`,
    description: `${session.duration_minutes} min commitment created from VOW.`,
    startDate,
    endDate,
    alerts: [-15, 0],
  });
  return id;
}

export async function syncSessionsToNativeCalendar(sessions: Session[]): Promise<number> {
  if (!Capacitor.isNativePlatform()) return 0;
  const upcoming = sessions.filter((session) => session.status === 'scheduled' && new Date(session.scheduled_at).getTime() > Date.now());
  if (!upcoming.length) return 0;
  if (!await requestNativeCalendarAccess()) return 0;
  let created = 0;
  const { result: calendars } = await CapacitorCalendar.listCalendars();
  const { result: defaultCalendar } = await CapacitorCalendar.getDefaultCalendar();
  const calendarId = defaultCalendar?.id ?? calendars[0]?.id;
  for (const session of upcoming) {
    const startDate = new Date(session.scheduled_at).getTime();
    const endDate = startDate + Math.max(15, session.duration_minutes || 60) * 60_000;
    await CapacitorCalendar.createEvent({
      calendarId,
      title: `VOW · ${session.title}`,
      description: `${session.duration_minutes} min commitment created from VOW.`,
      startDate,
      endDate,
      alerts: [-15, 0],
    });
    created += 1;
  }
  return created;
}
