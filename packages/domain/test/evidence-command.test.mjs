import test from 'node:test';
import assert from 'node:assert/strict';
import { createEvidence, linkEvidenceClaim } from '../src/evidence-command.mjs';

test('creates evidence and locks links to concrete claim revisions', async () => {
  const calls = [];
  const repository = {
    withTransaction: async (callback) => callback(repository),
    insertEvidence: async (value) => { calls.push(['evidence', value]); return value; },
    insertEvidenceClaimLink: async (value) => { calls.push(['link', value]); return value; },
    appendResearchEvent: async (value) => { calls.push(['event', value]); return value; },
  };
  const result = await createEvidence({ repository, actorId: 'actor_1', actorRole: 'contributor', evidenceId: 'evidence_1', evidenceType: 'code_test', artifactId: 'artifact_1', artifactRevision: 2, links: [{ claimId: 'claim_1', claimRevision: 3, relationType: 'supports' }], eventFactory: async (event) => event });
  assert.equal(result.links[0].claimRevision, 3);
  assert.equal(calls.length, 3);
});

test('links existing evidence to one existing claim revision and records an audit event', async () => {
  const calls = [];
  const repository = {
    withTransaction: async (callback) => callback(repository),
    getEvidence: async (evidenceId) => evidenceId === 'evidence_1' ? { evidenceId } : null,
    getClaimRevision: async (claimId, revision) => claimId === 'claim_1' && revision === 3 ? { claimId, revision } : null,
    insertEvidenceClaimLink: async (value) => { calls.push(['link', value]); return value; },
    appendResearchEvent: async (value) => { calls.push(['event', value]); return value; },
  };
  const result = await linkEvidenceClaim({ repository, actorId: 'actor_1', actorRole: 'contributor', evidenceId: 'evidence_1', claimId: 'claim_1', claimRevision: 3, relationType: 'supports', eventFactory: async (event) => event });
  assert.deepEqual(result.link, { evidenceId: 'evidence_1', claimId: 'claim_1', claimRevision: 3, relationType: 'supports', createdBy: 'actor_1' });
  assert.equal(result.event.eventType, 'evidence.claim_linked');
  assert.equal(calls.length, 2);
});

test('rejects Evidence-to-ClaimRevision links with a missing endpoint', async () => {
  const repository = {
    withTransaction: async (callback) => callback(repository),
    getEvidence: async () => null,
    getClaimRevision: async () => ({ claimId: 'claim_1', revision: 3 }),
    insertEvidenceClaimLink: async () => assert.fail('must not persist a missing endpoint'),
    appendResearchEvent: async () => assert.fail('must not emit an event for a missing endpoint'),
  };
  await assert.rejects(
    linkEvidenceClaim({ repository, actorId: 'actor_1', actorRole: 'contributor', evidenceId: 'missing', claimId: 'claim_1', claimRevision: 3, relationType: 'supports', eventFactory: async (event) => event }),
    (error) => error.code === 'EVIDENCE_NOT_FOUND' && error.status === 404,
  );
});
