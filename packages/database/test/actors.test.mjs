import assert from 'node:assert/strict';
import test from 'node:test';
import { actors, actorType, identityStrength } from '../src/index.mjs';

test('M3-04 defines the stable actors table from the M1 vocabularies', () => {
  const columns = actors[Symbol.for('drizzle:Columns')];

  assert.deepEqual(actorType.enumValues, [
    'human',
    'agent',
    'organization',
    'service',
    'maintainer',
    'witness',
  ]);
  assert.deepEqual(identityStrength.enumValues, [
    'verified',
    'observed',
    'self_declared',
    'unknown',
  ]);
  assert.equal(columns.actorId.name, 'actor_id');
  assert.equal(columns.actorId.primary, true);
  assert.equal(columns.actorType.notNull, true);
  assert.equal(columns.identityStrength.notNull, true);
  assert.equal(columns.identityStrength.hasDefault, true);
});
