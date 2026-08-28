import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { requestNativeCalendarAccess, syncSessionsToNativeCalendar } from '@/lib/nativeCalendar';
import type { Session } from '@/types/database';

const ENABLE_KEY = 'vow:native-calendar-sync';
const DISMISSED_KEY = 'vow:native-calendar-sync-ui-dismissed';

export function NativeCalendarSync() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [enabled, setEnabled] = useState(() => localStorage.getItem(ENABLE_KEY) === 'true');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === 'true');

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !userId || !enabled) return;
    let cancelled = false;
    async function sync() {
      const { data } = await supabase.from('sessions').select('*').eq('user_id', userId).eq('status', 'scheduled').gte('scheduled_at', new Date().toISOString()).order('scheduled_at', { ascending: true });
      if (cancelled || !data?.length) return;
      try { await syncSessionsToNativeCalendar(data as Session[]); } catch (error) { console.error('[VOW] Native calendar sync failed:', error); }
    }
    sync();
    return () => { cancelled = true; };
  }, [enabled, userId]);

  if (!Capacitor.isNativePlatform() || !session || dismissed) return null;

  function dismissAfterSuccess(text: string) {
    setMessage(text);
    window.setTimeout(() => {
      setDismissed(true);
      localStorage.setItem(DISMISSED_KEY, 'true');
    }, 850);
  }

  async function toggle() {
    if (busy || !userId) return;
    setBusy(true); setMessage('');
    try {
      if (!enabled) {
        const granted = await requestNativeCalendarAccess();
        if (!granted) throw new Error('Calendar access was not granted.');
        localStorage.setItem(ENABLE_KEY, 'true');
        setEnabled(true);
        const { data } = await supabase.from('sessions').select('*').eq('user_id', userId).eq('status', 'scheduled').gte('scheduled_at', new Date().toISOString()).order('scheduled_at', { ascending: true });
        const created = data?.length ? await syncSessionsToNativeCalendar(data as Session[]) : 0;
        dismissAfterSuccess(created ? `${created} upcoming VOW sessions added to your phone calendar.` : 'Phone calendar sync is on.');
      } else {
        localStorage.setItem(ENABLE_KEY, 'false');
        setEnabled(false);
        dismissAfterSuccess('Automatic phone calendar sync is off. Existing calendar events are unchanged.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update phone calendar sync.');
    } finally { setBusy(false); }
  }

  return <div className="border border-vow-border p-5 mb-8 transition-all duration-500 ease-out animate-[fadeIn_220ms_ease-out]"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><p className="text-sm font-medium text-vow-ink">Phone calendar</p><p className="text-xs text-vow-muted mt-1 leading-relaxed">Put VOW sessions into your device calendar so your normal calendar reminders can alert you.</p>{message && <p className="text-xs text-vow-ink mt-2">{message}</p>}</div><button onClick={toggle} disabled={busy} className="vow-btn-primary disabled:opacity-50">{busy ? 'Updating…' : enabled ? 'Calendar sync on' : 'Add VOW to phone calendar'}</button></div></div>;
}
