import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const schemaPath = fileURLToPath(new URL('../run.schema.json', import.meta.url));
const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
const validRun = {
  schema: 'srp.run.v1',
  run_id: 'run_018f0f4a-5c00-4000-8000-000000000001',
  task_id: 'task_018f0f4a-5c00-4000-8000-000000000002',
  context_bundle_id: 'context_01',
  input_artifact_ids: ['evidence_01'],
  source_code: 'git:0123456789abcdef',
  container: 'ghcr.io/evimesh/research@sha256:abc',
  command: 'python',
  args: ['run.py', '--seed', '42'],
  environment: { python: '3.12.4' },
  hardware: { cpu: 'x86_64', memory_bytes: 17179869184 },
  random_seed: 42,
  started_at: '2026-08-04T06:00:00.000Z',
  ended_at: '2026-08-04T06:02:00.000Z',
  network_access: false,
  output_artifact_ids: ['evidence_02'],
  exit_code: 0,
  actor_id: 'actor_01',
  signature: 'signature-bytes',
};

function validateRun(value) {
  for (const field of schema.required) if (!(field in value) || value[field] === undefined || value[field] === null) return `${field} is required`;
  if (value.schema !== 'srp.run.v1') return 'schema mismatch';
  if (!/^run_[0-9a-f-]{36}$/.test(value.run_id) || !/^task_[0-9a-f-]{36}$/.test(value.task_id)) return 'ID format';
  if (typeof value.context_bundle_id !== 'string' || value.context_bundle_id.length < 1) return 'context';
  for (const field of ['input_artifact_ids', 'output_artifact_ids', 'args']) if (!Array.isArray(value[field])) return field;
  for (const field of ['source_code', 'container', 'command', 'actor_id', 'signature']) if (typeof value[field] !== 'string' || value[field].length < 1) return field;
  if (!value.environment || Object.keys(value.environment).length === 0 || !value.hardware || Object.keys(value.hardware).length === 0) return 'runtime metadata';
  if (typeof value.network_access !== 'boolean' || !Number.isInteger(value.exit_code)) return 'execution outcome';
  if (Number.isNaN(Date.parse(value.started_at)) || Number.isNaN(Date.parse(value.ended_at)) || Date.parse(value.ended_at) < Date.parse(value.started_at)) return 'timestamps';
  return null;
}

test('defines the minimum Run Receipt fields', () => {
  assert.equal(schema.$id, 'https://evimesh.org/schema/run.schema.json');
  assert.equal(schema.properties.network_access.type, 'boolean');
  assert.equal(schema.properties.exit_code.type, 'integer');
  assert.equal(validateRun(validRun), null);
});

test('rejects incomplete or invalid Run vectors', () => {
  for (const invalid of [
    { ...validRun, run_id: 'not-a-run' },
    { ...validRun, environment: {} },
    { ...validRun, network_access: 'false' },
    { ...validRun, exit_code: 0.5 },
    { ...validRun, ended_at: '2026-08-04T05:00:00.000Z' },
    { ...validRun, signature: '' },
  ]) {
    assert.notEqual(validateRun(invalid), null);
  }
});
