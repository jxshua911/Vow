import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Goal, Session } from '@/types/database';
import { calculateRavenSnapshot, getRavenAwards, goalProgress, type RavenAward, type RavenSnapshot } from '@/lib/raven';
import { PageHeader } from './AppShell';

export function RavenPage() {
  const { session } = useAuth();
  const [snapshot, setSnapshot] = useState<RavenSnapshot | null>(null);
  const [awards, setAwards] = useState<RavenAward[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError('');
    try {
      const [sessionsRes, goalsRes, awardsRes, snapshotRes] = await Promise.all([
        supabase.from('sessions').select('*').eq('user_id', session.user.id).order('scheduled_at', { ascending: true }),
        supabase.from('goals').select('*').eq('user_id', session.user.id).in('status', ['active', 'locked', 'completed', 'abandoned']),
        supabase.from('raven_awards').select('*').eq('user_id', session.user.id).order('earned_at', { ascending: false }),
        supabase.from('raven_weekly_snapshots').select('*').eq('user_id', session.user.id).order('week_start', { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (sessionsRes.error) throw sessionsRes.error;
      if (goalsRes.error) throw goalsRes.error;
      const allSessions = (sessionsRes.data || []) as Session[];
      const allGoals = (goalsRes.data || []) as Goal[];
      const storedAwards = (awardsRes.data || []) as RavenAward[];
      const previous = snapshotRes.data?.snapshot as RavenSnapshot | null;
      const next = calculateRavenSnapshot(allSessions, previous);
      const earned = getRavenAwards(next, storedAwards);

      if (earned.length) {
        const { error: awardError } = await supabase.from('raven_awards').insert(earned.map((award) => ({ user_id: session.user.id, award_key: award.key, title: award.title, description: award.description, earned_at: award.earned_at })));
        // Unique-constraint violations mean the award was already stored — that's success, not failure.
        if (awardError && awardError.code !== '23505' && !/duplicate|unique/i.test(awardError.message)) throw awardError;
      }

      const currentWeek = next.recent_weeks[next.recent_weeks.length - 1];
      if (currentWeek) {
        const { error: snapshotError } = await supabase.from('raven_weekly_snapshots').upsert({ user_id: session.user.id, week_start: currentWeek.week_start, week_end: currentWeek.week_end, score: next.score, completion_pct: currentWeek.completion_pct, snapshot: next }, { onConflict: 'user_id,week_start' });
        if (snapshotError) throw snapshotError;
      }

      const storedKeys = new Set(storedAwards.map((award) => award.key));
      const newAwards = earned.filter((award) => !storedKeys.has(award.key));
      setSnapshot(next);
      setAwards([...newAwards, ...storedAwards]);
      setGoals(allGoals);
      setSessions(allSessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Raven could not load your progress.');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { load(); }, [load]);

  const progress = useMemo(() => snapshot ? goalProgress(sessions, goals).filter((x) => x.total > 0) : [], [snapshot, sessions, goals]);

  if (loading) return <div><PageHeader title="Raven" subtitle="Your progress, as it actually happened." /><div className="text-sm text-vow-muted">Raven is reading your progress...</div></div>;
  if (!snapshot) return <div><PageHeader title="Raven" subtitle="Your progress, as it actually happened." /><div className="border border-vow-border p-12 text-center"><p className="vow-heading text-xl text-vow-ink mb-2">Nothing to measure yet.</p><p className="text-sm text-vow-muted">Complete your first tracked session and Raven will start learning your pattern.</p></div></div>;

  const trendSymbol = snapshot.trend === 'up' ? '↗' : snapshot.trend === 'down' ? '↘' : '—';
  const trendText = snapshot.trend === 'new' ? 'New baseline' : snapshot.trend === 'up' ? `Up ${snapshot.score_delta} points` : snapshot.trend === 'down' ? `Down ${Math.abs(snapshot.score_delta || 0)} points` : 'Holding steady';

  return <div>
    <PageHeader title="Raven" subtitle="Your progress, as it actually happened." action={<button onClick={load} className="text-xs text-vow-muted hover:text-vow-ink">Refresh</button>} />

    {error && <div className="border-l-2 border-vow-ink pl-3 mb-8"><p className="text-xs text-vow-muted">{error}</p></div>}

    <section className="border border-vow-border p-6 mb-8">
      <div className="flex items-start justify-between gap-6">
        <div><p className="vow-label mb-2">Raven score</p><div className="flex items-end gap-3"><span className="vow-heading text-5xl text-vow-ink">{snapshot.score}</span><span className="text-sm text-vow-muted mb-2">/ 100</span></div><div className="flex items-center gap-1 mt-3 text-xs text-vow-muted"><span aria-hidden="true">{trendSymbol}</span>{trendText}</div></div>
        <div className="text-right"><p className="vow-label mb-2">Current streak</p><div className="flex items-center justify-end gap-2"><span aria-hidden="true">♨</span><span className="vow-heading text-3xl text-vow-ink">{snapshot.current_streak}</span><span className="text-xs text-vow-muted">days</span></div><p className="text-xs text-vow-muted mt-2">Best: {snapshot.best_streak} days</p></div>
      </div>
      <div className="mt-6 h-1 bg-vow-border overflow-hidden"><div className="h-full bg-vow-ink transition-all duration-700" style={{ width: `${snapshot.score}%` }} /></div>
      {snapshot.trend === 'down' && <div className="mt-5 border-t border-vow-border pt-5"><p className="text-sm text-vow-ink font-medium">Your score went down. What’s happening, bro?</p><p className="text-xs text-vow-muted mt-1">Raven noticed the change. It’s a signal to understand, not a reason to beat yourself up.</p></div>}
      {snapshot.trend === 'up' && <div className="mt-5 border-t border-vow-border pt-5"><p className="text-sm text-vow-ink font-medium">Your consistency is moving up.</p><p className="text-xs text-vow-muted mt-1">Keep doing the work. Raven is tracking the pattern.</p></div>}
    </section>

    <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-vow-border border border-vow-border mb-10">
      <Metric label="Completion" value={`${snapshot.completion_pct}%`} />
      <Metric label="Completed" value={snapshot.total_completed} />
      <Metric label="Best week" value={`${snapshot.best_weekly_completion_pct}%`} />
      <Metric label="Weeks tracked" value={snapshot.weeks_observed} />
    </div>

    {snapshot.signals.length > 0 && <section className="border-t border-vow-border pt-8 mb-10"><p className="vow-label mb-4">What Raven noticed</p><div className="space-y-3">{snapshot.signals.map((signal) => <div key={signal} className="text-sm text-vow-ink border-l border-vow-border pl-3">{signal}</div>)}</div></section>}

    {progress.length > 0 && <section className="border-t border-vow-border pt-8 mb-10"><p className="vow-label mb-4">Goal progress</p><div className="space-y-5">{progress.map(({ goal, completed, total, pct }) => <div key={goal.id}><div className="flex items-center justify-between gap-4 mb-2"><p className="text-sm text-vow-ink truncate">{goal.outcome}</p><p className="text-xs text-vow-muted shrink-0">{completed}/{total} · {pct}%</p></div><div className="h-1 bg-vow-border"><div className="h-full bg-vow-ink" style={{ width: `${pct}%` }} /></div></div>)}</div></section>}

    <section className="border-t border-vow-border pt-8 mb-10"><div className="flex items-center gap-2 mb-4"><span aria-hidden="true">◆</span><p className="vow-label">Personal bests</p></div><div className="grid grid-cols-2 gap-px bg-vow-border border border-vow-border"><Metric label="Longest streak" value={`${snapshot.best_streak} days`} /><Metric label="Best weekly completion" value={`${snapshot.best_weekly_completion_pct}%`} /><Metric label="Most completed in a week" value={snapshot.weekly_completed_best} /><Metric label="Total completed" value={snapshot.total_completed} /></div></section>

    {awards.length > 0 && <section className="border-t border-vow-border pt-8"><div className="flex items-center gap-2 mb-4"><span aria-hidden="true">★</span><p className="vow-label">Awards</p></div><div className="border-t border-vow-border">{awards.slice(0, 12).map((award, awardIndex) => <div key={`${award.key}-${awardIndex}`} className="border-b border-vow-border py-4 flex items-center gap-4"><div className="w-8 h-8 border border-vow-border flex items-center justify-center shrink-0">★</div><div><p className="text-sm text-vow-ink font-medium">{award.title}</p><p className="text-xs text-vow-muted mt-1">{award.description}</p></div></div>)}</div></section>}
  </div>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="bg-vow-bg p-4"><p className="vow-label mb-1">{label}</p><p className="text-lg text-vow-ink font-medium">{value}</p></div>;
}
