import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { identities } from '../src/identities.mjs';

test('identities binds one external provider subject to an actor', () => {
  const columns = getTableColumns(identities);
  const config = getTableConfig(identities);

  assert.equal(columns.identityId.name, 'identity_id');
  assert.equal(columns.identityId.primary, true);
  assert.equal(columns.identityId.hasDefault, true);
  assert.equal(columns.actorId.name, 'actor_id');
  assert.equal(columns.actorId.notNull, true);
  assert.equal(columns.provider.name, 'provider');
  assert.equal(columns.provider.notNull, true);
  assert.equal(columns.subject.name, 'subject');
  assert.equal(columns.subject.notNull, true);
  assert.equal(columns.email.name, 'email');
  assert.ok(config.uniqueConstraints.some((constraint) =>
    constraint.name === 'identities_provider_subject_unique'));
});
