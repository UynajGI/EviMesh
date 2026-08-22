import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, normalizeRandomSeed } from '../src/run-command.mjs';

const container = `oci:example@sha256:${'a'.repeat(64)}`;

test('creates a reproducibility run with immutable artifact references', async () => {
  const calls = [];
  const repository = {
    withTransaction: async (callback) => callback(repository),
    getArtifactRevision: async () => ({ artifactId: 'present', revision: 1 }),
    getArtifactVerification: async () => ({ status: 'verified' }),
    insertRun: async (value) => { calls.push(['run', value]); return value; },
    insertRunInput: async (value) => { calls.push(['input', value]); return value; },
    insertRunOutput: async (value) => { calls.push(['output', value]); return value; },
    appendResearchEvent: async (value) => { calls.push(['event', value]); return value; },
  };
  const result = await createRun({ repository, actorId: 'actor_1', actorRole: 'contributor', runId: 'run_1', taskId: 'task_1', contextBundleId: 'context_1', sourceCode: 'git:abc', container, command: 'pytest', environment: {}, hardware: {}, randomSeed: { value: 7 }, startedAt: new Date('2026-01-01T00:00:00Z'), endedAt: new Date('2026-01-01T00:00:01Z'), exitCode: 0, signingKeyId: 'key_1', signature: 'sig', inputs: [{ artifactId: 'a', artifactRevision: 1 }], outputs: [{ artifactId: 'b', artifactRevision: 1 }], eventFactory: async (event) => event });
  assert.equal(result.run.exitCode, 0);
  assert.equal(result.run.signingKeyId, 'key_1');
  assert.equal(calls.length, 4);
});

test('reports invalid run JSON fields precisely and rejects seed arrays', async () => {
  const base = {
    repository: { withTransaction: async () => {}, getArtifactRevision() {}, getArtifactVerification() {}, insertRun() {}, insertRunInput() {}, insertRunOutput() {}, appendResearchEvent() {} },
    actorId: 'actor_1', actorRole: 'contributor', runId: 'run_1', taskId: 'task_1', contextBundleId: 'context_1',
    sourceCode: 'git:abc', container, command: 'pytest', environment: {}, hardware: {}, randomSeed: {},
    startedAt: new Date('2026-01-01T00:00:00Z'), endedAt: new Date('2026-01-01T00:00:01Z'), exitCode: 0, signingKeyId: 'key_1', signature: 'sig', eventFactory: async (event) => event,
  };
  await assert.rejects(() => createRun({ ...base, environment: [] }), /environment must be/);
  await assert.rejects(() => createRun({ ...base, randomSeed: [] }), /random seed must be/);
});

test('rejects missing or duplicate artifact revision references before run creation', async () => {
  const repository = {
    withTransaction: async (callback) => callback(repository),
    getArtifactRevision: async () => null,
    getArtifactVerification: async () => ({ status: 'verified' }),
    insertRun() {}, insertRunInput() {}, insertRunOutput() {}, appendResearchEvent() {},
  };
  const base = { repository, actorId: 'actor_1', actorRole: 'contributor', runId: 'run_1', taskId: 'task_1', contextBundleId: 'context_1', sourceCode: 'git:abc', container, command: 'pytest', environment: {}, hardware: {}, randomSeed: {}, startedAt: new Date('2026-01-01T00:00:00Z'), endedAt: new Date('2026-01-01T00:00:01Z'), exitCode: 0, signingKeyId: 'key_1', signature: 'sig', eventFactory: async (event) => event };
  await assert.rejects(() => createRun({ ...base, inputs: [{ artifactId: 'a', artifactRevision: 1 }] }), (error) => error.code === 'ARTIFACT_REVISION_NOT_FOUND');
  await assert.rejects(() => createRun({ ...base, inputs: [{ artifactId: 'a', artifactRevision: 1 }, { artifactId: 'a', artifactRevision: 1 }] }), /duplicate/);
});

test('rejects a Run whose output artifact hash is not verified', async () => {
  const repository = {
    withTransaction: async (callback) => callback(repository),
    getArtifactRevision: async () => ({ artifactId: 'output', revision: 1 }),
    getArtifactVerification: async () => ({ status: 'invalid' }),
    insertRun() { throw new Error('must not write'); }, insertRunInput() { throw new Error('must not write'); }, insertRunOutput() { throw new Error('must not write'); }, appendResearchEvent() { throw new Error('must not write'); },
  };
  const base = { repository, actorId: 'actor_1', actorRole: 'contributor', runId: 'run_1', taskId: 'task_1', contextBundleId: 'context_1', sourceCode: 'git:abc', container, command: 'pytest', environment: {}, hardware: {}, randomSeed: {}, startedAt: new Date('2026-01-01T00:00:01Z'), endedAt: new Date('2026-01-01T00:00:02Z'), exitCode: 0, signingKeyId: 'key_1', signature: 'sig', eventFactory: async (event) => event };
  await assert.rejects(() => createRun({ ...base, outputs: [{ artifactId: 'output', artifactRevision: 1 }] }), (error) => error.code === 'ARTIFACT_OUTPUT_UNVERIFIED' && error.status === 409);
});

test('rejects mutable OCI tags without a sha256 digest', async () => {
  const repository = { withTransaction: async () => {}, getArtifactRevision() {}, getArtifactVerification() {}, insertRun() {}, insertRunInput() {}, insertRunOutput() {}, appendResearchEvent() {} };
  const base = { repository, actorId: 'actor_1', actorRole: 'contributor', runId: 'run_1', taskId: 'task_1', contextBundleId: 'context_1', sourceCode: 'git:abc', container: 'ghcr.io/evimesh/research:latest', command: 'pytest', environment: {}, hardware: {}, randomSeed: {}, startedAt: new Date('2026-01-01T00:00:00Z'), endedAt: new Date('2026-01-01T00:00:01Z'), exitCode: 0, signingKeyId: 'key_1', signature: 'sig', eventFactory: async (event) => event };
  await assert.rejects(() => createRun(base), (error) => error.code === 'OCI_DIGEST_REQUIRED');
});

test('normalizes equivalent random seed objects to one stable semantic hash', () => {
  const first = normalizeRandomSeed({ framework: 'numpy', seed: 7, replicas: { workerB: 2, workerA: 1 } });
  const second = normalizeRandomSeed({ replicas: { workerA: 1, workerB: 2 }, seed: 7, framework: 'numpy' });
  assert.deepEqual(first.value, second.value);
  assert.equal(first.semanticHash, second.semanticHash);
  assert.throws(() => normalizeRandomSeed({ seed: Number.NaN }), /JSON-compatible/);
});
