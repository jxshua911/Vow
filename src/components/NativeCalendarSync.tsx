import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { requestNativeCalendarAccess, syncSessionsToNativeCalendar } from '@/lib/nativeCalendar';
import type { Session } from '@/types/database';

const ENABLE_KEY = 'vow:native-calendar-sync';
const DISMISSED_KEY_PREFIX = 'vow:native-calendar-sync-ui-dismissed:';

export function NativeCalendarSync() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const accountEmail = session?.user.email;
  const [enabled, setEnabled] = useState(() => localStorage.getItem(ENABLE_KEY) === 'true');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [dismissed, setDismissed] = useState(() => Boolean(userId && localStorage.getItem(DISMISSED_KEY_PREFIX + userId) === 'true'));
  const [hiding, setHiding] = useState(false);
  const skipNextEffectSync = useRef(false);

  function dismissAfterSuccess(text: string) {
    setMessage(text);
    setHiding(true);
    window.setTimeout(() => {
      setDismissed(true);
      if (userId) localStorage.setItem(DISMISSED_KEY_PREFIX + userId, 'true');
    }, 520);
  }

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !userId || !enabled || dismissed) return;
    if (skipNextEffectSync.current) {
      skipNextEffectSync.current = false;
      return;
    }
    let cancelled = false;
    async function sync() {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'scheduled')
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error('[VOW] Native calendar sync session lookup failed:', error);
        return;
      }
      try {
        const created = data?.length ? await syncSessionsToNativeCalendar(data as Session[], accountEmail) : 0;
        if (!cancelled) dismissAfterSuccess(created ? created + ' upcoming VOW sessions are synced to your Google/device calendar.' : 'Calendar sync is up to date.');
      } catch (error) {
        console.error('[VOW] Native calendar sync failed:', error);
      }
    }
    void sync();
    return () => { cancelled = true; };
  }, [enabled, userId, accountEmail, dismissed]);

  if (!Capacitor.isNativePlatform() || !session || dismissed) return null;

  async function toggle() {
    if (busy || !userId) return;
    setBusy(true);
    setMessage('');
    try {
      if (!enabled) {
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
        const created = data?.length ? await syncSessionsToNativeCalendar(data as Session[], accountEmail) : 0;
        localStorage.setItem(ENABLE_KEY, 'true');
        localStorage.removeItem(DISMISSED_KEY_PREFIX + userId);
        skipNextEffectSync.current = true;
        setHiding(false);
        setEnabled(true);
        dismissAfterSuccess(created ? created + ' upcoming VOW sessions are synced to your Google/device calendar.' : 'Calendar sync is up to date.');
      } else {
        localStorage.setItem(ENABLE_KEY, 'false');
        setEnabled(false);
        dismissAfterSuccess('Automatic calendar sync is off. Existing calendar events are unchanged.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update calendar sync.');
    } finally {
      setBusy(false);
    }
  }

  return <div className={`border border-vow-border p-5 mb-8 vow-calendar-sync-panel${hiding ? ' vow-calendar-sync-panel-hiding' : ''}`}><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><p className="text-sm font-medium text-vow-ink">Calendar sync</p><p className="text-xs text-vow-muted mt-1 leading-relaxed">VOW adds your sessions to the Google calendar account available on this device, preferring the account matching your VOW email.</p>{message && <p className="text-xs text-vow-ink mt-2">{message}</p>}</div><button onClick={toggle} disabled={busy} className="vow-btn-primary disabled:opacity-50">{busy ? 'Updating…' : enabled ? 'Calendar sync on' : 'Sync VOW with calendar'}</button></div></div>;
}
