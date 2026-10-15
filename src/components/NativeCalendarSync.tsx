import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [dismissed, setDismissed] = useState(false);
  const [dismissedUserId, setDismissedUserId] = useState<string | null>(null);
  const [hiding, setHiding] = useState(false);
  const dismissTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (dismissTimer.current !== null) window.clearTimeout(dismissTimer.current);
  }, []);

  // Auth can resolve after the component mounts. Rehydrate dismissal only
  // once the current user's ID is known, and re-check if the account changes.
  useEffect(() => {
    if (!userId) {
      setDismissed(false);
      setDismissedUserId(null);
      return;
    }
    setDismissed(localStorage.getItem(DISMISSED_KEY_PREFIX + userId) === 'true');
    setDismissedUserId(userId);
  }, [userId]);
  const skipNextEffectSync = useRef(false);

  const dismissAfterSuccess = useCallback((text: string) => {
    setMessage(text);
    setHiding(true);
    if (userId) localStorage.setItem(DISMISSED_KEY_PREFIX + userId, 'true');
    if (dismissTimer.current !== null) window.clearTimeout(dismissTimer.current);
    // Let the CSS transition finish before unmounting the panel.
    dismissTimer.current = window.setTimeout(() => {
      setDismissed(true);
      dismissTimer.current = null;
    }, 480);
  }, [userId]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !userId || !enabled) return;
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
        if (!cancelled) dismissAfterSuccess(created ? created + ' upcoming VOW sessions are synced to your phone calendar.' : 'Phone calendar sync is up to date.');
      } catch (error) {
        console.error('[VOW] Native calendar sync failed:', error);
      }
    }
    void sync();
    return () => { cancelled = true; };
  }, [enabled, userId, accountEmail, dismissAfterSuccess]);

  if (!Capacitor.isNativePlatform() || !session || !userId || dismissedUserId !== userId || dismissed) return null;

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
        dismissAfterSuccess(created ? created + ' upcoming VOW sessions are synced to your phone calendar.' : 'Phone calendar sync is up to date.');
      } else {
        localStorage.setItem(ENABLE_KEY, 'false');
        setEnabled(false);
        dismissAfterSuccess('Phone calendar sync is off. Existing calendar events are unchanged.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update calendar sync.');
    } finally {
      setBusy(false);
    }
  }

  return <div aria-hidden={hiding} className={`border border-vow-border p-5 mb-8 vow-calendar-sync-panel${hiding ? ' vow-calendar-sync-panel-hiding pointer-events-none' : ''}`}><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><p className="text-sm font-medium text-vow-ink">Phone calendar sync</p><p className="text-xs text-vow-muted mt-1 leading-relaxed">Adds VOW sessions to a writable calendar on your phone.</p>{message && <p className="text-xs text-vow-ink mt-2">{message}</p>}</div><div className="flex items-center gap-3"><button onClick={toggle} disabled={busy || hiding} className="vow-btn-primary disabled:opacity-50">{busy ? 'Updating…' : enabled ? 'Phone calendar sync on' : 'Sync with phone calendar'}</button><button type="button" aria-label="Dismiss phone calendar sync panel" title="Dismiss" disabled={hiding} onClick={() => dismissAfterSuccess('Phone calendar sync settings dismissed.')} className="w-10 h-10 border border-vow-border text-vow-muted disabled:opacity-50">×</button></div></div></div>;
}
