import type { Goal, GoalClarificationAnswer } from '../types/database.ts';
import { analyseGoalForEvidence, type ArmadilloResult } from './armadillo.ts';
import { buildAnteaterContract, type AnteaterExecutionContract } from './anteater.ts';
import { rankHedgehogIntegrations, type HedgehogCandidate } from './hedgehog.ts';
import { INTEGRATIONS } from './integrations/catalog.ts';
import { inferGoalDifficulty, normaliseAnswers, unansweredQuestions } from './goalContextCore.ts';
import { detectDomainFlow, type DomainFlow } from './domainFlows.ts';
import { classifyPlanningMode, type PlanningDecision } from './planningModel.ts';

export type GoalDifficulty = 'beginner' | 'intermediate' | 'advanced';
export type GoalResourceType = 'youtube' | 'web' | 'app';

export interface GoalContext {
  goal: Pick<Goal, 'id' | 'title' | 'outcome' | 'why_it_matters' | 'start_date' | 'deadline' | 'duration' | 'status' | 'weekly_commitment_target' | 'planning_horizon_weeks' | 'planning_timezone'> & { planning_mode?: string | null; horizon_source?: string | null };
  answers: Array<{ question: string; answer: string | null; question_order: number }>;
  unansweredQuestions: string[];
  difficulty: GoalDifficulty;
  personalisationComplete: boolean;
  domainFlow: DomainFlow;
  planning: PlanningDecision;
  armadillo: ArmadilloResult;
  anteater: AnteaterExecutionContract;
  hedgehog: HedgehogCandidate[];
  plan: Record<string, unknown> | null;
  availableTime: string;
  preferences: string[];
  constraints: string[];
  activeStep?: string | null;
  learning: Record<string, unknown>;
}

function extractAnswerSignal(answers: GoalClarificationAnswer[], patterns: RegExp[]): string[] {
  return answers.filter((answer) => answer.answer?.trim() && patterns.some((pattern) => pattern.test(answer.answer || ''))).map((answer) => answer.answer!.trim()).slice(0, 5);
}
function persistedLearning(goal: Goal): Record<string, unknown> {
  return goal.goal_context_json && typeof goal.goal_context_json === 'object' ? goal.goal_context_json : {};
}
function persistedArmadillo(goal: Goal): ArmadilloResult | null {
  const stored = persistedLearning(goal).armadillo;
  if (!stored || typeof stored !== 'object') return null;
  const candidate = stored as Partial<ArmadilloResult>;
  if (typeof candidate.category !== 'string' || typeof candidate.goal_type !== 'string' || typeof candidate.metric !== 'string' || !Array.isArray(candidate.evidence)) return null;
  return { category: candidate.category, goal_type: candidate.goal_type, metric: candidate.metric, evidence: candidate.evidence.filter((item): item is string => typeof item === 'string'), integration: typeof candidate.integration === 'string' ? candidate.integration : null, fallback: typeof candidate.fallback === 'string' ? candidate.fallback : 'Manual tracking remains available.', confidence: Number.isFinite(Number(candidate.confidence)) ? Number(candidate.confidence) : 0.5, needs_clarification: Boolean((candidate as { needs_clarification?: unknown }).needs_clarification), clarification_reasons: Array.isArray((candidate as { clarification_reasons?: unknown }).clarification_reasons) ? ((candidate as { clarification_reasons: unknown[] }).clarification_reasons.filter((item): item is string => typeof item === 'string')) : [], flow_id: typeof candidate.flow_id === 'string' ? candidate.flow_id : 'domain-discovery', flow_progression: typeof candidate.flow_progression === 'string' ? candidate.flow_progression : '', research_focus: Array.isArray((candidate as { research_focus?: unknown }).research_focus) ? ((candidate as { research_focus: unknown[] }).research_focus.filter((item): item is string => typeof item === 'string')) : [] };
}

