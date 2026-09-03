import type { Goal, Session } from '@/types/database';

export type RavenWeek = {
  week_start: string;
  week_end: string;
  committed: number;
  completed: number;
  skipped: number;
  moved: number;
  completion_pct: number;
};

export type RavenAward = {
  key: string;
  title: string;
  description: string;
  earned_at: string;
};

export type RavenSnapshot = {
  score: number;
  previous_score: number | null;
  score_delta: number | null;
  trend: 'up' | 'down' | 'steady' | 'new';
  current_streak: number;
  best_streak: number;
  total_completed: number;
  total_sessions: number;
  completion_pct: number;
  best_weekly_completion_pct: number;
  best_week_start: string | null;
  weekly_completed_best: number;
  weeks_observed: number;
  recent_weeks: RavenWeek[];
  signals: string[];
};

function dateOnly(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00`);
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function monday(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d;
}

function weekEnd(start: Date) {
  const d = new Date(start);
  d.setDate(d.getDate() + 6);
  return d;
}

export function buildRavenWeeks(sessions: Session[], now = new Date()): RavenWeek[] {
  const relevant = sessions.filter((s) => new Date(s.scheduled_at) <= now);
  if (!relevant.length) return [];

  const buckets = new Map<string, RavenWeek>();
  for (const session of relevant) {
    const start = monday(new Date(session.scheduled_at));
    const key = isoDate(start);
    const current = buckets.get(key) || {
      week_start: key,
      week_end: isoDate(weekEnd(start)),
      committed: 0,
      completed: 0,
      skipped: 0,
      moved: 0,
      completion_pct: 0,
    };
    current.committed += 1;
    if (session.status === 'completed') current.completed += 1;
    if (session.status === 'skipped') current.skipped += 1;
    if (session.status === 'moved') current.moved += 1;
    buckets.set(key, current);
  }

  return [...buckets.values()]
    .map((week) => ({ ...week, completion_pct: week.committed ? Math.round((week.completed / week.committed) * 100) : 0 }))
    .sort((a, b) => a.week_start.localeCompare(b.week_start));
}

export function calculateStreaks(sessions: Session[], now = new Date()) {
  const completedDays = new Set(
    sessions
      .filter((s) => s.status === 'completed' && new Date(s.scheduled_at) <= now)
      .map((s) => isoDate(new Date(s.scheduled_at))),
  );
  const days = [...completedDays].sort();
  if (!days.length) return { current: 0, best: 0 };

  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i += 1) {
    const previous = dateOnly(days[i - 1]);
    const current = dateOnly(days[i]);
    const diff = Math.round((current.getTime() - previous.getTime()) / 86400000);
    if (diff === 1) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }

  const today = isoDate(now);
  const yesterday = isoDate(new Date(now.getTime() - 86400000));
  let current = 0;
  let cursor = completedDays.has(today) ? dateOnly(today) : completedDays.has(yesterday) ? dateOnly(yesterday) : null;
  while (cursor && completedDays.has(isoDate(cursor))) {
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { current, best };
}

export function calculateRavenSnapshot(sessions: Session[], previousSnapshot?: RavenSnapshot | null, now = new Date()): RavenSnapshot {
  const completed = sessions.filter((s) => s.status === 'completed' && new Date(s.scheduled_at) <= now).length;
  const observed = sessions.filter((s) => new Date(s.scheduled_at) <= now).length;
  const weeks = buildRavenWeeks(sessions, now);
  const recent = weeks.slice(-8);
  const currentWeek = weeks[weeks.length - 1] || null;
  const previousWeek = weeks[weeks.length - 2] || null;
  const streaks = calculateStreaks(sessions, now);

  const recentAverage = recent.length ? recent.reduce((sum, w) => sum + w.completion_pct, 0) / recent.length : 0;
  const streakContribution = Math.min(100, streaks.current * 12.5);
  const score = observed ? Math.round(Math.max(0, Math.min(100, recentAverage * 0.8 + streakContribution * 0.2))) : 0;
  const previousScore = previousSnapshot?.score ?? (previousWeek ? previousWeek.completion_pct : null);
  const delta = previousScore === null ? null : score - previousScore;
  const trend: RavenSnapshot['trend'] = delta === null ? 'new' : delta > 2 ? 'up' : delta < -2 ? 'down' : 'steady';

  const bestWeek = weeks.reduce<RavenWeek | null>((best, week) => (!best || week.completion_pct > best.completion_pct || (week.completion_pct === best.completion_pct && week.completed > best.completed) ? week : best), null);
  const signals: string[] = [];
  if (trend === 'down') signals.push('Your consistency score dropped compared with the previous period.');
  if (trend === 'up') signals.push('Your consistency is improving.');
  if (streaks.current >= 3) signals.push(`You are on a ${streaks.current}-day completion streak.`);
  if (currentWeek && currentWeek.committed > 0 && currentWeek.completion_pct >= 80) signals.push('You are maintaining strong completion this week.');
  if (currentWeek && currentWeek.committed > 0 && currentWeek.completion_pct < 50) signals.push('This week is showing a meaningful consistency drop.');
  if (previousWeek && currentWeek && currentWeek.completion_pct - previousWeek.completion_pct >= 15) signals.push('You bounced back strongly from last week.');

  return {
    score,
    previous_score: previousScore,
    score_delta: delta,
    trend,
    current_streak: streaks.current,
    best_streak: streaks.best,
    total_completed: completed,
    total_sessions: observed,
    completion_pct: observed ? Math.round((completed / observed) * 100) : 0,
    best_weekly_completion_pct: bestWeek?.completion_pct || 0,
    best_week_start: bestWeek?.week_start || null,
    weekly_completed_best: weeks.reduce((best, week) => Math.max(best, week.completed), 0),
    weeks_observed: weeks.length,
    recent_weeks: recent,
    signals,
  };
}

export function getRavenAwards(snapshot: RavenSnapshot, previousAwards: RavenAward[] = [], now = new Date()): RavenAward[] {
  const existing = new Set(previousAwards.map((a) => a.key));
  const awards: RavenAward[] = [];
  const add = (key: string, title: string, description: string) => {
    if (!existing.has(key)) awards.push({ key, title, description, earned_at: now.toISOString() });
  };

  if (snapshot.total_completed >= 1) add('first_completion', 'First VOW', 'You completed your first tracked session.');
  if (snapshot.current_streak >= 3 || snapshot.best_streak >= 3) add('three_day_streak', 'Three-Day Run', 'You completed tracked work on three consecutive days.');
  if (snapshot.current_streak >= 7 || snapshot.best_streak >= 7) add('seven_day_streak', 'Seven-Day Streak', 'Seven consecutive days of completed work.');
  if (snapshot.best_weekly_completion_pct >= 80) add('strong_week', 'Strong Week', 'You completed at least 80% of a tracked week.');
  if (snapshot.weeks_observed >= 4 && snapshot.recent_weeks.length >= 4 && snapshot.recent_weeks.slice(-4).every((w) => w.completion_pct >= 80)) add('four_week_consistency', 'Four Weeks Consistent', 'Four tracked weeks at 80% or better completion.');
  if (snapshot.score_delta !== null && snapshot.score_delta >= 15) add('bounce_back', 'Bounce Back', 'You recovered strongly after a consistency drop.');
  if (snapshot.best_weekly_completion_pct === 100) add('perfect_week', 'Clean Week', 'You completed every tracked session in a week.');
  return awards;
}

export function goalProgress(sessions: Session[], goals: Goal[]) {
  return goals.map((goal) => {
    const items = sessions.filter((s) => s.goal_id === goal.id);
    const completed = items.filter((s) => s.status === 'completed').length;
    return { goal, completed, total: items.length, pct: items.length ? Math.round((completed / items.length) * 100) : 0 };
  });
}
