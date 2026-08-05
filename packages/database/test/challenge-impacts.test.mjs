import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { challengeImpacts } from '../src/challenge-impacts.mjs';

test('challenge_impacts persist downstream claim revision effects', () => {
  const columns = getTableColumns(challengeImpacts);
  const config = getTableConfig(challengeImpacts);

  for (const [property, name] of [
    ['impactId', 'impact_id'],
    ['challengeId', 'challenge_id'],
    ['challengeRevision', 'challenge_revision'],
    ['claimId', 'claim_id'],
    ['claimRevision', 'claim_revision'],
    ['impactType', 'impact_type'],
    ['reason', 'reason'],
    ['details', 'details'],
    ['createdAt', 'created_at'],
  ]) {
    assert.equal(columns[property].name, name);
  }

  assert.equal(columns.impactId.primary, true);
  assert.equal(columns.details.hasDefault, true);
  assert.equal(config.foreignKeys.length, 2);
  assert.equal(config.checks.length, 2);
});
