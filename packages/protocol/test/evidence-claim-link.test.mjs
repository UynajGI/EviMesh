import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertEvidenceClaimRelation,
  createEvidenceClaimLink,
  EVIDENCE_CLAIM_RELATIONS,
  evidenceClaimRelationSemantics,
  isEvidenceClaimRelation,
} from '../src/evidence-claim-link.mjs';

test('defines the four Evidence-Claim link relations', () => {
  assert.deepEqual(EVIDENCE_CLAIM_RELATIONS, ['supports', 'refutes', 'qualifies', 'reproduces']);
  assert.equal(Object.isFrozen(EVIDENCE_CLAIM_RELATIONS), true);
  EVIDENCE_CLAIM_RELATIONS.forEach((type) => {
    assert.equal(assertEvidenceClaimRelation(type), type);
    assert.match(evidenceClaimRelationSemantics(type), /^evidence /);
  });
});

test('links Evidence to a specific ClaimRevision in source-to-target order', () => {
  const link = createEvidenceClaimLink({
    type: 'supports',
    evidenceId: 'evidence_1',
    claimRevisionId: 'claim_revision_2',
  });

  assert.deepEqual(link, {
    type: 'supports',
    source: 'evidence_1',
    target: 'claim_revision_2',
  });
  assert.equal(Object.isFrozen(link), true);
});

test('rejects unsupported relations and incomplete links', () => {
  assert.equal(isEvidenceClaimRelation('extends'), false);
  assert.throws(() => assertEvidenceClaimRelation('extends'), /unsupported evidence-claim relation/);
  assert.throws(() => createEvidenceClaimLink({ type: 'supports', claimRevisionId: 'claim_revision_1' }), /evidence ID/);
  assert.throws(() => createEvidenceClaimLink({ type: 'supports', evidenceId: 'evidence_1' }), /claim revision ID/);
  assert.throws(() => createEvidenceClaimLink({ type: 'supports', evidenceId: '', claimRevisionId: 'claim_revision_1' }), /evidence ID/);
});
