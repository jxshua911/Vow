import type { GoalContext } from '@/lib/goalContext';
import { buildResourceSearchPlan as buildContextResourceSearchPlan } from '@/lib/goalContext';

export interface ResourceSearchPlan {
  level: 'beginner' | 'intermediate' | 'advanced';
  youtubeQueries: string[];
  webQueries: string[];
  appKeywords: string[];
}

export function buildResourceSearchPlan(context: GoalContext): ResourceSearchPlan {
  const plan = buildContextResourceSearchPlan(context);
  return {
    level: context.personalisationComplete ? context.difficulty : 'beginner',
    youtubeQueries: plan.youtube,
    webQueries: plan.web,
    appKeywords: plan.apps,
  };
}

export function isBeginnerFallback(context: GoalContext): boolean {
  return !context.personalisationComplete || context.answers.every((answer) => !answer.answer?.trim());
}
