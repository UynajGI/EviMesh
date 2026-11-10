const DEVICE_CODE_BYTES = 32;
const TOKEN_BYTES = 32;
const USER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const USER_CODE_LENGTH = 8;
const DEFAULT_TTL_MS = 15 * 60 * 1000;
const DEFAULT_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const TOKEN_PREFIX = "evimesh_";
const TOKEN_DISPLAY_PREFIX_LENGTH = 16;

export const DEVICE_AUTH_SCOPES = Object.freeze([
  "profile:read",
  "project:read",
  "research:prepare",
  "research:submit",
  "artifact:upload",
]);

// Kept as a compatibility export for callers that used the earlier name.
export const CLI_DEVICE_SCOPES = DEVICE_AUTH_SCOPES;

export class DeviceAuthError extends Error {
  constructor(message, code = "DEVICE_AUTH_INVALID", status = 400) {
    super(message);
    this.name = "DeviceAuthError";
    this.code = code;
    this.status = status;
  }
}

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new DeviceAuthError(`${field} is required`, "INVALID_REQUEST");
  }
  return value.trim();
}

function randomBase64Url(bytes) {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return Buffer.from(buffer).toString("base64url");
}

function randomUserCode() {
  const buffer = new Uint8Array(USER_CODE_LENGTH);
  crypto.getRandomValues(buffer);
  const characters = Array.from(buffer, (byte) => USER_CODE_ALPHABET[byte % USER_CODE_ALPHABET.length]);
  const code = characters.join("");
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

async function digest(value) {
  const bytes = new TextEncoder().encode(value);
  const result = await crypto.subtle.digest("SHA-256", bytes);
  return Buffer.from(result).toString("base64url");
}

function isoTime(value, field) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new DeviceAuthError(`${field} must be a valid date`, "INVALID_REQUEST");
  return date.toISOString();
}

function normalizedUserCode(value) {
  const userCode = requiredText(value, "user_code").toUpperCase();
  if (!/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(userCode)) throw new DeviceAuthError("user_code format is invalid", "INVALID_REQUEST");
  return userCode;
}

export function normalizeDeviceScopes(value = undefined) {
  const requested = value === undefined || value === null || value === ""
    ? [...DEVICE_AUTH_SCOPES]
    : typeof value === "string"
      ? value.split(/\s+/).filter(Boolean)
      : Array.isArray(value) ? value : null;
  if (!requested || requested.length === 0 || requested.some((scope) => typeof scope !== "string" || !scope.trim())) {
    throw new DeviceAuthError("scope must contain one or more registered scopes", "INVALID_SCOPE");
  }
  const unique = new Set(requested.map((scope) => scope.trim()));
  const unsupported = [...unique].find((scope) => !DEVICE_AUTH_SCOPES.includes(scope));
  if (unsupported) throw new DeviceAuthError(`unsupported scope: ${unsupported}`, "INVALID_SCOPE");
  return DEVICE_AUTH_SCOPES.filter((scope) => unique.has(scope));
}

function publicGrant(record) {
  if (!record || typeof record !== "object") return null;
  return Object.freeze({
    status: record.status,
    client_id: record.clientId,
    requested_scopes: [...(record.requestedScopes ?? [])],
    expires_at: isoTime(record.expiresAt, "grant expiry"),
  });
}

/**
 * Explicit development/test fallback. It mirrors the production adapter by
 * retaining only SHA-256 digests for device and user codes and by consuming a
 * grant and persisting its token hash in one synchronous state transition.
 */
