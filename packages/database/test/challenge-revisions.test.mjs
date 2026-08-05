import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { challengeRevisions } from '../src/challenge-revisions.mjs';

test('challenge_revisions lock target claims and preserve challenge state', () => {
  const columns = getTableColumns(challengeRevisions);
  const config = getTableConfig(challengeRevisions);

  for (const [property, name] of [
    ['challengeId', 'challenge_id'],
    ['revision', 'revision'],
    ['state', 'state'],
    ['targetClaimId', 'target_claim_id'],
    ['targetClaimRevision', 'target_claim_revision'],
    ['reason', 'reason'],
    ['impact', 'impact'],
    ['proposedResolution', 'proposed_resolution'],
    ['createdBy', 'created_by'],
    ['createdAt', 'created_at'],
  ]) {
    assert.equal(columns[property].name, name);
  }

  assert.equal(config.primaryKeys[0].name, 'challenge_revisions_pkey');
  assert.deepEqual(config.primaryKeys[0].columns.map((column) => column.name), ['challenge_id', 'revision']);
  assert.equal(config.foreignKeys.length, 3);
  assert.equal(config.checks.length, 2);
});
