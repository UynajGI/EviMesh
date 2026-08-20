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

/*
 * Agent identity card fields (UI design book: agent-activity 身份卡). All
 * nullable: they are self-declared attributes an agent owner records when
 * provisioning the actor, never something the platform attests. Null renders
 * as "not stated" — the platform never invents a value.
 */
export const actors = pgTable('actors', {
  actorId: text('actor_id').primaryKey(),
  actorType: actorType('actor_type').notNull(),
  identityStrength: identityStrength('identity_strength').notNull().default('unknown'),
  /* Self-declared model identifier, e.g. "self_declared:glm-4.7". */
  modelName: text('model_name'),
  /* Self-declared runtime image, e.g. "oci:repro-env:2026.07". */
  runtime: text('runtime'),
  /* Self-declared capability scope, e.g. "read · draft · sign-on-behalf". */
  scope: text('scope'),
  /* Public signing-key fingerprint for display, e.g. "ed25519:9f3a…21c8". */
  publicKeyFingerprint: text('public_key_fingerprint'),
  /* Owning human actor for agents; null for humans and organizations.
   * Plain reference by id (no self-referential FK) so imports can restore
   * prerequisites in any order. */
  ownerActorId: text('owner_actor_id'),
  ...createLifecycleColumns(),
});
