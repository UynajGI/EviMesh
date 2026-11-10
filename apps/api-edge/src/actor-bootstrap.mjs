/**
 * Authoritative Human Actor bootstrap (0089 `actor_self_bootstrap`).
 *
 * After 0089, browser roles can no longer insert `actors` or `identities`.
 * The Worker verifies the caller's session against Supabase Auth
 * (`/auth/v1/user`), normalizes that server-side record into the exact claim
 * shape the RPC accepts, and calls the RPC with the service credential.
 * Nothing in the request body can influence the subject, email, or linked
 * identities.
 */

export const AUTH_BOOTSTRAP_CLAIMS_SCHEMA = 'evimesh.auth-bootstrap-claims.v1';
export const AUTH_BOOTSTRAP_RESULT_SCHEMA = 'evimesh.actor-bootstrap-result.v1';

const LINKABLE_PROVIDERS = new Map([
  ['github', 'github'],
  ['google', 'google'],
  ['custom:orcid', 'custom:orcid'],
  ['orcid', 'custom:orcid'],
]);

const UUID_V4ISH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const STATUS_BY_CODE = Object.freeze({
  ACTOR_BOOTSTRAP_EMAIL_NOT_VERIFIED: 403,
  ACTOR_BOOTSTRAP_SERVICE_ROLE_REQUIRED: 503,
  ACTOR_BOOTSTRAP_CLAIMS_INVALID: 400,
  ACTOR_BOOTSTRAP_IDENTITY_INVALID: 400,
  ACTOR_BOOTSTRAP_ORCID_INVALID: 400,
  ACTOR_BOOTSTRAP_IDENTITY_CONFLICT: 409,
  ACTOR_BOOTSTRAP_BINDING_CONFLICT: 409,
});

export class ActorBootstrapError extends Error {
  constructor(message, code = 'ACTOR_BOOTSTRAP_UNAVAILABLE', status = 503) {
    super(message);
    this.name = 'ActorBootstrapError';
    this.code = code;
    this.status = status;
  }
}

