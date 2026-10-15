import { Capacitor } from '@capacitor/core';
import { CapacitorCalendar } from '@ebarooni/capacitor-calendar';
import type { Session } from '@/types/database';

const SYNCED_PREFIX = 'vow:native-calendar-session:';

function isSynced(sessionId: string): boolean { return Boolean(localStorage.getItem(`${SYNCED_PREFIX}${sessionId}`)); }
function markSynced(sessionId: string, eventId: string): void { localStorage.setItem(`${SYNCED_PREFIX}${sessionId}`, eventId); }
function nativeTitle(session: Session): string {
  if (session.title.startsWith('Practice ·') || session.title.includes(' · W')) return `VOW · ${session.title}`;
  const lines = (session.notes || '').split('\n');
  const task = lines.find((line) => line.startsWith('Task: '))?.slice(6) || session.title;
  const compact = task.trim().replace(/^(practice|practise|work on|complete|perform|train|study|review)\s+/i, '').split(/\s+/).slice(0, 5).join(' ').replace(/[.,:;]+$/, '');
  return `VOW · ${(compact || 'Practice').slice(0, 40)}`;
}
function nativeDescription(session: Session): string {
  const lines = (session.notes || '').split('\n');
  const task = lines.find((line) => line.startsWith('Task: '))?.slice(6) || session.title;
  const steps = lines.filter((line) => /^Step \d+: /.test(line)).map((line) => line.replace(/^Step \d+: /, ''));
  return [task, ...steps.map((step, index) => `${index + 1}. ${step}`), `${session.duration_minutes} min commitment created from VOW.`].join('\n');
}

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
  const { id } = await CapacitorCalendar.createEvent({ calendarId, title: nativeTitle(session), description: nativeDescription(session), startDate, endDate, alerts: [-15, 0] });
  if (id) markSynced(session.id, id);
  return id;
}


export type NativeCalendarEvent = {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
};

export async function listNativeCalendarEvents(from: Date, to: Date): Promise<NativeCalendarEvent[]> {
  if (!Capacitor.isNativePlatform()) return [];
  if (!await requestNativeCalendarAccess()) return [];
  const { result } = await CapacitorCalendar.listEventsInRange({
    from: from.getTime(),
    to: to.getTime(),
  });
  return (result || []).map((event) => {
    const value = event as unknown as Record<string, unknown>;
    const startDate = typeof value.startDate === 'number' ? new Date(value.startDate).toISOString() : undefined;
    const endDate = typeof value.endDate === 'number' ? new Date(value.endDate).toISOString() : undefined;
    return {
      id: String(value.id || crypto.randomUUID()),
      summary: String(value.title || 'Calendar event'),
      description: typeof value.description === 'string' ? value.description : undefined,
      start: { dateTime: startDate },
      end: { dateTime: endDate },
    };
  });
}

export async function syncSessionsToNativeCalendar(sessions: Session[], preferredAccountEmail?: string): Promise<number> {
  if (!Capacitor.isNativePlatform()) return 0;
  const upcoming = sessions.filter((session) => session.status === 'scheduled' && new Date(session.scheduled_at).getTime() > Date.now());
  if (!upcoming.length || !await requestNativeCalendarAccess()) return 0;
  const calendarId = await getCalendarId(preferredAccountEmail);
  let createdOrRefreshed = 0;

  for (const session of upcoming) {
    const desiredTitle = nativeTitle(session);
    const storageKey = `${SYNCED_PREFIX}${session.id}`;
    const storedValue = localStorage.getItem(storageKey);
    const storedEventId = storedValue && storedValue !== 'true' ? storedValue : null;

    if (storedValue === 'true') {
      const startDate = new Date(session.scheduled_at);
      const from = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
      const to = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
      const legacy = (await listNativeCalendarEvents(from, to)).find((event) => {
        const eventStart = event.start.dateTime ? new Date(event.start.dateTime).getTime() : NaN;
        return (event.summary === `VOW · ${session.title}` || event.summary === desiredTitle)
          && Number.isFinite(eventStart) && Math.abs(eventStart - startDate.getTime()) < 60_000;
      });
      if (legacy?.summary === desiredTitle) {
        markSynced(session.id, legacy.id);
        continue;
      }
      if (legacy) await CapacitorCalendar.deleteEvent({ id: legacy.id });
      localStorage.removeItem(storageKey);
    }

    if (storedEventId) {
      const startDate = new Date(session.scheduled_at);
      const from = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
      const to = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
      const existing = (await listNativeCalendarEvents(from, to)).find((event) => event.id === storedEventId);
      if (existing?.summary === desiredTitle) continue;
      if (existing) await CapacitorCalendar.deleteEvent({ id: storedEventId });
      localStorage.removeItem(storageKey);
    }

    const startDate = new Date(session.scheduled_at).getTime();
    const endDate = startDate + Math.max(15, session.duration_minutes || 60) * 60_000;
    const { id } = await CapacitorCalendar.createEvent({ calendarId, title: desiredTitle, description: nativeDescription(session), startDate, endDate, alerts: [-15, 0] });
    if (id) markSynced(session.id, id);
    createdOrRefreshed += 1;
  }
  return createdOrRefreshed;
}


