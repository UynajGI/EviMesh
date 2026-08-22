import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalRunArtifactRefs, getRun, listRuns, RunQueryError } from '../src/run-query.mjs';

const runs = [
  { runId: 'run_2', startedAt: '2026-01-02T00:00:00.000Z' },
  { runId: 'run_1', startedAt: '2026-01-01T00:00:00.000Z' },
];

test('lists runs with filters and stable pagination', async () => {
  const calls = [];
  const page = await listRuns({ repository: { listRuns: async (filters) => { calls.push(filters); return runs; } }, taskId: ' task_1 ', actorId: 'actor_1', limit: 1 });
  assert.deepEqual(calls, [{ taskId: 'task_1', actorId: 'actor_1' }]);
  assert.deepEqual(page.items, [runs[1]]);
  assert.ok(page.nextCursor);
});

test('returns a run with canonically ordered artifact inputs and outputs', async () => {
  const unorderedInputs = [
    { artifactId: 'input-z', artifactRevision: 1 },
    { artifactId: 'input-shared', artifactRevision: 2 },
    { artifactId: 'input-a', artifactRevision: 1 },
    { artifactId: 'input-shared', artifactRevision: 10 },
  ];
  const unorderedOutputs = [
    { artifactId: 'output-shared', artifactRevision: 2 },
    { artifactId: 'output-shared', artifactRevision: 10 },
  ];
  const repository = {
    getRun: async (runId) => ({ runId }),
    listRunInputs: async () => unorderedInputs,
    listRunOutputs: async () => unorderedOutputs,
  };
  assert.deepEqual(await getRun({ repository, runId: ' run_1 ' }), {
    run: { runId: 'run_1' },
    inputs: [
      { artifactId: 'input-a', artifactRevision: 1 },
      { artifactId: 'input-shared', artifactRevision: 10 },
      { artifactId: 'input-shared', artifactRevision: 2 },
      { artifactId: 'input-z', artifactRevision: 1 },
    ],
    outputs: [
      { artifactId: 'output-shared', artifactRevision: 10 },
      { artifactId: 'output-shared', artifactRevision: 2 },
    ],
  });
  assert.deepEqual(unorderedInputs.map((ref) => `${ref.artifactId}@${ref.artifactRevision}`), [
    'input-z@1', 'input-shared@2', 'input-a@1', 'input-shared@10',
  ], 'canonical sorting must not mutate repository results');
  for (const invalid of [null, {}, 'artifact-a@1']) {
    assert.throws(
      () => canonicalRunArtifactRefs(invalid, 'inputs'),
      (error) => error instanceof RunQueryError && error.code === 'RUN_ARTIFACT_REFS_INVALID' && error.status === 400,
    );
  }
});

test('rejects invalid or missing run queries', async () => {
  const repository = { listRuns: async () => runs };
  await assert.rejects(() => listRuns({ repository, limit: 0 }), RunQueryError);
  await assert.rejects(() => getRun({ repository: {}, runId: 'run_1' }), RunQueryError);
  await assert.rejects(() => getRun({ repository: { getRun: async () => null, listRunInputs: async () => [], listRunOutputs: async () => [] }, runId: 'run_1' }), (error) => error.code === 'RUN_NOT_FOUND');
});
