import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Session, Goal, JournalEntry, UserSettings, Review, PatternFinding, ProposedCommitment } from '@/types/database';
import { weekRange, toDateString, formatDate, startOfWeek, endOfWeek, addDays } from '@/lib/dates';
import { allocateSameDaySlot, reserveSlot, toOccupiedSlots } from '@/lib/scheduling';
import { detectPatterns } from '@/lib/patterns';
import { buildCoachingText, biggestWin, biggestSetback } from '@/lib/coaching';
import { PageHeader } from './AppShell';

type GoalSchedule = { available_days?: string[]; preferred_times_by_day?: Record<string, string> };

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
    const [existingRes, pastRes] = await Promise.all([
      supabase.from('reviews').select('*').eq('user_id', session.user.id).eq('week_start', weekStart).maybeSingle(),
      supabase.from('reviews').select('*').eq('user_id', session.user.id).order('week_start', { ascending: false }).limit(10),
    ]);
    if (existingRes.error) throw existingRes.error;
    if (pastRes.error) throw pastRes.error;
    setExistingReview(existingRes.data as Review | null);
    setPastReviews((pastRes.data || []) as Review[]);
    setReview(existingRes.data as Review | null);
    setLoading(false);
  }, [session, start]);

  useEffect(() => { load().catch((err) => { console.error('Review load failed:', err); setActionError(err instanceof Error ? err.message : 'Could not load your weekly review.'); setLoading(false); }); }, [load]);

  async function generateReview() {
    if (!session) return;
    setGenerating(true); setActionError('');
    try {
      const weekStart = toDateString(start); const weekEnd = toDateString(end);
      const [sessionsRes, goalsRes, journalRes, settingsRes] = await Promise.all([
        supabase.from('sessions').select('*').eq('user_id', session.user.id).order('scheduled_at', { ascending: true }),
        supabase.from('goals').select('*').eq('user_id', session.user.id).in('status', ['active', 'locked', 'completed', 'abandoned']),
        supabase.from('journal_entries').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }),
        supabase.from('user_settings').select('*').eq('user_id', session.user.id).maybeSingle(),
      ]);
      if (sessionsRes.error) throw sessionsRes.error; if (goalsRes.error) throw goalsRes.error; if (journalRes.error) throw journalRes.error; if (settingsRes.error) throw settingsRes.error;
      const allSessions = (sessionsRes.data || []) as Session[]; const goals = (goalsRes.data || []) as Goal[]; const journal = (journalRes.data || []) as JournalEntry[]; const settings = (settingsRes.data || null) as UserSettings | null;
      const weekSessions = allSessions.filter((s) => { const d = new Date(s.scheduled_at); return d >= start && d <= end; });
      const committed = weekSessions.length; const completed = weekSessions.filter((s) => s.status === 'completed').length; const missed = weekSessions.filter((s) => s.status === 'skipped').length; const moved = weekSessions.filter((s) => s.status === 'moved').length; const completionPct = committed ? Math.round((completed / committed) * 100) : 0;
      const patterns = detectPatterns(allSessions, journal); const primaryGoal = goals.find((g) => g.status === 'active') || goals[0];
      const recommendations = patterns.map((p) => ({ title: p.description, description: p.proposed_adjustment, category: p.type === 'overload' ? 'load' as const : p.type === 'milestone_calibration' ? 'milestone' as const : 'schedule' as const }));
      const activeGoals = goals.filter((g) => g.status === 'active' || g.status === 'locked');
      const proposedCommitments: ProposedCommitment[] = activeGoals.map((g) => { const goalSessions = allSessions.filter((s) => s.goal_id === g.id); const goalCompleted = goalSessions.filter((s) => s.status === 'completed').length; const goalTotal = goalSessions.length; const goalPct = goalTotal ? goalCompleted / goalTotal : 1; let proposed = g.weekly_commitment_target; let notes = ''; if (goalPct < 0.5 && goalTotal >= 3) { proposed = Math.max(1, Math.floor(g.weekly_commitment_target * 0.7)); notes = `Reduced from ${g.weekly_commitment_target} based on recent completion rate. The plan may be too ambitious right now.`; } else if (goalPct >= 0.8) notes = 'You are hitting this consistently. Consider maintaining or slightly increasing.'; return { goal_id: g.id, goal_title: g.outcome, sessions_per_week: proposed, notes }; });
      const reviewData = { user_id: session.user.id, week_start: weekStart, week_end: weekEnd, completion_pct: completionPct, committed_count: committed, completed_count: completed, missed_count: missed, moved_count: moved, biggest_win: biggestWin(weekSessions), biggest_setback: biggestSetback(weekSessions), patterns: patterns as unknown as Record<string, unknown>[], recommendations: recommendations as unknown as Record<string, unknown>[], coaching_text: buildCoachingText(weekSessions, patterns, settings, primaryGoal?.why_it_matters || null), proposed_commitments: proposedCommitments as unknown as Record<string, unknown>[], status: 'draft' as const };
      if (existingReview && existingReview.status === 'draft') {
        const { data, error } = await supabase.from('reviews').update(reviewData).eq('id', existingReview.id).eq('user_id', session.user.id).select().maybeSingle();
        if (error) throw error;
        if (data) { setReview(data as Review); setExistingReview(data as Review); }
      } else {
        const { data, error } = await supabase.from('reviews').insert(reviewData).select().maybeSingle(); if (error) throw error;
        if (data) { setReview(data as Review); setExistingReview(data as Review); }
      }
      await load();
    } catch (err) { console.error('Review generation failed:', err); setActionError(err instanceof Error ? err.message : 'Could not generate your weekly review.'); } finally { setGenerating(false); }
  }

  async function confirmReview() {
    if (!review || !session) return;
    setConfirming(true); setActionError('');
    try {
      const { error: reviewError } = await supabase.from('reviews').update({ status: 'confirmed', confirmed_at: new Date().toISOString() }).eq('id', review.id).eq('user_id', session.user.id); if (reviewError) throw reviewError;
      const nextWeekStart = toDateString(addDays(startOfWeek(), 7)); const nextWeekEnd = toDateString(addDays(endOfWeek(), 7)); const proposed = review.proposed_commitments as unknown as ProposedCommitment[];
      const goalIds = proposed.map((commitment) => commitment.goal_id);
      const [{ data: goalRows, error: goalError }, { data: planRows, error: planError }] = await Promise.all([
        supabase.from('goals').select('id,plan_json').eq('user_id', session.user.id).in('id', goalIds),
        supabase.from('goal_plan_items').select('goal_id,week_number,day_of_week,scheduled_at,duration_minutes,task').eq('user_id', session.user.id).in('goal_id', goalIds).eq('week_number', 2),
      ]);
      if (goalError) throw goalError; if (planError) throw planError;
      const goalMap = new Map((goalRows || []).map((goal) => [goal.id, goal]));
      const planItemMap = new Map((planRows || []).map((item) => [`${item.goal_id}:${item.day_of_week}`, item]));
      for (const commitment of proposed) { const { error } = await supabase.from('commitment_log').insert({ user_id: session.user.id, week_start: nextWeekStart, week_end: nextWeekEnd, goal_id: commitment.goal_id, committed_sessions: commitment.sessions_per_week, completed_sessions: 0, skipped_sessions: 0, moved_sessions: 0, snapshot: { notes: commitment.notes, goal_title: commitment.goal_title } }); if (error) throw error; }
      const { data: existingSessions, error: existingError } = await supabase.from('sessions').select('scheduled_at,duration_minutes').eq('user_id', session.user.id).eq('status', 'scheduled'); if (existingError) throw existingError;
      const occupied = toOccupiedSlots((existingSessions || []).map((row) => ({ scheduledAt: row.scheduled_at, durationMinutes: row.duration_minutes })));
      const dayIndex: Record<string, number> = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5, Sunday: 6 };
      for (const commitment of proposed) {
        const goal = goalMap.get(commitment.goal_id);
        const schedule = (goal?.plan_json || {}) as GoalSchedule;
        const selectedDays = Array.isArray(schedule.available_days) ? schedule.available_days.filter((day) => day in dayIndex) : [];
        if (!selectedDays.length) throw new Error(`We couldn't find the schedule you chose for ${commitment.goal_title}. Open the goal and set its days and times before confirming next week.`);
        const daysToSchedule = selectedDays.slice(0, Math.max(1, commitment.sessions_per_week));
        for (const day of daysToSchedule) {
          const preferredTime = schedule.preferred_times_by_day?.[day];
          const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(preferredTime || '');
          if (!timeMatch) throw new Error(`We couldn't find a time for ${day} on ${commitment.goal_title}. Open the goal and set a time before confirming next week.`);
          const sessionDate = new Date(`${nextWeekStart}T00:00:00`);
          sessionDate.setDate(sessionDate.getDate() + dayIndex[day]);
          sessionDate.setHours(Math.min(23, Number(timeMatch[1])), Math.min(59, Number(timeMatch[2])), 0, 0);
          const planItem = planItemMap.get(`${commitment.goal_id}:${day}`);
          const durationMinutes = Math.max(5, Number(planItem?.duration_minutes) || 45);
          const slot = allocateSameDaySlot(sessionDate, durationMinutes, occupied);
          if (!slot) throw new Error(`No available time remains on ${day} for ${commitment.goal_title}. Choose another day before confirming.`);
          const { error } = await supabase.from('sessions').insert({ goal_id: commitment.goal_id, user_id: session.user.id, title: planItem?.task || commitment.goal_title, scheduled_at: slot.date.toISOString(), duration_minutes: slot.durationMinutes, status: 'scheduled' });
          if (error) throw error;
          reserveSlot(slot, occupied);
        }
      }
      await load();
    } catch (err) { console.error('Confirm failed:', err); setActionError(err instanceof Error ? err.message : 'Could not lock in next week.'); } finally { setConfirming(false); }
  }

  async function deleteReview(id: string) {
    if (!session) return;
    if (!confirm('Delete this review? The review record will be removed, but commitments and sessions already created from it will remain.')) return;
    setActionError('');
    const { error } = await supabase.from('reviews').delete().eq('id', id).eq('user_id', session.user.id);
    if (error) { setActionError(error.message); return; }
    if (review?.id === id) { setReview(null); setExistingReview(null); }
    setPastReviews((items) => items.filter((item) => item.id !== id));
    await load();
  }

  if (loading) return <div className="min-w-0 overflow-hidden"><PageHeader title="Weekly Review" /><div className="text-vow-muted text-sm">Loading...</div></div>;
  if (review && review.status === 'confirmed') return <ConfirmedReviewView review={review} pastReviews={pastReviews} onDelete={deleteReview} />;
  if (!review && !existingReview) return <div className="min-w-0 overflow-hidden"><PageHeader title="Weekly Review" subtitle={`${formatDate(toDateString(start))} — ${formatDate(toDateString(end))}`} /><div className="border-t border-vow-border pt-12 text-center"><p className="vow-heading text-2xl text-vow-ink mb-3">No review generated yet</p><p className="text-vow-muted text-sm mb-8 max-w-md mx-auto leading-relaxed break-words">Generate your weekly accountability review. It reads your sessions, journal, and commitment history to give you honest, evidence-based feedback and propose next week's commitments.</p>{actionError && <p className="text-sm text-vow-ink border-l-2 border-vow-ink pl-3 max-w-md mx-auto mb-6 text-left break-words">{actionError}</p>}<button onClick={generateReview} disabled={generating} className="vow-btn-primary">{generating ? 'Analyzing your week...' : 'Generate weekly review'}</button></div>{pastReviews.length > 0 && <PastReviewsList reviews={pastReviews} onDelete={deleteReview} />}</div>;
  return <div className="min-w-0 overflow-hidden"><PageHeader title="Weekly Review" subtitle={`${formatDate(toDateString(start))} — ${formatDate(toDateString(end))}`} /><ReviewContent review={review!} /><div className="border-t border-vow-border pt-8 mt-10"><h3 className="vow-label mb-4">Confirm next week's commitments</h3><div className="space-y-px border border-vow-border mb-6">{(review!.proposed_commitments as unknown as ProposedCommitment[]).map((c, i) => <div key={i} className="bg-vow-bg px-4 py-3 flex items-center justify-between gap-3"><div className="min-w-0 flex-1"><div className="text-sm text-vow-ink truncate">{c.goal_title}</div>{c.notes && <div className="text-xs text-vow-muted mt-0.5 break-words">{c.notes}</div>}</div><div className="text-sm text-vow-ink font-medium flex-shrink-0">{c.sessions_per_week}x/week</div></div>)}</div><p className="text-xs text-vow-muted mb-6 leading-relaxed max-w-lg break-words">Confirming locks these commitments into your immutable commitment log and schedules next week's sessions.</p>{actionError && <p className="text-sm text-vow-ink border-l-2 border-vow-ink pl-3 mb-6 break-words">{actionError}</p>}<div className="flex gap-3"><button onClick={generateReview} disabled={generating} className="vow-btn-ghost">Regenerate</button><button onClick={confirmReview} disabled={confirming} className="vow-btn-primary flex-1">{confirming ? 'Locking in...' : 'Lock in next week'}</button></div></div></div>;
}

