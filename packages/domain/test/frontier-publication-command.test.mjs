import test from 'node:test';
import assert from 'node:assert/strict';
import { publishFrontier, FrontierPublicationCommandError } from '../src/frontier-publication-command.mjs';

function repository() { const events = []; const repo = { events, withTransaction: async (callback) => callback(repo), getFrontierSnapshot: async () => ({ snapshotId: 'frontier-1', projectId: 'project-1', sequence: 1 }), appendResearchEvent: async (event) => { events.push(event); return event; } }; return repo; }

test('publishes a Frontier by appending frontier.published', async () => {
  const repo = repository();
  const result = await publishFrontier({ repository: repo, actorId: 'actor-1', actorRole: 'maintainer', snapshotId: 'frontier-1', eventFactory: async (event) => event });
  assert.equal(result.event.eventType, 'frontier.published');
  assert.deepEqual(result.event.payload, { entity_type: 'frontier_snapshot', snapshot_id: 'frontier-1', project_id: 'project-1', sequence: 1, actor_id: 'actor-1' });
});

test('does not publish a missing Frontier', async () => {
  const repo = repository(); repo.getFrontierSnapshot = async () => null;
  await assert.rejects(() => publishFrontier({ repository: repo, actorId: 'actor-1', actorRole: 'maintainer', snapshotId: 'frontier-missing', eventFactory: async (event) => event }), (error) => error instanceof FrontierPublicationCommandError && error.code === 'FRONTIER_SNAPSHOT_NOT_FOUND');
  assert.deepEqual(repo.events, []);
});
