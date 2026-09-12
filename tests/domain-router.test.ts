import test from 'node:test';
import assert from 'node:assert/strict';
import { specialistFor } from '../src/lib/domainRouter.ts';

test('ravioli is routed to the culinary specialist', () => {
  const result = specialistFor({ title: 'My goal is to make ravioli' });
  assert.ok(result);
  assert.equal(result?.id, 'cooking');
  assert.match(result?.planning_lens || '', /dish-specific/i);
});

test('different domains get different specialist flows', () => {
  assert.equal(specialistFor({ title: 'Run a faster 5K' })?.id, 'running');
  assert.equal(specialistFor({ title: 'Learn French' })?.id, 'languages');
  assert.equal(specialistFor({ title: 'Build an Arduino robot' })?.id, 'engineering');
  assert.equal(specialistFor({ title: 'Prepare a presentation' })?.id, 'public-speaking');
});
