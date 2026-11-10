import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(new URL('../drizzle/0086_brainy_callisto.sql', import.meta.url), 'utf8');

test('0086 keeps admission state private, RLS protected, and outside the research DAG', () => {
  for (const table of ['project_applications', 'project_invitations', 'admission_audit_events', 'admission_feature_gates']) {
    assert.match(migration, new RegExp(`CREATE TABLE "private"\."${table}"`));
    assert.match(migration, new RegExp(`ALTER TABLE "private"\."${table}" ENABLE ROW LEVEL SECURITY`));
    assert.match(migration, new RegExp(`REVOKE ALL ON TABLE "private"\."${table}" FROM PUBLIC`));
  }
  assert.match(migration, /ARRAY\['anon', 'authenticated', 'service_role'\]/);
  assert.doesNotMatch(migration, /research_nodes|research_node_revisions|research_edges/);
  assert.doesNotMatch(migration, /GRANT (?:SELECT|INSERT|UPDATE|DELETE|ALL) ON TABLE private\./i);
});

test('0086 persists terms/profile completion but verifies email against Supabase auth', () => {
  assert.match(migration, /ADD COLUMN "terms_version" text/);
  assert.match(migration, /ADD COLUMN "terms_accepted_at" timestamp with time zone/);
  assert.match(migration, /ADD COLUMN "profile_completed_at" timestamp with time zone/);
  assert.match(migration, /auth\.users WHERE id::text = \$1 AND email_confirmed_at IS NOT NULL/);
  assert.doesNotMatch(migration, /ADD COLUMN "email_verified"/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION "public"\."actor_onboarding_complete"/);
});

test('0086 stores public signing material only with server fingerprints and one active key', () => {
  assert.match(migration, /ADD COLUMN "fingerprint" text/);
  assert.match(migration, /CREATE UNIQUE INDEX "signing_keys_one_active_per_actor"/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION "private"\."prepare_signing_key"/);
  assert.match(migration, /SIGNING_KEY_FINGERPRINT_MISMATCH/);
  assert.match(migration, /SIGNING_KEY_MATERIAL_IMMUTABLE/);
  assert.match(migration, /decode_canonical_ed25519_spki/);
  assert.match(migration, /302a300506032b6570032100/);
  assert.match(migration, /'sha256:' \|\| pg_catalog\.encode\([\s\S]*?'hex'/);
  assert.match(migration, /DROP POLICY IF EXISTS "actor_owned_signing_keys"/);
  assert.match(migration, /REVOKE ALL ON TABLE "public"\."signing_keys" FROM PUBLIC/);
  assert.match(migration, /CREATE OR REPLACE VIEW "public"\."signing_key_verification_keys"/);
  assert.doesNotMatch(
    migration.match(/CREATE OR REPLACE VIEW "public"\."signing_key_verification_keys"[\s\S]*?statement-breakpoint/)?.[0] ?? '',
    /label|revocation_reason/,
  );
  assert.match(migration, /CREATE OR REPLACE FUNCTION "public"\."signing_key_list"/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION "public"\."signing_key_register"/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION "public"\."signing_key_revoke"/);
  assert.doesNotMatch(migration, /private_key|secret_key/i);
});

test('0086 keeps project approval fail-closed and serializes admission state without FK lock deadlocks', () => {
  assert.ok((migration.match(/FOR NO KEY UPDATE/g) ?? []).length >= 10);
  assert.doesNotMatch(migration, /FOR UPDATE;/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION "public"\."project_application_decide"/);
  const decideBody = migration.match(
    /CREATE OR REPLACE FUNCTION "public"\."project_application_decide"[\s\S]*?END;\n\$\$;/,
  )?.[0] ?? '';
  assert.match(decideBody, /PROJECT_APPROVAL_GRAPH_WRITE_NOT_READY/);
  assert.match(decideBody, /private\.project_application_approve_with_graph/);
  assert.match(decideBody, /admission_feature_gates/);
  assert.doesNotMatch(decideBody, /INSERT INTO "public"\."projects"/);
  assert.doesNotMatch(decideBody, /INSERT INTO "public"\."project_revisions"/);
  assert.doesNotMatch(decideBody, /INSERT INTO "public"\."project_members"/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION "public"\."project_invitation_respond"/);
  assert.match(migration, /ON CONFLICT \("project_id", "actor_id"\) DO UPDATE/);
  assert.match(migration, /clock_timestamp\(\)/);
  assert.match(migration, /expired_on_reinvite/);
  assert.match(migration, /PROJECT_INVITATION_PROJECT_INACTIVE/);
  assert.match(migration, /PROJECT_INVITATION_RECIPIENT_INVALID/);
  assert.match(migration, /PROJECT_MEMBERSHIP_LAST_OWNER/);
  assert.match(migration, /maintainers cannot remove owners or maintainers/);
  for (const functionName of ['project_membership_change_role', 'project_membership_remove']) {
    const body = migration.match(new RegExp(
      `CREATE OR REPLACE FUNCTION "public"\\."${functionName}"[\\s\\S]*?END;\\n\\$\\$;`,
    ))?.[0];
    assert.ok(body, `missing ${functionName}`);
    assert.match(body, /FROM "public"\."projects"[\s\S]*FOR NO KEY UPDATE;[\s\S]*FROM "public"\."project_members"/);
  }
});

test('0086 enforces canonical Project ids, bounded summaries, and non-null audit reasons', () => {
  assert.match(migration, /project_applications_project_id_canonical/);
  assert.match(migration, /\^project_\[0-9a-f\]/);
  assert.match(migration, /proposed_summary"\) between 1 and 4000/);
  for (const rpcName of [
    'signing_key_revoke',
    'project_application_decide',
    'project_invitation_revoke',
    'project_membership_change_role',
    'project_membership_remove',
  ]) {
    const body = migration.match(new RegExp(
      `CREATE OR REPLACE FUNCTION "public"\\."${rpcName}"[\\s\\S]*?END;\\n\\$\\$;`,
    ))?.[0] ?? '';
    assert.match(body, /p_reason IS NULL/);
  }
});

test('0086 audit events are append-only and all public RPCs are service-role only', () => {
  assert.match(migration, /admission_audit_events_append_only/);
  assert.match(migration, /ADMISSION_AUDIT_IMMUTABLE/);
  const rpcNames = [
    'actor_onboarding_complete',
    'signing_key_list',
    'signing_key_register',
    'signing_key_revoke',
    'project_application_submit',
    'project_application_withdraw',
    'project_application_decide',
    'project_invitation_create',
    'project_invitation_respond',
    'project_invitation_revoke',
    'project_membership_change_role',
    'project_membership_remove',
  ];
  for (const name of rpcNames) {
    assert.match(migration, new RegExp(`CREATE OR REPLACE FUNCTION "public"\\."${name}"`));
    assert.match(migration, new RegExp(`public\\.${name}\\(`));
  }
  assert.equal((migration.match(/\nSECURITY DEFINER\n/g) ?? []).length, rpcNames.length);
  assert.ok((migration.match(/SET search_path = ''/g) ?? []).length >= rpcNames.length + 2);
  assert.match(migration, /REVOKE ALL ON FUNCTION %s FROM PUBLIC/);
  assert.match(migration, /REVOKE ALL ON FUNCTION %s FROM anon/);
  assert.match(migration, /REVOKE ALL ON FUNCTION %s FROM authenticated/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION %s TO service_role/);
});
