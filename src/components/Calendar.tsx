import { useCallback, useEffect, useMemo, useState } from 'react';
import { Browser } from '@capacitor/browser';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Session } from '@/types/database';
import { formatTime, toDateString } from '@/lib/dates';
import { PageHeader } from './AppShell';
import { Capacitor } from '@capacitor/core';
import { NATIVE_CALENDAR_REDIRECT } from '@/lib/nativeAuth';

type CalendarEvent = {
  id: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

type CalendarMode = 'month' | 'week';

function getMonthStart(date: Date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
function getMonthEnd(date: Date) { return new Date(date.getFullYear(), date.getMonth() + 1, 0); }
function getWeekStart(date: Date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const result = new Date(date);
  result.setDate(date.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}
function getDaysBetween(start: Date, end: Date) {
  const days: Date[] = [];
  const current = new Date(start);
  while (current <= end) { days.push(new Date(current)); current.setDate(current.getDate() + 1); }
  return days;
}
function eventDate(event: CalendarEvent) { return event.start?.dateTime ? new Date(event.start.dateTime) : event.start?.date ? new Date(`${event.start.date}T00:00:00`) : null; }
function sessionDate(session: Session) { return new Date(session.scheduled_at); }
function sameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function formatMonth(date: Date) { return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }); }
function formatDay(date: Date) { return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }); }
function isToday(date: Date) { return sameDay(date, new Date()); }

