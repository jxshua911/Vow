import { Capacitor } from '@capacitor/core';
import { CapacitorCalendar } from '@ebarooni/capacitor-calendar';
import type { Session } from '@/types/database';

const SYNCED_PREFIX = 'vow:native-calendar-session:';
const CALENDAR_PREFIX = 'VOW · ';

function accountKey(preferredAccountEmail?: string) {
  return (preferredAccountEmail || 'unknown').trim().toLowerCase().replace(/[^a-z0-9@._+-]/g, '_');
}
function isSynced(sessionId: string, preferredAccountEmail?: string): boolean { return localStorage.getItem(`${SYNCED_PREFIX}${accountKey(preferredAccountEmail)}:${sessionId}`) === 'true'; }
function markSynced(sessionId: string, preferredAccountEmail?: string): void { localStorage.setItem(`${SYNCED_PREFIX}${accountKey(preferredAccountEmail)}:${sessionId}`, 'true'); }

export async function requestNativeCalendarAccess(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  const { result } = await CapacitorCalendar.requestFullCalendarAccess();
  return result === 'granted';
}

async function getCalendarId(preferredAccountEmail?: string): Promise<string | undefined> {
  const { result: calendars } = await CapacitorCalendar.listCalendars();
  if (!preferredAccountEmail) return undefined;
  const email = preferredAccountEmail.trim().toLowerCase();
  const title = `${CALENDAR_PREFIX}${preferredAccountEmail.trim()}`;
  const existing = calendars.find((calendar) => {
    if (calendar.visible === false || calendar.allowsContentModifications === false) return false;
    const sameAccount = calendar.accountName?.toLowerCase() === email || calendar.ownerAccount?.toLowerCase() === email;
    return sameAccount && calendar.title === title;
  });
  if (existing?.id) return existing.id;

  const created = await CapacitorCalendar.createCalendar({
    title,
    color: '#D4AF37',
    accountName: preferredAccountEmail.trim(),
    ownerAccount: preferredAccountEmail.trim(),
  });
  return created.id;
}

export async function addSessionToNativeCalendar(session: Session, preferredAccountEmail?: string): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;
  if (!await requestNativeCalendarAccess()) throw new Error('Calendar access was not granted.');
  const calendarId = await getCalendarId(preferredAccountEmail);
  if (!calendarId) throw new Error('No writable calendar was found for the connected Google account.');
  const startDate = new Date(session.scheduled_at).getTime();
  const endDate = startDate + Math.max(15, session.duration_minutes || 60) * 60_000;
  const { id } = await CapacitorCalendar.createEvent({ calendarId, title: `VOW · ${session.title}`, description: `${session.duration_minutes} min commitment created from VOW.`, startDate, endDate, alerts: [-15, 0] });
  markSynced(session.id, preferredAccountEmail);
  return id;
}

export async function syncSessionsToNativeCalendar(sessions: Session[], preferredAccountEmail?: string): Promise<number> {
  if (!Capacitor.isNativePlatform()) return 0;
  const upcoming = sessions.filter((session) => session.status === 'scheduled' && new Date(session.scheduled_at).getTime() > Date.now() && !isSynced(session.id, preferredAccountEmail));
  if (!upcoming.length || !await requestNativeCalendarAccess()) return 0;
  const calendarId = await getCalendarId(preferredAccountEmail);
  if (!calendarId) throw new Error('No writable calendar was found for the connected Google account.');
  let created = 0;
  for (const session of upcoming) {
    const startDate = new Date(session.scheduled_at).getTime();
    const endDate = startDate + Math.max(15, session.duration_minutes || 60) * 60_000;
    await CapacitorCalendar.createEvent({ calendarId, title: `VOW · ${session.title}`, description: `${session.duration_minutes} min commitment created from VOW.`, startDate, endDate, alerts: [-15, 0] });
    markSynced(session.id, preferredAccountEmail);
    created += 1;
  }
  return created;
}
