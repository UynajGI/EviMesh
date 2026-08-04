import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const schemaPath = fileURLToPath(new URL('../project.schema.json', import.meta.url));
const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
const validProject = {
  schema: 'srp.project.v1',
  project_id: 'project_018f0f4a-5c00-4000-8000-000000000001',
  revision: 1,
  state: 'draft',
  name: 'Reproducible numerical methods',
  summary: 'A governed project for independently reproducible numerical research.',
  created_at: '2026-08-04T06:00:00.000Z',
  created_by: 'actor_01',
  maintainer_ids: ['actor_01'],
  license: 'CC-BY-4.0',
};

function validateProject(value) {
  for (const field of schema.required) {
    if (!(field in value)) return `${field} is required`;
  }
  if (value.schema !== 'srp.project.v1') return 'schema mismatch';
  if (!/^project_[0-9a-f-]{36}$/.test(value.project_id)) return 'project_id format';
  if (!Number.isInteger(value.revision) || value.revision < 1) return 'revision';
  if (!schema.properties.state.enum.includes(value.state)) return 'state';
  if (typeof value.name !== 'string' || value.name.length < 1) return 'name';
  if (typeof value.summary !== 'string' || value.summary.length < 1) return 'summary';
  if (Number.isNaN(Date.parse(value.created_at))) return 'created_at';
  if (typeof value.created_by !== 'string' || value.created_by.length < 1) return 'created_by';
  return null;
}

test('defines the Project revision schema', () => {
  assert.equal(schema.$id, 'https://evimesh.org/schema/project.schema.json');
  assert.deepEqual(schema.required, ['schema', 'project_id', 'revision', 'state', 'name', 'summary', 'created_at', 'created_by']);
  assert.deepEqual(schema.properties.state.enum, ['draft', 'active', 'archived']);
  assert.equal(validateProject(validProject), null);
});

test('accepts valid Project vectors and rejects invalid ones', () => {
  for (const invalid of [
    { ...validProject, schema: 'srp.project.v2' },
    { ...validProject, project_id: 'question_018f0f4a-5c00-4000-8000-000000000001' },
    { ...validProject, revision: 0 },
    { ...validProject, state: 'deleted' },
    { ...validProject, name: '' },
    { ...validProject, created_at: 'not-a-time' },
    { ...validProject, created_by: '' },
  ]) {
    assert.notEqual(validateProject(invalid), null);
  }
});
