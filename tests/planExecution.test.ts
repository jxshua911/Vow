import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInitialExecutionItems } from '../src/lib/planExecution.ts';

const step = (title: string, minutes = 30) => ({ order: 1, title, purpose: 'Do the work.', target: 'A result exists.', evidence: 'Record the result.', estimated_minutes: minutes });

test('generic goals materialise actionable execution items without goal-specific branches', () => {
  const items = buildInitialExecutionItems([step('Define hamster outcome')], null, [], new Date('2026-09-14T08:00:00Z'));
  assert.equal(items.length, 1);
  assert.equal(items[0].task, 'Define hamster outcome');
  assert.ok(new Date(items[0].scheduled_at).getTime() > Date.parse('2026-09-14T08:00:00Z'));
});

test('preferred times are scheduled conflict-free for a timed goal', () => {
  const items = buildInitialExecutionItems([step('Study calculus'), step('Practice calculus')], '{"Monday":"09:00","Tuesday":"09:00"}', [], new Date('2026-09-14T08:00:00Z'));
  assert.equal(new Date(items[0].scheduled_at).getDay(), 1);
  assert.equal(new Date(items[0].scheduled_at).getHours(), 9);
  assert.equal(new Date(items[1].scheduled_at).getDay(), 2);
  assert.equal(new Date(items[1].scheduled_at).getHours(), 9);
});

test('no timeframe still materialises work without creating a deadline', () => {
  const items = buildInitialExecutionItems([step('Draw for 30 minutes')], null, [], new Date('2026-09-14T08:00:00Z'));
  assert.equal(items.length, 1);
  assert.equal(items[0].week_number, 1);
  assert.ok(items[0].scheduled_at);
});

test('existing occupied slots are respected', () => {
  const items = buildInitialExecutionItems([step('Next action', 60)], null, [{ scheduledAt: '2026-09-14T09:00:00.000Z', durationMinutes: 60 }], new Date('2026-09-14T08:00:00Z'));
  assert.equal(new Date(items[0].scheduled_at).getHours(), 10);
});
