import test from 'node:test';
import assert from 'node:assert/strict';
import { analyseGoalForEvidence } from '../src/lib/armadillo.ts';

test('Armadillo routes common categories to useful evidence', () => {
  const cases = [
    ['Run a faster 5K', 'Running', 'Strava'],
    ['Build a robotics prototype', 'Engineering', 'Google Calendar'],
    ['Finish my Bible reading plan', 'Bible Reading', 'YouVersion Bible'],
    ['Study for my physics exam', 'Study', 'Google Calendar'],
    ['Read 12 books', 'Reading', 'Google Books'],
  ] as const;
  for (const [title, type, integration] of cases) {
    const result = analyseGoalForEvidence({ title });
    assert.equal(result.goal_type, type);
    assert.equal(result.integration, integration);
    assert.ok(result.evidence.length > 0);
    assert.ok(result.confidence >= 0.65 && result.confidence <= 0.98);
  }
});

test('Armadillo safely falls back for unknown goals', () => {
  const result = analyseGoalForEvidence({ title: 'Do something completely unusual' });
  assert.equal(result.category, 'General');
  assert.equal(result.integration, null);
  assert.equal(result.confidence, 0.55);
});
