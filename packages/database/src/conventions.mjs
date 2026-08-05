import { timestamp } from 'drizzle-orm/pg-core';

/**
 * Lifecycle columns shared by mutable database projections.
 *
 * `deleted_at` is nullable and represents a soft delete. Consumers must
 * exclude rows where it is non-null unless they are explicitly querying the
 * historical/deleted view.
 */
export function createLifecycleColumns() {
  return {
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  };
}
