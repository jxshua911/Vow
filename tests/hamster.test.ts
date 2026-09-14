import test from 'node:test';
import assert from 'node:assert/strict';
import { HAMSTER_MODES, HAMSTER_WORKFLOWS, inferHamsterMode, findDomainFlow, buildHamsterContext } from '../src/lib/hamster.ts';

test('Hamster exposes every distinct planning workflow', () => {
  assert.deepEqual(Object.keys(HAMSTER_WORKFLOWS).sort(), [...HAMSTER_MODES].sort());
  for (const mode of HAMSTER_MODES) {
    assert.ok(HAMSTER_WORKFLOWS[mode].name);
    assert.ok(HAMSTER_WORKFLOWS[mode].rules.length >= 3);
  }
});

test('one-time goals do not require a horizon', () => {
  const mode = inferHamsterMode({ title: 'Make ravioli' });
  assert.equal(mode, 'one_time');
  assert.equal(HAMSTER_WORKFLOWS[mode].requires_horizon, false);
  assert.equal(HAMSTER_WORKFLOWS[mode].output_shape, 'ordered_steps');
});

test('event and performance goals get their own flows', () => {
  assert.equal(inferHamsterMode({ title: 'Run a 10K under 55 minutes by race day' }), 'event');
  assert.equal(inferHamsterMode({ title: 'Run a 10K under 55 minutes' }), 'performance');
});

test('mastery, project and recurring remain distinct', () => {
  assert.equal(inferHamsterMode({ title: 'Master guitar improvisation' }), 'mastery');
  assert.equal(inferHamsterMode({ title: 'Build my portfolio website' }), 'project');
  assert.equal(inferHamsterMode({ title: 'Meditate every day' }), 'recurring');
});

test('generic learn wording remains a valid adaptive goal', () => {
  assert.equal(inferHamsterMode({ title: 'Learn about the history of my family' }), 'adaptive');
  assert.equal(inferHamsterMode({ title: 'Hamster' }), 'adaptive');
});

test('user timeframe is preserved in planning context', () => {
  const context = buildHamsterContext({ title: 'Make ravioli', time_target: 'before my birthday' });
  assert.equal(context.mode, 'one_time');
  assert.equal(context.time_target, 'before my birthday');
});

test('culinary goals resolve to a domain flow instead of General', () => {
  const flow = findDomainFlow('Practical Skills', 'Cooking');
  assert.ok(flow);
  assert.equal(flow?.id, 'practical');
});

test('adaptive context carries anti-generic rules', () => {
  const context = buildHamsterContext({ title: 'Improve my guitar playing', category: 'Creative Skills', goal_type: 'Music' });
  assert.equal(context.mode, 'mastery');
  assert.ok(context.domain);
  assert.ok(context.anti_generic_rules.some(rule => /Never silently substitute a generic goal template/i.test(rule)));
});
