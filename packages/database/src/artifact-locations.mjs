import { sql } from 'drizzle-orm';
import { bigint, check, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { actors } from './actors.mjs';
import { artifacts } from './artifacts.mjs';

export const artifactLocations = pgTable(
  'artifact_locations',
  {
    locationId: text('location_id').primaryKey(),
    artifactId: text('artifact_id').notNull().references(() => artifacts.artifactId, { onDelete: 'restrict' }),
    locationType: text('location_type').notNull(),
    uri: text('uri').notNull(),
    rawHash: text('raw_hash'),
    sizeBytes: bigint('size_bytes', { mode: 'number' }),
    license: text('license'),
    createdBy: text('created_by').notNull().references(() => actors.actorId, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('artifact_locations_artifact_uri_unique').on(table.artifactId, table.uri),
    check('artifact_locations_uri_format', sql`${table.uri} ~ '^[a-z][a-z0-9+.-]*://[^\\s]+$'`),
    check('artifact_locations_external_metadata', sql`${table.locationType} <> 'external' OR (${table.rawHash} ~ '^sha256:[0-9a-f]{64}$' AND ${table.sizeBytes} >= 0 AND length(trim(${table.license})) > 0)`),
  ],
);
