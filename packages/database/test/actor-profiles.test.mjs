import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { actorProfiles } from '../src/actor-profiles.mjs';

test('actor_profiles provides a one-to-one actor presentation projection', () => {
  const columns = getTableColumns(actorProfiles);

  assert.equal(columns.actorId.name, 'actor_id');
  assert.equal(columns.actorId.primary, true);
  assert.equal(columns.actorId.notNull, true);
  assert.equal(columns.displayName.name, 'display_name');
  assert.equal(columns.bio.name, 'bio');
  assert.equal(columns.avatarUrl.name, 'avatar_url');
  assert.equal(columns.createdAt.name, 'created_at');
  assert.equal(columns.updatedAt.name, 'updated_at');
  assert.equal(columns.deletedAt.name, 'deleted_at');
});
