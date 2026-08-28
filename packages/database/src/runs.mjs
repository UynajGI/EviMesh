import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { actors } from './actors.mjs';
import { signingKeys } from './signing-keys.mjs';
import { tasks } from './tasks.mjs';

export const runs = pgTable(
  'runs',
  {
    runId: text('run_id').primaryKey(),
    taskId: text('task_id').notNull().references(() => tasks.taskId, { onDelete: 'restrict' }),
    contextBundleId: text('context_bundle_id').notNull(),
    sourceCode: text('source_code').notNull(),
    container: text('container').notNull(),
    command: text('command').notNull(),
    args: jsonb('args').notNull().default([]),
    environment: jsonb('environment').notNull(),
    hardware: jsonb('hardware').notNull(),
    randomSeed: jsonb('random_seed').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }).notNull(),
    networkAccess: boolean('network_access').notNull(),
    exitCode: integer('exit_code').notNull(),
    actorId: text('actor_id').notNull().references(() => actors.actorId, { onDelete: 'restrict' }),
    /* Nullable only for pre-0079 legacy rows whose historical key cannot be
     * inferred safely. Every new Run command requires and persists this ID. */
    signingKeyId: text('signing_key_id').references(() => signingKeys.keyId, { onDelete: 'restrict' }),
    signature: text('signature').notNull(),
  },
  (table) => [
    check('runs_time_ordered', sql`${table.endedAt} >= ${table.startedAt}`),
  ],
);
