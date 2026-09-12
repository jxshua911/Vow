import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from './AppShell';
import { INTEGRATIONS, recommendIntegrations, type IntegrationCategory } from '@/lib/integrations/catalog';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { NATIVE_CALENDAR_REDIRECT, NATIVE_STRAVA_REDIRECT, WEB_CALENDAR_REDIRECT, WEB_STRAVA_REDIRECT } from '@/lib/nativeAuth';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import type { Goal, GoalClarificationAnswer } from '@/types/database';
import { buildGoalContext, integrationIdsForGoal } from '@/lib/goalContext';

type ConnectionStatus = 'connected' | 'disconnected';
type ConnectionHistory = Record<string, ConnectionStatus>;
type ConnectionRow = { integration_id: string; status: ConnectionStatus; connected_at: string | null; disconnected_at: string | null; last_goal_ids: unknown };
const categories: { id: IntegrationCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'Relevant' }, { id: 'fitness', label: 'Fitness' }, { id: 'health', label: 'Health' },
  { id: 'education', label: 'Education' }, { id: 'productivity', label: 'Productivity' }, { id: 'reading', label: 'Reading' },
  { id: 'mindfulness', label: 'Mindfulness' }, { id: 'faith', label: 'Faith' },
];

export function ConnectPage({ onBack }: { onBack?: () => void }) {
  const { session } = useAuth();
  const [category, setCategory] = useState<IntegrationCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalContexts, setGoalContexts] = useState<ReturnType<typeof buildGoalContext>[]>([]);
  const [history, setHistory] = useState<ConnectionHistory>({});
  const [rows, setRows] = useState<ConnectionRow[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [googleCalendarAvailable, setGoogleCalendarAvailable] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [goalResult, connectionResult, calendarResult] = await Promise.all([
          supabase.from('goals').select('*').eq('user_id', session.user.id).in('status', ['draft', 'locked', 'active']),
          supabase.from('integration_connections').select('integration_id,status,connected_at,disconnected_at,last_goal_ids').eq('user_id', session.user.id),
          supabase.functions.invoke('google-calendar-auth', { body: { action: 'status' } }),
        ]);
        if (goalResult.error) throw goalResult.error;
        if (connectionResult.error) throw connectionResult.error;

        const nextGoals = (goalResult.data || []) as Goal[];
        const contexts = await Promise.all(nextGoals.map(async (goal) => {
          const { data: answers, error: answerError } = await supabase
            .from('goal_clarification_answers')
            .select('*')
            .eq('goal_id', goal.id)
            .eq('user_id', session.user.id)
            .order('question_order', { ascending: true });
          if (answerError) throw answerError;
          return buildGoalContext(goal, (answers || []) as GoalClarificationAnswer[]);
        }));

        if (cancelled) return;
        const nextRows = (connectionResult.data || []) as ConnectionRow[];
        const nextHistory = Object.fromEntries(nextRows.map((row) => [row.integration_id, row.status])) as ConnectionHistory;
        setGoals(nextGoals);
        setGoalContexts(contexts);
        setRows(nextRows);
        setHistory(nextHistory);
        setGoogleCalendarAvailable(!calendarResult.error && calendarResult.data?.available === true && calendarResult.data?.configured === true);
        setError('');
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load your connections.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  const relevantIds = useMemo(() => {
    const ids = new Set<string>();
    goalContexts.forEach((context) => integrationIdsForGoal(context, INTEGRATIONS).forEach((id) => ids.add(id)));
    recommendIntegrations(goals.map((goal) => `${goal.title} ${goal.outcome}`)).forEach((integration) => ids.add(integration.id));
    return ids;
  }, [goalContexts, goals]);
  const connectedIds = useMemo(() => new Set(Object.entries(history).filter(([, status]) => status === 'connected').map(([id]) => id)), [history]);
  const previouslyConnectedIds = useMemo(() => new Set(Object.entries(history).filter(([, status]) => status === 'disconnected').map(([id]) => id)), [history]);
  const relevantIntegrations = useMemo(() => {
    const q = query.trim().toLowerCase();
    return INTEGRATIONS.filter((integration) => {
      const categoryMatch = category === 'all' || integration.category === category;
      const lifecycleMatch = relevantIds.has(integration.id) || connectedIds.has(integration.id) || previouslyConnectedIds.has(integration.id);
      const queryMatch = !q || `${integration.name} ${integration.description} ${integration.category}`.toLowerCase().includes(q);
      return categoryMatch && lifecycleMatch && queryMatch;
    }).sort((a, b) => (connectedIds.has(a.id) ? 0 : previouslyConnectedIds.has(a.id) ? 1 : 2) - (connectedIds.has(b.id) ? 0 : previouslyConnectedIds.has(b.id) ? 1 : 2) || a.name.localeCompare(b.name));
  }, [category, query, relevantIds, connectedIds, previouslyConnectedIds]);
  const previouslyConnected = useMemo(() => INTEGRATIONS.filter((integration) => previouslyConnectedIds.has(integration.id) && !connectedIds.has(integration.id)), [previouslyConnectedIds, connectedIds]);

  async function persistStatus(id: string, status: ConnectionStatus) {
    if (!session?.user?.id) return;
    const goalIds = goals.filter((goal) => relevantIds.has(id)).map((goal) => goal.id);
    const existing = rows.find((row) => row.integration_id === id);
    const now = new Date().toISOString();
    const payload = { user_id: session.user.id, integration_id: id, status, connected_at: status === 'connected' ? now : (existing?.connected_at || null), disconnected_at: status === 'disconnected' ? now : null, last_goal_ids: goalIds, updated_at: now };
    const { data, error: upsertError } = await supabase.from('integration_connections').upsert(payload, { onConflict: 'user_id,integration_id' }).select('integration_id,status,connected_at,disconnected_at,last_goal_ids').single();
    if (upsertError) throw upsertError;
    const nextRow = data as ConnectionRow;
    setRows((current) => [...current.filter((row) => row.integration_id !== id), nextRow]);
    setHistory((current) => ({ ...current, [id]: status }));
  }

  async function openProvider(id: string) {
    if (!session || connecting) return;
    setConnecting(id); setError('');
    try {
      if (id === 'google-calendar') {
        if (!googleCalendarAvailable) throw new Error('Google Calendar is not configured yet.');
        const redirectUri = Capacitor.isNativePlatform() ? NATIVE_CALENDAR_REDIRECT : WEB_CALENDAR_REDIRECT;
        const { data, error: invokeError } = await supabase.functions.invoke('google-calendar-auth', { body: { action: 'start', redirectUri } });
        if (invokeError || !data?.authorizationUrl) throw invokeError || new Error('Could not start Google Calendar connection.');
        if (Capacitor.isNativePlatform()) await Browser.open({ url: data.authorizationUrl }); else window.location.assign(data.authorizationUrl);
        return;
      }
      if (id === 'strava') {
        const returnUri = Capacitor.isNativePlatform() ? NATIVE_STRAVA_REDIRECT : WEB_STRAVA_REDIRECT;
        const { data, error: invokeError } = await supabase.functions.invoke('strava-oauth', { body: { action: 'authorize', returnUri } });
        if (invokeError || !data?.url) throw invokeError || new Error('Could not start Strava connection.');
        if (Capacitor.isNativePlatform()) await Browser.open({ url: data.url }); else window.location.assign(data.url);
        return;
      }
      const integration = INTEGRATIONS.find((item) => item.id === id);
      if (integration?.connectionType === 'native' && integration.status === 'available') {
        await persistStatus(id, 'connected');
        return;
      }
      throw new Error(`${integration?.name || 'This connection'} needs its provider authentication flow configured before it can be connected.`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not connect this service.'); setConnecting(null); }
  }

  async function disconnectIntegration(id: string) {
    if (!session || connecting) return;
    setConnecting(id); setError('');
    try {
      if (id === 'strava') {
        const { error: disconnectError } = await supabase.functions.invoke('strava-oauth', { body: { action: 'disconnect' } });
        if (disconnectError) throw disconnectError;
      }
      if (id === 'google-calendar') {
        const { error: deleteError } = await supabase.from('google_calendar_connections').delete().eq('user_id', session.user.id);
        if (deleteError) throw deleteError;
      }
      await persistStatus(id, 'disconnected');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not disconnect this service.'); }
    finally { setConnecting(null); }
  }

  function renderIntegration(integration: typeof INTEGRATIONS[number]) {
    const isConnected = connectedIds.has(integration.id);
    const wasConnected = previouslyConnectedIds.has(integration.id);
    const unavailable = integration.status === 'setup-required' || (integration.id === 'google-calendar' && !googleCalendarAvailable);
    return <div key={integration.id} className="border border-vow-border p-4 md:p-5 flex items-center gap-4">
      <div className="w-11 h-11 border border-vow-border flex items-center justify-center shrink-0 bg-white p-2"><img src={integration.iconUrl} alt="" className="w-full h-full object-contain" loading="lazy" /></div>
      <div className="min-w-0 flex-1"><div className="flex items-center gap-2 flex-wrap"><h3 className="text-sm font-medium text-vow-ink">{integration.name}</h3>{isConnected && <span className="text-[10px] text-vow-ink">Connected</span>}{!isConnected && wasConnected && <span className="text-[10px] text-vow-muted">Previously connected</span>}{!isConnected && !wasConnected && relevantIds.has(integration.id) && <span className="text-[10px] text-vow-muted">Relevant to your goals</span>}</div><p className="text-xs text-vow-muted mt-1 leading-relaxed">{integration.description}</p><p className="text-[10px] text-vow-muted mt-2">Evidence: {integration.evidence.join(' · ')}</p></div>
      {isConnected ? <button disabled={connecting === integration.id} onClick={() => disconnectIntegration(integration.id)} className="shrink-0 px-3 py-2 text-xs border border-vow-border text-vow-muted hover:text-vow-ink flex items-center gap-1">{connecting === integration.id ? 'Updating...' : 'Disconnect'}</button> : <button disabled={unavailable || connecting === integration.id} onClick={() => openProvider(integration.id)} className="shrink-0 px-3 py-2 text-xs border border-vow-ink text-vow-ink hover:bg-vow-border/40 disabled:opacity-50 flex items-center gap-1">{wasConnected ? <RotateCcw className="w-3 h-3" /> : null}{connecting === integration.id ? 'Connecting...' : unavailable ? 'Setup required' : wasConnected ? 'Reconnect' : 'Connect'}</button>}
    </div>;
  }

  return <div>
    {onBack && <button onClick={onBack} className="text-sm text-vow-muted hover:text-vow-ink mb-6 flex items-center gap-1 transition-colors"><ArrowLeft className="w-4 h-4" />Back to profile</button>}
    <PageHeader title="Connect" subtitle="VOW surfaces services that can meaningfully support your goals, while remembering connections you have used before." />
    <section className="mb-8 border border-vow-border p-5 md:p-6"><h2 className="text-sm font-medium text-vow-ink mb-1">Your goal context drives this page</h2><p className="text-sm text-vow-muted leading-relaxed">Active goals determine recommendations. Once a service is connected, VOW remembers it even when the goal changes, so a future goal can reuse the connection without making you start over.</p></section>
    <div className="mb-5"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search relevant connections" aria-label="Search relevant connections" className="w-full border border-vow-border bg-transparent px-4 py-3 text-sm text-vow-ink outline-none focus:border-vow-ink" /></div>
    <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">{categories.map((item) => <button key={item.id} onClick={() => setCategory(item.id)} className={`whitespace-nowrap px-3 py-2 text-xs border transition-colors ${category === item.id ? 'border-vow-ink text-vow-ink' : 'border-vow-border text-vow-muted hover:text-vow-ink'}`}>{item.label}</button>)}</div>
    {loading ? <p className="text-sm text-vow-muted">Loading your goal-relevant connections...</p> : relevantIntegrations.length ? <div className="space-y-2">{relevantIntegrations.map(renderIntegration)}</div> : <section className="border border-vow-border p-6"><h2 className="text-sm font-medium text-vow-ink">No matching connections yet</h2><p className="text-sm text-vow-muted mt-2">Create an active goal and VOW will surface services that can provide useful evidence for it. Previous connections remain remembered when available.</p></section>}
    {previouslyConnected.length > 0 && <section className="mt-10"><div className="mb-4"><h2 className="text-sm font-medium text-vow-ink">Previously connected</h2><p className="text-xs text-vow-muted mt-1">These stay remembered by VOW even when disconnected.</p></div><div className="space-y-2">{previouslyConnected.filter((integration) => category === 'all' || integration.category === category).map(renderIntegration)}</div></section>}
    {error && <p className="mt-6 text-sm text-vow-ink border-l-2 border-vow-ink pl-3">{error}</p>}
  </div>;
}
