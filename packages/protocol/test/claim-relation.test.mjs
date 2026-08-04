import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertClaimRelationType,
  CLAIM_RELATION_TYPES,
  claimRelationSemantics,
  createClaimRelation,
  isClaimRelationType,
} from '../src/claim-relation.mjs';

test('defines all ClaimRelation types from the protocol', () => {
  assert.deepEqual(CLAIM_RELATION_TYPES, [
    'depends_on', 'supports', 'refutes', 'qualifies', 'reproduces',
    'extends', 'supersedes', 'contradicts', 'derived_from',
    'uses_method', 'uses_dataset', 'implements', 'verifies', 'challenges',
  ]);
  assert.equal(Object.isFrozen(CLAIM_RELATION_TYPES), true);
  CLAIM_RELATION_TYPES.forEach((type) => {
    assert.equal(assertClaimRelationType(type), type);
    assert.match(claimRelationSemantics(type), /^source /);
  });
});

test('preserves explicit source to target direction', () => {
  const relation = createClaimRelation({
    type: 'depends_on',
    source: 'claim_source',
    target: 'claim_upstream',
  });

  assert.deepEqual(relation, {
    type: 'depends_on',
    source: 'claim_source',
    target: 'claim_upstream',
  });
  assert.equal(Object.isFrozen(relation), true);
  assert.match(claimRelationSemantics(relation.type), /upstream dependency/);
});

test('rejects unknown relation types and missing endpoints', () => {
  assert.equal(isClaimRelationType('unknown'), false);
  assert.throws(() => assertClaimRelationType('unknown'), /unsupported claim relation type/);
  assert.throws(() => createClaimRelation({ type: 'supports', target: 'claim_b' }), /source/);
  assert.throws(() => createClaimRelation({ type: 'supports', source: 'claim_a' }), /target/);
  assert.throws(() => createClaimRelation({ type: 'supports', source: '', target: 'claim_b' }), /source/);
});
