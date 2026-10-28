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
  const [enabled, setEnabled] = useState(() => localStorage.getItem(ENABLE_KEY) === 'true');
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [syncFailed, setSyncFailed] = useState(false);
  const [message, setMessage] = useState('');
  const [dismissed, setDismissed] = useState<boolean | null>(null);
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

  const dismissAfterSuccess = useCallback((text: string, waitBeforeHide = 0) => {
    setMessage(text);
    if (userId) localStorage.setItem(DISMISSED_KEY_PREFIX + userId, 'true');
    if (dismissTimer.current !== null) window.clearTimeout(dismissTimer.current);
    const hidePanel = () => {
      setHiding(true);
      // Let the CSS transition finish before unmounting the panel.
      dismissTimer.current = window.setTimeout(() => {
        setDismissed(true);
        dismissTimer.current = null;
      }, 480);
    };
    if (waitBeforeHide > 0) {
      setHiding(false);
      dismissTimer.current = window.setTimeout(hidePanel, waitBeforeHide);
    } else {
      hidePanel();
    }
  }, [userId]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !userId || !enabled) return;
    let cancelled = false;
    async function sync() {
      setSyncing(true);
      setSyncFailed(false);
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
        if (!cancelled) { setMessage('VOW could not refresh your phone calendar. Please try again.'); setSyncFailed(true); setSyncing(false); }
        return;
      }
      if (!data?.length) {
        if (!cancelled) { setSyncing(false); dismissAfterSuccess('Phone calendar sync is enabled. Add a session time in Goals to sync it.', 2500); }
        return;
      }
      try {
        const created = await syncSessionsToNativeCalendar(data as Session[]);
        if (!cancelled) { setSyncing(false); dismissAfterSuccess(created ? created + ' upcoming VOW sessions are synced to your phone calendar.' : 'Phone calendar sync is up to date.', 2500); }
      } catch (error) {
        console.error('[VOW] Native calendar sync failed:', error);
        if (!cancelled) { setMessage(error instanceof Error ? error.message : 'VOW could not refresh your phone calendar.'); setSyncFailed(true); setSyncing(false); }
      }
    }
    const refresh = () => { if (document.visibilityState === 'visible') void sync(); };
    window.addEventListener('focus', refresh);
    window.addEventListener('vow:refresh', refresh);
    void sync();
    return () => { cancelled = true; window.removeEventListener('focus', refresh); window.removeEventListener('vow:refresh', refresh); };
  }, [enabled, userId, dismissAfterSuccess, retryKey]);

  if (!Capacitor.isNativePlatform() || !session || !userId || dismissedUserId !== userId || dismissed !== false) return null;

  async function toggle() {
    if (busy || !userId) return;
    setBusy(true);
    setMessage('');
    try {
      if (!enabled) {
        const granted = await requestNativeCalendarAccess();
        if (!granted) throw new Error('Calendar access was not granted.');
        localStorage.setItem(ENABLE_KEY, 'true');
        localStorage.removeItem(DISMISSED_KEY_PREFIX + userId);
        setHiding(false);
        setEnabled(true);
        setMessage('Refreshing your phone calendar…');
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

  return <div aria-hidden={hiding} className={`border border-vow-border p-5 mb-8 vow-calendar-sync-panel${hiding ? ' vow-calendar-sync-panel-hiding pointer-events-none' : ''}`}><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><p className="text-sm font-medium text-vow-ink">Phone calendar sync</p><p className="text-xs text-vow-muted mt-1 leading-relaxed">Adds VOW sessions to a writable calendar on your phone.</p>{message && <p className="text-xs text-vow-ink mt-2">{message}</p>}</div><div className="flex items-center gap-3">{syncFailed && enabled && <button type="button" onClick={() => setRetryKey((value) => value + 1)} disabled={syncing || busy || hiding} className="text-xs text-vow-ink underline underline-offset-4 disabled:opacity-50">{syncing ? 'Refreshing…' : 'Retry sync'}</button>}<button onClick={toggle} disabled={busy || syncing || hiding} className="vow-btn-primary disabled:opacity-50">{busy ? 'Updating…' : syncing ? 'Syncing…' : enabled ? 'Phone calendar sync on' : 'Sync with phone calendar'}</button><button type="button" aria-label="Dismiss phone calendar sync panel" title="Dismiss" disabled={hiding} onClick={() => dismissAfterSuccess('Phone calendar sync settings dismissed.')} className="w-10 h-10 border border-vow-border text-vow-muted disabled:opacity-50">×</button></div></div></div>;
}