export function createMemoryDeviceCodeStore({
  ttlMs = DEFAULT_TTL_MS,
  now = () => Date.now(),
  managedAgents = new Map(),
} = {}) {
  if (!Number.isInteger(ttlMs) || ttlMs < 1000) throw new DeviceAuthError("device code ttl must be at least one second");
  const byDeviceDigest = new Map();
  const byUserDigest = new Map();
  const issuedTokens = [];

  function getByUserDigest(userCodeDigest) {
    const deviceCodeDigest = byUserDigest.get(userCodeDigest);
    return deviceCodeDigest ? byDeviceDigest.get(deviceCodeDigest) ?? null : null;
  }

  function assertCurrent(record, timestamp) {
    if (!record) throw new DeviceAuthError("device authorization was not found", "DEVICE_AUTH_NOT_FOUND", 404);
    if (Date.parse(record.expiresAt) <= timestamp) throw new DeviceAuthError("device authorization expired", "EXPIRED_TOKEN");
  }

  return Object.freeze({
    persistent: false,
    ttlMs,
    issuedTokens,
    async create(record) {
      if (byDeviceDigest.has(record.deviceCodeDigest) || byUserDigest.has(record.userCodeDigest)) {
        throw new DeviceAuthError("device authorization code collision", "DEVICE_AUTH_CODE_COLLISION", 409);
      }
      const stored = { ...record, status: "pending", agentActorId: null, approvedByActorId: null };
      byDeviceDigest.set(stored.deviceCodeDigest, stored);
      byUserDigest.set(stored.userCodeDigest, stored.deviceCodeDigest);
      return { ...stored };
    },
    async preview({ userCodeDigest, at = now() }) {
      const record = getByUserDigest(userCodeDigest);
      assertCurrent(record, at);
      if (record.status !== "pending") throw new DeviceAuthError("device authorization is no longer pending", "DEVICE_AUTH_ALREADY_USED", 409);
      return { ...record };
    },
    async approve({ userCodeDigest, approvedByActorId, agentActorId, approvedAt }) {
      const record = getByUserDigest(userCodeDigest);
      assertCurrent(record, Date.parse(approvedAt));
      if (record.status !== "pending") throw new DeviceAuthError("device authorization is no longer pending", "DEVICE_AUTH_ALREADY_USED", 409);
      const configuredAgents = managedAgents.get(approvedByActorId);
      if (configuredAgents && !configuredAgents.some((actor) => actor.actorId === agentActorId)) {
        throw new DeviceAuthError("selected Agent is not managed by the approving Actor", "DEVICE_AUTH_AGENT_NOT_MANAGED", 403);
      }
      Object.assign(record, { status: "approved", approvedByActorId, agentActorId, approvedAt });
      return { ...record };
    },
    async deny({ userCodeDigest, deniedByActorId, deniedAt }) {
      const record = getByUserDigest(userCodeDigest);
      assertCurrent(record, Date.parse(deniedAt));
      if (record.status !== "pending") throw new DeviceAuthError("device authorization is no longer pending", "DEVICE_AUTH_ALREADY_USED", 409);
      Object.assign(record, { status: "denied", deniedByActorId, deniedAt });
      return { ...record };
    },
    async consume({ deviceCodeDigest, consumedAt, token }) {
      const record = byDeviceDigest.get(deviceCodeDigest) ?? null;
      assertCurrent(record, Date.parse(consumedAt));
      if (record.status === "pending") throw new DeviceAuthError("authorization is still pending", "AUTHORIZATION_PENDING");
      if (record.status !== "approved" || !record.agentActorId || !record.approvedByActorId) {
        throw new DeviceAuthError("device authorization was denied or already consumed", "ACCESS_DENIED");
      }
      Object.assign(record, { status: "consumed", consumedAt, issuedTokenId: token.tokenId });
      issuedTokens.push(Object.freeze({
        ...token,
        actorId: record.agentActorId,
        scopes: [...record.requestedScopes],
        approvedByActorId: record.approvedByActorId,
      }));
      return { ...record, tokenId: token.tokenId };
    },
    async listManagedAgents(actorId) {
      return [...(managedAgents.get(actorId) ?? [])].map((actor) => ({ ...actor }));
    },
  });
}

/** Start one device grant. Raw codes are returned once and never sent to storage. */
export async function startDeviceAuthorization({
  store,
  clientId,
  scopes,
  verificationUri = "/device",
  now = () => Date.now(),
} = {}) {
  if (!store || typeof store.create !== "function") throw new DeviceAuthError("persistent device authorization is unavailable", "DEVICE_AUTH_UNAVAILABLE", 503);
  clientId = requiredText(clientId, "client_id");
  if (clientId.length > 100) throw new DeviceAuthError("client_id must not exceed 100 characters", "INVALID_REQUEST");
  const requestedScopes = normalizeDeviceScopes(scopes);
  const issuedAtMs = now();
  const createdAt = new Date(issuedAtMs).toISOString();
  const expiresAt = new Date(issuedAtMs + store.ttlMs).toISOString();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const deviceCode = randomBase64Url(DEVICE_CODE_BYTES);
    const userCode = randomUserCode();
    try {
      await store.create({
        deviceCodeDigest: await digest(deviceCode),
        userCodeDigest: await digest(userCode),
        clientId,
        requestedScopes,
        createdAt,
        expiresAt,
      });
      const complete = new URL(verificationUri, "https://device.invalid");
      complete.searchParams.set("user_code", userCode);
      const verificationUriComplete = verificationUri.startsWith("http")
        ? complete.toString()
        : `${complete.pathname}${complete.search}`;
      return Object.freeze({
        device_code: deviceCode,
        user_code: userCode,
        verification_uri: verificationUri,
        verification_uri_complete: verificationUriComplete,
        interval: 5,
        expires_in: Math.floor(store.ttlMs / 1000),
      });
    } catch (error) {
      if (!(error instanceof DeviceAuthError) || error.code !== "DEVICE_AUTH_CODE_COLLISION" || attempt === 2) throw error;
    }
  }
  throw new DeviceAuthError("could not allocate a device authorization code", "DEVICE_AUTH_UNAVAILABLE", 503);
}

