import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const schemaPath = fileURLToPath(new URL('../common.schema.json', import.meta.url));
const schema = JSON.parse(await readFile(schemaPath, 'utf8'));

const validVectors = [
  ['uuidv7', '018f0f4a-5c00-7000-8000-000000000001'],
  ['objectId', 'claim_018f0f4a-5c00-4000-8000-000000000001'],
  ['hash', `sha256:${'a'.repeat(64)}`],
  ['actorType', 'agent'],
  ['identityStrength', 'verified'],
  ['timestamp', '2026-08-04T06:00:00.000Z'],
];

test('defines the common schema and protocol vocabulary', () => {
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(schema.$id, 'https://evimesh.org/schema/common.schema.json');
  assert.deepEqual(Object.keys(schema.$defs).sort(), [
    'actorType', 'hash', 'identityStrength', 'objectId', 'revision', 'signature', 'timestamp', 'uuid', 'uuidv7',
  ]);
  for (const [name, value] of validVectors) {
    assert.equal(typeof schema.$defs[name], 'object');
    assert.equal(typeof value, 'string');
  }
});

test('common schema definitions expose rejection constraints', () => {
  assert.equal(schema.$defs.revision.minimum, 1);
  assert.deepEqual(schema.$defs.actorType.enum, ['human', 'agent', 'organization', 'service', 'maintainer', 'witness']);
  assert.deepEqual(schema.$defs.identityStrength.enum, ['verified', 'observed', 'self_declared', 'unknown']);
  assert.deepEqual(schema.$defs.signature.required, ['algorithm', 'key_id', 'value']);
  assert.doesNotMatch('sha256:not-a-digest', new RegExp(schema.$defs.hash.pattern));
});
