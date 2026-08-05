import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertChallengeState,
  assertChallengeTransition,
  challengeTransitionsFrom,
  CHALLENGE_STATES,
  canTransitionChallenge,
  isChallengeState,
} from '../src/challenge-state.mjs';

test('defines the challenge investigation lifecycle', () => {
  assert.deepEqual(CHALLENGE_STATES, [
    'open', 'admissible', 'investigating', 'upheld', 'rejected', 'resolved',
  ]);
  assert.deepEqual(challengeTransitionsFrom('open'), ['admissible']);
  assert.deepEqual(challengeTransitionsFrom('admissible'), ['investigating']);
  assert.deepEqual(challengeTransitionsFrom('investigating'), ['upheld', 'rejected', 'resolved']);
  assert.deepEqual(challengeTransitionsFrom('upheld'), []);
  assert.deepEqual(challengeTransitionsFrom('rejected'), []);
  assert.deepEqual(challengeTransitionsFrom('resolved'), []);
  assert.equal(Object.isFrozen(CHALLENGE_STATES), true);
});

test('accepts only documented challenge transitions', () => {
  assert.equal(canTransitionChallenge('open', 'admissible'), true);
  assert.equal(canTransitionChallenge('admissible', 'investigating'), true);
  assert.equal(canTransitionChallenge('investigating', 'upheld'), true);
  assert.equal(canTransitionChallenge('investigating', 'rejected'), true);
  assert.equal(canTransitionChallenge('investigating', 'resolved'), true);
  assert.equal(canTransitionChallenge('open', 'investigating'), false);
  assert.equal(canTransitionChallenge('resolved', 'investigating'), false);
  assert.equal(assertChallengeTransition('investigating', 'resolved'), true);
});

test('rejects unknown states and reopening challenge outcomes', () => {
  CHALLENGE_STATES.forEach((state) => assert.equal(assertChallengeState(state), state));
  assert.equal(isChallengeState('closed'), false);
  assert.throws(() => assertChallengeState('closed'), /unsupported challenge state/);
  assert.throws(() => assertChallengeTransition('open', 'resolved'), /invalid challenge state transition/);
  assert.throws(() => assertChallengeTransition('upheld', 'open'), /invalid challenge state transition/);
});
