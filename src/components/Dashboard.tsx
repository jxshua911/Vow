import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Goal, Session } from '@/types/database';
import { FREE_PLANNING_ACTION_LIMIT, getEntitlementSnapshot, type EntitlementSnapshot } from '@/lib/entitlements';
import { formatTime, formatRelative, dayName } from '@/lib/dates';
import { isFlexibleUpcomingSession, isSessionInCurrentPlanWeek } from '@/lib/dashboardSessions';
import { PageHeader } from './AppShell';
import type { View } from './AppShell';
import { getDemoModeEnabled, isDemoModeEligible } from '@/lib/demoMode';

interface DashboardProps { onNavigate: (view: View) => void; }

function createAccountScopedDemoData(): { goals: Goal[]; sessions: Session[]; weekSessions: Session[] } {
  const now = new Date();
  const dateAt = (offsetDays: number, hour = 9) => {
    const date = new Date(now);
    date.setDate(date.getDate() + offsetDays);
    date.setHours(hour, 0, 0, 0);
    return date.toISOString();
  };
  // The demo must respect VOW's one-active-goal rule. It is one
  // illustrative goal with a coherent project-building session history.
  const definitions = [
    {
      id: 'demo-goal-project',
      title: 'Build a personal project',
      outcome: 'Ship a working first version that solves one clearly defined problem',
      completed: 4,
      total: 8,
      completedTitles: [
        'Choose one problem worth solving',
        'Define the first-version scope',
        'Map the core user journey',
        'Create the project structure',
      ],
      upcomingTitle: 'Build the core user flow',
    },
  ];
  const goals: Goal[] = definitions.map((item) => ({
    id: item.id,
    user_id: 'demo-only',
    title: item.title,
    outcome: item.outcome,
    why_it_matters: null,
    start_date: dateAt(-28).slice(0, 10),
    duration: '3m',
    deadline: dateAt(62).slice(0, 10),
    status: 'active',
    weekly_commitment_target: 3,
    plan_json: null,
    plan_version: 1,
    plan_generated_at: dateAt(-28),
    planning_horizon_weeks: 13,
    planning_timezone: 'Asia/Kuala_Lumpur',
    created_at: dateAt(-28),
    updated_at: dateAt(-1),
  }));
  const sessions: Session[] = [];
  let completedIndex = 0;
  definitions.forEach((goal) => {
    for (let index = 0; index < goal.completed; index += 1) {
      completedIndex += 1;
      sessions.push({
        id: `demo-completed-${goal.id}-${index}`,
        goal_id: goal.id,
        milestone_id: null,
        user_id: 'demo-only',
        title: goal.completedTitles[index] || 'Review project progress',
        day_of_week: null,
        scheduled_at: dateAt(-completedIndex - 1, 9),
        duration_minutes: 30,
        status: 'completed',
        moved_count: 0,
        plan_version: 1,
        external_event_id: null,
        completed_at: dateAt(-completedIndex - 1, 10),
        notes: null,
        created_at: dateAt(-completedIndex - 1),
        updated_at: dateAt(-completedIndex - 1),
      });
    }
    for (let index = goal.completed; index < goal.total - 1; index += 1) {
      const offset = 30 + index + completedIndex;
      sessions.push({
        id: `demo-skipped-${goal.id}-${index}`,
        goal_id: goal.id,
        milestone_id: null,
        user_id: 'demo-only',
        title: 'Previous planned session',
        day_of_week: null,
        scheduled_at: dateAt(-offset, 9),
        duration_minutes: 30,
        status: 'skipped',
        moved_count: 0,
        plan_version: 1,
        external_event_id: null,
        completed_at: null,
        notes: null,
        created_at: dateAt(-offset),
        updated_at: dateAt(-offset),
      });
    }
  });
  definitions.forEach((goal, index) => {
    sessions.push({
      id: `demo-upcoming-${goal.id}`,
      goal_id: goal.id,
      milestone_id: null,
      user_id: 'demo-only',
      title: goal.upcomingTitle,
      day_of_week: null,
      scheduled_at: dateAt(index + 1, 9 + (index % 3)),
      duration_minutes: [35, 20, 25, 45][index],
      status: 'scheduled',
      moved_count: 0,
      plan_version: 1,
      external_event_id: null,
      completed_at: null,
      notes: null,
      created_at: dateAt(-1),
      updated_at: dateAt(-1),
    });
  });
  const weekSessions: Session[] = [
    ...sessions.filter((session) => session.status === 'completed').slice(0, 3).map((session, index) => ({
      ...session,
      id: `demo-week-completed-${index}`,
      scheduled_at: dateAt(-Math.max(1, now.getDay() - index), 9),
    })),
    ...sessions.filter((session) => session.status === 'scheduled').slice(0, 2).map((session, index) => ({
      ...session,
      id: `demo-week-upcoming-${index}`,
      scheduled_at: dateAt(index + 1, 9),
      status: 'scheduled' as const,
      completed_at: null,
    })),
  ];
  return { goals, sessions, weekSessions };
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { session, displayName } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [entitlement, setEntitlement] = useState<EntitlementSnapshot | null>(null);
  const demoModeEligible = isDemoModeEligible(session?.user.email);
  const [demoModeEnabled, setDemoModeEnabled] = useState(false);

  useEffect(() => {
    if (!session || !demoModeEligible) {
      setDemoModeEnabled(false);
      return;
    }
    setDemoModeEnabled(getDemoModeEnabled(session.user.id));
    const handleDemoModeChange = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: string; enabled?: boolean }>).detail;
      if (detail?.userId === session.user.id) setDemoModeEnabled(Boolean(detail.enabled));
    };
    window.addEventListener('vow:demo-mode-changed', handleDemoModeChange);
    return () => window.removeEventListener('vow:demo-mode-changed', handleDemoModeChange);
  }, [session?.user.id, session?.user.email, demoModeEligible]);

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

  useEffect(() => {
    void load();
    const refresh = () => {
      if (document.visibilityState === 'visible') void load();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('vow:refresh', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('vow:refresh', refresh);
    };
  }, [load]);
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
    window.addEventListener('vow:refresh', refresh);
    return () => { active = false; window.removeEventListener('vow:entitlement-changed', onEntitlementChange); window.removeEventListener('focus', refresh); window.removeEventListener('vow:refresh', refresh); };
  }, []);
  // This read-only presentation layer is enabled only for the explicitly authorised demo account.
  // Demo rows are created in memory and are never inserted into Supabase or entitlement records.
  const isDemoMode = demoModeEligible && demoModeEnabled;
  const demoData = isDemoMode ? createAccountScopedDemoData() : null;
  const dashboardGoals = demoData?.goals ?? goals;
  const dashboardSessions = demoData?.sessions ?? sessions;
  const activeGoals = dashboardGoals.filter((g) => g.status === 'active' || g.status === 'locked');
  // Date-less sessions are supported by VOW's flexible scheduling modes. Count
  // them against the active goal's current plan week instead of silently
  // displaying 0/0 for a valid weekly commitment.
  const thisWeekSessions = demoData?.weekSessions ?? dashboardSessions.filter((s) => isSessionInCurrentPlanWeek(s, dashboardGoals));
  const completedThisWeek = thisWeekSessions.filter((s) => s.status === 'completed');
  const completionPct = thisWeekSessions.length > 0 ? Math.round((completedThisWeek.length / thisWeekSessions.length) * 100) : 0;
  const completedSessions = dashboardSessions.filter((s) => s.status === 'completed').length;
  const now = new Date();
  const planningLimit = Math.min(entitlement?.planning_limit ?? FREE_PLANNING_ACTION_LIMIT, FREE_PLANNING_ACTION_LIMIT);
  const timedUpcoming = dashboardSessions.filter((s) => Boolean(s.scheduled_at) && new Date(s.scheduled_at as string) >= now && s.status === 'scheduled');
  const flexibleUpcoming = dashboardSessions.filter((s) => isFlexibleUpcomingSession(s as Session & { day_of_week?: string | null }, dashboardGoals));
  const allUpcoming = [...timedUpcoming, ...flexibleUpcoming];
  const upcoming = allUpcoming.slice(0, 5);
  if (loading) return <div><PageHeader title={`Welcome back, ${displayName}`} /><div className="text-vow-muted text-sm">Loading...</div></div>;

  return <div data-vow-demo-mode={isDemoMode ? 'account-scoped-read-only' : undefined} className={`min-w-0 max-w-full overflow-x-clip ${activeGoals.length || upcoming.length ? 'vow-dashboard-populated' : 'vow-dashboard-empty'}`}>
    <PageHeader title={`Welcome back, ${displayName}`} subtitle={`${dayName(new Date().toISOString())} — ${new Date().toLocaleDateString([], { month: 'long', day: 'numeric' })}`} />
    <div className="grid min-w-0 grid-cols-2 md:grid-cols-4 gap-px bg-vow-border mb-4 md:mb-5 border border-vow-border [&>*]:min-w-0"><StatCell label="Active goals" value={activeGoals.length} /><StatCell label="Sessions this week" value={`${completedThisWeek.length}/${thisWeekSessions.length}`} subtitle={`${completionPct}% completed`} /><StatCell label="Sessions completed" value={completedSessions} subtitle="All time" /><StatCell label="Upcoming sessions" value={allUpcoming.length} subtitle="Scheduled" /></div>
    {entitlement?.plan !== 'premium' && <div className="grid grid-cols-2 gap-2.5 mb-4"><div className="border border-vow-border rounded-xl p-3"><p className="text-xs text-vow-muted mb-1">Planning actions</p><p className="text-lg font-medium text-vow-ink">{entitlement?.planning_used ?? 0}/{planningLimit ?? FREE_PLANNING_ACTION_LIMIT}</p><div className="h-1 bg-vow-surface mt-2 overflow-hidden"><div className="h-full bg-vow-ink" style={{ width: `${Math.min(100, Math.round(((entitlement?.planning_used ?? 0) / (planningLimit ?? FREE_PLANNING_ACTION_LIMIT)) * 100))}%` }} /></div></div><div className="border border-vow-border rounded-xl p-3"><p className="text-xs text-vow-muted mb-1">Weekly review</p><p className="text-lg font-medium text-vow-ink">{entitlement?.advanced_reviews_used ?? 0}/{entitlement?.advanced_reviews_limit ?? 1}</p></div></div>}
    <div className="grid min-w-0 md:grid-cols-2 gap-4 md:gap-8">
      <div>
        <h2 className="vow-label mb-2.5">Upcoming sessions</h2>
        {upcoming.length === 0 ? <div className="border border-vow-border p-5 md:p-7 text-center"><div className="w-7 h-7 mx-auto mb-3 border border-vow-border rounded-full" /><p className="text-vow-muted text-sm mb-3">No sessions scheduled.</p><button onClick={() => onNavigate('goals')} className="text-vow-ink text-sm font-medium border-b border-vow-ink pb-0.5 hover:opacity-70 transition-opacity">Schedule sessions</button></div> : <div className="space-y-px border border-vow-border">{upcoming.map((s) => { const goal = dashboardGoals.find((g) => g.id === s.goal_id); const day = (s as Session & { day_of_week?: string | null }).day_of_week; return <div key={s.id} className="bg-vow-bg px-3.5 py-2.5 flex items-center gap-2.5"><div className="w-2 h-2 rounded-full border border-vow-muted flex-shrink-0" /><div className="flex-1 min-w-0"><div className="text-sm text-vow-ink whitespace-normal break-words [overflow-wrap:anywhere] leading-snug">{s.title}</div><div className="text-xs text-vow-muted mt-1 break-words">{goal?.title || ''}</div></div><div className="text-right flex-shrink-0 max-w-[7.5rem]"><div className="text-xs text-vow-ink font-medium whitespace-normal break-words">{s.scheduled_at ? formatRelative(s.scheduled_at) : `${day || 'Flexible schedule'} · No fixed time`}</div>{s.scheduled_at && <div className="text-xs text-vow-muted whitespace-normal break-words">{formatTime(s.scheduled_at)}</div>}</div></div>; })}</div>}
      </div>
      <div>
        <h2 className="vow-label mb-4">Active goals</h2>
        {activeGoals.length === 0 ? <div className="border border-vow-border p-8 text-center"><p className="text-vow-muted text-sm">No active goals yet.</p></div> : <div className="space-y-px border border-vow-border">{activeGoals.map((g) => { const goalSessions = dashboardSessions.filter((s) => s.goal_id === g.id); const completed = goalSessions.filter((s) => s.status === 'completed').length; const total = goalSessions.length; const pct = total > 0 ? Math.round((completed / total) * 100) : 0; return <button key={g.id} onClick={() => { if (!isDemoMode) onNavigate('goals'); }} disabled={isDemoMode} aria-label={isDemoMode ? "Illustrative demo goal preview" : undefined} className="w-full text-left bg-vow-bg px-3.5 py-2.5 hover:opacity-70 transition-opacity disabled:cursor-default disabled:hover:opacity-100"><div className="flex min-w-0 items-start justify-between gap-2 mb-2"><div className="text-sm text-vow-ink min-w-0 flex-1 [overflow-wrap:anywhere]">{g.outcome}</div><div className="text-xs text-vow-muted flex-shrink-0">{pct}%</div></div><div className="h-px bg-vow-border relative"><div className="absolute inset-y-0 left-0 bg-vow-ink transition-all duration-500" style={{ width: `${pct}%`, height: '1px' }} /></div><div className="text-xs text-vow-muted mt-1.5 [overflow-wrap:anywhere]">{g.weekly_commitment_target} sessions/week — {completed}/{total} all-time</div></button>; })}</div>}
      </div>
    </div>
  </div>;
}

function StatCell({ label, value, subtitle }: { label: string; value: string | number; subtitle?: string }) { return <div className="bg-vow-bg min-w-0 px-3 sm:px-4 py-4 sm:py-5 overflow-hidden"><div className="text-3xl vow-heading text-vow-ink break-words">{value}</div><div className="vow-label mt-1.5 break-words">{label}</div>{subtitle && <div className="text-xs text-vow-muted mt-0.5">{subtitle}</div>}</div>; }
