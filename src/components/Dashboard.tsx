import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Goal, Session } from '@/types/database';
import { FREE_PLANNING_ACTION_LIMIT, getEntitlementSnapshot, type EntitlementSnapshot } from '@/lib/entitlements';
import { isThisWeek, formatTime, formatRelative, dayName } from '@/lib/dates';
import { PageHeader } from './AppShell';
import type { View } from './AppShell';

interface DashboardProps { onNavigate: (view: View) => void; }

export function Dashboard({ onNavigate }: DashboardProps) {
  const { session, displayName } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [entitlement, setEntitlement] = useState<EntitlementSnapshot | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    const [goalsRes, sessionsRes] = await Promise.all([
      supabase.from('goals').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }),
      supabase.from('sessions').select('*').eq('user_id', session.user.id).order('scheduled_at', { ascending: true }),
    ]);
    setGoals(goalsRes.data || []);
    setSessions(sessionsRes.data || []);
    setLoading(false);
  }, [session]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    let active = true;
    const refresh = () => { void getEntitlementSnapshot().then((snapshot) => { if (active) setEntitlement(snapshot); }); };
    refresh();
    const onEntitlementChange = (event: Event) => {
      const detail = (event as CustomEvent<EntitlementSnapshot | null>).detail;
      if (detail) setEntitlement(detail); else refresh();
    };
    window.addEventListener('vow:entitlement-changed', onEntitlementChange);
    window.addEventListener('focus', refresh);
    return () => { active = false; window.removeEventListener('vow:entitlement-changed', onEntitlementChange); window.removeEventListener('focus', refresh); };
  }, []);
  const activeGoals = goals.filter((g) => g.status === 'active' || g.status === 'locked');
  const thisWeekSessions = sessions.filter((s) => isThisWeek(s.scheduled_at));
  const completedThisWeek = thisWeekSessions.filter((s) => s.status === 'completed');
  const completionPct = thisWeekSessions.length > 0 ? Math.round((completedThisWeek.length / thisWeekSessions.length) * 100) : 0;
  const completedSessions = sessions.filter((s) => s.status === 'completed').length;
  const now = new Date();
  const planningLimit = Math.min(entitlement?.planning_limit ?? FREE_PLANNING_ACTION_LIMIT, FREE_PLANNING_ACTION_LIMIT);
  const allUpcoming = sessions.filter((s) => Boolean(s.scheduled_at) && new Date(s.scheduled_at as string) >= now && s.status === 'scheduled');
  const upcoming = allUpcoming.slice(0, 5);
  if (loading) return <div><PageHeader title={`Welcome back, ${displayName}`} /><div className="text-vow-muted text-sm">Loading...</div></div>;

  return <div className="min-w-0 max-w-full overflow-x-clip">
    <PageHeader title={`Welcome back, ${displayName}`} subtitle={`${dayName(new Date().toISOString())} — ${new Date().toLocaleDateString([], { month: 'long', day: 'numeric' })}`} />
    <div className="grid min-w-0 grid-cols-2 md:grid-cols-4 gap-px bg-vow-border mb-6 border border-vow-border"><StatCell label="Active goals" value={activeGoals.length} /><StatCell label="Sessions this week" value={`${completedThisWeek.length}/${thisWeekSessions.length}`} subtitle={`${completionPct}% completed`} /><StatCell label="Sessions completed" value={completedSessions} subtitle="All time" /><StatCell label="Upcoming sessions" value={allUpcoming.length} subtitle="Scheduled" /></div>
    {entitlement?.plan !== 'premium' && <div className="grid grid-cols-2 gap-3 mb-6"><div className="border border-vow-border rounded-xl p-3"><p className="text-xs text-vow-muted mb-1">Planning actions</p><p className="text-lg font-medium text-vow-ink">{entitlement?.planning_used ?? 0}/{planningLimit ?? FREE_PLANNING_ACTION_LIMIT}</p><div className="h-1 bg-vow-surface mt-2 overflow-hidden"><div className="h-full bg-vow-ink" style={{ width: `${Math.min(100, Math.round(((entitlement?.planning_used ?? 0) / (planningLimit ?? FREE_PLANNING_ACTION_LIMIT)) * 100))}%` }} /></div></div><div className="border border-vow-border rounded-xl p-3"><p className="text-xs text-vow-muted mb-1">Weekly review</p><p className="text-lg font-medium text-vow-ink">{entitlement?.advanced_reviews_used ?? 0}/{entitlement?.advanced_reviews_limit ?? 1}</p></div></div>}
    <div className="grid min-w-0 md:grid-cols-2 gap-6 md:gap-12">
      <div>
        <h2 className="vow-label mb-4">Upcoming sessions</h2>
        {upcoming.length === 0 ? <div className="border border-vow-border p-8 text-center"><div className="w-7 h-7 mx-auto mb-3 border border-vow-border rounded-full" /><p className="text-vow-muted text-sm mb-3">No sessions scheduled.</p><button onClick={() => onNavigate('goals')} className="text-vow-ink text-sm font-medium border-b border-vow-ink pb-0.5 hover:opacity-70 transition-opacity">Schedule sessions</button></div> : <div className="space-y-px border border-vow-border">{upcoming.map((s) => { const goal = goals.find((g) => g.id === s.goal_id); return <div key={s.id} className="bg-vow-bg px-4 py-3 flex items-center gap-3"><div className="w-2 h-2 rounded-full border border-vow-muted flex-shrink-0" /><div className="flex-1 min-w-0"><div className="text-sm text-vow-ink truncate">{s.title}</div><div className="text-xs text-vow-muted">{goal?.title || ''}</div></div><div className="text-right flex-shrink-0"><div className="text-xs text-vow-ink font-medium">{formatRelative(s.scheduled_at)}</div><div className="text-xs text-vow-muted">{formatTime(s.scheduled_at)}</div></div></div>; })}</div>}
      </div>
      <div>
        <h2 className="vow-label mb-4">Active goals</h2>
        {activeGoals.length === 0 ? <div className="border border-vow-border p-8 text-center"><p className="text-vow-muted text-sm">No active goals yet.</p></div> : <div className="space-y-px border border-vow-border">{activeGoals.map((g) => { const goalSessions = sessions.filter((s) => s.goal_id === g.id); const completed = goalSessions.filter((s) => s.status === 'completed').length; const total = goalSessions.length; const pct = total > 0 ? Math.round((completed / total) * 100) : 0; return <button key={g.id} onClick={() => onNavigate('goals')} className="w-full text-left bg-vow-bg px-4 py-3 hover:opacity-70 transition-opacity"><div className="flex items-center justify-between mb-2"><div className="text-sm text-vow-ink truncate flex-1">{g.outcome}</div><div className="text-xs text-vow-muted ml-2">{pct}%</div></div><div className="h-px bg-vow-border relative"><div className="absolute inset-y-0 left-0 bg-vow-ink transition-all duration-500" style={{ width: `${pct}%`, height: '1px' }} /></div><div className="text-xs text-vow-muted mt-1.5">{g.weekly_commitment_target} sessions/week — {completed}/{total} all-time</div></button>; })}</div>}
      </div>
    </div>
  </div>;
}

function StatCell({ label, value, subtitle }: { label: string; value: string | number; subtitle?: string }) { return <div className="bg-vow-bg px-4 py-5"><div className="text-3xl vow-heading text-vow-ink">{value}</div><div className="vow-label mt-1.5">{label}</div>{subtitle && <div className="text-xs text-vow-muted mt-0.5">{subtitle}</div>}</div>; }
