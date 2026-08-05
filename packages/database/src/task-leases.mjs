import { pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import { actors } from './actors.mjs';
import { createLifecycleColumns } from './conventions.mjs';
import { tasks } from './tasks.mjs';

export const taskLeases = pgTable(
  'task_leases',
  {
    taskId: text('task_id').notNull().references(() => tasks.taskId, { onDelete: 'restrict' }),
    holderActorId: text('holder_actor_id').notNull().references(() => actors.actorId, { onDelete: 'restrict' }),
    acquiredAt: timestamp('acquired_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    lastRenewedAt: timestamp('last_renewed_at', { withTimezone: true }),
    ...createLifecycleColumns(),
  },
  (table) => [
    primaryKey({ name: 'task_leases_pkey', columns: [table.taskId, table.holderActorId] }),
  ],
);
