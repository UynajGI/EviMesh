import test from 'node:test';
import assert from 'node:assert/strict';
import { createRunReceipt } from '../src/run-receipt.mjs';

const validReceipt = {
  taskId: 'task_1',
  contextBundleId: 'bundle_1',
  inputArtifactIds: ['artifact_input'],
  sourceCode: 'git:evimesh@abc123',
  container: 'oci:example@sha256:abc',
  command: 'pnpm test',
  args: ['--runInBand'],
  environment: { node: '22' },
  hardware: { cpu: 'x64' },
  randomSeed: 42,
  startedAt: '2026-08-04T10:00:00.000Z',
  endedAt: '2026-08-04T10:01:00.000Z',
  networkAccess: false,
  outputArtifactIds: ['artifact_output'],
  exitCode: 0,
  actorId: 'actor_1',
  signature: 'sig_1',
};

test('creates an immutable complete Run Receipt', () => {
  const receipt = createRunReceipt(validReceipt);

  assert.deepEqual(receipt, {
    task_id: 'task_1',
    context_bundle_id: 'bundle_1',
    input_artifact_ids: ['artifact_input'],
    source_code: 'git:evimesh@abc123',
    container: 'oci:example@sha256:abc',
    command: 'pnpm test',
    args: ['--runInBand'],
    environment: { node: '22' },
    hardware: { cpu: 'x64' },
    random_seed: 42,
    started_at: '2026-08-04T10:00:00.000Z',
    ended_at: '2026-08-04T10:01:00.000Z',
    network_access: false,
    output_artifact_ids: ['artifact_output'],
    exit_code: 0,
    actor_id: 'actor_1',
    signature: 'sig_1',
  });
  assert.equal(Object.isFrozen(receipt), true);
  assert.equal(Object.isFrozen(receipt.environment), true);
  assert.equal(Object.isFrozen(receipt.input_artifact_ids), true);
});

test('rejects incomplete, malformed, or unordered Run Receipts', () => {
  assert.throws(() => createRunReceipt({ ...validReceipt, command: undefined }), /command/);
  assert.throws(() => createRunReceipt({ ...validReceipt, environment: [] }), /environment/);
  assert.throws(() => createRunReceipt({ ...validReceipt, networkAccess: 'yes' }), /network access/);
  assert.throws(() => createRunReceipt({ ...validReceipt, exitCode: 0.5 }), /exit code/);
  assert.throws(() => createRunReceipt({ ...validReceipt, randomSeed: undefined }), /random seed/);
  assert.throws(() => createRunReceipt({
    ...validReceipt,
    startedAt: '2026-08-04T10:02:00.000Z',
    endedAt: '2026-08-04T10:01:00.000Z',
  }), /timestamps/);
});
