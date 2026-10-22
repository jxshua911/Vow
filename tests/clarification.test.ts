import test from 'node:test';
import assert from 'node:assert/strict';
import { answerForPlanning, CLARIFICATION_SKIP, clarificationQuestionsForPlanner, rememberClarificationAnswers, removeQuestionsAnsweredByPlanner, reuseClarificationAnswers } from '../src/lib/clarification.ts';

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

test('filters schedule and duration questions already answered in the planner', () => {
  assert.deepEqual(removeQuestionsAnsweredByPlanner([
    'How many days per week can you dedicate to training?',
    'What is your current experience with Muay Thai?',
    'What duration are you committing to?',
  ]), ['What is your current experience with Muay Thai?']);
});

test('keeps useful questions and removes duplicate wording', () => {
  assert.deepEqual(removeQuestionsAnsweredByPlanner([
    'What is your current starting point?',
    'What is your current starting point?',
    'What outcome would show progress?',
  ]), ['What is your current starting point?', 'What outcome would show progress?']);
});


test('filters redundant days, weekly session frequency, and session timing questions', () => {
  assert.deepEqual(removeQuestionsAnsweredByPlanner([
    'Which days work for you?',
    'How many sessions per week?',
    'What time should you train?',
    'What is your current experience with Spanish?',
  ]), [
    'What is your current experience with Spanish?',
  ]);
});

test('keeps legitimate goal-context questions across fitness, learning, and creative goals', () => {
  const questions = [
    'What equipment do you have available?',
    'What is your budget for learning materials?',
    'What tools or materials will your creative project require?',
  ];
  assert.deepEqual(removeQuestionsAnsweredByPlanner(questions), questions);
});

test('uses goal-specific fallback questions when every generated question is redundant', () => {
  assert.deepEqual(clarificationQuestionsForPlanner([
    'Which days work for you?',
    'How many sessions per week?',
    'What time should you train?',
  ]), [
    'What is your current starting point for this goal?',
    'What measurable result would show meaningful progress toward this goal?',
  ]);
});

test('keeps legitimate experience questions when redundant scheduling questions are mixed in', () => {
  assert.deepEqual(clarificationQuestionsForPlanner([
    'Which days work for you?',
    'How many sessions per week?',
    'What is your experience level with this goal?',
  ]), [
    'What is your experience level with this goal?',
  ]);
});
