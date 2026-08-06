import test from 'node:test';
import assert from 'node:assert/strict';
import { createClaim, reviseClaim, transitionClaim } from '../src/claim-command.mjs';
import { createCoreProjections, replayCoreProjections } from '../src/research-event-replay.mjs';

function repository() {
  const claims = new Map();
  const revisions = new Map();
  const events = [];
  return {
    claims, revisions, events,
    async withTransaction(callback) { return callback(this); },
    async insertClaim(value) { claims.set(value.claimId, structuredClone(value)); return value; },
    async insertClaimRevision(value) { revisions.set(value.claimId, structuredClone(value)); return value; },
    async getCurrentClaimRevision(claimId) { return revisions.get(claimId) ?? null; },
    async updateClaim(claimId, value) { claims.set(claimId, structuredClone(value)); return { claimId, ...value }; },
    async appendResearchEvent(value) { events.push(structuredClone(value)); return value; },
  };
}

function eventFactory() {
  let number = 0;
  return async ({ eventType, payload }) => ({ eventId: `event_${++number}`, eventType, payload });
}

test('rebuilds the Claim current projection after it is cleared, using append-only Event snapshots', async () => {
  const repo = repository();
  const makeEvent = eventFactory();
  await createClaim({
    repository: repo, actorId: 'actor_1', actorRole: 'maintainer', claimId: 'claim_1', questionId: 'question_1',
    statement: 'Original claim.', scope: { population: 'adults' }, assumptions: ['randomized'], falsification: { threshold: 0 }, eventFactory: makeEvent,
  });
  await reviseClaim({
    repository: repo, actorId: 'actor_2', actorRole: 'maintainer', claimId: 'claim_1', ifMatch: 'W/"claim:1"', currentEtag: 'W/"claim:1"',
    statement: 'Revised claim.', eventFactory: makeEvent,
  });
  await transitionClaim({
    repository: repo, actorId: 'actor_2', actorRole: 'maintainer', claimId: 'claim_1', toState: 'candidate', ifMatch: 'W/"claim:2"', currentEtag: 'W/"claim:2"', eventFactory: makeEvent,
  });

  const expected = structuredClone(repo.claims.get('claim_1'));
  const projections = createCoreProjections();
  projections.claims.set('stale_claim', { revision: 1, state: { claim: { claimId: 'stale_claim' } } });
  replayCoreProjections({ events: repo.events, projections });

  assert.deepEqual([...projections.claims.keys()], ['claim_1']);
  assert.deepEqual(projections.claims.get('claim_1'), {
    revision: 3,
    state: {
      claim: expected,
      revision: {
        claimId: 'claim_1', revision: 3, supersedes: 2, state: 'candidate', questionId: 'question_1',
        statement: 'Revised claim.', scope: { population: 'adults' }, assumptions: ['randomized'], falsification: { threshold: 0 }, createdBy: 'actor_2',
      },
    },
  });
  assert.equal(repo.events.length, 3);
  assert.equal(repo.events.every((event) => event.payload.projection), true);
});

test('preserves projections that the supplied Event stream cannot rebuild', () => {
  const projections = createCoreProjections();
  projections.projects.set('project_1', { revision: 1, state: { projectId: 'project_1' } });
  projections.tasks.set('task_1', { revision: 1, state: { taskId: 'task_1' } });
  projections.claims.set('stale_claim', { revision: 1, state: { claimId: 'stale_claim' } });

  replayCoreProjections({
    projections,
    events: [{ payload: { projection: { entity_type: 'claim', entity_id: 'claim_1', revision: 1, state: { claimId: 'claim_1' } } } }],
  });

  assert.deepEqual([...projections.projects.keys()], ['project_1']);
  assert.deepEqual([...projections.tasks.keys()], ['task_1']);
  assert.deepEqual([...projections.claims.keys()], ['claim_1']);
});