function ReviewContent({ review }: { review: Review }) { const patterns = (review.patterns || []) as unknown as PatternFinding[]; return <div className="space-y-10 min-w-0"><div className="border-t border-vow-border pt-8"><p className="vow-label mb-4">Your coach</p><div className="text-sm text-vow-ink whitespace-pre-wrap leading-relaxed break-words">{review.coaching_text}</div></div>{patterns.length > 0 && <div className="border-t border-vow-border pt-8"><p className="vow-label mb-4">Patterns detected ({patterns.length})</p><div className="space-y-6">{patterns.map((p, i) => <div key={i} className="border-b border-vow-border pb-6 last:border-0 min-w-0"><p className="text-xs text-vow-muted uppercase tracking-wide mb-2">{p.type.replace(/_/g, ' ')}</p><p className="text-sm text-vow-ink font-medium mb-3 break-words">{p.description}</p>{p.evidence.length > 0 && <div className="mb-3"><p className="text-xs text-vow-muted mb-1">Evidence</p><ul className="space-y-1">{p.evidence.map((e, j) => <li key={j} className="text-xs text-vow-muted pl-3 border-l border-vow-border break-words">{e}</li>)}</ul></div>}{p.hypothesis && <p className="text-xs text-vow-ink mb-2 break-words"><span className="text-vow-muted">Hypothesis: </span>{p.hypothesis}</p>}{p.proposed_adjustment && <p className="text-xs text-vow-ink break-words"><span className="text-vow-muted">Suggestion: </span>{p.proposed_adjustment}</p>}</div>)}</div></div>}</div>; }

