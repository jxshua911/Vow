import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureCompleteActionTree, hasCompleteActionTree, hasMeasurableEvidence, validateCategorySpecificDetail } from '../supabase/functions/vow-goal-ai/planValidation.ts';

test('recognises percentage measurements without requiring a word boundary after percent', () => {
  assert.equal(hasMeasurableEvidence('Increase weekly savings by 15%'), true);
  assert.equal(hasMeasurableEvidence('Complete 4 x 8 repetitions'), true);
  assert.equal(hasMeasurableEvidence('Read for 30 minutes'), true);
  assert.equal(hasMeasurableEvidence('Make progress'), false);
});

test('fitness category accepts exercise-specific session detail', () => {
  assert.equal(validateCategorySpecificDetail('fitness', 'Run 3 km, practise mobility, and record pace', 8), null);
});

test('learning and study aliases require learning actions', () => {
  assert.equal(validateCategorySpecificDetail('learning', 'Solve algebra problems and use recall quizzes', 8), null);
  assert.equal(validateCategorySpecificDetail('study', 'Generic progress on the goal without study actions', 8), 'CATEGORY_DETAIL_STUDY');
});

test('money and financial aliases require financial actions', () => {
  assert.equal(validateCategorySpecificDetail('money', 'Track expenses and update the monthly budget', 8), null);
  assert.equal(validateCategorySpecificDetail('financial', 'Generic progress with no relevant task detail', 8), 'CATEGORY_DETAIL_FINANCIAL');
});

test('career and business aliases require business actions', () => {
  assert.equal(validateCategorySpecificDetail('career', 'Interview five potential customers and validate pricing', 8), null);
  assert.equal(validateCategorySpecificDetail('business', 'Generic progress with no relevant task detail', 8), 'CATEGORY_DETAIL_BUSINESS');
});

test('creative and skill aliases require practice or production actions', () => {
  assert.equal(validateCategorySpecificDetail('creative', 'Draw studies and revise technique using feedback', 8), null);
  assert.equal(validateCategorySpecificDetail('skill', 'Generic progress with no relevant task detail', 8), 'CATEGORY_DETAIL_SKILL');
});

test('short plans and unknown categories are not rejected by the category matrix', () => {
  assert.equal(validateCategorySpecificDetail('fitness', 'No category keywords', 2), null);
  assert.equal(validateCategorySpecificDetail('general', 'No category keywords', 8), null);
});

test('a specific category is rejected only when the whole planned detail lacks its signals', () => {
  assert.equal(validateCategorySpecificDetail('fitness', 'Review quarterly ledger entries', 8), 'CATEGORY_DETAIL_FITNESS');
});


test('accepts a complete grouped action tree with instructions, measurements and nested steps', () => {
  const actions = [
    { title: 'Biceps curls', instructions: 'Keep elbows close and lower under control.', sets: 3, reps: '10–12', rest_seconds: 60, substeps: ['Choose a manageable load', 'Curl without swinging', 'Lower for two seconds'] },
    { title: 'Triceps extensions', instructions: 'Keep upper arms steady throughout each repetition.', sets: 3, reps: '10', rest_seconds: 60, substeps: ['Set up safely', 'Extend smoothly', 'Record completed repetitions'] },
    { title: 'Shoulder press', instructions: 'Use a comfortable range and stop if painful.', duration_minutes: 8, substeps: ['Warm up shoulders', 'Press with controlled form', 'Record load and repetitions'] },
  ];
  assert.equal(hasCompleteActionTree(actions), true);
});

test('accepts explicit rest periods inside a structured action tree', () => {
  const actions = [
    { title: 'FOUNDATIONS', type: 'category', children: [
      { title: 'Limits practice', instructions: 'Solve three limit problems and check each answer.', type: 'task' },
      { title: 'Short break', type: 'rest', duration_seconds: 300 },
    ] },
    { title: 'PRACTICE', type: 'category', children: [
      { title: 'Past exam questions', instructions: 'Solve three past exam questions and mark the working.', type: 'task' },
    ] },
    { title: 'REVIEW', type: 'category', children: [
      { title: 'Error review', instructions: 'Record each mistake and write the corrected method.', type: 'task' },
    ] },
  ];
  assert.equal(hasCompleteActionTree(actions), true);
  assert.equal(hasCompleteActionTree([
    ...actions.slice(0, 2),
    { title: 'REVIEW', type: 'category', children: [
      { title: 'Break with no duration', type: 'rest' },
    ] },
  ]), false);
});

test('rejects flat or incomplete action trees that cannot guide a session', () => {
  assert.equal(hasCompleteActionTree(['Biceps', 'Triceps', 'Shoulders']), false);
  assert.equal(hasCompleteActionTree([
    { title: 'Biceps curls', instructions: 'Do the exercise', sets: 3, reps: '10', substeps: ['Curl'] },
    { title: 'Triceps extensions', instructions: 'Do the exercise', sets: 3, reps: '10', substeps: ['Extend'] },
    { title: 'Shoulder press', instructions: 'Do the exercise', sets: 3, reps: '10', substeps: ['Press'] },
  ]), false);
});


test('repairs a missing action tree from the session task and metric', () => {
  const actions = ensureCompleteActionTree([], {
    task: 'Solve five algebra problems',
    purpose: 'Improve accuracy with linear equations',
    targetMetric: '5 problems checked',
  });
  assert.equal(hasCompleteActionTree(actions), true);
  assert.equal(actions.length, 3);
  assert.match(String(actions[1].title), /Solve five algebra problems/);
});
