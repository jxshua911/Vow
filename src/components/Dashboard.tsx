import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Goal, Session } from '@/types/database';
import { isThisWeek, formatTime, formatRelative, dayName } from '@/lib/dates';
import { PageHeader } from './AppShell';
import { readCache, writeCache } from '@/lib/cache';
import type { View } from './AppShell';

interface DashboardProps { onNavigate: (view: View) => void; }

export function Dashboard({ onNavigate }: DashboardProps) {
  const { session, displayName } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session) return;
    const userId = session.user.id;
    const [goalCache, sessionCache] = await Promise.all([
      readCache<Goal[]>(`dashboard:goals:${userId}`, userId),
      readCache<Session[]>(`dashboard:sessions:${userId}`, userId),
    ]);
    if (goalCache?.value) setGoals(goalCache.value);
    if (sessionCache?.value) setSessions(sessionCache.value);
    if (goalCache?.value || sessionCache?.value) setLoading(false);

    const [goalsRes, sessionsRes] = await Promise.all([
      supabase.from('goals').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('sessions').select('*').eq('user_id', userId).order('scheduled_at', { ascending: true }),
    ]);
    if (goalsRes.data) {
      setGoals(goalsRes.data);
      void writeCache(`dashboard:goals:${userId}`, userId, goalsRes.data);
    }
    if (sessionsRes.data) {
      setSessions(sessionsRes.data);
      void writeCache(`dashboard:sessions:${userId}`, userId, sessionsRes.data);
    }
    setLoading(false);
  }, [session]);

  useEffect(() => { load(); }, [load]);
  const activeGoals = goals.filter((g) => g.status === 'active' || g.status === 'locked');
  const thisWeekSessions = sessions.filter((s) => isThisWeek(s.scheduled_at));
  const completedThisWeek = thisWeekSessions.filter((s) => s.status === 'completed');
  const completionPct = thisWeekSessions.length > 0 ? Math.round((completedThisWeek.length / thisWeekSessions.length) * 100) : 0;
  const completedDayKeys = new Set(sessions.filter((s) => s.status === 'completed').map((s) => new Date(s.scheduled_at).toDateString()));
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const day = new Date();
    day.setDate(day.getDate() - i);
    if (completedDayKeys.has(day.toDateString())) streak++;
    else if (i > 0 || !completedDayKeys.has(day.toDateString())) {
      // today may have no completed session yet without breaking the streak
      if (i === 0) continue;
      break;
    }
  }
  const now = new Date();
  const upcoming = sessions.filter((s) => new Date(s.scheduled_at) >= now && s.status === 'scheduled').slice(0, 5);
  if (loading) return <div><PageHeader title={`Welcome back, ${displayName}`} /><div className="text-vow-muted text-sm">Loading...</div></div>;

  return <div>
    <PageHeader title={`Welcome back, ${displayName}`} subtitle={`${dayName(new Date().toISOString())} — ${new Date().toLocaleDateString([], { month: 'long', day: 'numeric' })}`} />
    <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-vow-border mb-10 border border-vow-border"><StatCell label="Active goals" value={activeGoals.length} /><StatCell label="This week" value={`${completedThisWeek.length}/${thisWeekSessions.length}`} /><StatCell label="Completion" value={`${completionPct}%`} /><StatCell label="Streak" value={`${streak}`} subtitle={streak === 0 ? 'Broken — honest count' : undefined} /></div>
    <div className="grid md:grid-cols-2 gap-12">
      <div>
        <h2 className="vow-label mb-4">Upcoming sessions</h2>
        {upcoming.length === 0 ? <div className="border border-vow-border p-8 text-center"><div className="w-7 h-7 mx-auto mb-3 border border-vow-border rounded-full" /><p className="text-vow-muted text-sm mb-3">No sessions scheduled.</p><button onClick={() => onNavigate('goals')} className="text-vow-ink text-sm font-medium border-b border-vow-ink pb-0.5 hover:opacity-70 transition-opacity">Schedule sessions</button></div> : <div className="space-y-px border border-vow-border">{upcoming.map((s) => { const goal = goals.find((g) => g.id === s.goal_id); return <div key={s.id} className="bg-vow-bg px-4 py-3 flex items-center gap-3"><div className="w-2 h-2 rounded-full border border-vow-muted flex-shrink-0" /><div className="flex-1 min-w-0"><div className="text-sm text-vow-ink truncate">{s.title}</div><div className="text-xs text-vow-muted">{goal?.title || ''}</div></div><div className="text-right flex-shrink-0"><div className="text-xs text-vow-ink font-medium">{formatRelative(s.scheduled_at)}</div><div className="text-xs text-vow-muted">{formatTime(s.scheduled_at)}</div></div></div>; })}</div>}
      </div>
      <div>
        <h2 className="vow-label mb-4">Active goals</h2>
        {activeGoals.length === 0 ? <div className="border border-vow-border p-8 text-center"><p className="text-vow-muted text-sm">No active goals yet.</p></div> : <div className="space-y-px border border-vow-border">{activeGoals.map((g) => { const goalSessions = sessions.filter((s) => s.goal_id === g.id); const completed = goalSessions.filter((s) => s.status === 'completed').length; const total = goalSessions.length; const pct = total > 0 ? Math.round((completed / total) * 100) : 0; return <button key={g.id} onClick={() => onNavigate('goals')} className="w-full text-left bg-vow-bg px-4 py-3 hover:opacity-70 transition-opacity"><div className="flex items-center justify-between mb-2"><div className="text-sm text-vow-ink truncate flex-1">{g.outcome}</div><div className="text-xs text-vow-muted ml-2">{pct}%</div></div><div className="h-px bg-vow-border relative"><div className="absolute inset-y-0 left-0 bg-vow-ink transition-all duration-500" style={{ width: `${pct}%`, height: '1px' }} /></div><div className="text-xs text-vow-muted mt-1.5">{g.weekly_commitment_target} sessions/week — {completed}/{total} all-time</div></button>; })}</div>}
      </div>
    </div>
    <div className="mt-8 border-t border-vow-border pt-5"><p className="text-xs text-vow-muted">Your journal remains private and is available within your Goals workspace.</p></div>
  </div>;
}

function StatCell({ label, value, subtitle }: { label: string; value: string | number; subtitle?: string }) { return <div className="bg-vow-bg px-4 py-5"><div className="text-3xl vow-heading text-vow-ink">{value}</div><div className="vow-label mt-1.5">{label}</div>{subtitle && <div className="text-xs text-vow-muted mt-0.5">{subtitle}</div>}</div>; }
