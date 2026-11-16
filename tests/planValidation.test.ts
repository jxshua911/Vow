import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureCompleteActionTree, hasCompleteActionTree, hasMeasurableEvidence, validateCategorySpecificDetail } from '../supabase/functions/vow-goal-ai/planValidation.ts';

const task = (title: string) => ({
  type: 'task',
  title,
  instructions: 'Complete ' + title.toLowerCase() + ' using the supplied material, then check the result against the stated objective.',
  substeps: [
    'Prepare the materials needed for ' + title.toLowerCase() + '.',
    'Complete the work and record the result for ' + title.toLowerCase() + '.',
  ],
});

test('recognises useful evidence and avoids image-dimension false positives', () => {
  assert.equal(hasMeasurableEvidence('Increase weekly savings by 15%'), true);
  assert.equal(hasMeasurableEvidence('Complete 4 x 8 repetitions'), true);
  assert.equal(hasMeasurableEvidence('Read for 30 minutes'), true);
  assert.equal(hasMeasurableEvidence('Complete 12 practice questions'), true);
  assert.equal(hasMeasurableEvidence('Save RM500 each month'), true);
  assert.equal(hasMeasurableEvidence('Practise twice a week'), true);
  assert.equal(hasMeasurableEvidence('Create a 1080 × 1440 carousel'), false);
  assert.equal(hasMeasurableEvidence('Make progress'), false);
});

test('category aliases are validated even for short plans', () => {
  assert.equal(validateCategorySpecificDetail('fitness', 'Run 3 km, practise mobility, and record pace', 1), null);
  assert.equal(validateCategorySpecificDetail('learning', 'Solve algebra problems and use recall quizzes', 2), null);
  assert.equal(validateCategorySpecificDetail('study', 'Generic progress on the goal without study actions', 1), 'CATEGORY_DETAIL_STUDY');
  assert.equal(validateCategorySpecificDetail('money', 'Track expenses and update the monthly budget', 1), null);
  assert.equal(validateCategorySpecificDetail('career', 'Interview five potential customers and validate pricing', 1), null);
  assert.equal(validateCategorySpecificDetail('creative', 'Draw studies and revise technique using feedback', 1), null);
  assert.equal(validateCategorySpecificDetail('business', 'Review the plan, practise the routine, and track progress', 1), 'CATEGORY_DETAIL_BUSINESS');
  assert.equal(validateCategorySpecificDetail('organisation', 'Clean the kitchen and label storage boxes', 1), null);
  assert.equal(validateCategorySpecificDetail('general', 'No category keywords', 8), null);
});

test('accepts a complete domain-neutral executable action tree', () => {
  assert.equal(hasCompleteActionTree([
    task('Read the assigned chapter'),
    task('Answer the practice questions'),
    task('Check and correct the answers'),
  ]), true);
});

test('accepts grouped actions and nested rest periods', () => {
  const actions = [
    { title: 'FOUNDATIONS', type: 'category', children: [
      { ...task('Limits practice') },
      { title: 'Short break', type: 'rest', duration_seconds: 300 },
    ] },
    { title: 'PRACTICE', type: 'category', children: [
      { ...task('Past exam questions') },
    ] },
    { title: 'REVIEW', type: 'category', children: [
      { ...task('Error review') },
    ] },
  ];
  assert.equal(hasCompleteActionTree(actions), true);
});

test('rejects missing, malformed, vague and shallow action breakdowns', () => {
  assert.equal(hasCompleteActionTree(null), false);
  assert.equal(hasCompleteActionTree([task('One'), task('Two')]), false);
  assert.equal(hasCompleteActionTree([
    { ...task('Read'), substeps: 'not-an-array' },
    task('Practise'),
    task('Review'),
  ]), false);
  assert.equal(hasCompleteActionTree([
    { title: 'Study calculus', instructions: 'Work through the material carefully.' },
    task('Practise problems'),
    task('Review answers'),
  ]), false);
  assert.equal(hasCompleteActionTree([
    { title: 'Read this', instructions: 'Do this task.', substeps: ['Read the task carefully', 'Finish the task now'] },
    task('Practise'),
    task('Review'),
  ]), false);
});

