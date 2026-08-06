import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/run-command.mjs';

test('creates a reproducibility run with immutable artifact references', async () => {
  const calls = [];
  const repository = {
    withTransaction: async (callback) => callback(repository),
    insertRun: async (value) => { calls.push(['run', value]); return value; },
    insertRunInput: async (value) => { calls.push(['input', value]); return value; },
    insertRunOutput: async (value) => { calls.push(['output', value]); return value; },
    appendResearchEvent: async (value) => { calls.push(['event', value]); return value; },
  };
  const result = await createRun({ repository, actorId: 'actor_1', actorRole: 'contributor', runId: 'run_1', taskId: 'task_1', contextBundleId: 'context_1', sourceCode: 'git:abc', container: 'oci:example@sha256:abc', command: 'pytest', environment: {}, hardware: {}, randomSeed: { value: 7 }, startedAt: new Date('2026-01-01T00:00:00Z'), endedAt: new Date('2026-01-01T00:00:01Z'), exitCode: 0, signature: 'sig', inputs: [{ artifactId: 'a', artifactRevision: 1 }], outputs: [{ artifactId: 'b', artifactRevision: 1 }], eventFactory: async (event) => event });
  assert.equal(result.run.exitCode, 0);
  assert.equal(calls.length, 4);
});
