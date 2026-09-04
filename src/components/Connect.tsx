import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from './AppShell';
import { INTEGRATIONS, type IntegrationCategory } from '@/lib/integrations/catalog';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { NATIVE_CALENDAR_REDIRECT } from '@/lib/nativeAuth';

function Glyph({ children, className = '' }: { children: string; className?: string }) { return <span aria-hidden="true" className={`inline-flex items-center justify-center font-medium leading-none ${className}`}>{children}</span>; }

type ConnectState = Record<string, 'connected' | 'setup'>;
const categories: { id: IntegrationCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'fitness', label: 'Fitness' }, { id: 'health', label: 'Health' },
  { id: 'education', label: 'Education' }, { id: 'productivity', label: 'Productivity' }, { id: 'reading', label: 'Reading' },
  { id: 'mindfulness', label: 'Mindfulness' }, { id: 'faith', label: 'Faith' },
];
const FIRST_VIEW_LIMIT = 6;

export function ConnectPage({ onBack }: { onBack?: () => void }) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const connectionKey = userId ? `vow:connections:${userId}` : '';
  const firstViewKey = userId ? `vow:connect-first-view-complete:${userId}` : '';
  const [category, setCategory] = useState<IntegrationCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const [connected, setConnected] = useState<ConnectState>({});
  const [connecting, setConnecting] = useState<string | null>(null);
  const [googleCalendarConnected, setGoogleCalendarConnected] = useState(false);
  const [googleCalendarAvailable, setGoogleCalendarAvailable] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!userId) { setConnected({}); setShowAll(false); return; }
    try { setConnected(JSON.parse(localStorage.getItem(connectionKey) || '{}')); } catch { setConnected({}); }
    setShowAll(localStorage.getItem(firstViewKey) === 'true');
  }, [userId, connectionKey, firstViewKey]);

  useEffect(() => { if (userId) localStorage.setItem(connectionKey, JSON.stringify(connected)); }, [connected, userId, connectionKey]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    supabase.functions.invoke('google-calendar-auth', { body: { action: 'status' } }).then(({ data, error }) => {
      if (cancelled) return;
      const available = !error && data?.available === true && data?.configured === true;
      setGoogleCalendarAvailable(available);
      setGoogleCalendarConnected(available && Boolean(data?.connected));
      if (available && data?.connected) setConnected((current) => ({ ...current, 'google-calendar': 'connected' }));
    }).catch(() => { if (!cancelled) { setGoogleCalendarAvailable(false); setGoogleCalendarConnected(false); } });
    return () => { cancelled = true; };
  }, [session]);

  const integrations = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = INTEGRATIONS.filter((integration) => {
      const categoryMatch = category === 'all' || integration.category === category;
      const queryMatch = !q || `${integration.name} ${integration.description} ${integration.category}`.toLowerCase().includes(q);
      return categoryMatch && queryMatch;
    });
    if (showAll || q || category !== 'all') return filtered;
    const connectedFirst = filtered.filter((item) => item.id === 'google-calendar' ? googleCalendarConnected : connected[item.id] === 'connected');
    const unconnected = filtered.filter((item) => !connectedFirst.includes(item));
    return [...connectedFirst, ...unconnected].slice(0, FIRST_VIEW_LIMIT);
  }, [category, query, showAll, connected, googleCalendarConnected]);

  async function connectIntegration(id: string) {
    if (!session || connecting) return;
    if (id === 'google-calendar') {
      if (!googleCalendarAvailable) return;
      setConnecting(id);
      try {
        const redirectUri = Capacitor.isNativePlatform() ? NATIVE_CALENDAR_REDIRECT : `${window.location.origin}/calendar/oauth/callback`;
        const { data, error: invokeError } = await supabase.functions.invoke('google-calendar-auth', { body: { action: 'start', redirectUri } });
        if (invokeError || !data?.authorizationUrl) throw invokeError || new Error('Google Calendar is not configured yet.');
        if (Capacitor.isNativePlatform()) await Browser.open({ url: data.authorizationUrl }); else window.location.assign(data.authorizationUrl);
      } catch {
        setGoogleCalendarAvailable(false);
      } finally { setConnecting(null); }
    }
  }

  function revealAll() {
    if (firstViewKey) localStorage.setItem(firstViewKey, 'true');
    setShowAll(true);
  }

  const isLimited = !showAll && !query.trim() && category === 'all' && integrations.length < INTEGRATIONS.length;

  return <div>
    {onBack && <button onClick={onBack} className="text-sm text-vow-muted hover:text-vow-ink mb-6 flex items-center gap-1 transition-colors"><Glyph>←</Glyph>Back to profile</button>}
    <PageHeader title="Connect" subtitle="Connect the services that can give VOW reliable evidence for your routines and commitments." />
    <section className="mb-8 border border-vow-border p-5 md:p-6"><h2 className="text-sm font-medium text-vow-ink mb-1">One place for your evidence</h2><p className="text-sm text-vow-muted leading-relaxed">VOW starts with a small set of immediately useful connections instead of overwhelming you with a catalogue. Connected and first-hand sources are prioritised; broader discovery is available when you want it.</p></section>
    <div className="mb-5"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search connections" aria-label="Search connections" className="w-full border border-vow-border bg-transparent px-4 py-3 text-sm text-vow-ink outline-none focus:border-vow-ink" /></div>
    <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">{categories.map((item) => <button key={item.id} onClick={() => setCategory(item.id)} className={`whitespace-nowrap px-3 py-2 text-xs border transition-colors ${category === item.id ? 'border-vow-ink text-vow-ink' : 'border-vow-border text-vow-muted hover:text-vow-ink'}`}>{item.label}</button>)}</div>
    <div className="space-y-2">{integrations.map((integration) => {
      const isConnected = integration.id === 'google-calendar' ? googleCalendarConnected : connected[integration.id] === 'connected';
      const unavailable = integration.status === 'setup-required' || (integration.id === 'google-calendar' && !googleCalendarAvailable);
      return <div key={integration.id} className="border border-vow-border p-4 md:p-5 flex items-center gap-4">
        <div className="w-11 h-11 border border-vow-border flex items-center justify-center shrink-0 bg-white p-2"><img src={integration.iconUrl} alt="" className="w-full h-full object-contain" loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none'; }} /></div>
        <div className="min-w-0 flex-1"><div className="flex items-center gap-2 flex-wrap"><h3 className="text-sm font-medium text-vow-ink">{integration.name}</h3>{isConnected && <span className="text-[10px] text-vow-ink">Connected</span>}{unavailable && !isConnected && <span className="text-[10px] text-vow-muted">Unavailable</span>}</div><p className="text-xs text-vow-muted mt-1 leading-relaxed">{integration.description}</p><p className="text-[10px] text-vow-muted mt-2">Evidence: {integration.evidence.join(' · ')}</p></div>
        <button disabled={isConnected || unavailable || connecting === integration.id} onClick={() => connectIntegration(integration.id)} className={`shrink-0 px-3 py-2 text-xs border transition-colors ${isConnected ? 'border-vow-border text-vow-muted' : unavailable ? 'border-vow-border text-vow-muted opacity-50 cursor-not-allowed' : 'border-vow-ink text-vow-ink hover:bg-vow-border/40 disabled:opacity-50'}`}>{isConnected ? 'Connected' : unavailable ? 'Unavailable' : connecting === integration.id ? 'Connecting…' : 'Connect'}</button>
      </div>;
    })}</div>
    {isLimited && <div className="mt-6 flex flex-col items-center gap-2 border-t border-vow-border pt-6"><p className="text-xs text-vow-muted">Showing the connections most relevant to a first VOW setup.</p><button onClick={revealAll} className="border border-vow-ink px-4 py-2 text-xs text-vow-ink">Explore all connections</button></div>}
  </div>;
}
