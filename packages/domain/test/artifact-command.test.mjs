import test from 'node:test';
import assert from 'node:assert/strict';
import { ArtifactCommandError, createArtifact } from '../src/artifact-command.mjs';

function repository() {
  const calls = [];
  const repo = {
    calls,
    withTransaction: async (callback) => callback(repo),
    insertArtifact: async (value) => { calls.push(['artifact', value]); return value; },
    insertArtifactRevision: async (value) => { calls.push(['revision', value]); return value; },
    insertArtifactLocation: async (value) => { calls.push(['location', value]); return value; },
    appendResearchEvent: async (value) => { calls.push(['event', value]); return value; },
  };
  return repo;
}

const input = {
  repository: repository(), actorId: 'actor_1', actorRole: 'contributor', artifactId: 'artifact_1',
  artifactType: 'dataset', rawHash: `sha256:${'a'.repeat(64)}`, sizeBytes: 12,
  mediaType: 'application/json', license: 'CC-BY-4.0', locationId: 'location_1', location: 'r2://evimesh/artifact_1',
  eventFactory: async (event) => event,
};

test('creates artifact, revision, location, and event in one transaction', async () => {
  const result = await createArtifact(input);
  assert.equal(result.revision.revision, 1);
  assert.equal(result.event.eventType, 'artifact.created');
  assert.equal(input.repository.calls.length, 4);
});
test('rejects malformed artifact metadata', async () => {
  await assert.rejects(() => createArtifact({ ...input, rawHash: 'sha256:bad' }), (error) => error instanceof ArtifactCommandError && error.code === 'ARTIFACT_INVALID');
  await assert.rejects(() => createArtifact({ ...input, location: 'not-a-uri' }), /absolute URI/);
});