function text(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** Linked identity subject: ORCID uses the iD, everything else the provider's stable id. */
function identitySubject(provider, identity) {
  const data = identity?.identity_data ?? {};
  if (provider === 'custom:orcid') {
    const candidate = text(data.orcid) ?? text(data.sub) ?? text(identity?.id);
    if (!candidate) return null;
    const match = /(\d{4}-\d{4}-\d{4}-\d{3}[\dX])$/i.exec(candidate);
    return match ? match[1].toUpperCase() : null;
  }
  return text(identity?.id) ?? text(data.sub) ?? text(data.provider_id);
}

/**
 * Normalize a Supabase Auth admin/user record. Only OAuth identities that
 * Supabase actually linked are included; email-only identities are carried by
 * the confirmed email instead.
 */
export function authoritativeClaimsFromAuthUser(user) {
  if (!user || typeof user !== 'object') {
    throw new ActorBootstrapError('authenticated user record is unavailable', 'ACTOR_BOOTSTRAP_AUTH_UNAVAILABLE', 503);
  }
  const authSubject = text(user.id);
  if (!authSubject || !UUID_V4ISH.test(authSubject)) {
    throw new ActorBootstrapError('authenticated subject is invalid', 'ACTOR_BOOTSTRAP_CLAIMS_INVALID', 400);
  }
  const email = text(user.email)?.toLowerCase() ?? null;
  const emailConfirmedAt = text(user.email_confirmed_at) ?? text(user.confirmed_at);
  if (!email || !emailConfirmedAt) {
    throw new ActorBootstrapError('confirm your email address before finishing account setup', 'ACTOR_BOOTSTRAP_EMAIL_NOT_VERIFIED', 403);
  }

  const seen = new Set();
  const identities = [];
  for (const identity of Array.isArray(user.identities) ? user.identities : []) {
    const provider = LINKABLE_PROVIDERS.get(text(identity?.provider) ?? '');
    if (!provider) continue;
    const subject = identitySubject(provider, identity);
    const verifiedAt = text(identity?.created_at) ?? text(identity?.last_sign_in_at);
    if (!subject || !verifiedAt) continue;
    const key = `${provider}\u0000${subject}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const identityEmail = text(identity?.identity_data?.email) ?? text(identity?.email);
    identities.push({
      provider,
      subject,
      ...(identityEmail && identityEmail.length <= 320 ? { email: identityEmail } : {}),
      verifiedAt,
    });
  }

  return Object.freeze({
    schema: AUTH_BOOTSTRAP_CLAIMS_SCHEMA,
    source: 'supabase_auth_admin',
    authSubject,
    email,
    emailConfirmedAt,
    identities,
  });
}

function serviceHeaders(serviceRoleKey, extra = {}) {
  const headers = { accept: 'application/json', apikey: serviceRoleKey, ...extra };
  if (!serviceRoleKey.startsWith('sb_secret_')) headers.authorization = `Bearer ${serviceRoleKey}`;
  return headers;
}

function rpcFailure(payload) {
  const message = typeof payload?.message === 'string' ? payload.message : '';
  const tagged = /^\[([A-Z0-9_]+)\]\s*(.*)$/.exec(message);
  const code = tagged?.[1] ?? 'ACTOR_BOOTSTRAP_FAILED';
  const status = STATUS_BY_CODE[code] ?? 503;
  return new ActorBootstrapError(tagged?.[2] || 'account setup is temporarily unavailable', code, status);
}

/** Supabase adapter: verify the session, then call the service-only RPC. */
export function createSupabaseActorBootstrap({ url, publishableKey, serviceRoleKey, fetchImpl = fetch } = {}) {
  const baseUrl = text(url)?.replace(/\/$/, '') ?? null;
  const secret = text(serviceRoleKey);
  const publicKey = text(publishableKey);
  if (!baseUrl || !secret || !publicKey) return null;

  async function authUser(accessToken) {
    let response;
    try {
      response = await fetchImpl(`${baseUrl}/auth/v1/user`, {
        headers: { accept: 'application/json', apikey: publicKey, authorization: `Bearer ${accessToken}` },
      });
    } catch {
      throw new ActorBootstrapError('authenticated user verification is unavailable', 'ACTOR_BOOTSTRAP_AUTH_UNAVAILABLE', 503);
    }
    if (response.status === 401 || response.status === 403) {
      throw new ActorBootstrapError('your session has expired', 'ACTOR_BOOTSTRAP_SESSION_INVALID', 401);
    }
    if (!response.ok) {
      throw new ActorBootstrapError('authenticated user verification failed', 'ACTOR_BOOTSTRAP_AUTH_UNAVAILABLE', 503);
    }
    return response.json().catch(() => null);
  }

  return Object.freeze({
    async bootstrap({ accessToken, claims } = {}) {
      const token = text(accessToken);
      if (!token) throw new ActorBootstrapError('authentication required', 'ACTOR_BOOTSTRAP_SESSION_INVALID', 401);
      const user = await authUser(token);
      if (text(claims?.sub) && text(user?.id) !== text(claims.sub)) {
        throw new ActorBootstrapError('session subject does not match the authenticated user', 'ACTOR_BOOTSTRAP_SESSION_INVALID', 401);
      }
      const authoritativeClaims = authoritativeClaimsFromAuthUser(user);
      let response;
      try {
        response = await fetchImpl(`${baseUrl}/rest/v1/rpc/actor_self_bootstrap`, {
          method: 'POST',
          headers: serviceHeaders(secret, { 'content-type': 'application/json' }),
          body: JSON.stringify({ p_authoritative_claims: authoritativeClaims }),
        });
      } catch {
        throw new ActorBootstrapError('account setup is temporarily unavailable');
      }
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw rpcFailure(payload);
      if (payload?.schema !== AUTH_BOOTSTRAP_RESULT_SCHEMA || !text(payload.actorId)) {
        throw new ActorBootstrapError('account setup returned an invalid response', 'ACTOR_BOOTSTRAP_INVALID_RESPONSE', 502);
      }
      return payload;
    },
  });
}
