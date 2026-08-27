import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from './AppShell';
import { INTEGRATIONS, type IntegrationCategory } from '@/lib/integrations/catalog';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { NATIVE_CALENDAR_REDIRECT } from '@/lib/nativeAuth';

type ConnectState = Record<string, 'connected' | 'setup'>;
const categories: { id: IntegrationCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'fitness', label: 'Fitness' }, { id: 'health', label: 'Health' },
  { id: 'education', label: 'Education' }, { id: 'productivity', label: 'Productivity' }, { id: 'reading', label: 'Reading' },
  { id: 'mindfulness', label: 'Mindfulness' }, { id: 'faith', label: 'Faith' },
];

export function ConnectPage() {
  const { session } = useAuth();
  const [category, setCategory] = useState<IntegrationCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const [connected, setConnected] = useState<ConnectState>(() => { try { return JSON.parse(localStorage.getItem('vow:connections') || '{}'); } catch { return {}; } });
  const [connecting, setConnecting] = useState<string | null>(null);
  const [googleCalendarConnected, setGoogleCalendarConnected] = useState(false);
  const [googleCalendarAvailable, setGoogleCalendarAvailable] = useState(false);

  useEffect(() => { localStorage.setItem('vow:connections', JSON.stringify(connected)); }, [connected]);

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
    return INTEGRATIONS.filter((integration) => {
      const categoryMatch = category === 'all' || integration.category === category;
      const queryMatch = !q || `${integration.name} ${integration.description} ${integration.category}`.toLowerCase().includes(q);
      return categoryMatch && queryMatch;
    });
  }, [category, query]);

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
      return;
    }
  }

  return <div>
    <PageHeader title="Connect" subtitle="Connect the services that can give VOW reliable evidence for your routines and commitments." />
    <section className="mb-8 border border-vow-border p-5 md:p-6"><h2 className="text-sm font-medium text-vow-ink mb-1">One place for your evidence</h2><p className="text-sm text-vow-muted leading-relaxed">Only integrations that are actually available can be connected. Providers still in setup stay visible so you can see the roadmap, but their controls are intentionally inactive.</p></section>
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
  </div>;
}
