import test from 'node:test';
import assert from 'node:assert/strict';
import { createEvidence } from '../src/evidence-command.mjs';

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
