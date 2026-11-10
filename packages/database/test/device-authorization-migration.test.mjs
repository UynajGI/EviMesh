import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(
  new URL('../drizzle/0085_persistent_device_authorization.sql', import.meta.url),
  'utf8',
);

test('0085 keeps Device Authorization and its audit trail private', () => {
  assert.match(migration, /CREATE TABLE "private"\."device_authorizations"/);
  assert.match(migration, /CREATE TABLE "private"\."device_authorization_events"/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/g);
  assert.match(migration, /REVOKE ALL ON TABLE "private"\."device_authorizations" FROM PUBLIC/);
  assert.match(migration, /REVOKE ALL ON TABLE private\.device_authorizations FROM %I/);
  assert.match(migration, /ARRAY\['anon', 'authenticated', 'service_role'\]/);
  assert.doesNotMatch(migration, /REVOKE ALL ON SCHEMA private FROM %I/);
  assert.doesNotMatch(migration, /GRANT (?:SELECT|INSERT|UPDATE|DELETE|ALL).*device_authorizations/i);
  assert.doesNotMatch(migration, /research_nodes|research_node_revisions|research_edges/);
});

test('0085 persists only code/token digests and the fixed scope registry', () => {
  assert.match(migration, /"device_code_digest" text NOT NULL/);
  assert.match(migration, /"user_code_digest" text NOT NULL/);
  assert.doesNotMatch(migration, /"device_code" text/);
  assert.doesNotMatch(migration, /"user_code" text/);
  assert.doesNotMatch(migration, /"access_token"/);
  assert.match(migration, /'profile:read', 'project:read', 'research:prepare', 'research:submit', 'artifact:upload'/);
  assert.doesNotMatch(migration, /research:sign/);
  assert.match(migration, /p_token_hash text/);
  assert.match(migration, /INSERT INTO "public"\."api_tokens"/);
  assert.doesNotMatch(migration, /p_token_scopes/);
});

test('0085 exposes only service-role lifecycle RPCs with pinned definers', () => {
  for (const name of ['start', 'preview', 'approve', 'deny', 'consume']) {
    assert.match(migration, new RegExp(`CREATE OR REPLACE FUNCTION "public"\\."device_authorization_${name}"`));
  }
  assert.equal((migration.match(/SECURITY DEFINER/g) ?? []).length, 5);
  assert.ok((migration.match(/SET search_path = ''/g) ?? []).length >= 7);
  assert.match(migration, /REVOKE ALL ON FUNCTION "public"\."device_authorization_start"[\s\S]*FROM PUBLIC/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION %s TO service_role/);
  assert.match(migration, /REVOKE ALL ON FUNCTION %s FROM anon/);
  assert.match(migration, /REVOKE ALL ON FUNCTION %s FROM authenticated/);
});

test('0085 approves and consumes under row locks with immutable linked audit events', () => {
  assert.ok((migration.match(/FOR UPDATE/g) ?? []).length >= 3);
  assert.match(migration, /device_authorization_events_append_only/);
  assert.match(migration, /\[DEVICE_AUTH_AUDIT_IMMUTABLE\]/);
  assert.match(migration, /agent\.owner_actor_id = p_approved_by_actor_id/);
  assert.match(migration, /agent\.actor_type = 'agent'/);
  assert.match(migration, /approval_event_id = v_event_id/);
  assert.match(migration, /consumption_event_id = v_event_id/);
  assert.match(migration, /issued_token_id = p_token_id/);
  assert.match(migration, /v_grant\.status <> 'approved'/);
  assert.match(migration, /WHEN unique_violation/);
});

test('0085 hardens API token display and rotation metadata additively', () => {
  assert.match(migration, /ADD COLUMN "label" text DEFAULT 'API token' NOT NULL/);
  assert.match(migration, /ADD COLUMN "rotated_from_token_id" uuid/);
  assert.match(migration, /ADD COLUMN "rotated_at" timestamp with time zone/);
  assert.match(migration, /api_tokens_rotated_from_token_id_unique/);
  assert.match(migration, /api_tokens_rotation_state/);
});
