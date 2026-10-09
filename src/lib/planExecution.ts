import { allocateSameDaySlot, reserveSlot, toOccupiedSlots, type OccupiedSlot } from './scheduling.ts';

export type ActionablePlanStep = {
  order: number;
  title: string;
  purpose: string;
  target: string;
  evidence: string;
  estimated_minutes: number;
};

export type ExecutionItemDraft = {
  week_number: number;
  day_of_week: string;
  scheduled_at: string;
  task: string;
  purpose: string;
  target_metric: string;
  duration_minutes: number;
  notes: string;
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parsePreferredTimes(value: string | null | undefined): Record<string, string> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([day, time]) => DAYS.includes(day) && typeof time === 'string' && /^\d{2}:\d{2}$/.test(time)));
  } catch {
    return {};
  }
}

function preferredRequest(now: Date, day: string, time: string, occurrence: number): Date {
  const requested = new Date(now);
  const targetDay = DAYS.indexOf(day);
  const daysUntil = (targetDay - requested.getDay() + 7) % 7;
  requested.setDate(requested.getDate() + daysUntil + occurrence * 7);
  const [hours, minutes] = time.split(':').map(Number);
  requested.setHours(hours, minutes, 0, 0);
  if (requested <= now && occurrence === 0) requested.setDate(requested.getDate() + 7);
  return requested;
}

function immediateRequest(now: Date, offset: number): Date {
  const requested = new Date(now);
  requested.setMinutes(0, 0, 0);
  requested.setHours(requested.getHours() + 1 + offset);
  return requested;
}

function allocateNextAvailable(requested: Date, durationMinutes: number, occupied: OccupiedSlot[]): { date: Date; durationMinutes: number } {
  for (let dayOffset = 0; dayOffset < 30; dayOffset += 1) {
    const candidate = new Date(requested);
    candidate.setDate(candidate.getDate() + dayOffset);
    const slot = allocateSameDaySlot(candidate, durationMinutes, occupied);
    if (slot) return slot;
  }
  throw new Error('No available time remains for the first actionable plan tasks.');
}

export function buildInitialExecutionItems(
  steps: ActionablePlanStep[],
  preferredSessionTimes: string | null | undefined,
  occupiedRows: OccupiedSlot[],
  now = new Date(),
): ExecutionItemDraft[] {
  const preferred = parsePreferredTimes(preferredSessionTimes);
  const preferredDays = DAYS.filter((day) => preferred[day]);
  const occupied = toOccupiedSlots(occupiedRows);

  return steps.map((step, index) => {
    const day = preferredDays.length ? preferredDays[index % preferredDays.length] : DAYS[now.getDay()];
    const request = preferredDays.length
      ? preferredRequest(now, day, preferred[day], Math.floor(index / preferredDays.length))
      : immediateRequest(now, index);
    const durationMinutes = Math.max(5, Number(step.estimated_minutes) || 30);
    const slot = allocateNextAvailable(request, durationMinutes, occupied);
    reserveSlot(slot, occupied);
    return {
      week_number: 1,
      day_of_week: slot.date.toLocaleDateString('en-US', { weekday: 'long' }),
      scheduled_at: slot.date.toISOString(),
      task: step.title,
      purpose: step.purpose,
      target_metric: step.target,
      duration_minutes: slot.durationMinutes,
      notes: JSON.stringify({ evidence: step.evidence }),
    };
  });
}
