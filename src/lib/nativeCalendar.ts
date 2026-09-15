import { Capacitor } from '@capacitor/core';
import { CapacitorCalendar } from '@ebarooni/capacitor-calendar';
import type { Session } from '@/types/database';

const SYNCED_PREFIX = 'vow:native-calendar-session:';

function isSynced(sessionId: string): boolean { return localStorage.getItem(`${SYNCED_PREFIX}${sessionId}`) === 'true'; }
function markSynced(sessionId: string): void { localStorage.setItem(`${SYNCED_PREFIX}${sessionId}`, 'true'); }

export async function requestNativeCalendarAccess(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  const { result } = await CapacitorCalendar.requestFullCalendarAccess();
  return result === 'granted';
}

async function getCalendarId(preferredAccountEmail?: string): Promise<string | undefined> {
  const { result: calendars } = await CapacitorCalendar.listCalendars();
  const { result: defaultCalendar } = await CapacitorCalendar.getDefaultCalendar();
  const writable = calendars.filter((calendar) => calendar.visible !== false && calendar.allowsContentModifications !== false);
  if (preferredAccountEmail) {
    const exact = writable.find((calendar) => calendar.accountName?.toLowerCase() === preferredAccountEmail.toLowerCase() || calendar.ownerAccount?.toLowerCase() === preferredAccountEmail.toLowerCase());
    if (exact) return exact.id;
  }
  const googleCalendar = writable.find((calendar) => /@gmail\.com$/i.test(calendar.accountName || '') || /@googlemail\.com$/i.test(calendar.accountName || '') || /@gmail\.com$/i.test(calendar.ownerAccount || '') || /@googlemail\.com$/i.test(calendar.ownerAccount || ''));
  if (googleCalendar) return googleCalendar.id;
  return defaultCalendar?.id ?? writable[0]?.id ?? calendars[0]?.id;
}

export async function addSessionToNativeCalendar(session: Session, preferredAccountEmail?: string): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;
  if (!await requestNativeCalendarAccess()) throw new Error('Calendar access was not granted.');
  const calendarId = await getCalendarId(preferredAccountEmail);
  const startDate = new Date(session.scheduled_at).getTime();
  const endDate = startDate + Math.max(15, session.duration_minutes || 60) * 60_000;
  const { id } = await CapacitorCalendar.createEvent({ calendarId, title: `VOW · ${session.title}`, description: `${session.duration_minutes} min commitment created from VOW.`, startDate, endDate, alerts: [-15, 0] });
  markSynced(session.id);
  return id;
}

export async function syncSessionsToNativeCalendar(sessions: Session[], preferredAccountEmail?: string): Promise<number> {
  if (!Capacitor.isNativePlatform()) return 0;
  const upcoming = sessions.filter((session) => session.status === 'scheduled' && new Date(session.scheduled_at).getTime() > Date.now() && !isSynced(session.id));
  if (!upcoming.length || !await requestNativeCalendarAccess()) return 0;
  const calendarId = await getCalendarId(preferredAccountEmail);
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
