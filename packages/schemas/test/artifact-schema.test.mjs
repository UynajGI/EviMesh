import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const schemaPath = fileURLToPath(new URL('../artifact.schema.json', import.meta.url));
const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
const validArtifact = {
  schema: 'srp.artifact.v1',
  artifact_id: 'evidence_018f0f4a-5c00-4000-8000-000000000001',
  revision: 1,
  artifact_type: 'dataset',
  hash: `sha256:${'a'.repeat(64)}`,
  location: 'https://storage.evimesh.org/artifacts/evidence-01.bin',
  license: 'CC-BY-4.0',
  size_bytes: 2048,
  media_type: 'application/octet-stream',
  description: 'Pinned dataset used by the reproduction run.',
  created_at: '2026-08-04T06:00:00.000Z',
  created_by: 'actor_01',
};

function validateArtifact(value) {
  for (const field of schema.required) if (!(field in value) || value[field] === undefined || value[field] === null) return `${field} is required`;
  if (value.schema !== 'srp.artifact.v1') return 'schema mismatch';
  if (!/^evidence_[0-9a-f-]{36}$/.test(value.artifact_id)) return 'artifact_id format';
  if (!Number.isInteger(value.revision) || value.revision < 1) return 'revision';
  if (!schema.properties.artifact_type.enum.includes(value.artifact_type)) return 'artifact_type';
  if (!/^sha256:[0-9a-f]{64}$/.test(value.hash)) return 'hash';
  if (!/^[a-z][a-z0-9+.-]*:\/\/[^\s]+$/.test(value.location)) return 'location';
  if (typeof value.license !== 'string' || value.license.length < 1) return 'license';
  if ('size_bytes' in value && (!Number.isInteger(value.size_bytes) || value.size_bytes < 0)) return 'size_bytes';
  return Number.isNaN(Date.parse(value.created_at)) ? 'created_at' : null;
}

test('defines Artifact integrity and provenance fields', () => {
  assert.equal(schema.$id, 'https://evimesh.org/schema/artifact.schema.json');
  assert.deepEqual(schema.required, ['schema', 'artifact_id', 'revision', 'artifact_type', 'hash', 'location', 'license', 'created_at', 'created_by']);
  assert.equal(schema.properties.hash.pattern, '^sha256:[0-9a-f]{64}$');
  assert.equal(validateArtifact(validArtifact), null);
});

test('rejects invalid Artifact hash, location, license, and metadata', () => {
  for (const invalid of [
    { ...validArtifact, artifact_id: 'claim_018f0f4a-5c00-4000-8000-000000000001' },
    { ...validArtifact, hash: 'sha256:not-a-digest' },
    { ...validArtifact, location: 'local-file.bin' },
    { ...validArtifact, license: '' },
    { ...validArtifact, size_bytes: -1 },
    { ...validArtifact, artifact_type: 'unknown' },
  ]) {
    assert.notEqual(validateArtifact(invalid), null);
  }
});
