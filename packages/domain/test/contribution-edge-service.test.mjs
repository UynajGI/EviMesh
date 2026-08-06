import test from 'node:test';
import assert from 'node:assert/strict';
import { addContributionProducedEdge, ContributionEdgeError } from '../src/contribution-edge-service.mjs';

function repository({ statement = true, revision = true } = {}) {
  const calls = [];
  const repo = {
    calls,
    withTransaction: async (callback) => callback(repo),
    getContributionStatement: async () => statement ? { statementId: 'contribution_1' } : null,
    getObjectRevision: async (reference) => { calls.push(['revision', reference]); return revision ? reference : null; },
    insertContributionEdge: async (edge) => { calls.push(['edge', edge]); return edge; },
  };
  return repo;
}

test('attaches a contribution statement to an existing produced object revision', async () => {
  const repo = repository();
  const edge = await addContributionProducedEdge({ repository: repo, statementId: 'contribution_1', objectType: 'artifact', objectId: 'artifact_1', objectRevision: 2 });
  assert.deepEqual(edge, { statementId: 'contribution_1', edgeType: 'produced', objectType: 'artifact', objectId: 'artifact_1', objectRevision: 2 });
  assert.deepEqual(repo.calls, [
    ['revision', { objectType: 'artifact', objectId: 'artifact_1', revision: 2 }],
    ['edge', edge],
  ]);
});

test('rejects missing contribution statements, missing revisions, and invalid revision references', async () => {
  await assert.rejects(addContributionProducedEdge({ repository: repository({ statement: false }), statementId: 'contribution_1', objectType: 'artifact', objectId: 'artifact_1', objectRevision: 1 }), (error) => error instanceof ContributionEdgeError && error.code === 'CONTRIBUTION_STATEMENT_NOT_FOUND');
  await assert.rejects(addContributionProducedEdge({ repository: repository({ revision: false }), statementId: 'contribution_1', objectType: 'artifact', objectId: 'artifact_1', objectRevision: 1 }), (error) => error.code === 'CONTRIBUTION_OUTPUT_NOT_FOUND');
  await assert.rejects(addContributionProducedEdge({ repository: repository(), statementId: 'contribution_1', objectType: 'artifact', objectId: 'artifact_1', objectRevision: 0 }), /positive integer/);
});
