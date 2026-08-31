import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const schemaDirectory = dirname(testDirectory);
const fixtureDirectory = join(schemaDirectory, 'fixtures', 'invalid');
const expectedSchemas = ['project', 'question', 'task', 'claim', 'artifact', 'run', 'verification', 'challenge', 'frontier', 'contribution', 'event', 'answer', 'rebuttal', 'evaluation', 'dataset', 'tool'];

test('provides at least two invalid fixtures for every M1-28 to M1-38 schema', async () => {
  const fixtureNames = (await readdir(fixtureDirectory)).filter((name) => name.endsWith('.json')).sort();
  assert.deepEqual(fixtureNames, expectedSchemas.map((name) => `${name}.json`).sort());

  for (const name of expectedSchemas) {
    const samples = JSON.parse(await readFile(join(fixtureDirectory, `${name}.json`), 'utf8'));
    const schema = JSON.parse(await readFile(join(schemaDirectory, `${name}.schema.json`), 'utf8'));
    assert.equal(Array.isArray(samples), true);
    assert.ok(samples.length >= 2, `${name}: expected at least two invalid samples`);

    for (const sample of samples) {
      const wrongSchema = sample.schema !== schema.properties.schema.const;
      const missingRequired = schema.required.some((field) => !(field in sample));
      assert.equal(wrongSchema || missingRequired, true, `${name}: sample is not structurally invalid`);
    }
  }
});
