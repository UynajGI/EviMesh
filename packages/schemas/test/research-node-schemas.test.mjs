import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { schemaFileForDocument, validateAgainstSchema } from '../src/validator.mjs';

const kinds = ['answer', 'rebuttal', 'evaluation', 'dataset', 'tool'];

for (const kind of kinds) {
  test(`defines and validates the strong srp.${kind}.v1 document`, async () => {
    const schema = JSON.parse(await readFile(new URL(`../${kind}.schema.json`, import.meta.url), 'utf8'));
    const fixture = JSON.parse(await readFile(new URL(`../fixtures/valid/${kind}.json`, import.meta.url), 'utf8'));
    assert.equal(schema.properties.schema.const, `srp.${kind}.v1`);
    assert.equal(schemaFileForDocument(fixture), `${kind}.schema.json`);
    assert.deepEqual(validateAgainstSchema(schema, fixture), { valid: true, findings: [] });
    assert.equal(validateAgainstSchema(schema, { ...fixture, unexpected: true }).valid, false);
    assert.equal(validateAgainstSchema(schema, { ...fixture, supersedes_revision: 1 }).valid, false);
    assert.equal(validateAgainstSchema(schema, { ...fixture, revision: 2, supersedes_revision: 1 }).valid, true);
    assert.equal(validateAgainstSchema(schema, { ...fixture, revision: 2, supersedes_revision: null }).valid, false);
  });
}

test('Evaluation requires a basis and validates its stance', async () => {
  const schema = JSON.parse(await readFile(new URL('../evaluation.schema.json', import.meta.url), 'utf8'));
  const fixture = JSON.parse(await readFile(new URL('../fixtures/valid/evaluation.json', import.meta.url), 'utf8'));
  assert.equal(validateAgainstSchema(schema, { ...fixture, basis_refs: [] }).valid, false);
  assert.equal(validateAgainstSchema(schema, { ...fixture, stance: 'truth_score' }).valid, false);
});
