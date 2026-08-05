import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { verificationPolicyRevisions } from '../src/verification-policy-revisions.mjs';

test('verification_policy_revisions preserve append-only policy requirements and outcomes', () => {
  const columns = getTableColumns(verificationPolicyRevisions);
  const config = getTableConfig(verificationPolicyRevisions);

  for (const [property, name] of [
    ['policyId', 'policy_id'],
    ['revision', 'revision'],
    ['supersedes', 'supersedes'],
    ['requirements', 'requirements'],
    ['outcomes', 'outcomes'],
    ['createdBy', 'created_by'],
    ['createdAt', 'created_at'],
  ]) {
    assert.equal(columns[property].name, name);
  }

  assert.equal(config.primaryKeys[0].name, 'verification_policy_revisions_pkey');
  assert.deepEqual(config.primaryKeys[0].columns.map((column) => column.name), ['policy_id', 'revision']);
  assert.equal(config.checks.length, 2);
});
