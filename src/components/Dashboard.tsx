import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Goal, Session } from '@/types/database';
import { formatTime, formatRelative, dayName } from '@/lib/dates';
import { PageHeader } from './AppShell';
import type { View } from './AppShell';

interface DashboardProps { onNavigate: (view: View) => void; }

function openGoal(onNavigate: (view: View) => void, userId: string, goalId: string) {
  localStorage.setItem(`vow:open-goal:${userId}`, goalId);
  onNavigate('goals');
}

function shortText(value: string, max = 54) {
  const clean = value.trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { session, displayName } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

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
  const activeGoals = goals.filter((g) => g.status === 'active' || g.status === 'locked');
  const now = new Date();
  const upcoming = sessions.filter((s) => new Date(s.scheduled_at) >= now && s.status === 'scheduled').slice(0, 5);

  if (loading) return <div><PageHeader title={`Welcome back, ${displayName}`} /><div className="text-vow-muted text-sm">Loading...</div></div>;

  return <div className="min-w-0 overflow-hidden">
    <PageHeader title={`Welcome back, ${displayName}`} subtitle={`${dayName(new Date().toISOString())} — ${new Date().toLocaleDateString([], { month: 'long', day: 'numeric' })}`} />
    <div className="grid md:grid-cols-2 gap-8 lg:gap-12 min-w-0">
      <div className="min-w-0">
        <h2 className="vow-label mb-4">Upcoming sessions</h2>
        {upcoming.length === 0 ? <div className="border border-vow-border p-8 text-center"><div className="w-7 h-7 mx-auto mb-3 border border-vow-border rounded-full" /><p className="text-vow-muted text-sm mb-3">No sessions scheduled.</p><button onClick={() => onNavigate('goals')} className="text-vow-ink text-sm font-medium border-b border-vow-ink pb-0.5 hover:opacity-70 transition-opacity">Schedule sessions</button></div> : <div className="space-y-px border border-vow-border overflow-hidden">{upcoming.map((s) => { const goal = goals.find((g) => g.id === s.goal_id); return <button key={s.id} onClick={() => openGoal(onNavigate, session!.user.id, s.goal_id)} className="w-full bg-vow-bg px-4 py-3 flex items-center gap-3 text-left hover:bg-vow-surface/40 transition-colors min-w-0 overflow-hidden"><div className="w-2 h-2 rounded-full border border-vow-muted flex-shrink-0" /><div className="flex-1 min-w-0 overflow-hidden"><div className="text-sm text-vow-ink truncate">{shortText(s.title)}</div><div className="text-xs text-vow-muted truncate">{goal ? shortText(goal.title || goal.outcome, 34) : ''}</div></div><div className="text-right flex-shrink-0"><div className="text-xs text-vow-ink font-medium">{formatRelative(s.scheduled_at)}</div><div className="text-xs text-vow-muted">{formatTime(s.scheduled_at)}</div></div></button>; })}</div>}
      </div>
      <div className="min-w-0">
        <h2 className="vow-label mb-4">Active goals</h2>
        {activeGoals.length === 0 ? <div className="border border-vow-border p-8 text-center"><p className="text-vow-muted text-sm">No active goals yet.</p></div> : <div className="space-y-px border border-vow-border overflow-hidden">{activeGoals.map((g) => { const goalSessions = sessions.filter((s) => s.goal_id === g.id); const completed = goalSessions.filter((s) => s.status === 'completed').length; const total = goalSessions.length; const pct = total > 0 ? Math.round((completed / total) * 100) : 0; return <button key={g.id} onClick={() => openGoal(onNavigate, session!.user.id, g.id)} className="w-full text-left bg-vow-bg px-4 py-3 hover:bg-vow-surface/40 transition-opacity min-w-0 overflow-hidden"><div className="flex items-center justify-between mb-2 gap-3"><div className="text-sm text-vow-ink truncate min-w-0">{shortText(g.outcome || g.title)}</div><div className="text-xs text-vow-muted ml-2 shrink-0">{pct}%</div></div><div className="h-px bg-vow-border relative"><div className="absolute inset-y-0 left-0 bg-vow-ink transition-all duration-500" style={{ width: `${pct}%`, height: '1px' }} /></div><div className="text-xs text-vow-muted mt-1.5 truncate">{g.weekly_commitment_target} sessions/week — {completed}/{total} all-time</div></button>; })}</div>}
      </div>
    </div>
    <div className="mt-8 border-t border-vow-border pt-5"><p className="text-xs text-vow-muted">Your journal remains private and is available within your Goals workspace.</p></div>
  </div>;
}
