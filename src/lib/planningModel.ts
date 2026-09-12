import type { DomainFlow } from './domainFlows.ts';

export type PlanningMode = 'one_time' | 'project' | 'recurring' | 'mastery' | 'performance' | 'event' | 'adaptive';

export type PlanningDecision = {
  mode: PlanningMode;
  reason: string;
  requires_deadline: boolean;
  requires_schedule: boolean;
  estimated_horizon_weeks: number | null;
  cadence_hint: string | null;
};

const has = (text: string, patterns: string[]) => patterns.some((item) => text.includes(item));

export function classifyPlanningMode(input: { title?: string | null; outcome?: string | null; why_it_matters?: string | null }, flow: DomainFlow): PlanningDecision {
  const text = [input.title, input.outcome, input.why_it_matters, flow.goal_types.join(' ')].filter(Boolean).join(' ').toLowerCase();
  if (has(text, ['once','one time','single time','just once','one-off','one off','make this','build this','create this','cook this','prepare this'])) {
    return { mode: 'one_time', reason: 'The goal describes a finite outcome that can be completed once.', requires_deadline: false, requires_schedule: false, estimated_horizon_weeks: null, cadence_hint: null };
  }
  if (has(text, ['by ','deadline','before ','exam','competition','race day','event date','launch date','due date'])) {
    return { mode: 'event', reason: 'The outcome is anchored to a real deadline or event.', requires_deadline: true, requires_schedule: true, estimated_horizon_weeks: null, cadence_hint: null };
  }
  if (has(text, ['faster','sub-','pb','personal best','qualify','score','pace','strength target','weight target','time target'])) {
    return { mode: 'performance', reason: 'The goal is defined by improving a measurable performance outcome.', requires_deadline: false, requires_schedule: true, estimated_horizon_weeks: null, cadence_hint: 'adaptive' };
  }
  if (has(text, ['learn','learn to','master','become fluent','get better at','improve my','skill','practice'])) {
    return { mode: 'mastery', reason: 'The goal involves developing capability rather than simply completing a finite task.', requires_deadline: false, requires_schedule: false, estimated_horizon_weeks: null, cadence_hint: 'adaptive' };
  }
  if (has(text, ['every day','daily','each day','each week','weekly','habit','routine','consistently','regularly'])) {
    return { mode: 'recurring', reason: 'The desired outcome is an ongoing behaviour or rhythm.', requires_deadline: false, requires_schedule: true, estimated_horizon_weeks: null, cadence_hint: 'user-defined' };
  }
  if (['Culinary','Creative Arts','Technology/Projects','Career/Projects','Home & Life'].includes(flow.category)) {
    return { mode: 'project', reason: 'The domain normally benefits from a finite sequence of deliverables, but VOW should infer the actual horizon from the work involved.', requires_deadline: false, requires_schedule: false, estimated_horizon_weeks: null, cadence_hint: null };
  }
  return { mode: 'adaptive', reason: 'The goal needs domain-specific discovery before VOW chooses a timeline.', requires_deadline: false, requires_schedule: false, estimated_horizon_weeks: null, cadence_hint: 'adaptive' };
}