test('rejects excessive depth and excessive total node counts', () => {
  const nested = (depth: number): Record<string, unknown> =>
    depth === 0
      ? task('Complete the final task')
      : { type: 'group', title: 'Group level ' + depth, children: [nested(depth - 1), task('Complete sibling ' + depth)] };
  assert.equal(hasCompleteActionTree([nested(5), task('Second root'), task('Third root')]), false);

  const broad = Array.from({ length: 12 }, (_, index) => ({
    type: 'group',
    title: 'Group ' + index,
    children: Array.from({ length: 8 }, (_, child) => task('Task ' + index + ' ' + child)),
  }));
  assert.equal(hasCompleteActionTree(broad), false);
});

test('validates rest durations strictly', () => {
  const rest = (duration: unknown) => ({ type: 'rest', title: 'Rest', duration_seconds: duration });
  assert.equal(hasCompleteActionTree([rest(60), task('Do the work'), task('Review the work'), task('Record the result')]), true);
  assert.equal(hasCompleteActionTree([rest(true), task('Do the work'), task('Review the work'), task('Record the result')]), false);
  assert.equal(hasCompleteActionTree([rest(0), task('Do the work'), task('Review the work'), task('Record the result')]), false);
  assert.equal(hasCompleteActionTree([rest(90000), task('Do the work'), task('Review the work'), task('Record the result')]), false);
});

test('does not fabricate a successful-looking action tree when output is incomplete', () => {
  assert.deepEqual(ensureCompleteActionTree([], {
    task: 'Study calculus',
    purpose: 'Improve understanding',
    targetMetric: 'Complete ten problems',
  }), []);
});

test('requires three executable leaves; rest periods do not count as work', () => {
  assert.equal(hasCompleteActionTree([
    { title: 'Break', type: 'rest', duration_seconds: 120 },
    task('Complete the first work block'),
    task('Complete the second work block'),
  ]), false);
  assert.equal(hasCompleteActionTree([
    { title: 'Break', type: 'rest', duration_seconds: 120 },
    task('Complete the first work block'),
    task('Complete the second work block'),
    task('Record and review the result'),
  ]), true);
});

test('accepts currency symbols and common frequency measures', () => {
  assert.equal(hasMeasurableEvidence('Save $250 per month'), true);
  assert.equal(hasMeasurableEvidence('Set aside €40 weekly'), true);
  assert.equal(hasMeasurableEvidence('Complete 3 times per week'), true);
  assert.equal(hasMeasurableEvidence('Create a 1080 x 1440 design'), false);
  assert.equal(hasMeasurableEvidence('Create a 1080 x 1440 design and complete 4 x 8 sets'), true);
});

test('accepts normalized empty optional fields on group and rest nodes', () => {
  const normalizedGroup = (title: string, child: unknown) => ({
    type: 'category',
    title,
    instructions: '',
    substeps: [],
    children: [child],
  });
  const normalizedRest = {
    type: 'rest',
    title: 'Rest',
    instructions: '',
    substeps: [],
    rest_seconds: 90,
    children: [],
  };
  assert.equal(hasCompleteActionTree([
    normalizedGroup('Preparation', task('Prepare the required materials')),
    normalizedGroup('Execution', task('Complete the planned exercise')),
    normalizedGroup('Review', task('Record and assess the outcome')),
    normalizedRest,
  ]), true);
});

test('does not accept generic verbs as skill-specific evidence', () => {
  assert.equal(validateCategorySpecificDetail('Creative Skills', 'Build something, create something, and practise more.', 1), 'CATEGORY_DETAIL_SKILL');
});

test('maps every AI classifier category family to a supported validator', () => {
  assert.equal(validateCategorySpecificDetail('Languages', 'Translate ten phrases and practise pronunciation', 1), null);
  assert.equal(validateCategorySpecificDetail('Crafts/Hobbies', 'Create a sketch and refine the drawing technique', 1), null);
  assert.equal(validateCategorySpecificDetail('Technology/Projects', 'Build the feature and run the acceptance tests', 1), null);
  assert.equal(validateCategorySpecificDetail('Career/Projects', 'Interview clients and revise the portfolio', 1), null);
  assert.equal(validateCategorySpecificDetail('Personal Development', 'Build a daily routine and review the habit', 1), null);
  assert.equal(validateCategorySpecificDetail('Creative Skills', 'Compose a draft and rehearse the performance', 1), null);
  assert.equal(validateCategorySpecificDetail('Practical Skills', 'Practise the technique and prepare the materials', 1), null);
});
