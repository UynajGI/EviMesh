import { pgEnum, pgTable, text } from 'drizzle-orm/pg-core';
import { createLifecycleColumns } from './conventions.mjs';

export const actorType = pgEnum('actor_type', [
  'human',
  'agent',
  'organization',
  'service',
  'maintainer',
  'witness',
]);

export const identityStrength = pgEnum('identity_strength', [
  'verified',
  'observed',
  'self_declared',
  'unknown',
]);

export const actors = pgTable('actors', {
  actorId: text('actor_id').primaryKey(),
  actorType: actorType('actor_type').notNull(),
  identityStrength: identityStrength('identity_strength').notNull().default('unknown'),
  ...createLifecycleColumns(),
});
