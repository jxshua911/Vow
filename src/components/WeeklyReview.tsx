import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Session, Goal, JournalEntry, UserSettings, Review, PatternFinding, ProposedCommitment } from '@/types/database';
import { weekRange, toDateString, formatDate, startOfWeek, endOfWeek, addDays } from '@/lib/dates';
import { allocateSameDaySlot, reserveSlot, toOccupiedSlots } from '@/lib/scheduling';
import { detectPatterns } from '@/lib/patterns';
import { buildCoachingText, biggestWin, biggestSetback } from '@/lib/coaching';
import { PageHeader } from './AppShell';
import { RavenReviewSection } from './Raven';
import { Check, ArrowRight, RotateCcw } from 'lucide-react';

export function ReviewPage() {
  const { session } = useAuth();
  const [review, setReview] = useState<Review | null>(null);
  const [existingReview, setExistingReview] = useState<Review | null>(null);
  const [pastReviews, setPastReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [actionError, setActionError] = useState('');

  const { start, end } = weekRange();

  const load = useCallback(async () => {
    if (!session) return;
    const weekStart = toDateString(start);

    const { data: existing, error: existingError } = await supabase
      .from('reviews')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('week_start', weekStart)
      .maybeSingle();
    if (existingError) throw existingError;
    setExistingReview(existing as Review | null);

    const { data: past, error: pastError } = await supabase
      .from('reviews')
      .select('*')
      .eq('user_id', session.user.id)
      .order('week_start', { ascending: false })
      .limit(10);
    if (pastError) throw pastError;
    setPastReviews((past || []) as Review[]);

    if (existing) setReview(existing as Review);
    setLoading(false);
  }, [session, start]);

  useEffect(() => { load().catch((err) => { console.error('Review load failed:', err); setActionError(err instanceof Error ? err.message : 'Could not load your weekly review.'); setLoading(false); }); }, [load]);

  async function generateReview() {
    if (!session) return;
    setGenerating(true);
    setActionError('');

    try {
      const weekStart = toDateString(start);
      const weekEnd = toDateString(end);

      const [sessionsRes, goalsRes, journalRes, settingsRes] = await Promise.all([
        supabase.from('sessions').select('*').eq('user_id', session.user.id).order('scheduled_at', { ascending: true }),
        supabase.from('goals').select('*').eq('user_id', session.user.id).in('status', ['active', 'locked', 'completed', 'abandoned']),
        supabase.from('journal_entries').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }),
        supabase.from('user_settings').select('*').eq('user_id', session.user.id).maybeSingle(),
      ]);
      if (sessionsRes.error) throw sessionsRes.error;
      if (goalsRes.error) throw goalsRes.error;
      if (journalRes.error) throw journalRes.error;
      if (settingsRes.error) throw settingsRes.error;

      const allSessions = (sessionsRes.data || []) as Session[];
      const goals = (goalsRes.data || []) as Goal[];
      const journal = (journalRes.data || []) as JournalEntry[];
      const settings = (settingsRes.data || null) as UserSettings | null;

      const weekSessions = allSessions.filter((s) => {
        const d = new Date(s.scheduled_at);
        return d >= start && d <= end;
      });

      const committed = weekSessions.length;
      const completed = weekSessions.filter((s) => s.status === 'completed').length;
      const missed = weekSessions.filter((s) => s.status === 'skipped').length;
      const moved = weekSessions.filter((s) => s.status === 'moved').length;
      const completionPct = committed > 0 ? Math.round((completed / committed) * 100) : 0;

      const patterns = detectPatterns(allSessions, journal);
      const win = biggestWin(weekSessions);
      const setback = biggestSetback(weekSessions);

      const primaryGoal = goals.find((g) => g.status === 'active') || goals[0];
      const whyItMatters = primaryGoal?.why_it_matters || null;
      const coachingText = buildCoachingText(weekSessions, patterns, settings, whyItMatters);

      const recommendations = patterns.map((p) => ({
        title: p.description,
        description: p.proposed_adjustment,
        category: p.type === 'overload' ? 'load' as const : p.type === 'milestone_calibration' ? 'milestone' as const : 'schedule' as const,
      }));

      const activeGoals = goals.filter((g) => g.status === 'active' || g.status === 'locked');
      const proposedCommitments: ProposedCommitment[] = activeGoals.map((g) => {
        const goalSessions = allSessions.filter((s) => s.goal_id === g.id);
        const goalCompleted = goalSessions.filter((s) => s.status === 'completed').length;
        const goalTotal = goalSessions.length;
        const goalPct = goalTotal > 0 ? goalCompleted / goalTotal : 1;
        let proposed = g.weekly_commitment_target;
        let notes = '';
        if (goalPct < 0.5 && goalTotal >= 3) {
          proposed = Math.max(1, Math.floor(g.weekly_commitment_target * 0.7));
          notes = `Reduced from ${g.weekly_commitment_target} based on recent completion rate. The plan may be too ambitious right now.`;
        } else if (goalPct >= 0.8) {
          notes = `You are hitting this consistently. Consider maintaining or slightly increasing.`;
        }
        return { goal_id: g.id, goal_title: g.outcome, sessions_per_week: proposed, notes };
      });

      const reviewData = {
        user_id: session.user.id,
        week_start: weekStart,
        week_end: weekEnd,
        completion_pct: completionPct,
        committed_count: committed,
        completed_count: completed,
        missed_count: missed,
        moved_count: moved,
        biggest_win: win,
        biggest_setback: setback,
        patterns: patterns as unknown as Record<string, unknown>[],
        recommendations: recommendations as unknown as Record<string, unknown>[],
        coaching_text: coachingText,
        proposed_commitments: proposedCommitments as unknown as Record<string, unknown>[],
        status: 'draft' as const,
      };

      const { data, error } = await supabase.from('reviews').insert(reviewData).select().maybeSingle();
      if (error) throw error;
      if (data) {
        setReview(data as Review);
        setExistingReview(data as Review);
      }
    } catch (err) {
      console.error('Review generation failed:', err);
      setActionError(err instanceof Error ? err.message : 'Could not generate your weekly review.');
    } finally {
      setGenerating(false);
    }
  }

  async function confirmReview() {
    if (!review || !session) return;
    setConfirming(true);
    setActionError('');

    try {
      const { error: reviewError } = await supabase.from('reviews').update({ status: 'confirmed', confirmed_at: new Date().toISOString() }).eq('id', review.id).eq('user_id', session.user.id);
      if (reviewError) throw reviewError;
      const nextWeekStart = toDateString(addDays(startOfWeek(), 7));
      const nextWeekEnd = toDateString(addDays(endOfWeek(), 7));

      const proposed = review.proposed_commitments as unknown as ProposedCommitment[];
      for (const commitment of proposed) {
        const { error } = await supabase.from('commitment_log').insert({
          user_id: session.user.id,
          week_start: nextWeekStart,
          week_end: nextWeekEnd,
          goal_id: commitment.goal_id,
          committed_sessions: commitment.sessions_per_week,
          completed_sessions: 0,
          skipped_sessions: 0,
          moved_sessions: 0,
          snapshot: { notes: commitment.notes, goal_title: commitment.goal_title },
        });
        if (error) throw error;
      }

      const { data: existingSessions, error: existingError } = await supabase
        .from('sessions')
        .select('scheduled_at,duration_minutes')
        .eq('user_id', session.user.id)
        .eq('status', 'scheduled');
      if (existingError) throw existingError;

      const occupied = toOccupiedSlots((existingSessions || []).map((row) => ({
        scheduledAt: row.scheduled_at,
        durationMinutes: row.duration_minutes,
      })));

      for (const commitment of proposed) {
        for (let i = 0; i < commitment.sessions_per_week; i++) {
          const sessionDate = addDays(new Date(nextWeekStart), i + 1);
          sessionDate.setHours(9, 0, 0, 0);
          const slot = allocateSameDaySlot(sessionDate, 45, occupied);
          if (!slot) throw new Error(`No available time remains for ${commitment.goal_title}. Choose another day before confirming.`);

          const { error } = await supabase.from('sessions').insert({
            goal_id: commitment.goal_id,
            user_id: session.user.id,
            title: commitment.goal_title,
            scheduled_at: slot.date.toISOString(),
            duration_minutes: slot.durationMinutes,
            status: 'scheduled',
          });
          if (error) throw error;
          reserveSlot(slot, occupied);
        }
      }
      await load();
    } catch (err) {
      console.error('Confirm failed:', err);
      setActionError(err instanceof Error ? err.message : 'Could not lock in next week.');
    } finally {
      setConfirming(false);
    }
  }

  if (loading) return <div className="min-w-0 overflow-hidden"><PageHeader title="Weekly Review" /><div className="text-vow-muted text-sm">Loading...</div></div>;
  if (review && review.status === 'confirmed') return <ConfirmedReviewView review={review} pastReviews={pastReviews} />;

  if (!review && !existingReview) {
    return (
      <div className="min-w-0 overflow-hidden">
        <PageHeader title="Weekly Review" subtitle={`${formatDate(toDateString(start))} — ${formatDate(toDateString(end))}`} />
        <div className="border-t border-vow-border pt-12 text-center">
          <p className="vow-heading text-2xl text-vow-ink mb-3">No review generated yet</p>
          <p className="text-vow-muted text-sm mb-8 max-w-md mx-auto leading-relaxed break-words">Generate your weekly accountability review. It reads your sessions, journal, and commitment history to give you honest, evidence-based feedback and propose next week's commitments.</p>
          {actionError && <p className="text-sm text-vow-ink border-l-2 border-vow-ink pl-3 max-w-md mx-auto mb-6 text-left break-words">{actionError}</p>}
          <button onClick={generateReview} disabled={generating} className="vow-btn-primary">{generating ? 'Analyzing your week...' : 'Generate weekly review'}</button>
        </div>
        {pastReviews.length > 1 && <PastReviewsList reviews={pastReviews.slice(1)} />}
      </div>
    );
  }

  return (
    <div className="min-w-0 overflow-hidden">
      <PageHeader title="Weekly Review" subtitle={`${formatDate(toDateString(start))} — ${formatDate(toDateString(end))}`} />
      <RavenReviewSection review={review!} />
      <ReviewContent review={review!} />
      <div className="border-t border-vow-border pt-8 mt-10">
        <h3 className="vow-label mb-4">Confirm next week's commitments</h3>
        <div className="space-y-px border border-vow-border mb-6">
          {(review!.proposed_commitments as unknown as ProposedCommitment[]).map((c, i) => (
            <div key={i} className="bg-vow-bg px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1"><div className="text-sm text-vow-ink truncate">{c.goal_title}</div>{c.notes && <div className="text-xs text-vow-muted mt-0.5 break-words">{c.notes}</div>}</div>
              <div className="text-sm text-vow-ink font-medium flex-shrink-0">{c.sessions_per_week}x/week</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-vow-muted mb-6 leading-relaxed max-w-lg break-words">Confirming locks these commitments into your immutable commitment log and schedules next week's sessions. You can adjust before confirming.</p>
        {actionError && <p className="text-sm text-vow-ink border-l-2 border-vow-ink pl-3 mb-6 break-words">{actionError}</p>}
        <div className="flex gap-3">
          <button onClick={generateReview} disabled={generating} className="vow-btn-ghost"><RotateCcw className="w-4 h-4" />Regenerate</button>
          <button onClick={confirmReview} disabled={confirming} className="vow-btn-primary flex-1"><Check className="w-4 h-4" />{confirming ? 'Locking in...' : 'Lock in next week'}</button>
        </div>
      </div>
    </div>
  );
}

function ReviewContent({ review }: { review: Review }) {
  const patterns = (review.patterns || []) as unknown as PatternFinding[];
  return (
    <div className="space-y-10 min-w-0">
      <div className="border-t border-vow-border pt-8"><p className="vow-label mb-4">Your coach</p><div className="text-sm text-vow-ink whitespace-pre-wrap leading-relaxed break-words">{review.coaching_text}</div></div>
      {patterns.length > 0 && <div className="border-t border-vow-border pt-8"><p className="vow-label mb-4">Patterns detected ({patterns.length})</p><div className="space-y-6">{patterns.map((p, i) => <div key={i} className="border-b border-vow-border pb-6 last:border-0 min-w-0"><p className="text-xs text-vow-muted uppercase tracking-wide mb-2">{p.type.replace(/_/g, ' ')}</p><p className="text-sm text-vow-ink font-medium mb-3 break-words">{p.description}</p>{p.evidence.length > 0 && <div className="mb-3"><p className="text-xs text-vow-muted mb-1">Evidence</p><ul className="space-y-1">{p.evidence.map((e, j) => <li key={j} className="text-xs text-vow-muted pl-3 border-l border-vow-border break-words">{e}</li>)}</ul></div>}{p.hypothesis && <p className="text-xs text-vow-ink mb-2 break-words"><span className="text-vow-muted">Hypothesis: </span>{p.hypothesis}</p>}{p.proposed_adjustment && <p className="text-xs text-vow-ink break-words"><span className="text-vow-muted">Suggestion: </span>{p.proposed_adjustment}</p>}</div>)}</div></div>}
    </div>
  );
}

function ConfirmedReviewView({ review, pastReviews }: { review: Review; pastReviews: Review[] }) {
  return <div className="min-w-0 overflow-hidden"><PageHeader title="Weekly Review" subtitle={`${formatDate(review.week_start)} — ${formatDate(review.week_end)}`} /><div className="border-l-2 border-vow-success pl-4 mb-10"><p className="text-sm text-vow-ink font-medium">Review confirmed</p><p className="text-xs text-vow-muted mt-0.5 break-words">Next week's commitments are locked in and sessions are scheduled.</p></div><RavenReviewSection review={review} /><ReviewContent review={review} />{pastReviews.length > 1 && <PastReviewsList reviews={pastReviews.slice(1)} />}</div>;
}

function PastReviewsList({ reviews }: { reviews: Review[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  if (reviews.length === 0) return null;
  return <div className="border-t border-vow-border pt-8 mt-10 min-w-0"><h3 className="vow-label mb-4">Past reviews</h3><div className="border-t border-vow-border">{reviews.map((r) => <div key={r.id} className="border-b border-vow-border"><button onClick={() => setExpanded(expanded === r.id ? null : r.id)} className="w-full flex items-center justify-between py-4 text-left hover:opacity-70 transition-opacity"><div className="min-w-0"><div className="text-sm text-vow-ink break-words">{formatDate(r.week_start)} — {formatDate(r.week_end)}</div><div className="text-xs text-vow-muted mt-0.5 break-words">{r.completed_count}/{r.committed_count} sessions — {Math.round(r.completion_pct)}% — {r.status}</div></div><ArrowRight className={`w-4 h-4 text-vow-muted transition-transform shrink-0 ml-3 ${expanded === r.id ? 'rotate-90' : ''}`} /></button>{expanded === r.id && <div className="pb-8"><ReviewContent review={r} /></div>}</div>)}</div></div>;
}