export function buildGoalContext(goal: Goal, answers: GoalClarificationAnswer[] = [], activeStep?: string | null): GoalContext {
  const normalised = normaliseAnswers(answers);
  const unanswered = unansweredQuestions(answers);
  const learning = persistedLearning(goal);
  const domainFlow = detectDomainFlow(goal).flow;
  const armadillo = persistedArmadillo(goal) || analyseGoalForEvidence(goal);
  const planning = classifyPlanningMode(goal, domainFlow);
  const availableTime = answers.find((answer) => /time|minutes|hour|hours|schedule|availability|day/i.test(answer.question))?.answer?.trim() || (typeof learning.availableTime === 'string' ? learning.availableTime : 'VOW determines workload from the goal, answers and actual cadence needs.');
  const storedPreferences = Array.isArray(learning.preferences) ? learning.preferences.filter((item): item is string => typeof item === 'string') : [];
  const storedConstraints = Array.isArray(learning.constraints) ? learning.constraints.filter((item): item is string => typeof item === 'string') : [];
  const preferences = [...storedPreferences, ...extractAnswerSignal(answers, [/prefer|like|enjoy|want|rather/i])].filter((value, index, all) => all.indexOf(value) === index).slice(0, 8);
  const constraints = [...storedConstraints, ...extractAnswerSignal(answers, [/constraint|limit|can't|cannot|busy|equipment|injur|budget|school|work/i])].filter((value, index, all) => all.indexOf(value) === index).slice(0, 8);
  const partialContext = {
    goal: { id: goal.id, title: goal.title, outcome: goal.outcome, why_it_matters: goal.why_it_matters, start_date: goal.start_date, deadline: goal.deadline, duration: goal.duration, status: goal.status, weekly_commitment_target: goal.weekly_commitment_target, planning_horizon_weeks: goal.planning_horizon_weeks, planning_timezone: goal.planning_timezone, planning_mode: (goal as Goal & { planning_mode?: string | null }).planning_mode, horizon_source: (goal as Goal & { horizon_source?: string | null }).horizon_source },
    answers: normalised, unansweredQuestions: unanswered, difficulty: inferGoalDifficulty(answers),
    personalisationComplete: normalised.length > 0 && unanswered.length === 0 && domainFlow.id !== 'domain-discovery',
    domainFlow, planning, armadillo, plan: goal.plan_json, availableTime, preferences, constraints,
    activeStep: activeStep ?? (typeof learning.current_plan_step === 'string' ? learning.current_plan_step : null), learning,
  };
  const anteater = buildAnteaterContract(partialContext as GoalContext);
  const hedgehog = rankHedgehogIntegrations(partialContext as GoalContext, INTEGRATIONS);
  return { ...partialContext, anteater, hedgehog };
}

export function goalContextPrompt(context: GoalContext): string {
  return [
    `Goal: ${context.goal.title}`, `Outcome: ${context.goal.outcome}`, `Why: ${context.goal.why_it_matters || 'Not supplied'}`,
    `Domain flow: ${context.domainFlow.id}`, `Category: ${context.domainFlow.category}`, `Goal type: ${context.armadillo.goal_type}`,
    `Planning mode: ${context.planning.mode}`, `Planning rationale: ${context.planning.reason}`, `Estimated horizon: ${context.planning.estimated_horizon_weeks ?? 'system decides'}`,
    `Requires deadline: ${context.planning.requires_deadline ? 'yes' : 'no'}`, `Requires schedule: ${context.planning.requires_schedule ? 'yes' : 'no'}`,
    `Domain questions: ${context.domainFlow.discovery_questions.join(' | ')}`, `Domain metrics: ${context.domainFlow.metrics.join(', ')}`,
    `Evidence: ${context.armadillo.evidence.join(', ')}`, `Evidence metric: ${context.armadillo.metric}`, `Suggested integration: ${context.armadillo.integration || 'none'}`,
    `Difficulty: ${context.difficulty}`, `Armadillo clarification required: ${context.armadillo.needs_clarification ? 'yes' : 'no'}`, `Armadillo reasons: ${context.armadillo.clarification_reasons.join(' | ') || 'none'}`,
    `Anteater execution mode: ${context.anteater.execution_mode}`, `Anteater primary metric: ${context.anteater.primary_metric}`, `Anteater next action: ${context.anteater.next_action}`, `Anteater checkpoint: ${context.anteater.checkpoint}`,
    `Hedgehog candidates: ${context.hedgehog.length ? context.hedgehog.slice(0, 5).map((item) => `${item.name} (${item.score})`).join(' | ') : 'none'}`,
    `Personalisation complete: ${context.personalisationComplete ? 'yes' : 'no'}`, `Unanswered questions: ${context.unansweredQuestions.length ? context.unansweredQuestions.join(' | ') : 'none'}`,
    `Available time: ${context.availableTime}`, `Preferences: ${context.preferences.length ? context.preferences.join(' | ') : 'none supplied'}`,
    `Constraints: ${context.constraints.length ? context.constraints.join(' | ') : 'none supplied'}`, `Planning horizon: ${context.goal.planning_horizon_weeks || context.goal.duration || 'system determined'}`,
    `Planning timezone: ${context.goal.planning_timezone || 'local timezone'}`, `Active plan step: ${context.activeStep || 'not specified'}`,
    `Learning: ${JSON.stringify(context.learning).slice(0, 3000)}`, `Answers: ${context.answers.map((answer) => `Q=${answer.question} / A=${answer.answer || 'not supplied'}`).join(' | ') || 'none'}`,
  ].join('\n');
}

export function buildResourceSearchPlan(context: GoalContext): { youtube: string[]; web: string[]; apps: string[] } {
  const base = [context.goal.title, context.domainFlow.category, context.armadillo.goal_type].filter(Boolean).join(' ');
  const level = context.personalisationComplete ? context.difficulty : 'discovery';
  const step = context.activeStep ? ` ${context.activeStep}` : '';
  const contextTerms = [...context.preferences, ...context.constraints, ...context.domainFlow.research_focus.slice(0, 2)].slice(0, 5).join(' ');
  const suffix = contextTerms ? ` ${contextTerms}` : '';
  return { youtube: [`${base}${step} ${level} tutorial${suffix}`, `${base}${step} ${level} walkthrough${suffix}`], web: [`${base}${step} ${level} authoritative guide${suffix}`, `${base}${step} evidence based resources${suffix}`], apps: [context.armadillo.goal_type, context.domainFlow.category, ...context.armadillo.evidence].filter(Boolean) };
}

export function integrationIdsForGoal(context: GoalContext, integrationCatalog: Array<{ id: string; recommendedGoalKeywords: string[]; name: string; evidence?: string[] }>): string[] {
  return rankHedgehogIntegrations(context, integrationCatalog.map((item) => ({ id: item.id, name: item.name, evidence: item.evidence || [], recommendedGoalKeywords: item.recommendedGoalKeywords }))).map((item) => item.id);
}
