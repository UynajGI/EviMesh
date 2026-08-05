import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { actors } from './actors.mjs';
import { artifacts } from './artifacts.mjs';

export const artifactType = pgEnum('artifact_type', [
  'code',
  'dataset',
  'document',
  'figure',
  'proof',
  'notebook',
  'container',
  'model',
  'report',
  'other',
]);

export const artifactRevisions = pgTable(
  'artifact_revisions',
  {
    artifactId: text('artifact_id').notNull().references(() => artifacts.artifactId, { onDelete: 'restrict' }),
    revision: integer('revision').notNull(),
    supersedes: integer('supersedes'),
    artifactType: artifactType('artifact_type').notNull(),
    rawHash: text('raw_hash').notNull(),
    semanticHash: text('semantic_hash'),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    mediaType: text('media_type').notNull(),
    license: text('license').notNull(),
    description: text('description'),
    createdBy: text('created_by').notNull().references(() => actors.actorId, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: 'artifact_revisions_pkey', columns: [table.artifactId, table.revision] }),
    check('artifact_revisions_revision_positive', sql`${table.revision} > 0`),
    check(
      'artifact_revisions_supersedes_previous',
      sql`(${table.revision} = 1 AND ${table.supersedes} IS NULL) OR (${table.revision} > 1 AND ${table.supersedes} = ${table.revision} - 1)`,
    ),
    check('artifact_revisions_raw_hash_format', sql`${table.rawHash} ~ '^sha256:[0-9a-f]{64}$'`),
    check(
      'artifact_revisions_semantic_hash_format',
      sql`${table.semanticHash} IS NULL OR ${table.semanticHash} ~ '^sha256:[0-9a-f]{64}$'`,
    ),
    check('artifact_revisions_size_nonnegative', sql`${table.sizeBytes} >= 0`),
  ],
);
