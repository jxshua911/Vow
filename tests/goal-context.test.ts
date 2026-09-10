import test from 'node:test';
import assert from 'node:assert/strict';
import { inferGoalDifficulty, normaliseAnswers, unansweredQuestions } from '../src/lib/goalContextCore.ts';
import { parseClarification, parsePlan, type GoalClarification, type GoalPlan } from '../src/lib/goalAI.ts';

const clarificationFallback: GoalClarification = {
  questions: ['baseline?', 'success?', 'constraints?'],
  recommended_duration_weeks: 8,
  rationale: 'fallback',
};

const planFallback: GoalPlan = {
  outcome: 'fallback', success_metric: 'progress', baseline: 'unknown', assumptions: [], milestones: [], session_templates: [], weekly_focus: [], progression: 'gradual', checkpoints: [], risks: [], fallback_rules: [], summary: 'fallback', duration_weeks: 8, weekly_commitment_target: 3, available_days: ['Monday'], schedule: [],
};

test('goal difficulty defaults to beginner without useful experience evidence', () => {
  assert.equal(inferGoalDifficulty([]), 'beginner');
  assert.equal(inferGoalDifficulty([{ answer: 'I am new to this', question_order: 0 }]), 'beginner');
});

test('goal difficulty recognises intermediate and advanced evidence', () => {
  assert.equal(inferGoalDifficulty([{ answer: 'I have some experience already', question_order: 0 }]), 'intermediate');
  assert.equal(inferGoalDifficulty([{ answer: 'I have years of experience and compete', question_order: 0 }]), 'advanced');
});

test('clarification questions preserve order and identify unanswered prompts', () => {
  const answers = [
    { question: 'Constraints?', answer: '', question_order: 2 },
    { question: 'Baseline?', answer: '20 minutes', question_order: 0 },
    { question: 'Success?', answer: null, question_order: 1 },
  ];
  assert.deepEqual(unansweredQuestions(answers), ['Success?', 'Constraints?']);
  assert.deepEqual(normaliseAnswers(answers).map((item) => item.question), ['Baseline?', 'Success?', 'Constraints?']);
});

test('invalid clarification output safely falls back', () => {
  assert.deepEqual(parseClarification({ questions: ['only one'] }, clarificationFallback), clarificationFallback);
  const parsed = parseClarification({ questions: ['a', 'b', 'c'], recommended_duration_weeks: 999, rationale: 'ok' }, clarificationFallback);
  assert.equal(parsed.recommended_duration_weeks, 52);
});

test('invalid plan output safely falls back', () => {
  assert.deepEqual(parsePlan({ outcome: 'x' }, planFallback), planFallback);
});
