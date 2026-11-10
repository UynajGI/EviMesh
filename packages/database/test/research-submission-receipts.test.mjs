import assert from 'node:assert/strict';
import test from 'node:test';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { researchSubmissionReceipts } from '../src/research-submission-receipts.mjs';

test('typed research receipts bind one Agent submission to its Human nonce and immutable revision', () => {
  const columns = getTableColumns(researchSubmissionReceipts);
  const config = getTableConfig(researchSubmissionReceipts);

  assert.equal(config.schema, 'private');
  assert.deepEqual(Object.keys(columns), [
    'receiptId',
    'agentActorId',
    'publisherActorId',
    'keyId',
    'nonce',
    'submissionHash',
    'canonicalPayloadHash',
    'projectId',
    'nodeKind',
    'nodeId',
    'revision',
    'eventId',
    'result',
    'createdAt',
  ]);
  assert.equal(columns.receiptId.primary, true);
  for (const column of Object.values(columns)) assert.equal(column.notNull, true);

  for (const name of [
    'research_submission_receipts_node_revision_fk',
    'research_submission_receipts_consumed_nonce_fk',
    'research_submission_receipts_agent_actor_id_actors_actor_id_fk',
    'research_submission_receipts_publisher_actor_id_actors_actor_id_fk',
    'research_submission_receipts_key_id_signing_keys_key_id_fk',
    'research_submission_receipts_project_id_projects_project_id_fk',
    'research_submission_receipts_event_id_research_events_event_id_fk',
  ]) {
    assert.ok(config.foreignKeys.some((constraint) => constraint.getName() === name), `missing ${name}`);
  }
  for (const name of [
    'research_submission_receipts_agent_key_nonce_unique',
    'research_submission_receipts_event_unique',
    'research_submission_receipts_revision_unique',
    'research_submission_receipts_project_created_idx',
  ]) {
    assert.ok(config.indexes.some((entry) => entry.config.name === name), `missing ${name}`);
  }
  for (const name of [
    'research_submission_receipts_nonce_shape',
    'research_submission_receipts_submission_hash_shape',
    'research_submission_receipts_payload_hash_shape',
    'research_submission_receipts_revision_positive',
  ]) {
    assert.ok(config.checks.some((constraint) => constraint.name === name), `missing ${name}`);
  }
});
