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
    lines.push(`That's a strong week — the majority of what you locked in got done.`);
  } else if (completionPct >= 50) {
    lines.push(`You followed through on more than half of your commitments. Not perfect, but real progress.`);
  } else if (total > 0) {
    lines.push(`This was a tough week for follow-through. That's data, not a verdict.`);
  }

  // Patterns — each with a proposed adjustment, never a bare callout
  if (patterns.length > 0) {
    lines.push(`Here's what I noticed:`);
    for (const p of patterns.slice(0, 3)) {
      lines.push(`• ${p.description}.`);
      if (p.hypothesis) lines.push(`  Hypothesis: ${p.hypothesis}`);
      if (p.proposed_adjustment) lines.push(`  Suggestion: ${p.proposed_adjustment}`);
    }
  }

  // Motivation dip — reference why_it_matters if completion is low
  if (completionPct < 50 && whyItMatters) {
    lines.push(`When you set this goal, you wrote: "${whyItMatters}"`);
    lines.push(`If that reason still holds, the issue may be the plan — not your commitment.`);
  }

  // Pause context acknowledgment
  if (settings?.pause_context) {
    lines.push(`Note: you flagged an active life context — "${settings.pause_context}". I'm accounting for that and not counting these weeks against your patterns.`);
  }

  // Closing — never shaming
  if (total === 0) {
    lines.push(`No sessions were scheduled this week. Want to lock in a lighter commitment for next week?`);
  } else if (completionPct < 50) {
    lines.push(`No shame here — let's adjust the plan and try a smaller, more realistic commitment next week.`);
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
