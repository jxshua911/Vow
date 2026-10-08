import type { Session, PatternFinding, UserSettings } from '@/types/database';

/**
 * Coaching tone engine.
 * Rules:
 * - Name the pattern factually ("you moved this session 3 times") — never characterize the person.
 * - Always pair a setback with one concrete proposed adjustment — never a callout alone.
 * - Never diagnose the user's psychology — offer hypotheses they confirm or correct.
 * - Reference the user's own "why it matters" during motivation dips.
 */

export function buildCoachingText(
  sessions: Session[],
  patterns: PatternFinding[],
  settings: UserSettings | null,
  whyItMatters: string | null
): string {
  const total = sessions.length;
  const completed = sessions.filter((s) => s.status === 'completed').length;
  const moved = sessions.filter((s) => s.status === 'moved').length;
  const skipped = sessions.filter((s) => s.status === 'skipped').length;
  const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const lines: string[] = [];

  // Factual summary
  lines.push(`This week you completed ${completed} of ${total} scheduled sessions (${completionPct}%).`);

  if (moved > 0) {
    lines.push(`You moved ${moved} ${moved === 1 ? 'session' : 'sessions'} and skipped ${skipped}.`);
  } else if (skipped > 0) {
    lines.push(`You skipped ${skipped} ${skipped === 1 ? 'session' : 'sessions'}.`);
  }

  // Wins
  if (completionPct >= 80) {
    lines.push(`Most of the commitments you set were completed.`);
  } else if (completionPct >= 50) {
    lines.push(`More than half of your commitments were completed. Keep the parts of the plan that are working.`);
  } else if (total > 0) {
    lines.push(`Follow-through was lower this week. The useful question is what should change in the plan.`);
  }

  // Patterns — each with a proposed adjustment, never a bare callout
  if (patterns.length > 0) {
    lines.push(`What to adjust next:`);
    for (const p of patterns.slice(0, 3)) {
      lines.push(`• ${p.description}.`);
      if (p.hypothesis) lines.push(`  Possible reason: ${p.hypothesis}`);
      if (p.proposed_adjustment) lines.push(`  Next step: ${p.proposed_adjustment}`);
    }
  }

  // Motivation dip — reference why_it_matters if completion is low
  if (completionPct < 50 && whyItMatters) {
    lines.push(`Your reason for this goal: "${whyItMatters}"`);
    lines.push(`If that still matters to you, make next week's commitment easier to execute.`);
  }

  // Pause context acknowledgment
  if (settings?.pause_context) {
    lines.push(`You flagged this context: "${settings.pause_context}". The next commitment should account for it.`);
  }

  // Closing — never shaming
  if (total === 0) {
    lines.push(`No sessions were scheduled this week. Want to lock in a lighter commitment for next week?`);
  } else if (completionPct < 50) {
    lines.push(`Next week, reduce the commitment to a level you can execute consistently.`);
  } else {
    lines.push(`Keep going. Lock in next week's commitments when you're ready.`);
  }

  return lines.join('\n\n');
}

export function biggestWin(sessions: Session[]): string | null {
  const completed = sessions.filter((s) => s.status === 'completed');
  if (completed.length === 0) return null;

  const churnedButDone = completed.find((s) => s.moved_count >= 2);
  if (churnedButDone) {
    return `"${churnedButDone.title}" — you moved it ${churnedButDone.moved_count} times but still got it done. That's follow-through.`;
  }

  const longest = completed.reduce((a, b) => (b.duration_minutes > a.duration_minutes ? b : a));
  return `Completed "${longest.title}" (${longest.duration_minutes} min).`;
}

export function biggestSetback(sessions: Session[]): string | null {
  const missed = sessions.filter((s) => s.status === 'skipped' || s.status === 'moved');
  if (missed.length === 0) return null;

  const mostMoved = missed.reduce((a, b) => (b.moved_count > a.moved_count ? b : a));
  if (mostMoved.moved_count >= 2) {
    return `"${mostMoved.title}" was moved ${mostMoved.moved_count} times and ultimately ${mostMoved.status}.`;
  }

  return `"${mostMoved.title}" was ${mostMoved.status}.`;
}
