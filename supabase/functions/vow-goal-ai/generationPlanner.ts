export type GenerationStage = "skeleton" | "window";
export type GenerationWindow = { index: number; startWeek: number; endWeek: number; weeks: number; sessions: number };
export type WindowValidationInput = {
  expectedStartWeek: number;
  expectedEndWeek: number;
  selectedDays: string[];
  milestones: Array<{ week: number; title?: string }>;
  sessions: Array<{ week: number; day: string; task?: string; milestone_week?: number | null }>;
};

const MIN_OUTPUT_TOKENS = 1200;
const MIN_WINDOW_WEEKS = 1;

export function estimateOutputTokens(input: {
  stage: GenerationStage;
  weeks: number;
  sessionsPerWeek: number;
  complexity: number;
  providerOutputLimit: number;
}): number {
  const { stage, weeks, sessionsPerWeek, complexity, providerOutputLimit } = input;
  if (!Number.isFinite(providerOutputLimit) || providerOutputLimit < MIN_OUTPUT_TOKENS) {
    throw new Error("PROVIDER_OUTPUT_LIMIT_UNAVAILABLE");
  }
  const safeWeeks = Math.max(1, Math.min(52, Math.round(weeks)));
  const safeDays = Math.max(1, Math.min(7, Math.round(sessionsPerWeek)));
  const multiplier = Math.max(0.75, Math.min(1.8, Number.isFinite(complexity) ? complexity : 1));
  const raw = stage === "skeleton"
    ? 900 + safeWeeks * 65 + safeDays * 90
    : 500 + safeWeeks * 120 + safeWeeks * safeDays * 300 * multiplier;
  return Math.max(MIN_OUTPUT_TOKENS, Math.ceil(raw));
}

export function buildGenerationWindows(input: {
  totalWeeks: number;
  sessionsPerWeek: number;
  complexity: number;
  providerOutputLimit: number;
}): GenerationWindow[] {
  const totalWeeks = Math.max(1, Math.min(52, Math.round(input.totalWeeks)));
  const preferred = input.complexity >= 1.35 ? 4 : 8;
  let windowWeeks = preferred;
  while (
    windowWeeks > MIN_WINDOW_WEEKS &&
    estimateOutputTokens({
      stage: "window",
      weeks: Math.min(windowWeeks, totalWeeks),
      sessionsPerWeek: input.sessionsPerWeek,
      complexity: input.complexity,
      providerOutputLimit: input.providerOutputLimit,
    }) > input.providerOutputLimit && windowWeeks > MIN_WINDOW_WEEKS
  ) windowWeeks = Math.max(MIN_WINDOW_WEEKS, Math.floor(windowWeeks / 2));

  if (estimateOutputTokens({
    stage: "window", weeks: Math.min(windowWeeks, totalWeeks),
    sessionsPerWeek: input.sessionsPerWeek, complexity: input.complexity,
    providerOutputLimit: input.providerOutputLimit,
  }) > input.providerOutputLimit) throw new Error("WINDOW_EXCEEDS_PROVIDER_LIMIT");

  const windows: GenerationWindow[] = [];
  for (let startWeek = 1, index = 0; startWeek <= totalWeeks; index += 1) {
    const endWeek = Math.min(totalWeeks, startWeek + windowWeeks - 1);
    windows.push({
      index,
      startWeek,
      endWeek,
      weeks: endWeek - startWeek + 1,
      sessions: (endWeek - startWeek + 1) * input.sessionsPerWeek,
    });
    startWeek = endWeek + 1;
  }
  return windows;
}

export function validateGeneratedWindow(input: WindowValidationInput): string | null {
  const expectedWeeks = new Set(
    Array.from(
      { length: input.expectedEndWeek - input.expectedStartWeek + 1 },
      (_, index) => input.expectedStartWeek + index,
    ),
  );
  const selected = new Set(input.selectedDays);
  const seen = new Set<string>();
  const counts = new Map<number, number>();
  if (!input.sessions.length) return "EMPTY_WINDOW";
  for (const session of input.sessions) {
    if (!expectedWeeks.has(session.week)) return "WEEK_OUTSIDE_WINDOW";
    if (!selected.has(session.day)) return "UNSELECTED_SESSION_DAY";
    if (!session.task?.trim()) return "SESSION_TASK_MISSING";
    const key = `${session.week}:${session.day.toLowerCase()}`;
    if (seen.has(key)) return "DUPLICATE_SESSION";
    seen.add(key);
    counts.set(session.week, (counts.get(session.week) || 0) + 1);
    if (session.milestone_week != null && !input.milestones.some(
      milestone => milestone.week === session.milestone_week,
    )) return "MILESTONE_LINK_INVALID";
  }
  for (const week of expectedWeeks) {
    if ((counts.get(week) || 0) !== selected.size) return "SESSION_COUNT_MISMATCH";
  }
  return null;
}
