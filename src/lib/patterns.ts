import type { Session, JournalEntry, PatternFinding } from '@/types/database';
import { dayName, timeOfDay } from './dates';

/**
 * Evidence-based pattern detection over sessions.
 * Reasons over time-of-day/day-of-week, moved_count, and calendar adjacency.
 * Does NOT assert diagnoses — produces hypotheses with evidence for user confirmation.
 */
export function detectPatterns(
  sessions: Session[],
  journalEntries: JournalEntry[] = []
): PatternFinding[] {
  const patterns: PatternFinding[] = [];
  const missedOrMoved = sessions.filter((s) => s.status === 'skipped' || s.status === 'moved');

  if (missedOrMoved.length === 0) return patterns;

  // 1. Time-of-day / day-of-week patterns
  const dayBuckets: Record<string, Session[]> = {};
  const timeBuckets: Record<string, Session[]> = {};

  for (const s of missedOrMoved) {
    const d = dayName(s.scheduled_at);
    const t = timeOfDay(s.scheduled_at);
    const dayKey = `${d} ${t}`;
    (dayBuckets[dayKey] ??= []).push(s);
    (timeBuckets[t] ??= []).push(s);
  }

  for (const [key, bucket] of Object.entries(dayBuckets)) {
    if (bucket.length >= 2) {
      patterns.push({
        type: 'time_pattern',
        description: `${key} sessions keep getting bumped or skipped`,
        evidence: bucket.map((s) => `${dayName(s.scheduled_at)} — ${s.title} (moved ${s.moved_count}x, status: ${s.status})`),
        hypothesis: `${key} may not be a realistic slot for you right now.`,
        proposed_adjustment: `Want to try a different time for these sessions?`,
      });
    }
  }

  // 2. Repeated moves on a single session (reschedule churn)
  const churned = sessions.filter((s) => s.moved_count >= 3);
  for (const s of churned) {
    patterns.push({
      type: 'time_pattern',
      description: `"${s.title}" has been moved ${s.moved_count} times`,
      evidence: [`Moved count: ${s.moved_count}`, `Current status: ${s.status}`],
      hypothesis: `This session might be scheduled at a time that consistently conflicts with something else.`,
      proposed_adjustment: `Consider rescheduling it to a slot you've successfully kept before, or shortening the duration.`,
    });
  }

  // 3. Back-to-back / calendar conflict detection (proxy: same-day multiple missed)
  const dayMissBuckets: Record<string, Session[]> = {};
  for (const s of missedOrMoved) {
    const dateKey = new Date(s.scheduled_at).toDateString();
    (dayMissBuckets[dateKey] ??= []).push(s);
  }
  for (const [dateKey, bucket] of Object.entries(dayMissBuckets)) {
    if (bucket.length >= 2) {
      patterns.push({
        type: 'calendar_conflict',
        description: `Multiple sessions missed on ${new Date(dateKey).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}`,
        evidence: bucket.map((s) => `${s.title} at ${new Date(s.scheduled_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`),
        hypothesis: `That day may have had competing commitments. Packing sessions on already-busy days tends to fail.`,
        proposed_adjustment: `Spread sessions across lighter days instead of stacking them on one.`,
      });
    }
  }

  // 4. Milestone miscalibration (all sessions for one goal missed)
  const goalMissBuckets: Record<string, Session[]> = {};
  for (const s of missedOrMoved) {
    (goalMissBuckets[s.goal_id] ??= []).push(s);
  }
  const allSessionsByGoal: Record<string, Session[]> = {};
  for (const s of sessions) {
    (allSessionsByGoal[s.goal_id] ??= []).push(s);
  }
  for (const [goalId, missed] of Object.entries(goalMissBuckets)) {
    const total = allSessionsByGoal[goalId]?.length ?? 0;
    if (total > 0 && missed.length / total >= 0.6) {
      patterns.push({
        type: 'milestone_calibration',
        description: `Over 60% of sessions for this goal were missed or moved`,
        evidence: [`Missed/moved: ${missed.length} of ${total} total sessions`],
        hypothesis: `The plan itself may be miscalibrated — the milestone or weekly load might be too ambitious right now.`,
        proposed_adjustment: `Consider reducing the weekly commitment target or breaking the current milestone into a smaller step.`,
      });
    }
  }

  // 5. Overall overload (many sessions, low completion)
  const total = sessions.length;
  const completed = sessions.filter((s) => s.status === 'completed').length;
  if (total >= 5 && completed / total < 0.4) {
    patterns.push({
      type: 'overload',
      description: `You completed ${completed} of ${total} sessions this week`,
      evidence: [`Completion rate: ${Math.round((completed / total) * 100)}%`],
      hypothesis: `The total weekly load may be more than what's sustainable right now.`,
      proposed_adjustment: `Try reducing the number of committed sessions next week and see if completion improves.`,
    });
  }

  // 6. Journal-linked context near missed sessions
  if (journalEntries.length > 0) {
    for (const s of missedOrMoved.slice(0, 3)) {
      const sessionDate = new Date(s.scheduled_at);
      const nearby = journalEntries.filter((j) => {
        const jd = new Date(j.created_at);
        return Math.abs(jd.getTime() - sessionDate.getTime()) < 48 * 60 * 60 * 1000;
      });
      if (nearby.length > 0) {
        patterns.push({
          type: 'disruption',
          description: `Journal entries near a missed session`,
          evidence: nearby.map((j) => j.body.slice(0, 120)),
          hypothesis: `Something noted in your journal around this time may have affected your ability to do this session.`,
          proposed_adjustment: `If this was a legitimate disruption (illness, travel, crunch), mark it as a pause so it doesn't count as avoidance.`,
        });
      }
    }
  }

  return patterns;
}
