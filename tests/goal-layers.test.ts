import test from 'node:test';
import assert from 'node:assert/strict';
import { analyseGoalForEvidence } from '../src/lib/armadillo.ts';
import { buildAnteaterContract } from '../src/lib/anteater.ts';
import { rankHedgehogIntegrations } from '../src/lib/hedgehog.ts';
import { buildGoalContext } from '../src/lib/goalContext.ts';
import { INTEGRATIONS } from '../src/lib/integrations/catalog.ts';

test('goal layers stay connected', () => {
  const result = analyseGoalForEvidence({ title: 'Run a faster 5K' });
  assert.equal(result.goal_type, 'Running');
  assert.equal(result.integration, 'Strava');

  const goal = {
    id: 'goal-1', user_id: 'user-1', title: 'Run a faster 5K', outcome: 'Improve my 5K performance', why_it_matters: null,
    start_date: '2026-09-14', deadline: '2026-11-08', duration: '8w', status: 'active', weekly_commitment_target: 3,
    planning_horizon_weeks: 8, planning_timezone: 'Africa/Dar_es_Salaam', plan_json: null, goal_context_json: {},
  } as never;
  const context = buildGoalContext(goal);
  const contract = buildAnteaterContract(context);
  const ranked = rankHedgehogIntegrations(context, INTEGRATIONS);
  assert.equal(contract.primary_metric, context.armadillo.metric);
  assert.ok(contract.next_action.length > 0);
  assert.equal(ranked[0]?.id, 'strava');
  assert.ok(context.hedgehog.some((item) => item.id === 'strava'));
});
