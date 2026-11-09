import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { actors } from './actors.mjs';
import { projects } from './projects.mjs';
import { researchEvents } from './research-events.mjs';
import { researchGraphSchema, researchNodeKind, researchNodeRevisions } from './research-graph.mjs';
import { signatureNonces } from './signature-nonces.mjs';
import { signingKeys } from './signing-keys.mjs';

/**
 * Immutable idempotency receipt for one Human-signed, Agent-produced typed
 * research revision. Direct access is intentionally denied by migration 0088;
 * service callers receive only the fixed RPC result.
 */
export const researchSubmissionReceipts = researchGraphSchema.table(
  'research_submission_receipts',
  {
    receiptId: uuid('receipt_id').primaryKey().defaultRandom(),
    agentActorId: text('agent_actor_id')
      .notNull()
      .references(() => actors.actorId, { onDelete: 'restrict' }),
    publisherActorId: text('publisher_actor_id')
      .notNull()
      .references(() => actors.actorId, { onDelete: 'restrict' }),
    keyId: text('key_id')
      .notNull()
      .references(() => signingKeys.keyId, { onDelete: 'restrict' }),
    nonce: text('nonce').notNull(),
    submissionHash: text('submission_hash').notNull(),
    canonicalPayloadHash: text('canonical_payload_hash').notNull(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.projectId, { onDelete: 'restrict' }),
    nodeKind: researchNodeKind('node_kind').notNull(),
    nodeId: text('node_id').notNull(),
    revision: integer('revision').notNull(),
    eventId: text('event_id')
      .notNull()
      .references(() => researchEvents.eventId, { onDelete: 'restrict' }),
    result: jsonb('result').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'research_submission_receipts_node_revision_fk',
      columns: [table.nodeKind, table.nodeId, table.revision],
      foreignColumns: [researchNodeRevisions.nodeKind, researchNodeRevisions.nodeId, researchNodeRevisions.revision],
    }).onDelete('restrict'),
    foreignKey({
      name: 'research_submission_receipts_consumed_nonce_fk',
      columns: [table.publisherActorId, table.keyId, table.nonce],
      foreignColumns: [signatureNonces.actorId, signatureNonces.keyId, signatureNonces.nonce],
    }).onDelete('restrict'),
    uniqueIndex('research_submission_receipts_agent_key_nonce_unique')
      .on(table.agentActorId, table.keyId, table.nonce),
    uniqueIndex('research_submission_receipts_event_unique').on(table.eventId),
    uniqueIndex('research_submission_receipts_revision_unique')
      .on(table.nodeKind, table.nodeId, table.revision),
    index('research_submission_receipts_project_created_idx').on(table.projectId, table.createdAt),
    check('research_submission_receipts_nonce_shape', sql`${table.nonce} ~ '^[A-Za-z0-9_-]{16,128}$'`),
    check('research_submission_receipts_submission_hash_shape', sql`${table.submissionHash} ~ '^sha256:[0-9a-f]{64}$'`),
    check('research_submission_receipts_payload_hash_shape', sql`${table.canonicalPayloadHash} ~ '^sha256:[0-9a-f]{64}$'`),
    check('research_submission_receipts_revision_positive', sql`${table.revision} > 0`),
  ],
);
