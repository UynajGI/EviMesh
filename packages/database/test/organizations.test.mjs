import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { organizations } from '../src/organizations.mjs';

test('organizations provide stable identity and unique actor/slug bindings', () => {
  const columns = getTableColumns(organizations);
  const config = getTableConfig(organizations);
  const uniqueNames = config.uniqueConstraints.map((constraint) => constraint.name);

  assert.equal(columns.organizationId.name, 'organization_id');
  assert.equal(columns.organizationId.primary, true);
  assert.equal(columns.actorId.name, 'actor_id');
  assert.equal(columns.actorId.notNull, true);
  assert.equal(columns.slug.name, 'slug');
  assert.equal(columns.slug.notNull, true);
  assert.equal(columns.displayName.name, 'display_name');
  assert.equal(columns.displayName.notNull, true);
  assert.equal(columns.description.name, 'description');
  assert.ok(uniqueNames.includes('organizations_actor_id_unique'));
  assert.ok(uniqueNames.includes('organizations_slug_unique'));
});
