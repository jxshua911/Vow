import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { requestNativeCalendarAccess, syncSessionsToNativeCalendar } from '@/lib/nativeCalendar';
import type { Session } from '@/types/database';

function storageKey(prefix: string, userId: string) { return `${prefix}:${userId}`; }

export function NativeCalendarSync() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const accountEmail = session?.user.email;
  const enableKey = userId ? storageKey('vow:native-calendar-sync', userId) : '';
  const dismissedKey = userId ? storageKey('vow:native-calendar-sync-ui-dismissed', userId) : '';
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [dismissed, setDismissed] = useState(false);
  const [hiding, setHiding] = useState(false);

  useEffect(() => {
    if (!userId) { setEnabled(false); setDismissed(false); return; }
    setEnabled(localStorage.getItem(enableKey) === 'true');
    setDismissed(localStorage.getItem(dismissedKey) === 'true');
    setHiding(false);
  }, [userId, enableKey, dismissedKey]);

  function dismissAfterSuccess(text: string) {
    setMessage(text);
    window.setTimeout(() => setHiding(true), 850);
    window.setTimeout(() => {
      setDismissed(true);
      if (dismissedKey) localStorage.setItem(dismissedKey, 'true');
    }, 1320);
  }

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !userId || !enabled || dismissed) return;
    let cancelled = false;
    async function sync() {
      const { data } = await supabase.from('sessions').select('*').eq('user_id', userId).eq('status', 'scheduled').gte('scheduled_at', new Date().toISOString()).order('scheduled_at', { ascending: true });
      if (cancelled) return;
      try {
        const created = data?.length ? await syncSessionsToNativeCalendar(data as Session[], accountEmail) : 0;
        if (!cancelled) dismissAfterSuccess(created ? `${created} upcoming VOW sessions are synced to your Google/device calendar.` : 'Calendar sync is up to date.');
      } catch (error) { console.error('[VOW] Native calendar sync failed:', error); }
    }
    sync();
    return () => { cancelled = true; };
  }, [enabled, userId, accountEmail, dismissed]);

  if (!Capacitor.isNativePlatform() || !session || dismissed) return null;

  async function toggle() {
    if (busy || !userId) return;
    setBusy(true); setMessage('');
    try {
      if (!enabled) {
        const granted = await requestNativeCalendarAccess();
        if (!granted) throw new Error('Calendar access was not granted.');
        localStorage.setItem(enableKey, 'true');
        localStorage.removeItem(dismissedKey);
        setEnabled(true);
        const { data } = await supabase.from('sessions').select('*').eq('user_id', userId).eq('status', 'scheduled').gte('scheduled_at', new Date().toISOString()).order('scheduled_at', { ascending: true });
        const created = data?.length ? await syncSessionsToNativeCalendar(data as Session[], accountEmail) : 0;
        dismissAfterSuccess(created ? `${created} upcoming VOW sessions added to your Google/device calendar.` : 'Calendar sync is on.');
      } else {
        localStorage.setItem(enableKey, 'false');
        setEnabled(false);
        dismissAfterSuccess('Automatic calendar sync is off. Existing calendar events are unchanged.');
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not update calendar sync.'); }
    finally { setBusy(false); }
  }

  return <div className={`border border-vow-border p-5 mb-8 vow-calendar-sync-panel${hiding ? ' vow-calendar-sync-panel-hiding' : ''}`}><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><p className="text-sm font-medium text-vow-ink">Calendar sync</p><p className="text-xs text-vow-muted mt-1 leading-relaxed">VOW only syncs sessions into the calendar account that matches the signed-in VOW account.</p>{message && <p className="text-xs text-vow-ink mt-2">{message}</p>}</div><button onClick={toggle} disabled={busy} className="vow-btn-primary disabled:opacity-50">{busy ? 'Updating…' : enabled ? 'Calendar sync on' : 'Sync VOW with calendar'}</button></div></div>;
}
