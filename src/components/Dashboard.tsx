import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Goal, Session } from '@/types/database';
import { formatTime, formatRelative, dayName } from '@/lib/dates';
import { PageHeader } from './AppShell';
import type { View } from './AppShell';
import { WeekManagement } from './WeekManagement';

interface DashboardProps { onNavigate: (view: View) => void; }
function openGoal(onNavigate: (view: View) => void, userId: string, goalId: string) { localStorage.setItem(`vow:open-goal:${userId}`, goalId); onNavigate('goals'); }
function shortText(value: string, max = 58) { const clean = value.trim(); return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean; }
function isSameDay(value: string, date: Date) { const d = new Date(value); return d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth() && d.getDate() === date.getDate(); }
function startOfCurrentWeek(date: Date) { const d = new Date(date); const day = d.getDay(); d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day)); d.setHours(0, 0, 0, 0); return d; }

export function Dashboard({ onNavigate }: DashboardProps) {
  const { session, displayName } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError('');
    const [goalsRes, sessionsRes] = await Promise.all([
      supabase.from('goals').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }),
      supabase.from('sessions').select('*').eq('user_id', session.user.id).order('scheduled_at', { ascending: true }),
    ]);
    if (goalsRes.error || sessionsRes.error) setError(goalsRes.error?.message || sessionsRes.error?.message || 'Could not load your dashboard.');
    setGoals((goalsRes.data || []) as Goal[]);
    setSessions((sessionsRes.data || []) as Session[]);
    setLoading(false);
  }, [session]);
  useEffect(() => { load().catch((err) => { setError(err instanceof Error ? err.message : 'Could not load your dashboard.'); setLoading(false); }); }, [load]);

  const now = useMemo(() => new Date(), []);
  const weekStart = startOfCurrentWeek(now);
  const activeGoals = goals.filter((g) => g.status === 'active' || g.status === 'locked');
  const todaySessions = useMemo(() => sessions.filter((s) => isSameDay(s.scheduled_at, now)).sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()), [sessions, now]);
  const upcoming = sessions.filter((s) => new Date(s.scheduled_at) >= now && s.status === 'scheduled').slice(0, 5);
  const weekSessions = sessions.filter((s) => { const date = new Date(s.scheduled_at); return date >= weekStart && date <= now; });
  const weekCompleted = weekSessions.filter((s) => s.status === 'completed').length;
  const weekScheduled = sessions.filter((s) => { const date = new Date(s.scheduled_at); return date >= now && date >= weekStart && date <= new Date(weekStart.getTime() + 7 * 86400000) && s.status === 'scheduled'; }).length;

  if (loading) return <div><PageHeader title={`Welcome back, ${displayName || 'there'}`} /><div className="text-vow-muted text-sm py-8">Loading your dashboard…</div></div>;

  return <div className="min-w-0 overflow-hidden">
    <PageHeader title={`Welcome back, ${displayName || 'there'}`} subtitle={`${dayName(now.toISOString())} — ${now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`} />
    {error && <p className="text-sm text-vow-ink border-l-2 border-vow-ink pl-3 mb-8 break-words" role="alert">{error}</p>}

    <section className="grid grid-cols-3 gap-px bg-vow-border border border-vow-border mb-10">
      {[["Completed", weekCompleted], ["Scheduled", weekScheduled], ["Active goals", activeGoals.length]].map(([label, value]) => <div key={String(label)} className="bg-vow-bg p-5 min-w-0"><p className="text-[10px] uppercase tracking-wide text-vow-muted">{label}</p><p className="text-2xl text-vow-ink mt-2">{value}</p></div>)}
    </section>

    <div className="grid lg:grid-cols-[1.2fr_1fr] gap-10 lg:gap-14 min-w-0">
      <section className="min-w-0">
        <div className="flex items-end justify-between mb-4 gap-3"><div><h2 className="vow-label">Today</h2><p className="text-xs text-vow-muted mt-1">What needs your attention today.</p></div><button onClick={() => onNavigate('calendar')} className="min-h-11 px-2 text-xs text-vow-muted hover:text-vow-ink shrink-0">Calendar →</button></div>
        {todaySessions.length === 0 ? <div className="border border-vow-border p-8"><p className="text-sm text-vow-ink">Nothing scheduled today.</p><p className="text-xs text-vow-muted mt-1">Your calendar is clear.</p></div> : <div className="border border-vow-border divide-y divide-vow-border">{todaySessions.map((s) => { const goal = goals.find((g) => g.id === s.goal_id); const complete = s.status === 'completed'; return <button key={s.id} onClick={() => openGoal(onNavigate, session!.user.id, s.goal_id)} className="w-full min-h-20 text-left p-4 flex items-center gap-4 hover:bg-vow-surface/40 transition-colors"><span className={`w-7 h-7 border flex items-center justify-center shrink-0 text-xs ${complete ? 'border-vow-ink' : 'border-vow-border'}`} aria-hidden="true">{complete ? '✓' : '·'}</span><div className="min-w-0 flex-1"><p className={`text-sm text-vow-ink break-words ${complete ? 'line-through opacity-60' : ''}`}>{shortText(s.title)}</p><p className="text-xs text-vow-muted mt-1 truncate">{goal ? shortText(goal.outcome, 42) : 'Goal'}</p></div><div className="text-right shrink-0"><p className="text-xs text-vow-ink">{formatTime(s.scheduled_at)}</p><p className="text-[10px] text-vow-muted mt-1">{s.duration_minutes} min</p></div></button>; })}</div>}
      </section>

      <section className="min-w-0">
        <div className="flex items-end justify-between mb-4 gap-3"><div><h2 className="vow-label">Goals</h2><p className="text-xs text-vow-muted mt-1">Your active commitments.</p></div><button onClick={() => onNavigate('goals')} className="min-h-11 px-2 text-xs text-vow-muted shrink-0">All goals →</button></div>
        {activeGoals.length === 0 ? <div className="border border-vow-border p-8"><p className="text-sm text-vow-ink mb-1">No active goals yet.</p><button onClick={() => onNavigate('goals')} className="min-h-11 text-sm text-vow-ink underline underline-offset-2">Create your first goal</button></div> : <div className="border-t border-vow-border">{activeGoals.slice(0, 5).map((g) => { const goalSessions = sessions.filter((s) => s.goal_id === g.id && new Date(s.scheduled_at) <= now); const completed = goalSessions.filter((s) => s.status === 'completed').length; const total = goalSessions.length; const pct = total ? Math.round((completed / total) * 100) : 0; return <button key={g.id} onClick={() => openGoal(onNavigate, session!.user.id, g.id)} className="w-full min-h-20 text-left border-b border-vow-border py-4 group"><div className="flex items-center justify-between mb-2 gap-3"><div className="text-sm text-vow-ink break-words min-w-0 group-hover:opacity-70">{shortText(g.outcome)}</div><div className="text-xs text-vow-muted shrink-0">{total ? `${pct}%` : 'Not started'}</div></div><div className="h-px bg-vow-border relative"><div className="absolute inset-y-0 left-0 bg-vow-ink" style={{ width: `${pct}%` }} /></div><div className="text-xs text-vow-muted mt-1.5 break-words">{g.weekly_commitment_target} sessions/week · {completed} completed</div></button>; })}</div>}
      </section>
    </div>

    <section className="mt-10 pt-8 border-t border-vow-border"><div className="flex items-end justify-between mb-4 gap-3"><div><h2 className="vow-label">Up next</h2><p className="text-xs text-vow-muted mt-1">The next commitments on your calendar.</p></div><button onClick={() => onNavigate('review')} className="min-h-11 px-2 text-xs text-vow-muted hover:text-vow-ink shrink-0">Weekly review →</button></div>{upcoming.length === 0 ? <div className="border border-vow-border p-6"><p className="text-sm text-vow-muted">Nothing else is scheduled.</p></div> : <div className="border-t border-vow-border">{upcoming.map((s) => { const goal = goals.find((g) => g.id === s.goal_id); return <button key={s.id} onClick={() => openGoal(onNavigate, session!.user.id, s.goal_id)} className="w-full min-h-16 text-left border-b border-vow-border py-4 flex items-center gap-4 hover:bg-vow-surface/30 transition-colors"><div className="w-24 shrink-0"><p className="text-xs text-vow-ink">{formatRelative(s.scheduled_at)}</p><p className="text-[10px] text-vow-muted mt-1">{formatTime(s.scheduled_at)}</p></div><div className="min-w-0 flex-1"><p className="text-sm text-vow-ink break-words">{shortText(s.title)}</p><p className="text-xs text-vow-muted break-words mt-1">{goal ? shortText(goal.outcome, 42) : 'Goal'}</p></div><span className="min-w-11 min-h-11 flex items-center justify-center text-xs text-vow-muted" aria-hidden="true">→</span></button>; })}</div>}</section>
    <WeekManagement />
  </div>;
}
