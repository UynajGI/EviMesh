import assert from 'node:assert/strict';
import test from 'node:test';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { contributionRole, contributionStatements } from '../src/contribution-statements.mjs';

test('contribution_statements attribute a typed role to an actor', () => {
  const columns = getTableColumns(contributionStatements);
  assert.deepEqual(Object.keys(columns), [
    'statementId',
    'eventId',
    'actorId',
    'role',
    'description',
    'createdAt',
  ]);
  assert.equal(columns.statementId.primary, true);
  assert.equal(columns.eventId.notNull, true);
  assert.equal(columns.actorId.notNull, true);
  assert.deepEqual(contributionRole.enumValues, [
    'originator',
    'contributor',
    'reviewer',
    'verifier',
    'witness',
    'maintainer',
  ]);

  const config = getTableConfig(contributionStatements);
  assert.equal(config.foreignKeys.length, 2);
  assert.equal(config.checks.length, 1);
});
