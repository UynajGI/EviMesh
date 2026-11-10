import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(
  new URL('../drizzle/0088_atomic_typed_research_submit.sql', import.meta.url),
  'utf8',
);
const [previousSnapshot, currentSnapshot, journal] = await Promise.all([
  readFile(new URL('../drizzle/meta/0087_snapshot.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../drizzle/meta/0088_snapshot.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8').then(JSON.parse),
]);

test('0088 snapshot contains only the receipt table delta and links the migration journal', () => {
  assert.equal(currentSnapshot.prevId, previousSnapshot.id);
  const previousTables = Object.keys(previousSnapshot.tables);
  assert.deepEqual(
    Object.keys(currentSnapshot.tables).filter((name) => !previousTables.includes(name)),
    ['private.research_submission_receipts'],
  );
  for (const table of previousTables) {
    assert.deepEqual(currentSnapshot.tables[table], previousSnapshot.tables[table], `unexpected drift in ${table}`);
  }
  const withoutIdentityAndTables = ({ id, prevId, tables, ...snapshot }) => snapshot;
  assert.deepEqual(
    withoutIdentityAndTables(currentSnapshot),
    withoutIdentityAndTables(previousSnapshot),
  );
  // Later migrations may follow; 0088 must stay journaled at its own index.
  const entry = journal.entries.find((candidate) => candidate.idx === 88);
  assert.equal(entry?.tag, '0088_atomic_typed_research_submit');
});

test('installs one append-only private receipt and one service-only public RPC', () => {
  assert.match(migration, /CREATE TABLE "private"\."research_submission_receipts"/);
  assert.match(migration, /UNIQUE INDEX "research_submission_receipts_agent_key_nonce_unique"/);
  assert.match(migration, /FOREIGN KEY \("publisher_actor_id","key_id","nonce"\) REFERENCES "public"\."signature_nonces"/);
  assert.match(migration, /research_submission_receipts_append_only_trigger/);
  assert.match(migration, /ALTER TABLE private\.research_submission_receipts ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION private\.execute_typed_research_submit\(\s*p_agent_actor_id text,\s*p_signature_envelope jsonb,\s*p_platform_event jsonb\s*\)[\s\S]*?SECURITY DEFINER\s*SET search_path = ''/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.execute_typed_research_submit\(\s*p_agent_actor_id text,\s*p_signature_envelope jsonb,\s*p_platform_event jsonb\s*\)[\s\S]*?SECURITY INVOKER\s*SET search_path = ''/);
  assert.match(migration, /current_user <> 'service_role'/);
  assert.match(migration, /RETURN private\.execute_typed_research_submit\(p_agent_actor_id,p_signature_envelope,p_platform_event\)/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION private\.execute_typed_research_submit\(text,jsonb,jsonb\) TO service_role/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.execute_typed_research_submit\(text,jsonb,jsonb\) TO service_role/);
  for (const role of ['PUBLIC', 'anon', 'authenticated']) {
    assert.match(migration, new RegExp(`REVOKE ALL ON FUNCTION private\\.execute_typed_research_submit\\(text,jsonb,jsonb\\) FROM ${role}`));
    assert.match(migration, new RegExp(`REVOKE ALL ON FUNCTION public\\.execute_typed_research_submit\\(text,jsonb,jsonb\\) FROM ${role}`));
  }
  assert.doesNotMatch(migration, /GRANT EXECUTE ON FUNCTION public\.execute_typed_research_submit[^;]* TO (?:anon|authenticated|PUBLIC)/);
  assert.doesNotMatch(migration, /GRANT [^;]*(?:SELECT|INSERT|UPDATE|DELETE)[^;]*research_submission_receipts[^;]* TO (?:anon|authenticated|service_role|PUBLIC)/i);
});

test('derives all five exact motifs, including revision lineage, instead of accepting an arbitrary edge plan', () => {
  for (const [kind, relation] of [
    ['answer', 'answers'],
    ['rebuttal', 'rebuts'],
    ['evaluation', 'evaluates'],
    ['dataset', 'materializes_dataset'],
    ['tool', 'packages_tool'],
  ]) {
    assert.match(migration, new RegExp(`'${kind}'`));
    assert.match(migration, new RegExp(`'${relation}'`));
  }
  for (const relation of ['derived_from', 'grounds_rebuttal', 'evaluation_basis', 'supersedes']) {
    assert.match(migration, new RegExp(`'${relation}'`));
  }
  assert.match(migration, /derive_typed_research_incoming_edges\(v_payload\)/);
  assert.match(migration, /p_payload->'incomingEdges' IS DISTINCT FROM v_edges/);
  assert.match(migration, /\[TYPED_RESEARCH_EDGE_SET_MISMATCH\]/);
  assert.doesNotMatch(migration, /p_(?:edge_plan|node_plan|table|column|sql)/i);
  assert.doesNotMatch(migration, /\bEXECUTE\s+(?:format|p_)/i);
});

test('locks and revalidates Agent attribution, owner, role, exact active key, graph version, and rank-free event', () => {
  assert.match(migration, /FROM public\.actors[\s\S]*?WHERE actor_id=p_agent_actor_id[\s\S]*?FOR SHARE/);
  assert.match(migration, /v_agent\.actor_type IS DISTINCT FROM 'agent'::public\.actor_type/);
  assert.match(migration, /v_agent\.owner_actor_id IS DISTINCT FROM v_publisher_actor_id/);
  assert.match(migration, /v_publisher\.actor_type IS DISTINCT FROM 'human'::public\.actor_type/);
  assert.match(migration, /FROM public\.signing_keys[\s\S]*?WHERE key_id=v_key_id[\s\S]*?FOR SHARE/);
  assert.match(migration, /v_key\.actor_id IS DISTINCT FROM v_publisher_actor_id/);
  assert.match(migration, /v_key\.algorithm IS DISTINCT FROM 'Ed25519'/);
  assert.match(migration, /v_key\.revoked_at IS NOT NULL OR v_key\.deleted_at IS NOT NULL/);
  assert.match(migration, /status='active' AND deleted_at IS NULL[\s\S]*?FOR SHARE/);
  assert.match(migration, /v_role NOT IN \('owner','maintainer','contributor'\)/);
  assert.match(migration, /'research-graph\.v1'/);
  assert.match(migration, /v_event_payload \?\| ARRAY\['commit_rank','batch_rank'\]/);
  assert.match(migration, /v_event_payload->'publisher_signature_envelope' IS DISTINCT FROM p_signature_envelope/);
  assert.match(migration, /v_event_payload->'typed_document' IS DISTINCT FROM v_node/);
  assert.match(migration, /v_event_payload->'incoming_edges' IS DISTINCT FROM v_expected_edges/);
});

test('keeps nonce, event, revision, subtype, bases, crosswalk, edges, and receipt in one rollback-safe function', () => {
  for (const table of [
    'public.signature_nonces', 'private.research_nodes',
    'private.research_node_revisions', 'private.answer_revisions', 'private.rebuttal_revisions',
    'private.evaluation_revisions', 'private.evaluation_bases', 'private.dataset_revisions',
    'private.tool_revisions', 'private.research_edges', 'private.legacy_node_records',
    'private.research_submission_receipts',
  ]) assert.match(migration, new RegExp(`INSERT INTO ${table.replace('.', '\\.')}`));
  assert.match(migration, /v_event_id := private\.persist_verified_research_event\(p_platform_event,v_expected_event_type,p_agent_actor_id\)/);
  assert.match(
    migration,
    /v_event_id := private\.persist_verified_research_event[\s\S]*?INSERT INTO public\.signature_nonces[\s\S]*?\[TYPED_RESEARCH_SIGNATURE_REPLAYED\]/,
  );
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /v_existing_receipt\.submission_hash IS DISTINCT FROM v_submission_hash/);
  assert.match(migration, /RETURN v_existing_receipt\.result/);
  assert.match(migration, /ON CONFLICT DO NOTHING;[\s\S]*?GET DIAGNOSTICS v_inserted = ROW_COUNT;[\s\S]*?\[TYPED_RESEARCH_SIGNATURE_REPLAYED\]/);
  assert.match(migration, /created_by,created_at[\s\S]*?p_agent_actor_id,v_created_at/);
  assert.match(migration, /v_commit_rank := nextval\('private\.research_commit_rank_seq'\)/);
  assert.doesNotMatch(migration, /digest\s*\([^)]*::text/i);
  assert.doesNotMatch(migration, /research_graph_dual_write_hash/);
});
