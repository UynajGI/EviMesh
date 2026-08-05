import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { verificationContractRevisions } from '../src/verification-contract-revisions.mjs';

test('verification_contract_revisions preserve append-only contract requirements', () => {
  const columns = getTableColumns(verificationContractRevisions);
  const config = getTableConfig(verificationContractRevisions);

  for (const [property, name] of [
    ['contractId', 'contract_id'], ['revision', 'revision'], ['supersedes', 'supersedes'],
    ['requirements', 'requirements'], ['verificationTypes', 'verification_types'],
    ['contextModes', 'context_modes'], ['createdBy', 'created_by'], ['createdAt', 'created_at'],
  ]) assert.equal(columns[property].name, name);
  assert.equal(columns.verificationTypes.hasDefault, true);
  assert.equal(columns.contextModes.hasDefault, true);
  assert.equal(config.primaryKeys[0].name, 'verification_contract_revisions_pkey');
  assert.deepEqual(config.primaryKeys[0].columns.map((column) => column.name), ['contract_id', 'revision']);
  assert.equal(config.checks.length, 2);
});
