import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTOR_TYPES, assertActorType, isActorType } from '../src/actor.mjs';

test('defines the complete actor type vocabulary', () => {
  assert.deepEqual(ACTOR_TYPES, [
    'human',
    'agent',
    'organization',
    'service',
    'maintainer',
    'witness',
  ]);
  assert.equal(Object.isFrozen(ACTOR_TYPES), true);
  ACTOR_TYPES.forEach((type) => assert.equal(assertActorType(type), type));
});

test('rejects unknown and non-string actor types', () => {
  assert.equal(isActorType('bot'), false);
  assert.equal(isActorType(null), false);
  assert.throws(() => assertActorType('bot'), /unsupported actor type/);
  assert.throws(() => assertActorType(1), /unsupported actor type/);
});
