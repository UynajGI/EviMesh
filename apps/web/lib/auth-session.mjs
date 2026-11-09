export const AUTH_SEEN_STORAGE_KEY = 'evimesh.auth.seen';

export function hasSeenAuthenticatedSession(storage) {
  try {
    return storage?.getItem?.(AUTH_SEEN_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markAuthenticatedSession(storage) {
  try {
    storage?.setItem?.(AUTH_SEEN_STORAGE_KEY, '1');
  } catch {
    // Session hints are presentational only; unavailable storage must not
    // prevent Supabase from maintaining the real session.
  }
}

export function clearAuthenticatedSessionMarker(storage) {
  try {
    storage?.removeItem?.(AUTH_SEEN_STORAGE_KEY);
  } catch {
    // Best effort for browsers where storage is disabled.
  }
}

/**
 * A missing initial session is anonymous on a fresh browser, but an ended
 * session after a prior sign-in gets a distinct recovery state.
 */
export function missingSessionStatus(storage) {
  return hasSeenAuthenticatedSession(storage) ? 'expired' : 'anonymous';
}

/** Only same-origin application paths may be used after an auth callback. */
export function safeCallbackPath(value, fallback = '/') {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
  try {
    const base = new URL('https://evimesh.invalid');
    const resolved = new URL(value, base);
    if (resolved.origin !== base.origin) return fallback;
    if (resolved.pathname === '/auth/callback' || resolved.pathname.startsWith('/auth/callback/')) return fallback;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}

export function callbackErrorMessage(locationLike) {
  const search = new URLSearchParams(locationLike?.search ?? '');
  const hash = new URLSearchParams(String(locationLike?.hash ?? '').replace(/^#/, ''));
  return search.get('error_description')
    ?? hash.get('error_description')
    ?? search.get('error')
    ?? hash.get('error')
    ?? null;
}

function bootstrapError(message, { code = null, status = null, requestId = null } = {}) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.requestId = requestId;
  return error;
}

/**
 * Complete the authenticated identity bootstrap through the public API.
 * POST /actors/self is deliberately idempotent: both created=true and
 * created=false are successful callback outcomes.
 */
export async function bootstrapActorForSession(session, {
  apiUrl = process.env.NEXT_PUBLIC_EVIMESH_API_URL,
  fetchImpl = fetch,
} = {}) {
  const accessToken = session?.access_token;
  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    throw bootstrapError('The authenticated session did not include an access token.', {
      code: 'ACTOR_BOOTSTRAP_SESSION_INVALID',
      status: 401,
    });
  }
  if (typeof apiUrl !== 'string' || apiUrl.trim().length === 0) {
    throw bootstrapError('The EviMesh API is not configured for account setup.', {
      code: 'ACTOR_BOOTSTRAP_API_UNAVAILABLE',
      status: 503,
    });
  }

  const response = await fetchImpl(`${apiUrl.replace(/\/$/, '')}/actors/self`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw bootstrapError(payload.message ?? 'EviMesh could not finish setting up this account.', {
      code: payload.code ?? 'ACTOR_BOOTSTRAP_FAILED',
      status: response.status,
      requestId: payload.request_id ?? payload.requestId ?? null,
    });
  }
  if (typeof payload?.actor?.actorId !== 'string' || payload.actor.actorId.length === 0) {
    throw bootstrapError('EviMesh returned an invalid account setup response.', {
      code: 'ACTOR_BOOTSTRAP_INVALID_RESPONSE',
      status: 502,
    });
  }
  return payload;
}
