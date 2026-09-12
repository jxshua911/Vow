import test from 'node:test';
import assert from 'node:assert/strict';
import { detectDomainFlow } from '../src/lib/domainFlows';
import { classifyPlanningMode } from '../src/lib/planningModel';

test('ravioli routes through a culinary-specific flow', () => {
  const result = detectDomainFlow({ title: 'My goal is to make ravioli' });
  assert.equal(result.flow.category, 'Practical Skills');
  assert.equal(result.flow.goal_types[0], 'Cooking');
  assert.equal(result.flow.id, 'culinary');
  assert.ok(result.flow.discovery_questions.some((q) => /equipment|ingredients|serving|budget|kitchen/i.test(q)));
  assert.ok(result.flow.research_focus.length >= 4);
});

test('one-time goals are not forced into weekly planning', () => {
  const flow = detectDomainFlow({ title: 'Make ravioli once for dinner' }).flow;
  const result = classifyPlanningMode({ title: 'Make ravioli once for dinner' }, flow);
  assert.equal(result.mode, 'one_time');
  assert.equal(result.requires_schedule, false);
  assert.equal(result.horizon_weeks, null);
});

test('mastery goals use adaptive progression instead of a fixed horizon', () => {
  const flow = detectDomainFlow({ title: 'Learn to make ravioli' }).flow;
  const result = classifyPlanningMode({ title: 'Learn to make ravioli' }, flow);
  assert.equal(result.mode, 'mastery');
  assert.equal(result.requires_deadline, false);
  assert.equal(result.cadence, 'adaptive');
});