/** Replace a session event without deleting the existing event until its replacement exists. */
export async function replaceSessionInNativeCalendar(previous: Session, updated: Session): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;
  if (!await requestNativeCalendarAccess()) throw new Error('Calendar access was not granted.');

  const calendarId = await getCalendarId();
  const startDate = new Date(updated.scheduled_at).getTime();
  const endDate = startDate + Math.max(15, updated.duration_minutes || 60) * 60_000;
  const created = await CapacitorCalendar.createEvent({
    calendarId,
    title: nativeTitle(updated),
    description: nativeDescription(updated),
    startDate,
    endDate,
    alerts: [-15, 0],
  });
  if (!created.id) throw new Error('The replacement calendar event was not created.');

  try {
    const storageKey = `${SYNCED_PREFIX}${previous.id}`;
    const storedValue = localStorage.getItem(storageKey);
    let oldEventId = storedValue && storedValue !== 'true' ? storedValue : null;

    if (!oldEventId) {
      const oldStart = new Date(previous.scheduled_at);
      const events = await listNativeCalendarEvents(
        new Date(oldStart.getTime() - 24 * 60 * 60 * 1000),
        new Date(oldStart.getTime() + 24 * 60 * 60 * 1000),
      );
      const match = events.find((event) => {
        if (event.summary !== nativeTitle(previous) && event.summary !== `VOW · ${previous.title}`) return false;
        const eventStart = event.start.dateTime ? new Date(event.start.dateTime).getTime() : NaN;
        return Number.isFinite(eventStart) && Math.abs(eventStart - oldStart.getTime()) < 60_000;
      });
      oldEventId = match?.id || null;
    }

    if (oldEventId && oldEventId !== created.id) {
      await CapacitorCalendar.deleteEvent({ id: oldEventId });
    }
  } catch (error) {
    await CapacitorCalendar.deleteEvent({ id: created.id }).catch(() => undefined);
    throw error;
  }

  markSynced(updated.id, created.id);
  return created.id;
}

/** Remove the native event that belongs to a VOW session, including legacy synced events. */
export async function deleteSessionFromNativeCalendar(session: Session): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (!await requestNativeCalendarAccess()) throw new Error('Calendar access was not granted.');
  const storageKey = `${SYNCED_PREFIX}${session.id}`;
  const storedValue = localStorage.getItem(storageKey);
  let eventId = storedValue && storedValue !== 'true' ? storedValue : null;

  // Older app versions stored only a boolean. Recover their event by matching
  // the VOW-prefixed title and scheduled start time before deleting anything.
  if (!eventId) {
    const start = new Date(session.scheduled_at);
    const from = new Date(start.getTime() - 24 * 60 * 60 * 1000);
    const to = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const events = await listNativeCalendarEvents(from, to);
    const match = events.find((event) => {
      if (event.summary !== nativeTitle(session) && event.summary !== `VOW · ${session.title}`) return false;
      const eventStart = event.start.dateTime ? new Date(event.start.dateTime).getTime() : NaN;
      return Number.isFinite(eventStart) && Math.abs(eventStart - start.getTime()) < 60_000;
    });
    eventId = match?.id || null;
  }

  if (eventId) await CapacitorCalendar.deleteEvent({ id: eventId });
  localStorage.removeItem(storageKey);
}
