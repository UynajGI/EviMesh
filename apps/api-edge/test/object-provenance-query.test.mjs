import test from 'node:test';
import assert from 'node:assert/strict';
import { getObjectProvenance, ObjectProvenanceQueryError } from '../src/object-provenance-query.mjs';

function repository({ complete = true } = {}) {
  const calls = [];
  return {
    calls,
    getObjectRevision: async (reference) => { calls.push(['object', reference]); return complete ? { revision: 2, state: 'verified' } : null; },
    listContributionEdgesForObject: async (reference) => { calls.push(['edges', reference]); return [{ statementId: 'statement_1', edgeType: 'produced', ...reference }]; },
    listContributionStatementsByIds: async (ids) => { calls.push(['actors', ids]); return complete ? [{ statementId: 'statement_1', eventId: 'event_1', actorId: 'actor_1', role: 'verifier' }] : []; },
    listResearchEventsByIds: async (ids) => { calls.push(['events', ids]); return complete ? [{ eventId: 'event_1', eventType: 'verification.completed' }] : []; },
    listFrontiersForObjectRevision: async (reference) => { calls.push(['frontier', reference]); return complete ? [{ frontierId: 'frontier_1', sequence: 4 }] : []; },
  };
}

test('returns the Actor to Event to Object to Frontier path for an immutable revision', async () => {
  const repo = repository();
  const result = await getObjectProvenance({ repository: repo, objectType: 'verification', objectId: 'verification_1', objectRevision: 2 });
  assert.equal(result.actors[0].actorId, 'actor_1');
  assert.equal(result.events[0].eventId, 'event_1');
  assert.equal(result.actorEvents[0].actor.actorId, 'actor_1');
  assert.equal(result.actorEvents[0].event.eventId, 'event_1');
  assert.equal(result.object.revision.state, 'verified');
  assert.equal(result.frontier[0].frontierId, 'frontier_1');
  assert.deepEqual(repo.calls[0], ['object', { objectType: 'verification', objectId: 'verification_1', revision: 2 }]);
  assert.deepEqual(repo.calls[3], ['events', ['event_1']]);
});

test('rejects missing object revisions and incomplete provenance paths', async () => {
  await assert.rejects(getObjectProvenance({ repository: repository({ complete: false }), objectType: 'verification', objectId: 'verification_1', objectRevision: 2 }), (error) => error instanceof ObjectProvenanceQueryError && error.code === 'OBJECT_PROVENANCE_OBJECT_NOT_FOUND');
  const repo = repository();
  repo.listFrontiersForObjectRevision = async () => [];
  await assert.rejects(getObjectProvenance({ repository: repo, objectType: 'verification', objectId: 'verification_1', objectRevision: 2 }), (error) => error.code === 'OBJECT_PROVENANCE_PATH_NOT_FOUND');
});

test('rejects a provenance path when a contribution statement Event is absent', async () => {
  const repo = repository();
  repo.listResearchEventsByIds = async () => [];
  await assert.rejects(
    getObjectProvenance({ repository: repo, objectType: 'verification', objectId: 'verification_1', objectRevision: 2 }),
    (error) => error.code === 'OBJECT_PROVENANCE_PATH_NOT_FOUND',
  );
});
