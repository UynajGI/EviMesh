import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { organizationMembers } from '../src/organization-members.mjs';

test('organization_members has a composite organization/actor membership key', () => {
  const columns = getTableColumns(organizationMembers);
  const config = getTableConfig(organizationMembers);

  assert.equal(columns.organizationId.name, 'organization_id');
  assert.equal(columns.organizationId.notNull, true);
  assert.equal(columns.actorId.name, 'actor_id');
  assert.equal(columns.actorId.notNull, true);
  assert.equal(columns.role.name, 'role');
  assert.equal(columns.role.notNull, true);
  assert.equal(columns.role.hasDefault, true);
  assert.equal(config.primaryKeys[0].name, 'organization_members_pkey');
  assert.deepEqual(
    config.primaryKeys[0].columns.map((column) => column.name),
    ['organization_id', 'actor_id'],
  );
});
