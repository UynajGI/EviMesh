const SUPABASE_NONCE_TABLE = 'signature_nonces';

export class SupabaseNonceStoreError extends Error {
  constructor(message = 'signature replay protection is unavailable') {
    super(message);
    this.name = 'SupabaseNonceStoreError';
    this.code = 'CLIENT_SIGNATURE_UNAVAILABLE';
    this.status = 503;
  }
}

function requiredSecret(env) {
  const secret = env?.SUPABASE_SECRET_KEY ?? env?.SUPABASE_SERVICE_ROLE_KEY;
  return typeof secret === 'string' && secret.trim() ? secret.trim() : null;
}

function endpointFor(supabaseUrl) {
  if (typeof supabaseUrl !== 'string' || !supabaseUrl.trim()) {
    throw new SupabaseNonceStoreError();
  }
  let origin;
  try {
    origin = new URL(supabaseUrl.trim());
  } catch {
    throw new SupabaseNonceStoreError();
  }
  if (origin.protocol !== 'https:' && origin.protocol !== 'http:') {
    throw new SupabaseNonceStoreError();
  }
  origin.pathname = `${origin.pathname.replace(/\/$/, '')}/rest/v1/${SUPABASE_NONCE_TABLE}`;
  origin.search = 'on_conflict=actor_id%2Ckey_id%2Cnonce';
  return origin.toString();
}

/**
 * Creates a Worker-only adapter for the persistent nonce uniqueness barrier.
 * The server secret is deliberately read only from the Worker environment and
 * is never returned, logged, or included in thrown errors.
 */
export function createSupabaseNonceStore({ env, fetchImpl = globalThis.fetch, now = () => new Date().toISOString() } = {}) {
  const secret = requiredSecret(env);
  const endpoint = endpointFor(env?.SUPABASE_URL);
  if (!secret || typeof fetchImpl !== 'function') throw new SupabaseNonceStoreError();

  return Object.freeze({
    async claimSignatureNonce({ actorId, keyId, nonce } = {}) {
      let response;
      try {
        response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: {
            apikey: secret,
            authorization: `Bearer ${secret}`,
            'content-type': 'application/json',
            prefer: 'resolution=ignore-duplicates,return=representation',
          },
          body: JSON.stringify([{
            actor_id: actorId,
            key_id: keyId,
            nonce,
            consumed_at: now(),
          }]),
        });
      } catch {
        throw new SupabaseNonceStoreError();
      }
      if (!response?.ok) throw new SupabaseNonceStoreError();

      let rows;
      try {
        rows = await response.json();
      } catch {
        throw new SupabaseNonceStoreError();
      }
      if (!Array.isArray(rows)) throw new SupabaseNonceStoreError();
      if (rows.length === 0) return false;
      if (rows.length === 1) return true;
      throw new SupabaseNonceStoreError();
    },
  });
}
