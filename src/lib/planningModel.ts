import type { DomainFlow } from './domainFlows';

export type PlanningMode = 'one_time' | 'project' | 'recurring' | 'mastery' | 'performance' | 'event' | 'adaptive';

export type PlanningDecision = {
  mode: PlanningMode;
  reason: string;
  requires_deadline: boolean;
  requires_schedule: boolean;
  horizon_weeks: number | null;
  cadence: string | null;
};

const matches = (text: string, terms: string[]) => terms.some(term => text.includes(term));

export function classifyPlanningMode(input: { title?: string | null; outcome?: string | null; why_it_matters?: string | null }, flow: DomainFlow): PlanningDecision {
  const text = [input.title, input.outcome, input.why_it_matters].filter(Boolean).join(' ').toLowerCase();
  if (matches(text, ['once', 'one time', 'one-off', 'one off', 'just make', 'just cook', 'make this', 'cook this', 'build this', 'create this'])) {
    return { mode: 'one_time', reason: 'This is a finite outcome that can be completed once; VOW should plan the required steps rather than manufacture a recurring schedule.', requires_deadline: false, requires_schedule: false, horizon_weeks: null, cadence: null };
  }
  if (matches(text, ['by ', 'deadline', 'before ', 'exam', 'competition', 'race day', 'event date', 'launch date', 'due date'])) {
    return { mode: 'event', reason: 'The goal is constrained by a real date or event, so VOW should work backwards from that constraint.', requires_deadline: true, requires_schedule: true, horizon_weeks: null, cadence: null };
  }
  if (matches(text, ['faster', 'sub-', 'personal best', 'pb', 'qualify', 'target time', 'target score', 'pace target'])) {
    return { mode: 'performance', reason: 'Success depends on measurable performance improvement and repeated feedback.', requires_deadline: false, requires_schedule: true, horizon_weeks: null, cadence: 'adaptive' };
  }
  if (matches(text, ['learn ', 'learn to ', 'master ', 'become fluent', 'get better at', 'improve my ', 'practice ', 'practise '])) {
    return { mode: 'mastery', reason: 'The goal is capability development, so progression should be based on demonstrated ability rather than a fixed number of weeks.', requires_deadline: false, requires_schedule: false, horizon_weeks: null, cadence: 'adaptive' };
  }
  if (matches(text, ['every day', 'daily', 'each day', 'each week', 'weekly', 'habit', 'routine', 'consistently', 'regularly'])) {
    return { mode: 'recurring', reason: 'The outcome is an ongoing behaviour, so cadence is part of the goal itself.', requires_deadline: false, requires_schedule: true, horizon_weeks: null, cadence: 'user-defined' };
  }
  if (['Project', 'Programming', 'Engineering', 'Cooking', 'Writing', 'Photography', 'Career Development'].includes(flow.goal_types[0])) {
    return { mode: 'project', reason: 'The goal is a finite deliverable or project; VOW should derive the horizon from dependencies and workload.', requires_deadline: false, requires_schedule: false, horizon_weeks: null, cadence: null };
  }
  return { mode: 'adaptive', reason: 'There is not enough information yet to choose a sensible timeline. VOW should personalise the work first and derive timing from the actual goal.', requires_deadline: false, requires_schedule: false, horizon_weeks: null, cadence: 'adaptive' };
}
