import test from 'node:test';
import assert from 'node:assert/strict';
import { hasMeasurableEvidence, validateCategorySpecificDetail } from '../supabase/functions/vow-goal-ai/planValidation.ts';

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
  assert.equal(validateCategorySpecificDetail('financial', 'Generic progress with no money task details', 8), 'CATEGORY_DETAIL_FINANCIAL');
});

test('career and business aliases require business actions', () => {
  assert.equal(validateCategorySpecificDetail('career', 'Interview five potential customers and validate pricing', 8), null);
  assert.equal(validateCategorySpecificDetail('business', 'Generic progress with no customer or product action', 8), 'CATEGORY_DETAIL_BUSINESS');
});

test('creative and skill aliases require practice or production actions', () => {
  assert.equal(validateCategorySpecificDetail('creative', 'Draw studies and revise technique using feedback', 8), null);
  assert.equal(validateCategorySpecificDetail('skill', 'Generic progress without practice or a concrete task', 8), 'CATEGORY_DETAIL_SKILL');
});

test('short plans and unknown categories are not rejected by the category matrix', () => {
  assert.equal(validateCategorySpecificDetail('fitness', 'No category keywords', 2), null);
  assert.equal(validateCategorySpecificDetail('general', 'No category keywords', 8), null);
});

test('a specific category is rejected only when the whole planned detail lacks its signals', () => {
  assert.equal(validateCategorySpecificDetail('fitness', 'Set a budget and track spending', 8), 'CATEGORY_DETAIL_FITNESS');
});
