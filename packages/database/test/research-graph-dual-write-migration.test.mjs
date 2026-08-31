import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(new URL('../drizzle/0082_optimal_terrax.sql', import.meta.url), 'utf8');
const kernelMigration = await readFile(new URL('../drizzle/0080_rare_killmonger.sql', import.meta.url), 'utf8');

test('defines the private dispatcher before the fixed public PostgREST wrapper', () => {
  const implementation = migration.indexOf('CREATE OR REPLACE FUNCTION private.execute_research_graph_legacy_dual_write(');
  const wrapper = migration.indexOf('CREATE OR REPLACE FUNCTION public.execute_research_graph_legacy_dual_write(');
  assert.ok(implementation > 0);
  assert.ok(wrapper > implementation);
  assert.match(migration, /public\.execute_research_graph_legacy_dual_write\(\s*p_mutation_kind text,\s*p_command jsonb,\s*p_verified_events jsonb,\s*p_expected_legacy jsonb\s*\)/s);
  assert.match(migration, /RETURN private\.execute_research_graph_legacy_dual_write\(\s*p_mutation_kind,p_command,p_verified_events,p_expected_legacy\s*\)/s);
  assert.match(migration, /private\.execute_research_graph_legacy_dual_write\([\s\S]*?SECURITY DEFINER\s*SET search_path = ''/);
  assert.match(migration, /public\.execute_research_graph_legacy_dual_write\([\s\S]*?SECURITY INVOKER\s*SET search_path = ''/);
});

test('allows only the eight typed legacy mutation kinds without dynamic SQL', () => {
  for (const kind of [
    'claim.create', 'claim.revise', 'claim.transition',
    'evidence.create', 'evidence.link',
    'verification_receipt.submit',
    'challenge.create', 'challenge.transition',
  ]) assert.match(migration, new RegExp(`'${kind.replace('.', '\\.')}'`));
  assert.match(migration, /\[RESEARCH_GRAPH_DUAL_WRITE_KIND_INVALID\]/);
  assert.doesNotMatch(migration, /\bEXECUTE\s+(?:format|p_)/i);
  assert.doesNotMatch(migration, /p_(?:table|column|sql|edge_plan|node_plan)/i);
});

test('binds complete verified events, signed Claim projections, revision races, and exact motifs', () => {
  assert.match(migration, /research_events_event_type_namespaced.*\[a-z0-9_\]/s);
  assert.match(migration, /jsonb_typeof\(p_event->'signature'\) <> 'object'/);
  assert.match(migration, /v_persisted\.payload IS DISTINCT FROM p_event->'payload'/);
  assert.match(migration, /event parents must be unique/);
  assert.match(migration, /INSERT INTO public\.research_event_parents \(event_id,parent_event_id\)/);
  assert.match(migration, /parent must be an existing distinct UUIDv7 event/);
  assert.match(migration, /research_graph_events_semantically_equal\(p_expected_legacy->'event',v_event\)/);
  assert.match(migration, /payload'#>'\{projection,state,revision\}' IS DISTINCT FROM v_revision/);
  assert.match(migration, /payload'#>'\{projection,state,claim\}' IS DISTINCT FROM jsonb_build_object\(/);
  assert.match(migration, /v_claim->>'createdBy' IS DISTINCT FROM v_actor_id/);
  assert.match(migration, /\[RESEARCH_GRAPH_DUAL_WRITE_REVISION_RACE\]/);
  assert.match(migration, /v_is_replay := EXISTS \(\s*SELECT 1 FROM public\.claim_revisions/s);
  assert.match(migration, /v_is_replay := EXISTS \(\s*SELECT 1 FROM public\.challenge_revisions/s);
  assert.match(migration, /later\.revision>v_expected_revision/);
  assert.match(migration, /insert_research_graph_dual_write_evaluation/);
  assert.match(migration, /'evaluates'.*'evaluation_basis'/s);
  assert.match(migration, /'materializes_evidence'.*'artifact'.*'evidence'/s);
  assert.match(migration, /'verifies_claim'.*'verifies_run'.*'uses_verification_contract'/s);
  assert.match(migration, /'reports_finding'.*'verification_finding'/s);
  assert.match(migration, /'challenges'.*'challenge_revision'/s);
  assert.match(migration, /'supersedes'/);
});

test('writes allowlisted legacy rows, kernel rows, and immutable crosswalks in one function statement', () => {
  for (const table of [
    'public.claims', 'public.claim_revisions', 'public.evidence', 'public.evidence_claim_links',
    'public.verification_receipts', 'public.verification_findings', 'public.challenges',
    'public.challenge_revisions', 'public.research_events', 'private.research_nodes',
    'private.research_node_revisions', 'private.research_edges', 'private.legacy_node_records',
    'private.legacy_relation_records',
  ]) assert.match(migration, new RegExp(`INSERT INTO ${table.replace('.', '\\.')}`));
  assert.match(migration, /'legacy',p_expected_legacy,\s*'kernel',jsonb_build_object\('nodes',v_kernel_nodes,'edges',v_kernel_edges\),\s*'parity',true/s);
  assert.match(migration, /\[RESEARCH_GRAPH_DUAL_WRITE_PARITY_MISMATCH\]/);
  assert.match(migration, /\[RESEARCH_GRAPH_DUAL_WRITE_CROSSWALK_CONFLICT\]/);
});

test('keeps the wrapper service-only and browser roles mutation-free', () => {
  const defaultRevoke = kernelMigration.indexOf('ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC');
  const firstKernelHelper = kernelMigration.indexOf('CREATE OR REPLACE FUNCTION private.');
  assert.ok(defaultRevoke > 0 && defaultRevoke < firstKernelHelper);
  for (const helper of [
    'research_graph_dual_write_hash',
    'research_graph_events_semantically_equal',
    'persist_verified_research_event',
    'insert_research_graph_dual_write_edge',
    'insert_research_graph_dual_write_node_crosswalk',
    'insert_research_graph_dual_write_relation_crosswalk',
    'insert_research_graph_dual_write_node',
    'insert_research_graph_dual_write_evaluation',
    'assert_research_graph_dual_write_role',
    'execute_research_graph_legacy_dual_write',
  ]) assert.match(migration, new RegExp(`REVOKE ALL ON FUNCTION private\\.${helper}\\(`));
  assert.match(migration, /\[RESEARCH_GRAPH_DUAL_WRITE_SERVICE_ROLE_REQUIRED\]/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.execute_research_graph_legacy_dual_write\(text,jsonb,jsonb,jsonb\) FROM PUBLIC/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.execute_research_graph_legacy_dual_write\(text,jsonb,jsonb,jsonb\) FROM anon/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.execute_research_graph_legacy_dual_write\(text,jsonb,jsonb,jsonb\) FROM authenticated/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.execute_research_graph_legacy_dual_write\(text,jsonb,jsonb,jsonb\) TO service_role/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION private\.execute_research_graph_legacy_dual_write\(text,jsonb,jsonb,jsonb\) TO service_role/);
  assert.doesNotMatch(migration, /GRANT EXECUTE ON FUNCTION private\.persist_verified_research_event[^;]* TO service_role/);
  assert.doesNotMatch(migration, /GRANT EXECUTE ON FUNCTION private\.insert_research_graph_dual_write_(?:edge|node|evaluation)[^;]* TO service_role/);
  assert.doesNotMatch(migration, /GRANT EXECUTE ON FUNCTION public\.execute_research_graph_legacy_dual_write[^;]* TO (?:anon|authenticated)/);
  assert.doesNotMatch(migration, /GRANT EXECUTE ON FUNCTION [^;]* TO PUBLIC/);
});

test('keeps all dollar-quoted function bodies and migration statements balanced', () => {
  assert.equal(migration.split('$$').length - 1, 24);
  assert.equal(migration.split('$node_backfill_security$').length - 1, 2);
  assert.equal(migration.split('$research_graph_dual_write_grants$').length - 1, 2);
  assert.equal(migration.split('--> statement-breakpoint').filter((part) => part.trim()).length, 35);
});
