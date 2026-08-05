import assert from 'node:assert/strict';
import test from 'node:test';
import drizzleConfig from '../drizzle.config.mjs';
import { createDatabaseClient, schema } from '../src/index.mjs';

test('exports an empty schema entry point for M3-01', () => {
  assert.deepEqual(schema, {});
});

test('creates a postgres-js Drizzle client from an explicit URL', async () => {
  const { client, db } = createDatabaseClient('postgresql://localhost/evimesh_test');

  assert.equal(typeof db, 'object');
  await client.end({ timeout: 1 });
});

test('requires DATABASE_URL when no URL is supplied', () => {
  assert.throws(() => createDatabaseClient(), /DATABASE_URL is required/);
});

test('configures PostgreSQL migrations from the package schema entry point', () => {
  assert.equal(drizzleConfig.dialect, 'postgresql');
  assert.equal(drizzleConfig.schema, './src/schema.mjs');
  assert.equal(drizzleConfig.out, './drizzle');
});
