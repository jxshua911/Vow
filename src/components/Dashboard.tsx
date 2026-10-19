import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Goal, Session } from '@/types/database';
import { FREE_PLANNING_ACTION_LIMIT, getEntitlementSnapshot, type EntitlementSnapshot } from '@/lib/entitlements';
import { formatTime, formatRelative, dayName } from '@/lib/dates';
import { isSessionInCurrentPlanWeek } from '@/lib/dashboardSessions';
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
  // Date-less sessions are supported by VOW's flexible scheduling modes. Count
  // them against the active goal's current plan week instead of silently
  // displaying 0/0 for a valid weekly commitment.
  const thisWeekSessions = sessions.filter((s) => isSessionInCurrentPlanWeek(s, goals));
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
    <div className="grid min-w-0 grid-cols-2 md:grid-cols-4 gap-px bg-vow-border mb-6 border border-vow-border [&>*]:min-w-0"><StatCell label="Active goals" value={activeGoals.length} /><StatCell label="Sessions this week" value={`${completedThisWeek.length}/${thisWeekSessions.length}`} subtitle={`${completionPct}% completed`} /><StatCell label="Sessions completed" value={completedSessions} subtitle="All time" /><StatCell label="Upcoming sessions" value={allUpcoming.length} subtitle="Scheduled" /></div>
    {entitlement?.plan !== 'premium' && <div className="grid grid-cols-2 gap-3 mb-6"><div className="border border-vow-border rounded-xl p-3"><p className="text-xs text-vow-muted mb-1">Planning actions</p><p className="text-lg font-medium text-vow-ink">{entitlement?.planning_used ?? 0}/{planningLimit ?? FREE_PLANNING_ACTION_LIMIT}</p><div className="h-1 bg-vow-surface mt-2 overflow-hidden"><div className="h-full bg-vow-ink" style={{ width: `${Math.min(100, Math.round(((entitlement?.planning_used ?? 0) / (planningLimit ?? FREE_PLANNING_ACTION_LIMIT)) * 100))}%` }} /></div></div><div className="border border-vow-border rounded-xl p-3"><p className="text-xs text-vow-muted mb-1">Weekly review</p><p className="text-lg font-medium text-vow-ink">{entitlement?.advanced_reviews_used ?? 0}/{entitlement?.advanced_reviews_limit ?? 1}</p></div></div>}
    <div className="grid min-w-0 md:grid-cols-2 gap-6 md:gap-12">
      <div>
        <h2 className="vow-label mb-4">Upcoming sessions</h2>
        {upcoming.length === 0 ? <div className="border border-vow-border p-8 text-center"><div className="w-7 h-7 mx-auto mb-3 border border-vow-border rounded-full" /><p className="text-vow-muted text-sm mb-3">No sessions scheduled.</p><button onClick={() => onNavigate('goals')} className="text-vow-ink text-sm font-medium border-b border-vow-ink pb-0.5 hover:opacity-70 transition-opacity">Schedule sessions</button></div> : <div className="space-y-px border border-vow-border">{upcoming.map((s) => { const goal = goals.find((g) => g.id === s.goal_id); return <div key={s.id} className="bg-vow-bg px-4 py-3 flex items-center gap-3"><div className="w-2 h-2 rounded-full border border-vow-muted flex-shrink-0" /><div className="min-w-0 flex-1"><p className="text-sm font-medium text-vow-ink truncate">{s.title}</p><p className="text-xs text-vow-muted mt-1">{goal?.title || 'VOW session'} · {formatRelative(s.scheduled_at)} · {formatTime(s.scheduled_at)}</p></div></div>; })}</div>}
      </div>
      <div>
        <h2 className="vow-label mb-4">Active goals</h2>
        {activeGoals.length === 0 ? <div className="border border-vow-border p-8 text-center"><p className="text-vow-muted text-sm mb-3">No active goals yet.</p><button onClick={() => onNavigate('goals')} className="text-vow-ink text-sm font-medium border-b border-vow-ink pb-0.5 hover:opacity-70 transition-opacity">Create a goal</button></div> : <div className="space-y-px border border-vow-border">{activeGoals.slice(0, 5).map((g) => <button key={g.id} onClick={() => onNavigate('goals')} className="w-full text-left bg-vow-bg px-4 py-3 hover:bg-vow-surface transition-colors"><p className="text-sm font-medium text-vow-ink">{g.title}</p><p className="text-xs text-vow-muted mt-1">{g.weekly_commitment_target} sessions/week{g.deadline ? ` · Due ${new Date(g.deadline).toLocaleDateString([], { month: 'short', day: 'numeric' })}` : ''}</p></button>)}</div>}
      </div>
    </div>
  </div>;
}

function StatCell({ label, value, subtitle }: { label: string; value: string | number; subtitle?: string }) {
  return <div className="bg-vow-bg px-3 py-4 md:px-4"><p className="text-[10px] uppercase tracking-[0.14em] text-vow-muted mb-2">{label}</p><p className="text-xl md:text-2xl font-medium text-vow-ink tabular-nums">{value}</p>{subtitle && <p className="text-[10px] text-vow-muted mt-1">{subtitle}</p>}</div>;
}
