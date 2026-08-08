import { pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { actors } from './actors.mjs';
import { signingKeys } from './signing-keys.mjs';

export const signatureNonces = pgTable(
  'signature_nonces',
  {
    actorId: text('actor_id')
      .notNull()
      .references(() => actors.actorId, { onDelete: 'cascade' }),
    keyId: text('key_id')
      .notNull()
      .references(() => signingKeys.keyId, { onDelete: 'cascade' }),
    nonce: text('nonce').notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('signature_nonces_actor_key_nonce_unique').on(table.actorId, table.keyId, table.nonce),
  ],
);

/**
 * Atomically claim one verified signature nonce. A false return means another
 * request already claimed this actor/key/nonce tuple.
 */
export async function claimSignatureNonce({ db, actorId, keyId, nonce, consumedAt = new Date() } = {}) {
  if (!db || typeof db.insert !== 'function') {
    throw new TypeError('db.insert is required to claim a signature nonce');
  }

  const inserted = await db
    .insert(signatureNonces)
    .values({ actorId, keyId, nonce, consumedAt })
    .onConflictDoNothing({ target: [signatureNonces.actorId, signatureNonces.keyId, signatureNonces.nonce] })
    .returning({ nonce: signatureNonces.nonce });

  return inserted.length === 1;
}
