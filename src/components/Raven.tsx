import { useCallback, useEffect, useMemo, useState } from 'react';
import { Award, ArrowUpRight, ArrowDownRight, Minus, Flame } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Goal, Session } from '@/types/database';
import { calculateRavenSnapshot, getRavenAwards, goalProgress, type RavenAward, type RavenSnapshot } from '@/lib/raven';

function currentWeekStart() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  return date.toISOString().slice(0, 10);
}

export function RavenReviewSection() {
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
        supabase.from('raven_weekly_snapshots').select('*').eq('user_id', session.user.id).order('week_start', { ascending: false }).limit(8),
      ]);
      if (sessionsRes.error) throw sessionsRes.error;
      if (goalsRes.error) throw goalsRes.error;
      if (awardsRes.error) throw awardsRes.error;
      if (snapshotRes.error) throw snapshotRes.error;

      const allSessions = (sessionsRes.data || []) as Session[];
      const allGoals = (goalsRes.data || []) as Goal[];
      const storedAwards = (awardsRes.data || []) as RavenAward[];
      const storedSnapshots = (snapshotRes.data || []) as Array<{ week_start: string; snapshot: RavenSnapshot }>;
      const weekStart = currentWeekStart();
      const previousStored = storedSnapshots.find((row) => row.week_start < weekStart)?.snapshot || null;
      const next = calculateRavenSnapshot(allSessions, previousStored);
      const earned = getRavenAwards(next, storedAwards);

      if (earned.length) {
        const { error: awardError } = await supabase.from('raven_awards').upsert(
          earned.map((award) => ({ user_id: session.user.id, award_key: award.key, title: award.title, description: award.description, earned_at: award.earned_at })),
          { onConflict: 'user_id,award_key', ignoreDuplicates: true },
        );
        if (awardError) throw awardError;
      }

      const currentWeek = next.recent_weeks.find((week) => week.week_start === weekStart) || next.recent_weeks[next.recent_weeks.length - 1];
      if (currentWeek) {
        const { error: snapshotError } = await supabase.from('raven_weekly_snapshots').upsert(
          { user_id: session.user.id, week_start: currentWeek.week_start, week_end: currentWeek.week_end, score: next.score, completion_pct: currentWeek.completion_pct, snapshot: next },
          { onConflict: 'user_id,week_start' },
        );
        if (snapshotError) throw snapshotError;
      }

      setSnapshot(next);
      setAwards([...earned, ...storedAwards]);
      setGoals(allGoals);
      setSessions(allSessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Progress construct could not load.');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { load(); }, [load]);
  const progress = useMemo(() => snapshot ? goalProgress(sessions, goals) : [], [snapshot, sessions, goals]);

  if (loading) return <section className="border-t border-vow-border pt-8"><p className="vow-label mb-3">Turtle score</p><p className="text-sm text-vow-muted">Reading your progress...</p></section>;
  if (error) return <section className="border-t border-vow-border pt-8"><p className="vow-label mb-3">Turtle score</p><p className="text-sm text-vow-muted">{error}</p></section>;
  if (!snapshot) return null;

  const TrendIcon = snapshot.trend === 'up' ? ArrowUpRight : snapshot.trend === 'down' ? ArrowDownRight : Minus;
  const trendText = snapshot.trend === 'new' ? 'New baseline' : snapshot.trend === 'up' ? `Up ${snapshot.score_delta} points` : snapshot.trend === 'down' ? `Down ${Math.abs(snapshot.score_delta || 0)} points` : 'Holding steady';
  const visibleSignals = snapshot.signals.slice(0, 2);
  const visibleAwards = awards.slice(0, 4);

  return <section className="border-t border-vow-border pt-8">
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 mb-5">
      <div className="min-w-0">
        <p className="vow-label mb-2">Turtle score</p>
        <div className="flex items-end gap-3"><span className="vow-heading text-4xl text-vow-ink">{snapshot.score}</span><span className="text-sm text-vow-muted mb-1.5">/ 100</span></div>
        <p className="text-xs text-vow-muted mt-1">Slowly but surely, with VOW 🐢🤍</p>
        <div className="flex items-center gap-1 mt-2 text-xs text-vow-muted"><TrendIcon className="w-3.5 h-3.5" />{trendText}</div>
      </div>
      <div className="sm:text-right shrink-0"><p className="vow-label mb-2">Current streak</p><div className="flex items-center sm:justify-end gap-2"><Flame className="w-4 h-4" /><span className="vow-heading text-2xl text-vow-ink">{snapshot.current_streak}</span><span className="text-xs text-vow-muted">days</span></div><p className="text-xs text-vow-muted mt-1">Best: {snapshot.best_streak} days</p></div>
    </div>
    <div className="h-1 bg-vow-border overflow-hidden mb-5"><div className="h-full bg-vow-ink transition-all duration-700" style={{ width: `${snapshot.score}%` }} /></div>
    {snapshot.trend === 'down' && <div className="border-l-2 border-vow-ink pl-3 mb-5"><p className="text-sm text-vow-ink font-medium">Your score went down. What’s happening, bro?</p><p className="text-xs text-vow-muted mt-1">The change is a signal to understand, not a reason to beat yourself up.</p></div>}
    {snapshot.trend === 'up' && <div className="border-l-2 border-vow-ink pl-3 mb-5"><p className="text-sm text-vow-ink font-medium">Your consistency is moving up.</p><p className="text-xs text-vow-muted mt-1">Keep doing the work. The pattern is improving.</p></div>}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-vow-border border border-vow-border mb-6"><Metric label="Completion" value={`${snapshot.completion_pct}%`} /><Metric label="Completed" value={snapshot.total_completed} /><Metric label="Best week" value={`${snapshot.best_weekly_completion_pct}%`} /><Metric label="Weeks tracked" value={snapshot.weeks_observed} /></div>
    {visibleSignals.length > 0 && <div className="mb-6"><p className="vow-label mb-3">What we noticed</p><div className="grid md:grid-cols-2 gap-3">{visibleSignals.map((signal) => <div key={signal} className="border border-vow-border p-3 text-sm text-vow-ink break-words">{signal}</div>)}</div></div>}
    {progress.filter((x) => x.total > 0).length > 0 && <div className="mb-6"><p className="vow-label mb-3">Goal progress</p><div className="border border-vow-border divide-y divide-vow-border">{progress.filter((x) => x.total > 0).map(({ goal, completed, total, pct }) => <div key={goal.id} className="p-3 min-w-0"><div className="flex items-center justify-between gap-3 mb-1.5"><p className="text-sm text-vow-ink truncate min-w-0">{goal.outcome}</p><p className="text-xs text-vow-muted shrink-0">{completed}/{total} · {pct}%</p></div><div className="h-1 bg-vow-border"><div className="h-full bg-vow-ink" style={{ width: `${pct}%` }} /></div></div>)}</div></div>}
    <div className="grid grid-cols-2 gap-px bg-vow-border border border-vow-border mb-6"><Metric label="Longest streak" value={`${snapshot.best_streak} days`} /><Metric label="Best week" value={snapshot.weekly_completed_best} /></div>
    {visibleAwards.length > 0 && <div><div className="flex items-center gap-2 mb-3"><Award className="w-4 h-4" /><p className="vow-label">Awards</p></div><div className="grid md:grid-cols-2 gap-3">{visibleAwards.map((award) => <div key={`${award.key}-${award.earned_at}`} className="border border-vow-border p-3 flex items-start gap-3 min-w-0"><div className="w-7 h-7 border border-vow-border flex items-center justify-center shrink-0"><Award className="w-3.5 h-3.5" /></div><div className="min-w-0"><p className="text-sm text-vow-ink font-medium truncate">{award.title}</p><p className="text-xs text-vow-muted mt-0.5 break-words">{award.description}</p></div></div>)}</div></div>}
  </section>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="bg-vow-bg p-4 min-w-0"><p className="vow-label mb-1 truncate">{label}</p><p className="text-lg text-vow-ink font-medium truncate">{value}</p></div>;
}
