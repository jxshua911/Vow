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
  { id: 'education', label: 'Education' }, { id: 'productivity', label: 'Productivity' },
  { id: 'reading', label: 'Reading' }, { id: 'mindfulness', label: 'Mindfulness' }, { id: 'faith', label: 'Faith' },
];

export function ConnectPage() {
  const { session } = useAuth();
  const [category, setCategory] = useState<IntegrationCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const [connected, setConnected] = useState<ConnectState>(() => {
    try { return JSON.parse(localStorage.getItem('vow:connections') || '{}'); } catch { return {}; }
  });
  const [connecting, setConnecting] = useState<string | null>(null);
  const [googleCalendarConnected, setGoogleCalendarConnected] = useState(false);

  useEffect(() => { localStorage.setItem('vow:connections', JSON.stringify(connected)); }, [connected]);

  useEffect(() => {
    if (!session) return;
    supabase.functions.invoke('google-calendar-auth', { body: { action: 'status' } })
      .then(({ data }) => {
        const isConnected = Boolean(data?.connected);
        setGoogleCalendarConnected(isConnected);
        if (isConnected) setConnected((current) => ({ ...current, 'google-calendar': 'connected' }));
      });
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
      setConnecting(id);
      try {
        const redirectUri = Capacitor.isNativePlatform() ? NATIVE_CALENDAR_REDIRECT : `${window.location.origin}/calendar/oauth/callback`;
        const { data, error } = await supabase.functions.invoke('google-calendar-auth', { body: { action: 'start', redirectUri } });
        if (error) throw error;
        if (!data?.authorizationUrl) throw new Error('Google Calendar authorization URL was not returned.');
        if (Capacitor.isNativePlatform()) await Browser.open({ url: data.authorizationUrl });
        else window.location.assign(data.authorizationUrl);
      } catch (error) {
        window.alert(error instanceof Error ? error.message : 'Could not start the connection.');
      } finally { setConnecting(null); }
      return;
    }
    setConnected((current) => ({ ...current, [id]: 'setup' }));
    window.alert('This provider needs its own authorised developer connection before VOW can securely read its data. No account data has been claimed or faked as connected.');
  }

  return (
    <div>
      <PageHeader title="Connect" subtitle="Connect the services that can give VOW reliable evidence for your goals." />
      <section className="mb-8 border border-vow-border p-5 md:p-6">
        <h2 className="text-sm font-medium text-vow-ink mb-1">One place for your evidence</h2>
        <p className="text-sm text-vow-muted leading-relaxed">VOW requests only the permissions needed for a connection. A connected service is never treated as proof unless its data actually supports the goal.</p>
      </section>
      <div className="mb-5">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search connections" aria-label="Search connections" className="w-full border border-vow-border bg-transparent px-4 py-3 text-sm text-vow-ink outline-none focus:border-vow-ink" />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
        {categories.map((item) => <button key={item.id} onClick={() => setCategory(item.id)} className={`whitespace-nowrap px-3 py-2 text-xs border transition-colors ${category === item.id ? 'border-vow-ink text-vow-ink' : 'border-vow-border text-vow-muted hover:text-vow-ink'}`}>{item.label}</button>)}
      </div>
      <div className="space-y-2">
        {integrations.map((integration) => {
          const isConnected = integration.id === 'google-calendar' ? googleCalendarConnected : connected[integration.id] === 'connected';
          const setupRequired = integration.status === 'setup-required';
          return (
            <div key={integration.id} className="border border-vow-border p-4 md:p-5 flex items-center gap-4">
              <div className="w-11 h-11 border border-vow-border flex items-center justify-center shrink-0 bg-white p-2">
                <img src={integration.iconUrl} alt="" className="w-full h-full object-contain" loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap"><h3 className="text-sm font-medium text-vow-ink">{integration.name}</h3>{isConnected && <span className="text-[10px] text-vow-ink">Connected</span>}</div>
                <p className="text-xs text-vow-muted mt-1 leading-relaxed">{integration.description}</p>
                <p className="text-[10px] text-vow-muted mt-2">Evidence: {integration.evidence.join(' · ')}</p>
              </div>
              <button disabled={isConnected || connecting === integration.id} onClick={() => connectIntegration(integration.id)} className={`shrink-0 px-3 py-2 text-xs border transition-colors ${isConnected ? 'border-vow-border text-vow-muted' : 'border-vow-ink text-vow-ink hover:bg-vow-border/40 disabled:opacity-50'}`}>
                {isConnected ? 'Connected' : connecting === integration.id ? 'Connecting…' : setupRequired ? 'Configure' : 'Connect'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
