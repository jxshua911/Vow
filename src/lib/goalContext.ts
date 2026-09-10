import type { Goal, GoalClarificationAnswer } from '@/types/database';
import { analyseGoalForEvidence, type ArmadilloResult } from '@/lib/armadillo';

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
  activeStep?: string | null;
}

function inferDifficulty(answers: GoalClarificationAnswer[]): GoalDifficulty {
  const answered = answers.filter((answer) => Boolean(answer.answer?.trim()));
  const text = answered.map((answer) => answer.answer?.toLowerCase() ?? '').join(' ');
  if (/beginner|new to|never|starting|no experience|first time/.test(text)) return 'beginner';
  if (/advanced|expert|years of experience|experienced|competitive/.test(text)) return 'advanced';
  if (/intermediate|some experience|familiar|already/.test(text)) return 'intermediate';
  return answered.length >= 2 ? 'intermediate' : 'beginner';
}

export function buildGoalContext(goal: Goal, answers: GoalClarificationAnswer[] = [], activeStep?: string | null): GoalContext {
  const unansweredQuestions = answers.filter((answer) => !answer.answer?.trim()).sort((a, b) => a.question_order - b.question_order).map((answer) => answer.question);
  const armadillo = analyseGoalForEvidence(goal);
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
    answers: answers.sort((a, b) => a.question_order - b.question_order).map((answer) => ({ question: answer.question, answer: answer.answer, question_order: answer.question_order })),
    unansweredQuestions,
    difficulty: inferDifficulty(answers),
    personalisationComplete: answers.length > 0 && unansweredQuestions.length === 0,
    armadillo,
    plan: goal.plan_json,
    activeStep: activeStep ?? null,
  };
}

export function goalContextPrompt(context: GoalContext): string {
  const unanswered = context.unansweredQuestions.length ? context.unansweredQuestions.join(' | ') : 'none';
  return [
    `Goal: ${context.goal.title}`,
    `Outcome: ${context.goal.outcome}`,
    `Why: ${context.goal.why_it_matters || 'Not supplied'}`,
    `Difficulty: ${context.difficulty}`,
    `Personalisation complete: ${context.personalisationComplete ? 'yes' : 'no'}`,
    `Unanswered questions: ${unanswered}`,
    `Category: ${context.armadillo.category}`,
    `Goal type: ${context.armadillo.goal_type}`,
    `Evidence: ${context.armadillo.evidence.join(', ')}`,
    `Recommended integration: ${context.armadillo.integration || 'none'}`,
    `Active plan step: ${context.activeStep || 'not specified'}`,
  ].join('\n');
}

export function resourceSearchQueries(context: GoalContext): { youtube: string[]; web: string[] } {
  const base = [context.goal.title, context.armadillo.goal_type].filter(Boolean).join(' ');
  const level = context.personalisationComplete ? context.difficulty : 'beginner';
  const step = context.activeStep ? ` ${context.activeStep}` : '';
  return {
    youtube: [
      `${base}${step} ${level} tutorial`,
      `${base}${step} ${level} guide`,
    ],
    web: [
      `${base}${step} ${level} guide`,
      `${base}${step} ${level} resources`,
    ],
  };
}

export function integrationIdsForGoal(context: GoalContext, integrationCatalog: Array<{ id: string; recommendedGoalKeywords: string[]; name: string }>): string[] {
  const text = `${context.goal.title} ${context.goal.outcome} ${context.goal.why_it_matters || ''} ${context.armadillo.goal_type} ${context.armadillo.category}`.toLowerCase();
  return integrationCatalog
    .map((integration) => ({ id: integration.id, score: integration.recommendedGoalKeywords.reduce((score, keyword) => score + (text.includes(keyword.toLowerCase()) ? 1 : 0), 0) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ id }) => id);
}
