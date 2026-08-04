import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const schemaPath = fileURLToPath(new URL('../task.schema.json', import.meta.url));
const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
const validTask = {
  schema: 'srp.task.v1',
  task_id: 'task_018f0f4a-5c00-4000-8000-000000000001',
  revision: 1,
  state: 'open',
  title: 'Reproduce the reference implementation',
  description: 'Run the documented procedure and record all outputs.',
  inputs: [{ name: 'dataset', description: 'Pinned input dataset', type: 'dataset', required: true }],
  outputs: [{ name: 'reproduction-report', description: 'Report with hashes and results', type: 'report', required: true }],
  acceptance: ['All commands and versions are recorded', 'Independent result matches tolerance'],
  context_mode: 'frontier',
  question_id: 'question_018f0f4a-5c00-4000-8000-000000000001',
  created_at: '2026-08-04T06:00:00.000Z',
  created_by: 'actor_01',
};

function validateTask(value) {
  for (const field of schema.required) if (!(field in value) || value[field] === undefined || value[field] === null) return `${field} is required`;
  if (value.schema !== 'srp.task.v1') return 'schema mismatch';
  if (!/^task_[0-9a-f-]{36}$/.test(value.task_id)) return 'task_id format';
  if (!Number.isInteger(value.revision) || value.revision < 1) return 'revision';
  if (!schema.properties.state.enum.includes(value.state)) return 'state';
  if (typeof value.title !== 'string' || value.title.length < 1) return 'title';
  if (typeof value.description !== 'string' || value.description.length < 1) return 'description';
  if (!Array.isArray(value.inputs) || !Array.isArray(value.outputs) || value.outputs.length < 1) return 'artifacts';
  for (const artifact of [...value.inputs, ...value.outputs]) {
    if (!artifact || typeof artifact.name !== 'string' || artifact.name.length < 1 || typeof artifact.description !== 'string' || artifact.description.length < 1) return 'artifact spec';
  }
  if (!Array.isArray(value.acceptance) || value.acceptance.length < 1 || value.acceptance.some((item) => typeof item !== 'string' || item.length < 1)) return 'acceptance';
  if (!schema.properties.context_mode.enum.includes(value.context_mode)) return 'context_mode';
  return Number.isNaN(Date.parse(value.created_at)) ? 'created_at' : null;
}

test('defines Task inputs, outputs, acceptance, and context mode', () => {
  assert.equal(schema.$id, 'https://evimesh.org/schema/task.schema.json');
  assert.equal(schema.properties.outputs.minItems, 1);
  assert.deepEqual(schema.properties.context_mode.enum, ['frontier', 'full_trace', 'adversarial', 'blind']);
  assert.equal(validateTask(validTask), null);
});

test('rejects invalid Task vectors', () => {
  for (const invalid of [
    { ...validTask, task_id: 'claim_018f0f4a-5c00-4000-8000-000000000001' },
    { ...validTask, state: 'resolved' },
    { ...validTask, outputs: [] },
    { ...validTask, acceptance: [] },
    { ...validTask, context_mode: 'unknown' },
    { ...validTask, inputs: [{ name: '', description: 'missing name' }] },
  ]) {
    assert.notEqual(validateTask(invalid), null);
  }
});
