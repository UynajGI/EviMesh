import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(
  new URL('../drizzle/0089_atomic_public_identity_and_project_admission.sql', import.meta.url),
  'utf8',
);

function functionBody(name, schema = 'private') {
  const pattern = new RegExp(
    `CREATE OR REPLACE FUNCTION "${schema}"\\."${name}"[\\s\\S]*?END;\\n\\$\\$;`,
  );
  return migration.match(pattern)?.[0] ?? '';
}

test('0089 makes verified identity provenance explicit and removes browser identity DML', () => {
  assert.match(migration, /ALTER TABLE "public"\."identities" ADD COLUMN "verification_source" text/);
  assert.match(migration, /ALTER TABLE "public"\."identities" ADD COLUMN "verified_at" timestamp with time zone/);
  assert.match(migration, /identities_verification_shape/);
  assert.match(migration, /"verification_source" = 'supabase_auth'/);
  assert.match(migration, /DROP POLICY IF EXISTS "actors_insert_self"/);
  assert.match(migration, /DROP POLICY IF EXISTS "identities_own_subject"/);
  for (const table of ['actors', 'identities']) {
    assert.match(
      migration,
      new RegExp(`REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE "public"\\."${table}" FROM "authenticated"`),
    );
  }
  assert.doesNotMatch(migration, /GRANT (?:INSERT|UPDATE|DELETE).*"authenticated"/);
});

test('Actor bootstrap consumes only the strict Auth Admin projection and provider allowlist', () => {
  const body = functionBody('actor_self_bootstrap');
  assert.ok(body.length > 5_000);
  assert.match(body, /evimesh\.auth-bootstrap-claims\.v1/);
  assert.match(body, /supabase_auth_admin/);
  assert.match(body, /item\.value->>'provider' NOT IN \('github','google','custom:orcid'\)/);
  assert.match(body, /ACTOR_BOOTSTRAP_ORCID_INVALID/);
  assert.match(body, /"private"\."orcid_is_valid"/);
  assert.doesNotMatch(body, /user_metadata|raw_user_meta_data|manually_verified|self_declared.*custom:orcid/);
  assert.match(body, /pg_advisory_xact_lock/);
  assert.match(body, /ORDER BY item\.value->>'provider'/);
});

test('Actor and every verified identity are created in one transaction with collision preflight', () => {
  const body = functionBody('actor_self_bootstrap');
  const preflight = body.indexOf('Preflight every linked identity');
  const actorInsert = body.indexOf('INSERT INTO "public"."actors"');
  assert.ok(preflight > 0 && actorInsert > preflight);
  assert.match(body, /ACTOR_BOOTSTRAP_BINDING_CONFLICT/);
  assert.match(body, /ACTOR_BOOTSTRAP_IDENTITY_CONFLICT/);
  assert.match(body, /"provider"='supabase' AND "subject"=v_auth_subject/);
  assert.match(body, /INSERT INTO "private"\."admission_audit_events"/);
  assert.match(body, /'actor\.bootstrapped'/);
  assert.match(body, /'identity\.linked'/);
  assert.doesNotMatch(body, /COMMIT|ROLLBACK/);
});

test('service-only wrappers are invoker functions over private definer transactions', () => {
  for (const name of ['actor_self_bootstrap', 'project_application_decide_atomic']) {
    const privateBody = functionBody(name, 'private');
    const publicBody = functionBody(name, 'public');
    assert.match(privateBody, /SECURITY DEFINER\s+SET search_path = ''/);
    assert.match(publicBody, /SECURITY INVOKER\s+SET search_path = ''/);
    assert.match(publicBody, /current_user <> 'service_role'/);
    assert.match(publicBody, /request\.jwt\.claim\.role/);
    assert.match(migration, new RegExp(`REVOKE ALL ON FUNCTION "public"\\."${name}"`));
    assert.match(migration, new RegExp(`GRANT EXECUTE ON FUNCTION "public"\\."${name}"`));
  }
  assert.match(migration, /REVOKE ALL ON FUNCTION "public"\."project_application_decide"\(uuid,text,text,text,timestamp with time zone\) FROM "service_role"/);
});

test('project decisions bind a platform governance event without pretending it is Human-signed', () => {
  const body = functionBody('project_application_decide_atomic');
  assert.match(body, /governance\.project_application_decided/);
  assert.match(body, /evimesh\.project-application-decision\.v1/);
  assert.match(body, /signer_semantics/);
  assert.match(body, /platform_governance/);
  assert.match(body, /human_signature/);
  assert.match(body, /v_payload->'human_signature' IS DISTINCT FROM 'false'::jsonb/);
  assert.match(body, /human_key\."key_id"=p_platform_event->'signature'->>'key_id'/);
  assert.match(body, /PROJECT_APPLICATION_PLATFORM_KEY_INVALID/);
  assert.match(body, /"actor_type"='service'/);
  assert.match(body, /steward_actor_id/);
  assert.doesNotMatch(body, /signing_keys[\s\S]{0,200}(?:INSERT|signature_nonces)/);
});

test('approval atomically creates legacy Project, kernel revision/crosswalk, owner, decision, and audit', () => {
  const body = functionBody('project_application_decide_atomic');
  const eventAt = body.indexOf('"persist_verified_research_event"');
  const projectAt = body.indexOf('INSERT INTO "public"."projects"');
  const revisionAt = body.indexOf('INSERT INTO "public"."project_revisions"');
  const graphAt = body.indexOf('"insert_research_graph_dual_write_node"');
  const memberAt = body.indexOf('INSERT INTO "public"."project_members"');
  const applicationAt = body.indexOf('UPDATE "private"."project_applications"');
  const auditAt = body.lastIndexOf('INSERT INTO "private"."admission_audit_events"');
  const receiptAt = body.lastIndexOf('INSERT INTO "private"."project_application_decision_receipts"');
  assert.ok(eventAt > 0 && projectAt > eventAt && revisionAt > projectAt && graphAt > revisionAt);
  assert.ok(memberAt > graphAt && applicationAt > memberAt && auditAt > applicationAt && receiptAt > auditAt);
  assert.match(body, /'project'::"private"\."research_node_kind"/);
  assert.match(body, /'published'::"private"\."research_document_state"/);
  assert.match(body, /'owner','active'/);
  assert.match(body, /'project_application\.'\|\|p_decision/);
  assert.doesNotMatch(body, /COMMIT|ROLLBACK/);
});

test('decision receipts serialize retries and are immutable, private, and exact-event bound', () => {
  assert.match(migration, /CREATE TABLE "private"\."project_application_decision_receipts"/);
  assert.match(migration, /CONSTRAINT "project_application_decision_receipts_application_unique" UNIQUE \("application_id"\)/);
  assert.match(migration, /CONSTRAINT "project_application_decision_receipts_event_unique" UNIQUE \("event_id"\)/);
  assert.match(migration, /project_application_decision_receipts_append_only_trigger/);
  assert.match(migration, /ALTER TABLE "private"\."project_application_decision_receipts" ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /REVOKE ALL ON TABLE "private"\."project_application_decision_receipts" FROM PUBLIC/);
  const body = functionBody('project_application_decide_atomic');
  assert.match(body, /FOR NO KEY UPDATE/);
  assert.match(body, /v_receipt\."platform_event" IS DISTINCT FROM p_platform_event/);
  assert.match(body, /PROJECT_APPLICATION_DECISION_REPLAY_CONFLICT/);
  assert.match(body, /RETURN v_receipt\."result"/);
});