export async function getDeviceAuthorizationForApproval({ store, userCode, now = () => Date.now() } = {}) {
  if (!store || typeof store.preview !== "function") throw new DeviceAuthError("persistent device authorization is unavailable", "DEVICE_AUTH_UNAVAILABLE", 503);
  userCode = normalizedUserCode(userCode);
  return publicGrant(await store.preview({ userCodeDigest: await digest(userCode), at: now() }));
}

/** Approve one pending code for an explicitly selected, human-managed Agent. */
export async function approveDeviceAuthorization({
  store,
  approvedByActorId,
  agentActorId,
  userCode,
  now = () => Date.now(),
} = {}) {
  if (!store || typeof store.approve !== "function") throw new DeviceAuthError("persistent device authorization is unavailable", "DEVICE_AUTH_UNAVAILABLE", 503);
  approvedByActorId = requiredText(approvedByActorId, "approving actor id");
  agentActorId = requiredText(agentActorId, "agent_actor_id");
  userCode = normalizedUserCode(userCode);
  const record = await store.approve({
    userCodeDigest: await digest(userCode),
    approvedByActorId,
    agentActorId,
    approvedAt: new Date(now()).toISOString(),
  });
  return Object.freeze({ status: "approved", agent_actor_id: record.agentActorId, expires_at: isoTime(record.expiresAt, "grant expiry") });
}

export async function denyDeviceAuthorization({ store, deniedByActorId, userCode, now = () => Date.now() } = {}) {
  if (!store || typeof store.deny !== "function") throw new DeviceAuthError("persistent device authorization is unavailable", "DEVICE_AUTH_UNAVAILABLE", 503);
  deniedByActorId = requiredText(deniedByActorId, "denying actor id");
  userCode = normalizedUserCode(userCode);
  await store.deny({ userCodeDigest: await digest(userCode), deniedByActorId, deniedAt: new Date(now()).toISOString() });
  return Object.freeze({ status: "denied" });
}

/** Atomically exchange one approved grant for a hash-only Agent API token. */
export async function exchangeDeviceToken({
  store,
  deviceCode,
  now = () => Date.now(),
  tokenTtlMs = DEFAULT_TOKEN_TTL_MS,
} = {}) {
  if (!store || typeof store.consume !== "function") throw new DeviceAuthError("persistent device authorization is unavailable", "DEVICE_AUTH_UNAVAILABLE", 503);
  deviceCode = requiredText(deviceCode, "device_code");
  if (!/^[A-Za-z0-9_-]{43}$/.test(deviceCode)) throw new DeviceAuthError("device code is invalid", "INVALID_GRANT");
  if (!Number.isInteger(tokenTtlMs) || tokenTtlMs < 60_000) throw new DeviceAuthError("device token lifetime is invalid", "DEVICE_AUTH_TOKEN_UNAVAILABLE", 503);
  const issuedAtMs = now();
  const plaintext = `${TOKEN_PREFIX}${randomBase64Url(TOKEN_BYTES)}`;
  const tokenId = crypto.randomUUID();
  const token = {
    tokenId,
    tokenHash: await digest(plaintext),
    tokenPrefix: plaintext.slice(0, TOKEN_DISPLAY_PREFIX_LENGTH),
    label: "CLI device connection",
    expiresAt: new Date(issuedAtMs + tokenTtlMs).toISOString(),
  };
  let consumed;
  try {
    consumed = await store.consume({
      deviceCodeDigest: await digest(deviceCode),
      consumedAt: new Date(issuedAtMs).toISOString(),
      token,
    });
  } catch (error) {
    if (error instanceof DeviceAuthError && error.code === "DEVICE_AUTH_NOT_FOUND") {
      throw new DeviceAuthError("device code is invalid", "INVALID_GRANT");
    }
    if (error instanceof DeviceAuthError && error.code === "DEVICE_AUTH_ALREADY_USED") {
      throw new DeviceAuthError("device authorization was already consumed", "ACCESS_DENIED");
    }
    throw error;
  }
  if (!consumed || consumed.status !== "consumed" || !Array.isArray(consumed.requestedScopes)) {
    throw new DeviceAuthError("device authorization store returned an invalid result", "DEVICE_AUTH_TOKEN_UNAVAILABLE", 503);
  }
  return Object.freeze({
    access_token: plaintext,
    token_type: "Bearer",
    expires_in: Math.floor(tokenTtlMs / 1000),
    scope: consumed.requestedScopes.join(" "),
    scopes: [...consumed.requestedScopes],
    token_id: consumed.tokenId ?? tokenId,
    agent_actor_id: consumed.agentActorId,
    approved_by_actor_id: consumed.approvedByActorId,
  });
}

export async function listManagedAgents({ store, actorId } = {}) {
  if (!store || typeof store.listManagedAgents !== "function") throw new DeviceAuthError("managed Agent lookup is unavailable", "DEVICE_AUTH_UNAVAILABLE", 503);
  actorId = requiredText(actorId, "actor id");
  return store.listManagedAgents(actorId);
}
