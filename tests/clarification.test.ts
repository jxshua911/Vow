import test from 'node:test';
import assert from 'node:assert/strict';
import { answerForPlanning, CLARIFICATION_SKIP, rememberClarificationAnswers, reuseClarificationAnswers } from '../src/lib/clarification.ts';

test('reuses an answer when the same question returns in a later round', () => {
  assert.deepEqual(reuseClarificationAnswers(['What is your current running level?'], {
    'What is your current running level?': 'I can run 5 km comfortably',
  }), ['I can run 5 km comfortably']);
});

test('reuses a relevant answer when a follow-up is rephrased', () => {
  assert.deepEqual(reuseClarificationAnswers(['What running experience do you have currently?'], {
    'What is your current running level?': 'I can run 5 km comfortably',
  }), ['I can run 5 km comfortably']);
});

test('does not reuse an answer when the questions are unrelated', () => {
  assert.deepEqual(reuseClarificationAnswers(['What is your monthly saving target?'], {
    'What is your current running level?': 'I can run 5 km comfortably',
  }), ['']);
});

test('an explicit skip becomes a visible assumption instruction for the planner', () => {
  assert.match(answerForPlanning(CLARIFICATION_SKIP), /USER_SKIPPED/);
  assert.match(answerForPlanning(''), /adjustable assumption/);
});

test('remembering answers ignores skipped and blank responses', () => {
  const remembered = rememberClarificationAnswers(
    { 'What is your goal?': 'Finish a 5K' },
    ['What is your pace?', 'What is your schedule?', 'What is your experience?'],
    ['__VOW_SKIP_USE_ASSUMPTION__', '', 'Beginner'],
  );
  assert.deepEqual(remembered, { 'What is your goal?': 'Finish a 5K', 'What is your experience?': 'Beginner' });
});
