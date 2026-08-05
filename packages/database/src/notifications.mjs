import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { actors } from './actors.mjs';
import { researchEvents } from './research-events.mjs';

export const notifications = pgTable(
  'notifications',
  {
    notificationId: text('notification_id').primaryKey(),
    recipientActorId: text('recipient_actor_id').notNull(),
    eventId: text('event_id').notNull(),
    notificationType: text('notification_type').notNull(),
    payload: jsonb('payload').notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('notifications_recipient_event_type_unique').on(
      table.recipientActorId,
      table.eventId,
      table.notificationType,
    ),
    index('notifications_inbox_idx').on(table.recipientActorId, table.readAt, table.createdAt),
    foreignKey({
      name: 'notifications_recipient_actor_fk',
      columns: [table.recipientActorId],
      foreignColumns: [actors.actorId],
    }).onDelete('restrict'),
    foreignKey({
      name: 'notifications_event_fk',
      columns: [table.eventId],
      foreignColumns: [researchEvents.eventId],
    }).onDelete('restrict'),
    check('notifications_type_namespaced', sql`${table.notificationType} ~ '^[a-z][a-z0-9]*(\\.[a-z][a-z0-9]*)+$'`),
  ],
);
