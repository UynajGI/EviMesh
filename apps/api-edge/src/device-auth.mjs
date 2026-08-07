const DEVICE_CODE_BYTES = 32;
const USER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const USER_CODE_LENGTH = 8;
const DEFAULT_TTL_MS = 15 * 60 * 1000;
export const CLI_DEVICE_SCOPES = Object.freeze(["profile:read", "project:read"]);

export class DeviceAuthError extends Error {
  constructor(message, code = "DEVICE_AUTH_INVALID", status = 400) {
    super(message);
    this.name = "DeviceAuthError";
    this.code = code;
    this.status = status;
  }
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

/** Bounded in-process pending-code store; production wiring injects a shared store. */
export function createMemoryDeviceCodeStore({ ttlMs = DEFAULT_TTL_MS, now = () => Date.now() } = {}) {
  if (!Number.isInteger(ttlMs) || ttlMs < 1000) throw new DeviceAuthError("device code ttl must be at least one second");
  const byDeviceCode = new Map();
  const byUserCode = new Map();

  // Expired records stay readable so exchanges can report `expired_token`;
  // pruning happens on create to keep the store bounded.
  function prune() {
    const current = now();
    for (const [deviceCode, record] of byDeviceCode) {
      if (record.expiresAtMs <= current) {
        byDeviceCode.delete(deviceCode);
        byUserCode.delete(record.userCode);
      }
    }
  }

  return Object.freeze({
    ttlMs,
    async create(record) {
      prune();
      byDeviceCode.set(record.deviceCode, record);
      byUserCode.set(record.userCode, record.deviceCode);
      return record;
    },
    async getByDeviceCode(deviceCode) {
      return byDeviceCode.get(deviceCode) ?? null;
    },
    async getByUserCode(userCode) {
      const deviceCode = byUserCode.get(userCode);
      return deviceCode ? byDeviceCode.get(deviceCode) ?? null : null;
    },
    async update(deviceCode, patch) {
      const record = byDeviceCode.get(deviceCode);
      if (!record) return null;
      const updated = { ...record, ...patch };
      byDeviceCode.set(deviceCode, updated);
      return updated;
    },
    async delete(deviceCode) {
      const record = byDeviceCode.get(deviceCode);
      if (!record) return false;
      byDeviceCode.delete(deviceCode);
      byUserCode.delete(record.userCode);
      return true;
    },
  });
}

/** Start one device authorization grant and return the RFC-8628 polling contract. */
export async function startDeviceAuthorization({ store, clientId, now = () => Date.now() } = {}) {
  if (!store || typeof store.create !== "function") throw new DeviceAuthError("device code store is required", "DEVICE_AUTH_UNAVAILABLE", 503);
  if (typeof clientId !== "string" || clientId.trim().length === 0) throw new DeviceAuthError("client_id is required", "INVALID_REQUEST");
  const issuedAtMs = now();
  const record = {
    deviceCode: randomBase64Url(DEVICE_CODE_BYTES),
    userCode: randomUserCode(),
    clientId: clientId.trim(),
    status: "pending",
    actorId: null,
    createdAtMs: issuedAtMs,
    expiresAtMs: issuedAtMs + store.ttlMs,
  };
  await store.create(record);
  return Object.freeze({
    device_code: record.deviceCode,
    user_code: record.userCode,
    verification_uri: "/device",
    interval: 5,
    expires_in: Math.floor(store.ttlMs / 1000),
  });
}

/** Bind one user code to the authenticated Actor after browser confirmation. */
export async function approveDeviceAuthorization({ store, actorId, userCode, now = () => Date.now() } = {}) {
  if (!store || typeof store.getByUserCode !== "function") throw new DeviceAuthError("device code store is required", "DEVICE_AUTH_UNAVAILABLE", 503);
  if (typeof actorId !== "string" || actorId.trim().length === 0) throw new DeviceAuthError("actor id is required");
  if (typeof userCode !== "string" || userCode.trim().length === 0) throw new DeviceAuthError("user_code is required");
  const record = await store.getByUserCode(userCode.trim().toUpperCase());
  if (!record || record.expiresAtMs <= now()) throw new DeviceAuthError("user code not found or expired", "USER_CODE_NOT_FOUND", 404);
  if (record.status !== "pending") throw new DeviceAuthError("user code was already used", "USER_CODE_USED", 409);
  await store.update(record.deviceCode, { status: "approved", actorId: actorId.trim() });
  return Object.freeze({ status: "approved", device_code: record.deviceCode });
}

/** Exchange an approved device code for one limited-scope API token. */
export async function exchangeDeviceToken({ store, deviceCode, issueToken, now = () => Date.now() } = {}) {
  if (!store || typeof store.getByDeviceCode !== "function") throw new DeviceAuthError("device code store is required", "DEVICE_AUTH_UNAVAILABLE", 503);
  if (typeof issueToken !== "function") throw new DeviceAuthError("device token issuer is required", "DEVICE_AUTH_TOKEN_UNAVAILABLE", 503);
  if (typeof deviceCode !== "string" || deviceCode.trim().length === 0) throw new DeviceAuthError("device_code is required", "INVALID_REQUEST");
  const record = await store.getByDeviceCode(deviceCode.trim());
  if (!record) throw new DeviceAuthError("device code not found", "INVALID_DEVICE_CODE");
  if (record.expiresAtMs <= now()) {
    await store.delete(record.deviceCode);
    throw new DeviceAuthError("device code expired", "EXPIRED_TOKEN");
  }
  if (record.status === "pending") throw new DeviceAuthError("authorization is still pending", "AUTHORIZATION_PENDING");
  if (record.status !== "approved" || !record.actorId) throw new DeviceAuthError("device code is not approved", "ACCESS_DENIED");
  const issued = await issueToken(record.actorId);
  await store.delete(record.deviceCode);
  if (!issued || typeof issued.access_token !== "string" || !Array.isArray(issued.scopes)) {
    throw new DeviceAuthError("device token issuer returned an invalid token", "DEVICE_AUTH_TOKEN_UNAVAILABLE", 503);
  }
  return Object.freeze({ access_token: issued.access_token, scopes: [...issued.scopes], token_id: issued.token_id ?? null });
}
