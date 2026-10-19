type PlannedSession = {
  goal_id: string;
  status: string;
  scheduled_at: string | null;
  day_of_week?: string | null;
  notes?: string | null;
};

type PlannedGoal = {
  id: string;
  status: string;
  start_date?: string | null;
};

function currentPlanWeek(startDate: string, now: Date): number {
  const start = new Date(`${startDate}T00:00:00`);
  if (!Number.isFinite(start.getTime())) return -1;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const elapsedDays = Math.floor((today.getTime() - startDay.getTime()) / 86_400_000);
  return elapsedDays < 0 ? -1 : Math.floor(elapsedDays / 7) + 1;
}

/** Count date-less sessions when their active plan assigns them to this week. */
export function isSessionInCurrentPlanWeek(
  session: PlannedSession,
  goals: PlannedGoal[],
  now: Date = new Date(),
): boolean {
  if (session.scheduled_at) {
    const target = new Date(session.scheduled_at);
    if (!Number.isFinite(target.getTime())) return false;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const day = start.getDay();
    start.setDate(start.getDate() + (day === 0 ? -6 : 1 - day));
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return target >= start && target < end;
  }
  if (session.status !== 'scheduled' && session.status !== 'completed') return false;

  const goal = goals.find((candidate) => candidate.id === session.goal_id);
  if (!goal || (goal.status !== 'active' && goal.status !== 'locked') || !goal.start_date) return false;

  const match = /Plan (?:day|cadence): Week\s*(\d+)/i.exec(session.notes || '');
  if (!match) return false;
  const plannedWeek = Number(match[1]);
  if (!Number.isInteger(plannedWeek) || plannedWeek < 1) return false;
  return plannedWeek === currentPlanWeek(goal.start_date, now);
}
