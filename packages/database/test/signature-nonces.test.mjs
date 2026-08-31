import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { readFile } from 'node:fs/promises';
import { claimSignatureNonce, signatureNonces } from '../src/signature-nonces.mjs';

test('signature_nonces makes actor/key/nonce persistence unique', () => {
  const columns = getTableColumns(signatureNonces);
  const config = getTableConfig(signatureNonces);

  assert.equal(columns.actorId.name, 'actor_id');
  assert.equal(columns.keyId.name, 'key_id');
  assert.equal(columns.nonce.name, 'nonce');
  assert.equal(columns.consumedAt.name, 'consumed_at');
  assert.ok(config.uniqueConstraints.some((constraint) =>
    constraint.name === 'signature_nonces_actor_key_nonce_unique'
      && constraint.columns.map((column) => column.name).join(',') === 'actor_id,key_id,nonce'));
});

test('claimSignatureNonce reports whether the atomic insert won the uniqueness race', async () => {
  const calls = [];
  const makeDatabase = (inserted) => ({
    insert(table) {
      assert.equal(table, signatureNonces);
      return {
        values(values) {
          calls.push({ values });
          return {
            onConflictDoNothing(options) {
              calls.push({ target: options.target.map((column) => column.name) });
              return { returning: async () => inserted ? [{ nonce: values.nonce }] : [] };
            },
          };
        },
      };
    },
  });

  assert.equal(await claimSignatureNonce({ db: makeDatabase(true), actorId: 'actor-1', keyId: 'key-1', nonce: 'nonce-0123456789abcdef' }), true);
  assert.equal(await claimSignatureNonce({ db: makeDatabase(false), actorId: 'actor-1', keyId: 'key-1', nonce: 'nonce-0123456789abcdef' }), false);
  assert.deepEqual(calls[1].target, ['actor_id', 'key_id', 'nonce']);
});

test('migration enables RLS and restricts Data API access to service_role', async () => {
  const sql = await readFile(new URL('../drizzle/0074_signature_nonces.sql', import.meta.url), 'utf8');
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL ON TABLE "public"\."signature_nonces" FROM "anon", "authenticated"/);
  assert.match(sql, /REVOKE ALL ON TABLE "public"\."signature_nonces" FROM "service_role"/);
  assert.match(sql, /GRANT INSERT, SELECT ON TABLE "public"\."signature_nonces" TO "service_role"/);
  assert.ok(
    sql.indexOf('REVOKE ALL ON TABLE "public"."signature_nonces" FROM "service_role"')
      < sql.indexOf('GRANT INSERT, SELECT ON TABLE "public"."signature_nonces" TO "service_role"'),
  );
  assert.doesNotMatch(sql, /SECURITY DEFINER/);
});
