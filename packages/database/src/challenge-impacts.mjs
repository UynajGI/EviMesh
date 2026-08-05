import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { challengeRevisions } from './challenge-revisions.mjs';
import { claimRevisions } from './claim-revisions.mjs';

export const challengeImpacts = pgTable(
  'challenge_impacts',
  {
    impactId: text('impact_id').primaryKey(),
    challengeId: text('challenge_id').notNull(),
    challengeRevision: integer('challenge_revision').notNull(),
    claimId: text('claim_id').notNull(),
    claimRevision: integer('claim_revision').notNull(),
    impactType: text('impact_type').notNull(),
    reason: text('reason').notNull(),
    details: jsonb('details').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'challenge_impacts_challenge_revision_fk',
      columns: [table.challengeId, table.challengeRevision],
      foreignColumns: [challengeRevisions.challengeId, challengeRevisions.revision],
    }).onDelete('restrict'),
    foreignKey({
      name: 'challenge_impacts_claim_revision_fk',
      columns: [table.claimId, table.claimRevision],
      foreignColumns: [claimRevisions.claimId, claimRevisions.revision],
    }).onDelete('restrict'),
    check('challenge_impacts_challenge_revision_positive', sql`${table.challengeRevision} > 0`),
    check('challenge_impacts_claim_revision_positive', sql`${table.claimRevision} > 0`),
  ],
);