function ConfirmedReviewView({ review, pastReviews, onDelete }: { review: Review; pastReviews: Review[]; onDelete: (id: string) => void }) { return <div className="min-w-0 overflow-hidden"><PageHeader title="Weekly Review" subtitle={`${formatDate(review.week_start)} — ${formatDate(review.week_end)}`} /><div className="border-l-2 border-vow-success pl-4 mb-10"><p className="text-sm text-vow-ink font-medium">Review confirmed</p><p className="text-xs text-vow-muted mt-0.5 break-words">Next week's commitments are locked in and sessions are scheduled.</p></div><ReviewContent review={review} /><div className="mt-8 pt-5 border-t border-vow-border"><button onClick={() => onDelete(review.id)} className="text-xs text-vow-muted hover:text-vow-ink">Delete this review</button></div>{pastReviews.length > 1 && <PastReviewsList reviews={pastReviews.slice(1)} onDelete={onDelete} />}</div>; }

function PastReviewsList({ reviews, onDelete }: { reviews: Review[]; onDelete: (id: string) => void }) { const [expanded, setExpanded] = useState<string | null>(null); if (!reviews.length) return null; return <div className="border-t border-vow-border pt-8 mt-10 min-w-0"><h3 className="vow-label mb-4">Past reviews</h3><div className="border-t border-vow-border">{reviews.map((r) => <div key={r.id} className="border-b border-vow-border"><div className="flex items-center gap-4 py-4"><button onClick={() => setExpanded(expanded === r.id ? null : r.id)} className="flex-1 min-w-0 text-left hover:opacity-70 transition-opacity"><div className="text-sm text-vow-ink break-words">{formatDate(r.week_start)} — {formatDate(r.week_end)}</div><div className="text-xs text-vow-muted mt-0.5 break-words">{r.completed_count}/{r.committed_count} sessions — {Math.round(r.completion_pct)}% — {r.status}</div></button><button onClick={() => onDelete(r.id)} className="text-xs text-vow-muted hover:text-vow-ink shrink-0">Delete</button></div>{expanded === r.id && <div className="pb-8"><ReviewContent review={r} /></div>}</div>)}</div></div>; }
