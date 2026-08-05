import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { challenges } from '../src/challenges.mjs';

test('challenges provide stable identity and lifecycle ownership', () => {
  const columns = getTableColumns(challenges);

  for (const [property, name] of [
    ['challengeId', 'challenge_id'],
    ['createdBy', 'created_by'],
    ['createdAt', 'created_at'],
    ['updatedAt', 'updated_at'],
    ['deletedAt', 'deleted_at'],
  ]) {
    assert.equal(columns[property].name, name);
  }

  assert.equal(columns.challengeId.primary, true);
  assert.equal(columns.createdBy.notNull, true);
  assert.equal(columns.createdAt.hasDefault, true);
  assert.equal(columns.updatedAt.hasDefault, true);
});
