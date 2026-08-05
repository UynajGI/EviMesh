import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { claimRevisions } from '../src/claim-revisions.mjs';

test('claim_revisions preserve immutable epistemic boundary content', () => {
  const columns = getTableColumns(claimRevisions);
  const config = getTableConfig(claimRevisions);

  for (const [property, name] of [
    ['claimId', 'claim_id'], ['revision', 'revision'], ['supersedes', 'supersedes'],
    ['state', 'state'], ['statement', 'statement'], ['scope', 'scope'],
    ['assumptions', 'assumptions'], ['falsification', 'falsification'],
    ['questionId', 'question_id'], ['createdBy', 'created_by'], ['createdAt', 'created_at'],
  ]) assert.equal(columns[property].name, name);
  assert.equal(columns.assumptions.hasDefault, true);
  assert.equal(config.primaryKeys[0].name, 'claim_revisions_pkey');
  assert.deepEqual(config.primaryKeys[0].columns.map((column) => column.name), ['claim_id', 'revision']);
  assert.equal(config.checks.length, 2);
});
