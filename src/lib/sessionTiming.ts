export type SessionTimingMode = 'timed' | 'flexible-day' | 'unscheduled';

export type SessionTiming = {
  mode: SessionTimingMode;
  dayOfWeek: string | null;
  scheduledAt: string | null;
};

/** Build a persisted timing value without inventing a clock time. */
export function resolveSessionTiming(
  mode: SessionTimingMode,
  dayOfWeek: string | null | undefined,
  scheduledAt: string | null | undefined,
): SessionTiming {
  if (mode === 'unscheduled') {
    return { mode, dayOfWeek: null, scheduledAt: null };
  }
  const day = typeof dayOfWeek === 'string' && dayOfWeek.trim() ? dayOfWeek.trim() : null;
  if (mode === 'flexible-day') return { mode, dayOfWeek: day, scheduledAt: null };
  const timestamp = typeof scheduledAt === 'string' && Number.isFinite(Date.parse(scheduledAt))
    ? new Date(scheduledAt).toISOString()
    : null;
  return { mode, dayOfWeek: day, scheduledAt: timestamp };
}

/** A moved counter measures a real reschedule, not a change of timing mode. */
export function shouldIncrementMovedCount(
  previousScheduledAt: string | null | undefined,
  nextScheduledAt: string | null | undefined,
): boolean {
  if (!previousScheduledAt || !nextScheduledAt) return false;
  const previous = Date.parse(previousScheduledAt);
  const next = Date.parse(nextScheduledAt);
  return Number.isFinite(previous) && Number.isFinite(next) && previous !== next;
}
