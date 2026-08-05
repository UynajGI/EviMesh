import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { runInputs } from '../src/run-inputs.mjs';

test('run_inputs lock each input to a concrete Artifact revision', () => {
  const columns = getTableColumns(runInputs);
  const config = getTableConfig(runInputs);

  for (const [property, name] of [
    ['runId', 'run_id'], ['artifactId', 'artifact_id'],
    ['artifactRevision', 'artifact_revision'], ['createdAt', 'created_at'],
  ]) assert.equal(columns[property].name, name);
  assert.equal(config.primaryKeys[0].name, 'run_inputs_pkey');
  assert.deepEqual(config.primaryKeys[0].columns.map((column) => column.name), [
    'run_id', 'artifact_id', 'artifact_revision',
  ]);
  assert.equal(config.foreignKeys.length, 2);
  assert.equal(config.checks.length, 1);
});
