import { Capacitor } from '@capacitor/core';
import { CapacitorCalendar } from '@ebarooni/capacitor-calendar';
import type { Session } from '@/types/database';

const SYNCED_PREFIX = 'vow:native-calendar-session:';

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

async function getCalendarId(_preferredAccountEmail?: string): Promise<string | undefined> {
  const { result: calendars } = await CapacitorCalendar.listCalendars();
  const { result: defaultCalendar } = await CapacitorCalendar.getDefaultCalendar();
  const writable = calendars.filter((calendar) => calendar.visible !== false && calendar.allowsContentModifications !== false);

  // Phone-calendar sync follows Android's configured default calendar instead
  // of choosing a Google calendar based on the VOW account's email address.
  // Google account authorization remains a separate, optional integration.
  const writableDefault = defaultCalendar
    ? writable.find((calendar) => calendar.id === defaultCalendar.id)
    : undefined;
  return writableDefault?.id ?? writable[0]?.id ?? defaultCalendar?.id ?? calendars[0]?.id;
}

export async function addSessionToNativeCalendar(session: Session, preferredAccountEmail?: string): Promise<string | null> {
  if (!Capacitor.isNativePlatform() || !session.scheduled_at) return null;
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
  const upcoming = sessions.filter((session) => session.status === 'scheduled' && Boolean(session.scheduled_at) && new Date(session.scheduled_at as string).getTime() > Date.now());
  if (!upcoming.length || !await requestNativeCalendarAccess()) return 0;
  const calendarId = await getCalendarId(preferredAccountEmail);
  let createdOrRefreshed = 0;

  for (const session of upcoming) {
    const desiredTitle = nativeTitle(session);
    const storageKey = `${SYNCED_PREFIX}${session.id}`;
    const storedValue = localStorage.getItem(storageKey);
    const storedEventId = storedValue && storedValue !== 'true' ? storedValue : null;

    if (storedValue === 'true') {
      const startDate = new Date(session.scheduled_at || '');
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

    let staleEventId: string | null = null;
    if (storedEventId) {
      const startDate = new Date(session.scheduled_at || '');
      const from = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
      const to = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
      const existing = (await listNativeCalendarEvents(from, to)).find((event) => event.id === storedEventId);
      const desiredStart = startDate.getTime();
      const desiredEnd = desiredStart + Math.max(15, session.duration_minutes || 60) * 60_000;
      const existingStart = existing?.start.dateTime ? new Date(existing.start.dateTime).getTime() : NaN;
      const existingEnd = existing?.end.dateTime ? new Date(existing.end.dateTime).getTime() : NaN;
      const timeMatches = Number.isFinite(existingStart)
        && Math.abs(existingStart - desiredStart) < 60_000
        && (!Number.isFinite(existingEnd) || Math.abs(existingEnd - desiredEnd) < 60_000);
      if (existing?.summary === desiredTitle && timeMatches) continue;

      // Create the replacement first; deleting the old event before a successful
      // create could leave the user's calendar empty if the plugin fails.
      staleEventId = storedEventId;
      localStorage.removeItem(storageKey);
    }

    if (!session.scheduled_at) continue;
    const startDate = new Date(session.scheduled_at).getTime();
    const endDate = startDate + Math.max(15, session.duration_minutes || 60) * 60_000;

    // The device calendar may already contain the same event through Google
    // Calendar sync. Reuse a matching event rather than creating a duplicate.
    const duplicateWindowStart = new Date(startDate - 60_000);
    const duplicateWindowEnd = new Date(startDate + 60_000);
    const taskTitle = (session.notes || '').split('\n')
      .find((line) => line.startsWith('Task: '))?.slice(6)?.trim();
    const normalizeTitle = (value: string) => value
      .replace(/^VOW\s*·\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLocaleLowerCase();
    const expectedTitles = new Set(
      [session.title, taskTitle, nativeTitle(session)]
        .filter((value): value is string => Boolean(value))
        .map(normalizeTitle),
    );
    const matchingEvent = (await listNativeCalendarEvents(duplicateWindowStart, duplicateWindowEnd)).find((event) => {
      const eventStart = event.start.dateTime ? new Date(event.start.dateTime).getTime() : NaN;
      return expectedTitles.has(normalizeTitle(event.summary))
        && Number.isFinite(eventStart)
        && Math.abs(eventStart - startDate) < 60_000;
    });
    if (matchingEvent) {
      markSynced(session.id, matchingEvent.id);
      continue;
    }

    const { id } = await CapacitorCalendar.createEvent({ calendarId, title: desiredTitle, description: nativeDescription(session), startDate, endDate, alerts: [-15, 0] });
    if (id) {
      markSynced(session.id, id);
      createdOrRefreshed += 1;
      if (staleEventId && staleEventId !== id) {
        try { await CapacitorCalendar.deleteEvent({ id: staleEventId }); }
        catch (error) { console.warn('[VOW] Could not remove the superseded phone calendar event:', error); }
      }
    }
  }
  return createdOrRefreshed;
}


/** Replace a session event without deleting the existing event until its replacement exists. */
export async function replaceSessionInNativeCalendar(previous: Session, updated: Session): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;
  if (!await requestNativeCalendarAccess()) throw new Error('Calendar access was not granted.');

  if (!updated.scheduled_at) {
    await deleteSessionFromNativeCalendar(previous);
    localStorage.removeItem(`${SYNCED_PREFIX}${updated.id}`);
    return null;
  }
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

    if (!oldEventId && previous.scheduled_at) {
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
    if (!session.scheduled_at) { localStorage.removeItem(storageKey); return; }
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
