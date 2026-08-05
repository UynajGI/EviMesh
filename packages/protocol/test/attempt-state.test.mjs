import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertAttemptState,
  assertAttemptTransition,
  attemptTransitionsFrom,
  ATTEMPT_STATES,
  canTransitionAttempt,
  isAttemptState,
} from '../src/attempt-state.mjs';

test('defines the attempt lifecycle', () => {
  assert.deepEqual(ATTEMPT_STATES, ['active', 'paused', 'submitted', 'abandoned']);
  assert.deepEqual(attemptTransitionsFrom('active'), ['paused', 'submitted', 'abandoned']);
  assert.deepEqual(attemptTransitionsFrom('paused'), ['active', 'submitted', 'abandoned']);
  assert.deepEqual(attemptTransitionsFrom('submitted'), []);
  assert.deepEqual(attemptTransitionsFrom('abandoned'), []);
  assert.equal(Object.isFrozen(ATTEMPT_STATES), true);
});

test('supports pausing and resuming, then closes the attempt', () => {
  assert.equal(canTransitionAttempt('active', 'paused'), true);
  assert.equal(canTransitionAttempt('paused', 'active'), true);
  assert.equal(canTransitionAttempt('active', 'submitted'), true);
  assert.equal(canTransitionAttempt('paused', 'abandoned'), true);
  assert.equal(canTransitionAttempt('submitted', 'active'), false);
  assert.equal(canTransitionAttempt('abandoned', 'active'), false);
  assert.equal(assertAttemptTransition('active', 'submitted'), true);
});

test('rejects unknown states and illegal attempt transitions', () => {
  ATTEMPT_STATES.forEach((state) => assert.equal(assertAttemptState(state), state));
  assert.equal(isAttemptState('open'), false);
  assert.throws(() => assertAttemptState('open'), /unsupported attempt state/);
  assert.throws(() => assertAttemptTransition('active', 'active'), /invalid attempt state transition/);
  assert.throws(() => assertAttemptTransition('submitted', 'paused'), /invalid attempt state transition/);
});
