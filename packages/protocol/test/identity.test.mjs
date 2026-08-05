import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertIdentityStrength,
  IDENTITY_STRENGTHS,
  isIdentityStrength,
} from '../src/identity.mjs';

test('defines the identity strength vocabulary', () => {
  assert.deepEqual(IDENTITY_STRENGTHS, [
    'verified',
    'observed',
    'self_declared',
    'unknown',
  ]);
  assert.equal(Object.isFrozen(IDENTITY_STRENGTHS), true);
  IDENTITY_STRENGTHS.forEach((value) => assert.equal(assertIdentityStrength(value), value));
});

test('rejects unsupported identity strengths', () => {
  assert.equal(isIdentityStrength('trusted'), false);
  assert.equal(isIdentityStrength(undefined), false);
  assert.throws(() => assertIdentityStrength('trusted'), /unsupported identity strength/);
});
