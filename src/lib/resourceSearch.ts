import type { GoalContext } from '@/lib/goalContext';

export interface ResourceSearchPlan {
  level: 'beginner' | 'intermediate' | 'advanced';
  youtubeQueries: string[];
  webQueries: string[];
  appKeywords: string[];
}

export function buildResourceSearchPlan(context: GoalContext): ResourceSearchPlan {
  const level = context.personalisationComplete ? context.difficulty : 'beginner';
  const base = [context.goal.title, context.armadillo.goal_type].filter(Boolean).join(' ');
  const step = context.activeStep ? ` ${context.activeStep}` : '';
  const answers = context.answers.filter((answer) => answer.answer?.trim()).map((answer) => answer.answer!.trim()).slice(0, 3);
  const personalContext = answers.length ? ` ${answers.join(' ')}` : '';

  return {
    level,
    youtubeQueries: [
      `${base}${step} ${level} tutorial${personalContext}`,
      `${base}${step} ${level} walkthrough${personalContext}`,
    ],
    webQueries: [
      `${base}${step} ${level} guide${personalContext}`,
      `${base}${step} ${level} resources${personalContext}`,
    ],
    appKeywords: [context.armadillo.goal_type, context.armadillo.category, ...context.armadillo.evidence].filter(Boolean),
  };
}

export function isBeginnerFallback(context: GoalContext): boolean {
  return !context.personalisationComplete || context.answers.every((answer) => !answer.answer?.trim());
}
