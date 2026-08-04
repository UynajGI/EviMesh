import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertQuestionState,
  assertQuestionTransition,
  canTransitionQuestion,
  isQuestionState,
  QUESTION_STATES,
  questionTransitionsFrom,
} from '../src/question-state.mjs';

test('defines the complete question lifecycle', () => {
  assert.deepEqual(QUESTION_STATES, [
    'draft', 'proposed', 'under_review', 'admissible',
    'active', 'resolved', 'archived', 'rejected',
  ]);
  assert.deepEqual(questionTransitionsFrom('draft'), ['proposed']);
  assert.deepEqual(questionTransitionsFrom('under_review'), ['admissible', 'rejected']);
  assert.deepEqual(questionTransitionsFrom('active'), ['resolved', 'archived']);
  assert.deepEqual(questionTransitionsFrom('resolved'), ['archived']);
  assert.deepEqual(questionTransitionsFrom('archived'), []);
  assert.deepEqual(questionTransitionsFrom('rejected'), []);
  assert.equal(Object.isFrozen(QUESTION_STATES), true);
});

test('accepts only documented question transitions', () => {
  assert.equal(canTransitionQuestion('draft', 'proposed'), true);
  assert.equal(canTransitionQuestion('under_review', 'rejected'), true);
  assert.equal(canTransitionQuestion('admissible', 'active'), true);
  assert.equal(canTransitionQuestion('active', 'resolved'), true);
  assert.equal(canTransitionQuestion('resolved', 'archived'), true);
  assert.equal(canTransitionQuestion('draft', 'active'), false);
  assert.equal(canTransitionQuestion('rejected', 'draft'), false);
  assert.equal(assertQuestionTransition('admissible', 'active'), true);
});

test('rejects unknown states and illegal question transitions', () => {
  QUESTION_STATES.forEach((state) => assert.equal(assertQuestionState(state), state));
  assert.equal(isQuestionState('open'), false);
  assert.throws(() => assertQuestionState('open'), /unsupported question state/);
  assert.throws(() => assertQuestionTransition('active', 'draft'), /invalid question state transition/);
  assert.throws(() => assertQuestionTransition('archived', 'active'), /invalid question state transition/);
});
