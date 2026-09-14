import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { NATIVE_CALENDAR_REDIRECT } from '@/lib/nativeAuth';
import { requestNativeCalendarAccess, syncSessionsToNativeCalendar } from '@/lib/nativeCalendar';
import type { Session } from '@/types/database';

function fadeAway(setHiding: (value: boolean) => void, setDismissed: (value: boolean) => void) {
  setHiding(true);
  window.setTimeout(() => setDismissed(true), 360);
}

export function NativeCalendarSync() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleAvailable, setGoogleAvailable] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneDismissed, setPhoneDismissed] = useState(false);
  const [googleDismissed, setGoogleDismissed] = useState(false);
  const [hidingPhone, setHidingPhone] = useState(false);
  const [hidingGoogle, setHidingGoogle] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    supabase.functions.invoke('google-calendar-auth', { body: { action: 'status' } }).then(({ data, error }) => {
      if (cancelled) return;
      const available = !error && data?.available === true && data?.configured === true;
      const connected = available && Boolean(data?.connected);
      setGoogleAvailable(available);
      setGoogleConnected(connected);
      if (connected) setGoogleDismissed(true);
    }).catch(() => {
      if (!cancelled) {
        setGoogleAvailable(false);
        setGoogleConnected(false);
      }
    });
    return () => { cancelled = true; };
  }, [session]);

  useEffect(() => {
    const handleSuccess = () => {
      setGoogleConnected(true);
      setMessage('Google Calendar connected.');
      fadeAway(setHidingGoogle, setGoogleDismissed);
    };
    const handleError = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      setMessage(detail || 'Google Calendar connection failed.');
    };
    window.addEventListener('vow:google-calendar-connected', handleSuccess);
    window.addEventListener('vow:google-calendar-error', handleError);
    return () => {
      window.removeEventListener('vow:google-calendar-connected', handleSuccess);
      window.removeEventListener('vow:google-calendar-error', handleError);
    };
  }, []);

  async function connectGoogleCalendar() {
    if (!session || googleBusy || !googleAvailable) return;
    setGoogleBusy(true);
    setMessage('');
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: { action: 'start', redirectUri: NATIVE_CALENDAR_REDIRECT },
      });
      if (error || !data?.authorizationUrl) throw error || new Error('Google Calendar is not configured yet.');
      await Browser.open({ url: data.authorizationUrl });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not start Google Calendar connection.');
    } finally {
      setGoogleBusy(false);
    }
  }

  async function syncPhoneCalendar() {
    if (!userId || phoneBusy) return;
    setPhoneBusy(true);
    setMessage('');
    try {
      const granted = await requestNativeCalendarAccess();
      if (!granted) throw new Error('Calendar access was not granted.');
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'scheduled')
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true });
      if (error) throw error;
      const created = data?.length ? await syncSessionsToNativeCalendar(data as Session[]) : 0;
      setMessage(created ? `${created} upcoming VOW session${created === 1 ? '' : 's'} added to your phone calendar.` : 'Your phone calendar is already up to date.');
      fadeAway(setHidingPhone, setPhoneDismissed);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not sync your phone calendar.');
    } finally {
      setPhoneBusy(false);
    }
  }

  if (!Capacitor.isNativePlatform() || !session || (googleDismissed && phoneDismissed)) return null;

  return (
    <div className="mb-8 space-y-3">
      {!googleDismissed && googleAvailable && (
        <div className={`border border-vow-border p-5 transition-all duration-300 ${hidingGoogle ? 'opacity-0 -translate-y-1' : 'opacity-100'}`}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-vow-ink">Connect Google Calendar</p>
              <p className="text-xs text-vow-muted mt-1 leading-relaxed">Connect it only when you choose. VOW will not sync anything until you explicitly choose a calendar sync action.</p>
            </div>
            <button onClick={connectGoogleCalendar} disabled={googleBusy} className="vow-btn-primary disabled:opacity-50">
              {googleBusy ? 'Connecting…' : 'Connect Google Calendar'}
            </button>
          </div>
        </div>
      )}

      {!phoneDismissed && (
        <div className={`border border-vow-border p-5 transition-all duration-300 ${hidingPhone ? 'opacity-0 -translate-y-1' : 'opacity-100'}`}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-vow-ink">Sync phone calendar</p>
              <p className="text-xs text-vow-muted mt-1 leading-relaxed">Give VOW permission to add your upcoming sessions to a writable calendar on this phone. This is independent of Google Calendar.</p>
            </div>
            <button onClick={syncPhoneCalendar} disabled={phoneBusy} className="vow-btn-primary disabled:opacity-50">
              {phoneBusy ? 'Syncing…' : 'Sync phone calendar'}
            </button>
          </div>
        </div>
      )}

      {message && <p className="text-xs text-vow-ink px-1">{message}</p>}
      {googleConnected && !googleDismissed && <span className="sr-only">Google Calendar connected</span>}
    </div>
  );
}
