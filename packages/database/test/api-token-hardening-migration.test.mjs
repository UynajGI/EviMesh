import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(new URL('../drizzle/0087_true_bucky.sql', import.meta.url), 'utf8');

function rpcBody(name) {
  return migration.match(new RegExp(
    `CREATE OR REPLACE FUNCTION "public"\\."${name}"[\\s\\S]*?END;\\n\\$\\$;`,
  ))?.[0] ?? '';
}

test('0087 removes every browser and service-role base-table privilege', () => {
  assert.match(migration, /DROP POLICY IF EXISTS "actor_owned_api_tokens"/);
  assert.match(migration, /ALTER TABLE "public"\."api_tokens" ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /ARRAY\['anon', 'authenticated', 'service_role'\]/);
  assert.match(migration, /REVOKE ALL ON TABLE public\.api_tokens FROM %I/);
  assert.match(migration, /REVOKE ALL ON TABLE private\.api_token_audit_events FROM %I/);
  assert.doesNotMatch(migration, /GRANT (?:SELECT|INSERT|UPDATE|DELETE|ALL) ON TABLE (?:public\.api_tokens|private\.api_token_audit_events)/i);
});

test('0087 fixes the five-scope registry and permanently excludes signing authority', () => {
  for (const scope of ['profile:read', 'project:read', 'research:prepare', 'research:submit', 'artifact:upload']) {
    assert.match(migration, new RegExp(scope.replace(':', '\\:')));
  }
  assert.doesNotMatch(migration, /research:sign/);
  assert.match(migration, /api_tokens_scopes_registered/);
  assert.match(migration, /jsonb_array_length\("api_tokens"\."scopes"\) between 1 and 5/);
  assert.match(migration, /api_tokens_hash_shape/);
  assert.match(migration, /api_tokens_prefix_shape/);
});

test('0087 provides only safe service RPC projections and no manual issue RPC', () => {
  const names = [
    'api_token_auth_lookup',
    'api_token_mark_used',
    'api_token_list_owned_agent_tokens',
    'api_token_revoke_owned_agent_token',
    'api_token_rotate_owned_agent_token',
  ];
  for (const name of names) {
    const body = rpcBody(name);
    assert.ok(body, `missing ${name}`);
    assert.match(body, /SECURITY DEFINER/);
    assert.match(body, /SET search_path = ''/);
    assert.match(migration, new RegExp(`public\\.${name}\\(`));
  }
  assert.doesNotMatch(migration, /FUNCTION "public"\."api_token_(?:issue|create)/);
  assert.doesNotMatch(rpcBody('api_token_list_owned_agent_tokens'), /'tokenHash'|"token_hash"/);
  assert.doesNotMatch(rpcBody('api_token_auth_lookup'), /'tokenHash'/);
  assert.match(migration, /REVOKE ALL ON FUNCTION %s FROM authenticated/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION %s TO service_role/);
});

test('0087 binds token management to a verified human and their managed Agent', () => {
  assert.match(migration, /assert_verified_api_token_owner/);
  assert.match(migration, /auth\.users WHERE id::text = \$1 AND email_confirmed_at IS NOT NULL/);
  for (const name of ['api_token_list_owned_agent_tokens', 'api_token_revoke_owned_agent_token', 'api_token_rotate_owned_agent_token']) {
    const body = rpcBody(name);
    assert.match(body, /"actor_type" = 'agent'/);
    assert.match(body, /"owner_actor_id" = pg_catalog\.btrim\(p_owner_actor_id\)/);
  }
  assert.match(rpcBody('api_token_revoke_owned_agent_token'), /p_reason IS NULL/);
  assert.match(rpcBody('api_token_rotate_owned_agent_token'), /p_reason IS NULL/);
});

test('0087 rotation and usage are DB-clocked, locked, replay-safe, and Device-Auth-only', () => {
  assert.match(rpcBody('api_token_mark_used'), /clock_timestamp\(\)/);
  assert.match(rpcBody('api_token_mark_used'), /FOR NO KEY UPDATE/);
  const rotation = rpcBody('api_token_rotate_owned_agent_token');
  assert.match(rotation, /ORDER BY "token_id"[\s\S]*FOR NO KEY UPDATE/);
  assert.match(rotation, /event_type" = 'issued'|"event_type" = 'issued'/);
  assert.match(rotation, /API_TOKEN_ROTATION_DEVICE_AUTH_REQUIRED/);
  assert.match(rotation, /API_TOKEN_ROTATION_CONFLICT/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION "public"\."device_authorization_consume"/);
  assert.match(migration, /'issued'/);
  assert.match(migration, /api_token_audit_events_append_only/);
  assert.match(migration, /API_TOKEN_AUDIT_IMMUTABLE/);
});
