import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSessionTiming, shouldIncrementMovedCount } from '../src/lib/sessionTiming.ts';

test('timed sessions keep the selected weekday and a valid ISO timestamp', () => {
  const result = resolveSessionTiming('timed', 'Monday', '2026-10-19T09:00:00+03:00');
  assert.equal(result.dayOfWeek, 'Monday');
  assert.equal(result.scheduledAt, '2026-10-19T06:00:00.000Z');
});

test('flexible-day sessions retain the weekday without a timestamp', () => {
  assert.deepEqual(resolveSessionTiming('flexible-day', 'Tuesday', '2026-10-20T09:00:00Z'), {
    mode: 'flexible-day', dayOfWeek: 'Tuesday', scheduledAt: null,
  });
});

test('unscheduled sessions discard both weekday and timestamp', () => {
  assert.deepEqual(resolveSessionTiming('unscheduled', 'Friday', '2026-10-23T09:00:00Z'), {
    mode: 'unscheduled', dayOfWeek: null, scheduledAt: null,
  });
});

test('timed mode never fabricates an invalid timestamp', () => {
  assert.equal(resolveSessionTiming('timed', 'Wednesday', 'not-a-date').scheduledAt, null);
});

test('moving between timed and flexible/unscheduled modes does not increment moved count', () => {
  assert.equal(shouldIncrementMovedCount('2026-10-19T09:00:00Z', null), false);
  assert.equal(shouldIncrementMovedCount(null, '2026-10-20T09:00:00Z'), false);
});

test('a changed timestamp increments moved count but an unchanged one does not', () => {
  assert.equal(shouldIncrementMovedCount('2026-10-19T09:00:00Z', '2026-10-20T09:00:00Z'), true);
  assert.equal(shouldIncrementMovedCount('2026-10-19T09:00:00Z', '2026-10-19T09:00:00Z'), false);
});
