export interface GoalClarification {
  questions: string[];
  recommended_duration_weeks: number;
  rationale: string;
}

export interface PlanSessionTemplate {
  day: string;
  task: string;
  purpose: string;
  target_metric: string;
  duration_minutes: number;
  preferred_time: string;
}

export interface GoalPlan {
  outcome: string;
  success_metric: string;
  baseline: string;
  assumptions: string[];
  milestones: Array<{ title: string; description: string; week: number }>;
  session_templates: PlanSessionTemplate[];
  weekly_focus: string[];
  progression: string;
  checkpoints: string[];
  risks: string[];
  fallback_rules: string[];
  summary: string;
  duration_weeks: number;
  weekly_commitment_target: number;
  available_days: string[];
  schedule: Array<PlanSessionTemplate & { week: number; scheduled_at: string }>;
}

const stringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');
const nonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

export function parseClarification(value: unknown, fallback: GoalClarification): GoalClarification {
  if (!value || typeof value !== 'object') return fallback;
  const candidate = value as Record<string, unknown>;
  const questions = Array.isArray(candidate.questions) ? candidate.questions.filter(nonEmptyString).slice(0, 3) : [];
  if (questions.length < 2) return fallback;
  const duration = Number(candidate.recommended_duration_weeks);
  return {
    questions,
    recommended_duration_weeks: Number.isFinite(duration) ? Math.min(52, Math.max(1, Math.round(duration))) : fallback.recommended_duration_weeks,
    rationale: nonEmptyString(candidate.rationale) ? candidate.rationale.trim() : fallback.rationale,
  };
}

export function parsePlan(value: unknown, fallback: GoalPlan): GoalPlan {
  if (!value || typeof value !== 'object') return fallback;
  const candidate = value as Record<string, unknown>;
  const schedule = Array.isArray(candidate.schedule) ? candidate.schedule : [];
  const milestones = Array.isArray(candidate.milestones) ? candidate.milestones : [];
  const templates = Array.isArray(candidate.session_templates) ? candidate.session_templates : [];
  if (!nonEmptyString(candidate.outcome) || !nonEmptyString(candidate.success_metric) || !schedule.length || !milestones.length) return fallback;
  if (!stringArray(candidate.assumptions) || !stringArray(candidate.weekly_focus) || !stringArray(candidate.checkpoints) || !stringArray(candidate.risks) || !stringArray(candidate.fallback_rules)) return fallback;
  return {
    outcome: String(candidate.outcome),
    success_metric: String(candidate.success_metric),
    baseline: nonEmptyString(candidate.baseline) ? String(candidate.baseline) : fallback.baseline,
    assumptions: candidate.assumptions,
    milestones: milestones.filter((m) => typeof m === 'object' && m !== null).map((m) => m as { title: string; description: string; week: number }).filter((m) => nonEmptyString(m.title) && nonEmptyString(m.description) && Number.isFinite(Number(m.week))),
    session_templates: templates.filter((t) => typeof t === 'object' && t !== null).map((t) => t as PlanSessionTemplate).filter((t) => nonEmptyString(t.day) && nonEmptyString(t.task)),
    weekly_focus: candidate.weekly_focus,
    progression: nonEmptyString(candidate.progression) ? String(candidate.progression) : fallback.progression,
    checkpoints: candidate.checkpoints,
    risks: candidate.risks,
    fallback_rules: candidate.fallback_rules,
    summary: nonEmptyString(candidate.summary) ? String(candidate.summary) : fallback.summary,
    duration_weeks: Number(candidate.duration_weeks) || fallback.duration_weeks,
    weekly_commitment_target: Number(candidate.weekly_commitment_target) || fallback.weekly_commitment_target,
    available_days: stringArray(candidate.available_days) ? candidate.available_days : fallback.available_days,
    schedule: schedule.filter((item) => typeof item === 'object' && item !== null).map((item) => item as GoalPlan['schedule'][number]).filter((item) => nonEmptyString(item.task) && nonEmptyString(item.day) && Number.isFinite(Number(item.week))),
  };
}
