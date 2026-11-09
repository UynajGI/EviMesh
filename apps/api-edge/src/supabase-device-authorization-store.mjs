import { DeviceAuthError } from "./device-auth.mjs";

const DEFAULT_TTL_MS = 15 * 60 * 1000;

function requiredText(value, field) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${field} is required`);
  return value.trim();
}

function serviceHeaders(serviceRoleKey, extra = {}) {
  const headers = { ...extra, apikey: serviceRoleKey };
  // Current sb_secret_* keys are opaque gateway credentials, not JWTs.
  if (!serviceRoleKey.startsWith("sb_secret_")) headers.authorization = `Bearer ${serviceRoleKey}`;
  return headers;
}

function oneObject(payload) {
  const value = Array.isArray(payload) ? payload[0] ?? null : payload;
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function mappedError(message, fallbackStatus = 503) {
  const match = /^\[([A-Z0-9_]+)\]\s*(.*)$/.exec(message ?? "");
  let code = match?.[1] ?? "DEVICE_AUTH_STORAGE_FAILED";
  const detail = match?.[2] || "persistent device authorization request failed";
  if (code === "DEVICE_AUTH_PENDING") code = "AUTHORIZATION_PENDING";
  if (code === "DEVICE_AUTH_EXPIRED") code = "EXPIRED_TOKEN";
  if (code === "DEVICE_AUTH_DENIED" || code === "DEVICE_AUTH_CONSUMED") code = "ACCESS_DENIED";
  const status = code === "DEVICE_AUTH_NOT_FOUND" ? 404
    : code === "DEVICE_AUTH_AGENT_NOT_MANAGED" || code === "DEVICE_AUTH_APPROVER_INVALID" ? 403
      : code === "DEVICE_AUTH_ALREADY_USED" || code === "DEVICE_AUTH_CODE_COLLISION" ? 409
        : ["AUTHORIZATION_PENDING", "EXPIRED_TOKEN", "ACCESS_DENIED", "INVALID_SCOPE", "INVALID_REQUEST"].includes(code) ? 400
          : fallbackStatus;
  return new DeviceAuthError(detail, code, status);
}

function normalizeGrant(value) {
  const record = oneObject(value);
  if (!record) throw new DeviceAuthError("device authorization RPC returned an invalid result", "DEVICE_AUTH_STORAGE_FAILED", 503);
  return {
    ...record,
    clientId: record.clientId ?? record.client_id,
    requestedScopes: record.requestedScopes ?? record.requested_scopes ?? [],
    agentActorId: record.agentActorId ?? record.agent_actor_id ?? null,
    approvedByActorId: record.approvedByActorId ?? record.approved_by_actor_id ?? null,
    expiresAt: record.expiresAt ?? record.expires_at,
    tokenId: record.tokenId ?? record.token_id ?? record.issuedTokenId ?? record.issued_token_id ?? null,
  };
}

/** Service-role-only PostgREST adapter for private, transaction-backed grants. */
export function createSupabaseDeviceAuthorizationStore({
  url,
  serviceRoleKey,
  fetchImpl = fetch,
  ttlMs = DEFAULT_TTL_MS,
} = {}) {
  const baseUrl = requiredText(url, "Supabase URL").replace(/\/$/, "");
  const serviceKey = requiredText(serviceRoleKey, "Supabase service credential");
  if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation is required");
  if (!Number.isInteger(ttlMs) || ttlMs < 1000) throw new TypeError("device authorization TTL must be at least one second");

  async function rpc(name, body) {
    let response;
    try {
      response = await fetchImpl(`${baseUrl}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: serviceHeaders(serviceKey, { accept: "application/json", "content-type": "application/json" }),
        body: JSON.stringify(body),
      });
    } catch {
      throw new DeviceAuthError("persistent device authorization store is unreachable", "DEVICE_AUTH_UNAVAILABLE", 503);
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw mappedError(typeof payload?.message === "string" ? payload.message : "", response.status >= 500 ? 503 : 400);
    return normalizeGrant(payload);
  }

  async function listManagedAgents(actorId) {
    const endpoint = new URL(`${baseUrl}/rest/v1/actors`);
    endpoint.searchParams.set("select", "actor_id,actor_type,model_name,runtime,scope,public_key_fingerprint");
    endpoint.searchParams.set("owner_actor_id", `eq.${actorId}`);
    endpoint.searchParams.set("actor_type", "eq.agent");
    endpoint.searchParams.set("deleted_at", "is.null");
    endpoint.searchParams.set("order", "created_at.asc,actor_id.asc");
    let response;
    try {
      response = await fetchImpl(endpoint, { headers: serviceHeaders(serviceKey, { accept: "application/json" }) });
    } catch {
      throw new DeviceAuthError("managed Agent lookup is unreachable", "DEVICE_AUTH_UNAVAILABLE", 503);
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok || !Array.isArray(payload)) throw new DeviceAuthError("managed Agent lookup failed", "DEVICE_AUTH_UNAVAILABLE", 503);
    return payload.map((row) => Object.freeze({
      actorId: row.actor_id,
      actorType: row.actor_type,
      modelName: row.model_name ?? null,
      runtime: row.runtime ?? null,
      scope: row.scope ?? null,
      publicKeyFingerprint: row.public_key_fingerprint ?? null,
    }));
  }

  return Object.freeze({
    persistent: true,
    ttlMs,
    create: (record) => rpc("device_authorization_start", {
      p_device_code_digest: record.deviceCodeDigest,
      p_user_code_digest: record.userCodeDigest,
      p_client_id: record.clientId,
      p_requested_scopes: record.requestedScopes,
      p_created_at: record.createdAt,
      p_expires_at: record.expiresAt,
    }),
    preview: ({ userCodeDigest, at }) => rpc("device_authorization_preview", {
      p_user_code_digest: userCodeDigest,
      p_now: new Date(at).toISOString(),
    }),
    approve: ({ userCodeDigest, approvedByActorId, agentActorId, approvedAt }) => rpc("device_authorization_approve", {
      p_user_code_digest: userCodeDigest,
      p_approved_by_actor_id: approvedByActorId,
      p_agent_actor_id: agentActorId,
      p_approved_at: approvedAt,
    }),
    deny: ({ userCodeDigest, deniedByActorId, deniedAt }) => rpc("device_authorization_deny", {
      p_user_code_digest: userCodeDigest,
      p_denied_by_actor_id: deniedByActorId,
      p_denied_at: deniedAt,
    }),
    consume: ({ deviceCodeDigest, consumedAt, token }) => rpc("device_authorization_consume", {
      p_device_code_digest: deviceCodeDigest,
      p_consumed_at: consumedAt,
      p_token_id: token.tokenId,
      p_token_hash: token.tokenHash,
      p_token_prefix: token.tokenPrefix,
      p_token_label: token.label,
      p_token_expires_at: token.expiresAt,
    }),
    listManagedAgents,
  });
}
