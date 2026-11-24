import test from 'node:test';
import assert from 'node:assert/strict';
import { durationToken, parseDurationToken } from '../src/lib/goalDuration.ts';

test('duration tokens preserve weeks, months and years as distinct units', () => {
  assert.equal(durationToken('8', 'weeks'), '8w');
  assert.equal(durationToken('3', 'months'), '3m');
  assert.equal(durationToken('1', 'years'), '1y');
});

test('legacy week durations restore as the exact number of weeks', () => {
  assert.deepEqual(parseDurationToken('8w'), { amount: 8, unit: 'weeks' });
  assert.deepEqual(parseDurationToken('1w'), { amount: 1, unit: 'weeks' });
});

test('year durations remain years instead of being rewritten as twelve months', () => {
  assert.deepEqual(parseDurationToken('1y'), { amount: 1, unit: 'years' });
});

test('invalid, fractional and unsafe duration tokens are rejected', () => {
  assert.equal(parseDurationToken('0w'), null);
  assert.equal(parseDurationToken('-2w'), null);
  assert.equal(parseDurationToken('1.5m'), null);
  assert.equal(parseDurationToken('9007199254740992w'), null);
  assert.equal(parseDurationToken('8days'), null);
  assert.equal(durationToken('1.5', 'weeks'), null);
});
