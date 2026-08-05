import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { actors } from './actors.mjs';
import { challenges } from './challenges.mjs';
import { claimRevisions } from './claim-revisions.mjs';

export const challengeState = pgEnum('challenge_state', [
  'open',
  'admissible',
  'investigating',
  'upheld',
  'rejected',
  'resolved',
]);

export const challengeRevisions = pgTable(
  'challenge_revisions',
  {
    challengeId: text('challenge_id').notNull(),
    revision: integer('revision').notNull(),
    state: challengeState('state').notNull(),
    targetClaimId: text('target_claim_id').notNull(),
    targetClaimRevision: integer('target_claim_revision').notNull(),
    reason: text('reason').notNull(),
    impact: jsonb('impact').notNull(),
    proposedResolution: text('proposed_resolution'),
    createdBy: text('created_by').notNull().references(() => actors.actorId, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: 'challenge_revisions_pkey', columns: [table.challengeId, table.revision] }),
    foreignKey({
      name: 'challenge_revisions_challenge_fk',
      columns: [table.challengeId],
      foreignColumns: [challenges.challengeId],
    }).onDelete('restrict'),
    foreignKey({
      name: 'challenge_revisions_target_claim_revision_fk',
      columns: [table.targetClaimId, table.targetClaimRevision],
      foreignColumns: [claimRevisions.claimId, claimRevisions.revision],
    }).onDelete('restrict'),
    check('challenge_revisions_revision_positive', sql`${table.revision} > 0`),
    check('challenge_revisions_target_revision_positive', sql`${table.targetClaimRevision} > 0`),
  ],
);
