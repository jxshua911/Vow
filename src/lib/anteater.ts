import type { GoalContext } from './goalContext';

export interface AnteaterExecutionContract {
  primary_metric: string;
  evidence_sources: string[];
  execution_mode: 'tracked-session' | 'external-evidence' | 'manual';
  next_action: string;
  checkpoint: string;
}

export function buildAnteaterContract(context: GoalContext): AnteaterExecutionContract {
  const plan = context.plan;
  const firstScheduleItem = Array.isArray(plan?.schedule)
    ? (plan.schedule[0] as Record<string, unknown> | undefined)
    : undefined;
  const nextAction = context.activeStep || (typeof firstScheduleItem?.task === 'string' ? firstScheduleItem.task : null) || `Work toward ${context.goal.outcome}.`;
  const evidenceSources = [...context.armadillo.evidence];
  if (context.armadillo.integration) evidenceSources.push(context.armadillo.integration);

  let executionMode: AnteaterExecutionContract['execution_mode'] = 'manual';
  if (context.armadillo.integration && context.armadillo.integration !== 'Google Calendar') executionMode = 'external-evidence';
  if (!context.armadillo.integration) executionMode = 'tracked-session';
  if (context.goal.weekly_commitment_target > 0) executionMode = context.armadillo.integration ? executionMode : 'tracked-session';

  return {
    primary_metric: context.armadillo.metric,
    evidence_sources: [...new Set(evidenceSources)].slice(0, 8),
    execution_mode: executionMode,
    next_action: nextAction,
    checkpoint: `Review progress against ${context.armadillo.metric} at the next weekly review.`,
  };
}
