import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertClaimState,
  assertClaimTransition,
  canTransitionClaim,
  claimTransitionsFrom,
  CLAIM_STATES,
  isClaimOutcome,
  isClaimState,
} from '../src/claim-state.mjs';

test('defines the claim primary lifecycle and outcome states', () => {
  assert.deepEqual(CLAIM_STATES, [
    'hypothesis', 'candidate', 'under_verification',
    'provisionally_accepted', 'accepted', 'contested',
    'refuted', 'superseded', 'retracted', 'dependency_tainted',
  ]);
  assert.deepEqual(claimTransitionsFrom('hypothesis'), [
    'candidate', 'contested', 'refuted', 'superseded', 'retracted', 'dependency_tainted',
  ]);
  assert.deepEqual(claimTransitionsFrom('provisionally_accepted'), [
    'accepted', 'contested', 'refuted', 'superseded', 'retracted', 'dependency_tainted',
  ]);
  assert.deepEqual(claimTransitionsFrom('accepted'), [
    'contested', 'refuted', 'superseded', 'retracted', 'dependency_tainted',
  ]);
  CLAIM_STATES.slice(5).forEach((state) => assert.deepEqual(claimTransitionsFrom(state), []));
  assert.equal(Object.isFrozen(CLAIM_STATES), true);
});

test('supports sequential promotion and cross-cutting outcomes', () => {
  assert.equal(canTransitionClaim('hypothesis', 'candidate'), true);
  assert.equal(canTransitionClaim('candidate', 'under_verification'), true);
  assert.equal(canTransitionClaim('under_verification', 'provisionally_accepted'), true);
  assert.equal(canTransitionClaim('provisionally_accepted', 'accepted'), true);
  assert.equal(canTransitionClaim('candidate', 'contested'), true);
  assert.equal(canTransitionClaim('accepted', 'retracted'), true);
  assert.equal(isClaimOutcome('dependency_tainted'), true);
  assert.equal(assertClaimTransition('accepted', 'superseded'), true);
});

test('rejects skipping promotion stages and reopening outcomes', () => {
  CLAIM_STATES.forEach((state) => assert.equal(assertClaimState(state), state));
  assert.equal(isClaimState('open'), false);
  assert.throws(() => assertClaimState('open'), /unsupported claim state/);
  assert.throws(() => assertClaimTransition('hypothesis', 'accepted'), /invalid claim state transition/);
  assert.throws(() => assertClaimTransition('contested', 'candidate'), /invalid claim state transition/);
  assert.throws(() => assertClaimTransition('accepted', 'candidate'), /invalid claim state transition/);
  assert.equal(isClaimOutcome('accepted'), false);
});
