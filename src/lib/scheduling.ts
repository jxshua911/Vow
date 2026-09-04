export type ScheduledSlot = {
  date: Date;
  durationMinutes: number;
};

export type OccupiedSlot = {
  scheduledAt: string;
  durationMinutes?: number | null;
};

const WORKDAY_START_HOUR = 7;
const WORKDAY_END_HOUR = 22;
const SLOT_STEP_MINUTES = 30;

function overlaps(start: number, durationMinutes: number, occupied: OccupiedSlot): boolean {
  const occupiedStart = new Date(occupied.scheduledAt).getTime();
  const occupiedDuration = Math.max(5, Number(occupied.durationMinutes) || 60);
  const occupiedEnd = occupiedStart + occupiedDuration * 60_000;
  const end = start + durationMinutes * 60_000;
  return start < occupiedEnd && end > occupiedStart;
}

function hasConflict(candidate: Date, durationMinutes: number, occupied: OccupiedSlot[]): boolean {
  const start = candidate.getTime();
  return occupied.some((slot) => overlaps(start, durationMinutes, slot));
}

function nextHour(date: Date): Date {
  const next = new Date(date);
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  return next;
}

/**
 * Finds the next free slot on the same calendar day. Existing and newly
 * allocated sessions are both considered, and interval overlap is respected.
 */
export function allocateSameDaySlot(
  requested: Date,
  durationMinutes: number,
  occupied: OccupiedSlot[],
): ScheduledSlot | null {
  const duration = Math.max(5, Number(durationMinutes) || 30);
  const candidate = new Date(requested);
  candidate.setSeconds(0, 0);

  if (candidate.getHours() < WORKDAY_START_HOUR) {
    candidate.setHours(WORKDAY_START_HOUR, 0, 0, 0);
  }

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const end = new Date(candidate.getTime() + duration * 60_000);
    const dayEnd = new Date(candidate);
    dayEnd.setHours(WORKDAY_END_HOUR, 0, 0, 0);

    if (end > dayEnd) return null;

    if (!hasConflict(candidate, duration, occupied)) {
      return { date: candidate, durationMinutes: duration };
    }

    candidate.setTime(nextHour(candidate).getTime());
  }

  return null;
}

export function reserveSlot(slot: ScheduledSlot, occupied: OccupiedSlot[]): void {
  occupied.push({
    scheduledAt: slot.date.toISOString(),
    durationMinutes: slot.durationMinutes,
  });
}

export function toOccupiedSlots(rows: OccupiedSlot[]): OccupiedSlot[] {
  return rows
    .filter((row) => row.scheduledAt && !Number.isNaN(new Date(row.scheduledAt).getTime()))
    .map((row) => ({
      scheduledAt: new Date(row.scheduledAt).toISOString(),
      durationMinutes: row.durationMinutes,
    }));
}
