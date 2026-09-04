import { useEffect, useState, useCallback } from 'react';
import { ArrowRight, CheckCircle2, Flame, Target } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Goal, Session } from '@/types/database';
import { formatTime, formatRelative, dayName } from '@/lib/dates';
import { PageHeader } from './AppShell';
import type { View } from './AppShell';

interface DashboardProps { onNavigate: (view: View) => void; }
type RavenSummary = { score: number; score_delta: number | null; trend: 'up' | 'down' | 'steady' | 'new'; current_streak: number; completion_pct: number; };

type CommitmentRow = { goal_id: string; committed_sessions: number; completed_sessions: number; skipped_sessions: number; moved_sessions: number; };

function openGoal(onNavigate: (view: View) => void, userId: string, goalId: string) {
  localStorage.setItem(`vow:open-goal:${userId}`, goalId);
  onNavigate('goals');
}
function shortText(value: string, max = 54) { const clean = value.trim(); return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean; }

export function Dashboard({ onNavigate }: DashboardProps) {
  const { session, displayName } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [raven, setRaven] = useState<RavenSummary | null>(null);
  const [commitments, setCommitments] = useState<CommitmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    const [goalsRes, sessionsRes, ravenRes, commitmentRes] = await Promise.all([
      supabase.from('goals').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }),
      supabase.from('sessions').select('*').eq('user_id', session.user.id).order('scheduled_at', { ascending: true }),
      supabase.from('raven_weekly_snapshots').select('score,snapshot').eq('user_id', session.user.id).order('week_start', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('commitment_log').select('goal_id,committed_sessions,completed_sessions,skipped_sessions,moved_sessions').eq('user_id', session.user.id).order('week_start', { ascending: false }).limit(20),
    ]);
    setGoals((goalsRes.data || []) as Goal[]);
    setSessions((sessionsRes.data || []) as Session[]);
    setRaven(ravenRes.data?.snapshot ? (ravenRes.data.snapshot as RavenSummary) : null);
    setCommitments((commitmentRes.data || []) as CommitmentRow[]);
    setLoading(false);
  }, [session]);

  useEffect(() => { load(); }, [load]);
  const activeGoals = goals.filter((g) => g.status === 'active' || g.status === 'locked');
  const now = new Date();
  const upcoming = sessions.filter((s) => new Date(s.scheduled_at) >= now && s.status === 'scheduled').slice(0, 5);
  const observedSessions = sessions.filter((s) => new Date(s.scheduled_at) <= now);
  const completed = observedSessions.filter((s) => s.status === 'completed').length;
  const completion = observedSessions.length ? Math.round((completed / observedSessions.length) * 100) : 0;
  const nextSevenDays = sessions.filter((s) => { const d = new Date(s.scheduled_at); return s.status === 'scheduled' && d >= now && d <= new Date(now.getTime() + 7 * 86400000); });
  const recentCommitments = commitments.slice(0, activeGoals.length || 3);

  if (loading) return <div><PageHeader title={`Welcome back, ${displayName}`} /><div className="text-vow-muted text-sm">Loading...</div></div>;

  return <div className="min-w-0 overflow-hidden">
    <PageHeader title={`Welcome back, ${displayName}`} subtitle={`${dayName(new Date().toISOString())} — ${new Date().toLocaleDateString([], { month: 'long', day: 'numeric' })}`} />

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-vow-border border border-vow-border mb-8">
      <DashboardMetric label="Raven" value={raven ? `${raven.score}/100` : '—'} detail={raven ? raven.trend === 'up' ? `↑ ${raven.score_delta} this week` : raven.trend === 'down' ? `↓ ${Math.abs(raven.score_delta || 0)} this week` : 'Holding steady' : 'Start tracking'} icon={<Flame className="w-4 h-4" />} />
      <DashboardMetric label="Completion" value={`${raven?.completion_pct ?? completion}%`} detail={`${completed} completed`} icon={<CheckCircle2 className="w-4 h-4" />} />
      <DashboardMetric label="Next 7 days" value={nextSevenDays.length} detail={nextSevenDays.length === 1 ? 'session planned' : 'sessions planned'} icon={<Target className="w-4 h-4" />} />
      <DashboardMetric label="Active VOWs" value={activeGoals.length} detail="goals in motion" icon={<ArrowRight className="w-4 h-4" />} />
    </div>

    <div className="grid lg:grid-cols-[1.35fr_1fr] gap-8 lg:gap-12 min-w-0">
      <section className="min-w-0">
        <div className="flex items-end justify-between mb-4"><div><h2 className="vow-label">Your plan</h2><p className="text-xs text-vow-muted mt-1">What is actually on the calendar next.</p></div><button onClick={() => onNavigate('calendar')} className="text-xs text-vow-muted hover:text-vow-ink">Open calendar →</button></div>
        {upcoming.length === 0 ? <div className="border border-vow-border p-8 text-center"><div className="w-7 h-7 mx-auto mb-3 border border-vow-border rounded-full" /><p className="text-vow-muted text-sm mb-3">No sessions scheduled.</p><button onClick={() => onNavigate('goals')} className="text-vow-ink text-sm font-medium border-b border-vow-ink pb-0.5 hover:opacity-70 transition-opacity">Plan a session</button></div> : <div className="space-y-px border border-vow-border overflow-hidden">{upcoming.map((s) => { const goal = goals.find((g) => g.id === s.goal_id); return <button key={s.id} onClick={() => openGoal(onNavigate, session!.user.id, s.goal_id)} className="w-full bg-vow-bg px-4 py-3 flex items-center gap-3 text-left hover:bg-vow-surface/40 transition-colors min-w-0 overflow-hidden"><div className="w-2 h-2 rounded-full border border-vow-muted flex-shrink-0" /><div className="flex-1 min-w-0 overflow-hidden"><div className="text-sm text-vow-ink truncate">{shortText(s.title)}</div><div className="text-xs text-vow-muted truncate">{goal ? shortText(goal.outcome || goal.title, 34) : ''}</div></div><div className="text-right flex-shrink-0"><div className="text-xs text-vow-ink font-medium">{formatRelative(s.scheduled_at)}</div><div className="text-xs text-vow-muted">{formatTime(s.scheduled_at)}</div></div></button>; })}</div>}
      </section>

      <section className="min-w-0">
        <div className="flex items-end justify-between mb-4"><div><h2 className="vow-label">VOW progress</h2><p className="text-xs text-vow-muted mt-1">Execution against each active goal.</p></div><button onClick={() => onNavigate('review')} className="text-xs text-vow-muted hover:text-vow-ink">Weekly review →</button></div>
        {activeGoals.length === 0 ? <div className="border border-vow-border p-8 text-center"><p className="text-vow-muted text-sm">No active goals yet.</p></div> : <div className="space-y-5">{activeGoals.slice(0, 5).map((g) => { const goalSessions = sessions.filter((s) => s.goal_id === g.id && new Date(s.scheduled_at) <= now); const goalCompleted = goalSessions.filter((s) => s.status === 'completed').length; const total = goalSessions.length; const pct = total ? Math.round((goalCompleted / total) * 100) : 0; return <button key={g.id} onClick={() => openGoal(onNavigate, session!.user.id, g.id)} className="w-full text-left group"><div className="flex items-center justify-between mb-2 gap-3"><div className="text-sm text-vow-ink truncate min-w-0 group-hover:opacity-70">{shortText(g.outcome || g.title)}</div><div className="text-xs text-vow-muted shrink-0">{total ? `${pct}%` : 'No history'}</div></div><div className="h-px bg-vow-border relative"><div className="absolute inset-y-0 left-0 bg-vow-ink transition-all duration-500" style={{ width: `${pct}%` }} /></div><div className="text-xs text-vow-muted mt-1.5 truncate">{g.weekly_commitment_target} sessions/week · {goalCompleted} completed</div></button>; })}</div>}
      </section>
    </div>

    {recentCommitments.length > 0 && <section className="border-t border-vow-border mt-10 pt-6"><div className="flex items-end justify-between mb-4"><div><h2 className="vow-label">Commitment pulse</h2><p className="text-xs text-vow-muted mt-1">Recent commitments, not just intentions.</p></div><button onClick={() => onNavigate('review')} className="text-xs text-vow-muted hover:text-vow-ink">Review pattern →</button></div><div className="grid md:grid-cols-3 gap-px bg-vow-border border border-vow-border">{recentCommitments.slice(0, 3).map((row, index) => { const goal = goals.find((g) => g.id === row.goal_id); const total = row.committed_sessions || 0; const pct = total ? Math.round((row.completed_sessions / total) * 100) : 0; return <div key={`${row.goal_id}-${index}`} className="bg-vow-bg p-4 min-w-0"><p className="text-sm text-vow-ink truncate">{shortText(goal?.outcome || goal?.title || 'Goal')}</p><p className="text-xs text-vow-muted mt-1">{row.completed_sessions}/{total} completed · {pct}%</p><div className="h-px bg-vow-border mt-3"><div className="h-full bg-vow-ink" style={{ width: `${Math.min(100, pct)}%` }} /></div></div>; })}</div></section>}

    <div className="mt-8 border-t border-vow-border pt-5 flex items-center justify-between gap-4"><p className="text-xs text-vow-muted">Raven watches what you do. Weekly Review helps decide what to do next.</p><button onClick={() => onNavigate('review')} className="text-xs text-vow-ink hover:opacity-70 shrink-0">Open review →</button></div>
  </div>;
}

function DashboardMetric({ label, value, detail, icon }: { label: string; value: string | number; detail: string; icon: React.ReactNode }) {
  return <div className="bg-vow-bg p-4 min-w-0"><div className="flex items-center justify-between gap-2 mb-2"><p className="vow-label truncate">{label}</p><span className="text-vow-muted shrink-0">{icon}</span></div><p className="text-xl text-vow-ink font-medium truncate">{value}</p><p className="text-xs text-vow-muted mt-1 truncate">{detail}</p></div>;
}
