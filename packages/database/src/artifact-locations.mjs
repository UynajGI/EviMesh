import { sql } from 'drizzle-orm';
import { check, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { actors } from './actors.mjs';
import { artifacts } from './artifacts.mjs';

export const artifactLocations = pgTable(
  'artifact_locations',
  {
    locationId: text('location_id').primaryKey(),
    artifactId: text('artifact_id').notNull().references(() => artifacts.artifactId, { onDelete: 'restrict' }),
    locationType: text('location_type').notNull(),
    uri: text('uri').notNull(),
    createdBy: text('created_by').notNull().references(() => actors.actorId, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('artifact_locations_artifact_uri_unique').on(table.artifactId, table.uri),
    check('artifact_locations_uri_format', sql`${table.uri} ~ '^[a-z][a-z0-9+.-]*://[^\\s]+$'`),
  ],
);
