import type { Goal, GoalClarificationAnswer } from '@/types/database';
import { analyseGoalForEvidence, type ArmadilloResult } from '@/lib/armadillo';
import { inferGoalDifficulty, normaliseAnswers, unansweredQuestions } from '@/lib/goalContextCore';

export type GoalDifficulty = 'beginner' | 'intermediate' | 'advanced';
export type GoalResourceType = 'youtube' | 'web' | 'app';

export interface GoalContext {
  goal: Pick<Goal, 'id' | 'title' | 'outcome' | 'why_it_matters' | 'start_date' | 'deadline' | 'duration' | 'status' | 'weekly_commitment_target' | 'planning_horizon_weeks' | 'planning_timezone'>;
  answers: Array<{ question: string; answer: string | null; question_order: number }>;
  unansweredQuestions: string[];
  difficulty: GoalDifficulty;
  personalisationComplete: boolean;
  armadillo: ArmadilloResult;
  plan: Record<string, unknown> | null;
  availableTime: string;
  preferences: string[];
  constraints: string[];
  activeStep?: string | null;
}

function extractAnswerSignal(answers: GoalClarificationAnswer[], patterns: RegExp[]): string[] {
  return answers
    .filter((answer) => answer.answer?.trim() && patterns.some((pattern) => pattern.test(answer.answer || '')))
    .map((answer) => answer.answer!.trim())
    .slice(0, 5);
}

export function buildGoalContext(goal: Goal, answers: GoalClarificationAnswer[] = [], activeStep?: string | null): GoalContext {
  const normalised = normaliseAnswers(answers);
  const unanswered = unansweredQuestions(answers);
  const armadillo = analyseGoalForEvidence(goal);
  const availableTime = answers.find((answer) => /time|minutes|hour|hours|schedule|availability|day/i.test(answer.question))?.answer?.trim() || `${goal.weekly_commitment_target || 0} planned sessions/week`;
  const preferences = extractAnswerSignal(answers, [/prefer|like|enjoy|want|rather/i]);
  const constraints = extractAnswerSignal(answers, [/constraint|limit|can't|cannot|busy|equipment|injur|budget|school|work/i]);

  return {
    goal: {
      id: goal.id,
      title: goal.title,
      outcome: goal.outcome,
      why_it_matters: goal.why_it_matters,
      start_date: goal.start_date,
      deadline: goal.deadline,
      duration: goal.duration,
      status: goal.status,
      weekly_commitment_target: goal.weekly_commitment_target,
      planning_horizon_weeks: goal.planning_horizon_weeks,
      planning_timezone: goal.planning_timezone,
    },
    answers: normalised,
    unansweredQuestions: unanswered,
    difficulty: inferGoalDifficulty(answers),
    personalisationComplete: normalised.length > 0 && unanswered.length === 0,
    armadillo,
    plan: goal.plan_json,
    availableTime,
    preferences,
    constraints,
    activeStep: activeStep ?? null,
  };
}

export function goalContextPrompt(context: GoalContext): string {
  return [
    `Goal: ${context.goal.title}`,
    `Outcome: ${context.goal.outcome}`,
    `Why: ${context.goal.why_it_matters || 'Not supplied'}`,
    `Category: ${context.armadillo.category}`,
    `Goal type: ${context.armadillo.goal_type}`,
    `Evidence: ${context.armadillo.evidence.join(', ')}`,
    `Evidence metric: ${context.armadillo.metric}`,
    `Suggested integration: ${context.armadillo.integration || 'none'}`,
    `Difficulty: ${context.difficulty}`,
    `Personalisation complete: ${context.personalisationComplete ? 'yes' : 'no'}`,
    `Unanswered questions: ${context.unansweredQuestions.length ? context.unansweredQuestions.join(' | ') : 'none'}`,
    `Available time: ${context.availableTime}`,
    `Preferences: ${context.preferences.length ? context.preferences.join(' | ') : 'none supplied'}`,
    `Constraints: ${context.constraints.length ? context.constraints.join(' | ') : 'none supplied'}`,
    `Planning horizon: ${context.goal.planning_horizon_weeks || context.goal.duration || 'not specified'}`,
    `Planning timezone: ${context.goal.planning_timezone || 'local timezone'}`,
    `Active plan step: ${context.activeStep || 'not specified'}`,
    `Answers: ${context.answers.map((answer) => `Q=${answer.question} / A=${answer.answer || 'not supplied'}`).join(' | ') || 'none'}`,
  ].join('\n');
}

export function buildResourceSearchPlan(context: GoalContext): { youtube: string[]; web: string[]; apps: string[] } {
  const base = [context.goal.title, context.armadillo.goal_type].filter(Boolean).join(' ');
  const level = context.personalisationComplete ? context.difficulty : 'beginner';
  const step = context.activeStep ? ` ${context.activeStep}` : '';
  const contextTerms = [...context.preferences, ...context.constraints].slice(0, 3).join(' ');
  const suffix = contextTerms ? ` ${contextTerms}` : '';
  return {
    youtube: [`${base}${step} ${level} tutorial${suffix}`, `${base}${step} ${level} walkthrough${suffix}`],
    web: [`${base}${step} ${level} authoritative guide${suffix}`, `${base}${step} ${level} evidence based resources${suffix}`],
    apps: [context.armadillo.goal_type, context.armadillo.category, ...context.armadillo.evidence].filter(Boolean),
  };
}

export function integrationIdsForGoal(context: GoalContext, integrationCatalog: Array<{ id: string; recommendedGoalKeywords: string[]; name: string }>): string[] {
  const text = `${context.goal.title} ${context.goal.outcome} ${context.goal.why_it_matters || ''} ${context.armadillo.goal_type} ${context.armadillo.category} ${context.armadillo.evidence.join(' ')} ${context.preferences.join(' ')} ${context.constraints.join(' ')}`.toLowerCase();
  return integrationCatalog
    .map((integration) => ({ id: integration.id, score: integration.recommendedGoalKeywords.reduce((score, keyword) => score + (text.includes(keyword.toLowerCase()) ? 1 : 0), 0) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ id }) => id);
}