export function CalendarPage() {
  const { session: authSession } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [googleEvents, setGoogleEvents] = useState<CalendarEvent[]>([]);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [mode, setMode] = useState<CalendarMode>('month');
  const [loading, setLoading] = useState(true);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    if (!authSession) return;
    const rangeStart = new Date(); rangeStart.setMonth(rangeStart.getMonth() - 2); rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(); rangeEnd.setMonth(rangeEnd.getMonth() + 3); rangeEnd.setHours(23, 59, 59, 999);
    const { data, error: sessionsError } = await supabase.from('sessions').select('*').eq('user_id', authSession.user.id).gte('scheduled_at', rangeStart.toISOString()).lte('scheduled_at', rangeEnd.toISOString()).order('scheduled_at', { ascending: true });
    if (sessionsError) setError(sessionsError.message); else setSessions(data || []);
    setLoading(false);
  }, [authSession]);

  const checkGoogleConnection = useCallback(async () => {
    if (!authSession) return;
    const { data } = await supabase.from('google_calendar_connections').select('id').eq('user_id', authSession.user.id).maybeSingle();
    setGoogleConnected(Boolean(data));
  }, [authSession]);

  const loadGoogleEvents = useCallback(async () => {
    if (!authSession || !googleConnected) return;
    setGoogleLoading(true); setError(null);
    try {
      const start = new Date(); start.setMonth(start.getMonth() - 1); start.setHours(0, 0, 0, 0);
      const end = new Date(); end.setMonth(end.getMonth() + 3); end.setHours(23, 59, 59, 999);
      const { data, error: functionError } = await supabase.functions.invoke('google-calendar-events', { body: { action: 'list', timeMin: start.toISOString(), timeMax: end.toISOString() } });
      if (functionError) throw functionError;
      setGoogleEvents(data?.events || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load Google Calendar.');
    } finally { setGoogleLoading(false); }
  }, [authSession, googleConnected]);

  useEffect(() => { loadSessions(); checkGoogleConnection(); }, [loadSessions, checkGoogleConnection]);
  useEffect(() => { if (googleConnected) loadGoogleEvents(); }, [googleConnected, loadGoogleEvents]);

  useEffect(() => {
    const handleConnected = () => { setConnectingGoogle(false); setGoogleConnected(true); setError(null); };
    const handleError = (event: Event) => {
      setConnectingGoogle(false);
      setError((event as CustomEvent<string>).detail || 'Google Calendar connection failed.');
    };
    window.addEventListener('vow:google-calendar-connected', handleConnected);
    window.addEventListener('vow:google-calendar-error', handleError);
    return () => {
      window.removeEventListener('vow:google-calendar-connected', handleConnected);
      window.removeEventListener('vow:google-calendar-error', handleError);
    };
  }, []);

  async function connectGoogleCalendar() {
    if (!authSession) return;
    setConnectingGoogle(true); setError(null);
    try {
      const redirectUri = Capacitor.isNativePlatform() ? NATIVE_CALENDAR_REDIRECT : `${window.location.origin}/calendar/oauth/callback`;
      const { data, error: functionError } = await supabase.functions.invoke('google-calendar-auth', { body: { action: 'start', redirectUri } });
      if (functionError) throw functionError;
      if (!data?.authorizationUrl) throw new Error('Google Calendar authorization URL was not returned.');

      if (Capacitor.isNativePlatform()) {
        await Browser.open({ url: data.authorizationUrl });
      } else {
        window.location.assign(data.authorizationUrl);
      }
    } catch (err) {
      setConnectingGoogle(false);
      setError(err instanceof Error ? err.message : 'Could not start Google Calendar connection.');
    }
  }

  const calendarDays = useMemo(() => {
    if (mode === 'week') { const start = getWeekStart(currentDate); const end = new Date(start); end.setDate(start.getDate() + 6); return getDaysBetween(start, end); }
    const monthStart = getMonthStart(currentDate); const monthEnd = getMonthEnd(currentDate); const gridStart = getWeekStart(monthStart); const gridEnd = new Date(getWeekStart(monthEnd)); gridEnd.setDate(gridEnd.getDate() + 6); return getDaysBetween(gridStart, gridEnd);
  }, [currentDate, mode]);

  const sessionsForDay = (day: Date) => sessions.filter((item) => sameDay(sessionDate(item), day));
  const eventsForDay = (day: Date) => googleEvents.filter((event) => { const date = eventDate(event); return date ? sameDay(date, day) : false; });
  function movePeriod(direction: number) { const next = new Date(currentDate); if (mode === 'month') next.setMonth(next.getMonth() + direction); else next.setDate(next.getDate() + direction * 7); setCurrentDate(next); }
  function goToday() { setCurrentDate(new Date()); }

  return (
    <div>
      <PageHeader title="Calendar" subtitle="See your commitments alongside the rest of your life." />
      <div className="mb-8 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button onClick={() => movePeriod(-1)} className="w-9 h-9 border border-vow-border text-vow-muted hover:text-vow-ink transition-colors" aria-label="Previous">←</button>
            <button onClick={goToday} className="px-3 h-9 border border-vow-border text-xs text-vow-muted hover:text-vow-ink transition-colors">Today</button>
            <button onClick={() => movePeriod(1)} className="w-9 h-9 border border-vow-border text-vow-muted hover:text-vow-ink transition-colors" aria-label="Next">→</button>
          </div>
          <div className="flex border border-vow-border">
            <button onClick={() => setMode('month')} className={`px-3 py-2 text-xs ${mode === 'month' ? 'bg-vow-ink text-vow-bg' : 'text-vow-muted'}`}>Month</button>
            <button onClick={() => setMode('week')} className={`px-3 py-2 text-xs ${mode === 'week' ? 'bg-vow-ink text-vow-bg' : 'text-vow-muted'}`}>Week</button>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <h2 className="vow-heading text-xl text-vow-ink">{mode === 'month' ? formatMonth(currentDate) : `${formatDay(calendarDays[0])} – ${formatDay(calendarDays[calendarDays.length - 1])}`}</h2>
          <button onClick={loadGoogleEvents} disabled={!googleConnected || googleLoading} className="text-xs text-vow-muted hover:text-vow-ink transition-colors disabled:opacity-40">{googleLoading ? 'Syncing...' : 'Refresh'}</button>
        </div>
      </div>

      {!googleConnected && (
        <div className="border border-vow-border p-5 mb-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-vow-ink font-medium">Connect Google Calendar</p>
              <p className="text-xs text-vow-muted mt-1">Bring your existing commitments into VOW.</p>
            </div>
            <button onClick={connectGoogleCalendar} disabled={connectingGoogle} className="vow-btn-primary disabled:opacity-50">{connectingGoogle ? 'Connecting...' : 'Connect Calendar'}</button>
          </div>
        </div>
      )}

      {error && <div className="border-l-2 border-vow-ink pl-3 mb-6"><p className="text-xs text-vow-muted">{error}</p></div>}

      {loading ? <div className="text-sm text-vow-muted">Loading calendar...</div> : <>
        <div className="grid grid-cols-7 border-t border-l border-vow-border">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <div key={day} className="border-r border-b border-vow-border py-2 text-center text-[10px] uppercase tracking-wider text-vow-muted">{day}</div>)}
          {calendarDays.map((day) => {
            const daySessions = sessionsForDay(day); const dayEvents = eventsForDay(day); const outsideMonth = mode === 'month' && day.getMonth() !== currentDate.getMonth();
            return <div key={toDateString(day)} className={`min-h-[110px] border-r border-b border-vow-border p-2 ${outsideMonth ? 'opacity-35' : ''}`}>
              <div className={`text-xs mb-2 ${isToday(day) ? 'font-semibold text-vow-ink' : 'text-vow-muted'}`}>{day.getDate()}</div>
              <div className="space-y-1.5">
                {daySessions.map((item) => <div key={item.id} className="border-l-2 border-vow-ink pl-2 py-0.5"><p className="text-[11px] text-vow-ink leading-tight truncate">{item.title}</p><p className="text-[9px] text-vow-muted mt-0.5">{formatTime(item.scheduled_at)}</p></div>)}
                {dayEvents.map((event) => { const date = eventDate(event); return <div key={event.id} className="border-l-2 border-vow-border pl-2 py-0.5"><p className="text-[11px] text-vow-ink leading-tight truncate">{event.summary || 'Google event'}</p>{date && <p className="text-[9px] text-vow-muted mt-0.5">{date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>}</div>; })}
              </div>
            </div>;
          })}
        </div>
        <div className="mt-6 flex flex-wrap gap-6 text-xs text-vow-muted"><div className="flex items-center gap-2"><span className="w-3 h-px bg-vow-ink" />VOW session</div><div className="flex items-center gap-2"><span className="w-3 h-px bg-vow-border" />Google Calendar</div></div>
      </>}
    </div>
  );
}
