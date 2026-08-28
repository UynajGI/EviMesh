import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/index.mjs";
import { authenticateApiToken } from "../src/api-token-auth.mjs";
import { JwtVerificationError } from "../src/jwt.mjs";

async function issueToken({ actorId = "actor-1", scopes = ["profile:read", "project:read"], expiresAt = null, revokedAt = null } = {}) {
  const { createActorApiToken } = await import("../../../packages/domain/src/api-token.mjs");
  const records = new Map();
  const insertApiToken = async (record) => {
    const persisted = { tokenId: `token-${records.size + 1}`, actorId, scopes, expiresAt, revokedAt, ...record };
    records.set(record.tokenHash, persisted);
    return persisted;
  };
  const { token } = await createActorApiToken({
    repository: { insertApiToken, withTransaction: async (callback) => callback({ insertApiToken }) },
    actorId,
    scopes,
    expiresAt,
  });
  return { token, records };
}

function repositoryOver(records, { trackUsage = [] } = {}) {
  return {
    findApiTokenByHash: async (hash) => records.get(hash) ?? null,
    updateApiTokenLastUsedAt: async (tokenId, usedAt) => { trackUsage.push({ tokenId, usedAt }); return { tokenId }; },
    getActor: async (actorId) => ({ actorId, actorType: "agent" }),
  };
}

test("authenticates an issued evimesh_ token and resolves its actor", async () => {
  const { token, records } = await issueToken();
  const claims = await authenticateApiToken({ repository: repositoryOver(records), token });
  assert.equal(claims.kind, "api_token");
  assert.equal(claims.actorId, "actor-1");
  assert.deepEqual(claims.scopes, ["profile:read", "project:read"]);
});

test("rejects revoked, expired, and unknown tokens", async () => {
  const revoked = await issueToken({ revokedAt: "2026-01-01T00:00:00.000Z" });
  await assert.rejects(authenticateApiToken({ repository: repositoryOver(revoked.records), token: revoked.token }), JwtVerificationError);

  const expired = await issueToken({ expiresAt: "2026-01-01T00:00:00.000Z" });
  await assert.rejects(authenticateApiToken({ repository: repositoryOver(expired.records), token: expired.token }), JwtVerificationError);

  await assert.rejects(authenticateApiToken({ repository: repositoryOver(new Map()), token: "evimesh_unknown" }), JwtVerificationError);
});

test("protected routes accept API tokens end to end", async () => {
  const { token, records } = await issueToken();
  const app = createApp({ repository: repositoryOver(records) });
  const me = await app.fetch(new Request("https://api.example.test/auth/me", { headers: { authorization: `Bearer ${token}` } }), {});
  assert.equal(me.status, 200);
  assert.deepEqual(await me.json(), { subject: "actor-1", email: null, actorId: "actor-1", actorType: "agent", signingKey: null });
});

test("auth/me forwards the caller JWT when resolving a Supabase identity", async () => {
  const calls = [];
  const repository = {
    findIdentity: async (...args) => { calls.push(args); return { actorId: "actor-1" }; },
    getActor: async (actorId) => ({ actorId, actorType: "human" }),
  };
  const app = createApp({ repository, authenticate: async () => ({ sub: "supabase-subject" }) });
  const response = await app.fetch(new Request("https://api.example.test/auth/me", {
    headers: { authorization: "Bearer supabase-jwt" },
  }), {});
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal(calls.length, 2, "rate limiting and the route both resolve the authenticated actor");
  assert.ok(calls.every((args) => args[0] === "supabase"
    && args[1] === "supabase-subject"
    && args[2]?.accessToken === "supabase-jwt"));
});

test("signing-key registration works with API tokens", async () => {
  const { token, records } = await issueToken();
  const keys = [];
  const repository = {
    ...repositoryOver(records),
    findActiveSigningKey: async () => keys.find((key) => key.actorId === "actor-1") ?? null,
    insertSigningKey: async (key) => { keys.push(key); return key; },
    withTransaction: async (callback) => callback({
      findActiveSigningKey: async () => keys.find((key) => key.actorId === "actor-1") ?? null,
      insertSigningKey: async (key) => { keys.push(key); return key; },
    }),
  };
  const app = createApp({ repository });
  const response = await app.fetch(new Request("https://api.example.test/signing-keys", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ keyId: "key-1", publicKey: "pubkey-bytes" }),
  }), {});
  assert.equal(response.status, 201, await response.clone().text());
  assert.equal(keys[0].actorId, "actor-1");
  assert.equal(keys[0].keyId, "key-1");
});

test("device-login tokens authenticate subsequent API calls", async () => {
  const records = new Map();
  const repository = {
    findIdentity: async () => ({ actorId: "actor-1" }),
    getActor: async (actorId) => ({ actorId, actorType: "agent" }),
    findApiTokenByHash: async (hash) => records.get(hash) ?? null,
    insertApiToken: async (record) => {
      const persisted = { tokenId: `token-${records.size + 1}`, actorId: "actor-1", scopes: record.scopes, expiresAt: null, revokedAt: null, ...record };
      records.set(record.tokenHash, persisted);
      return persisted;
    },
    withTransaction: async (callback) => callback({
      insertApiToken: async (record) => repository.insertApiToken(record),
    }),
  };
  const app = createApp({ repository, authenticate: async () => ({ sub: "supabase-subject" }) });

  const start = await app.fetch(new Request("https://api.example.test/auth/device", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client_id: "evimesh-cli" }) }), {});
  const device = await start.json();
  await app.fetch(new Request("https://api.example.test/auth/device/approve", { method: "POST", headers: { authorization: "Bearer jwt", "content-type": "application/json" }, body: JSON.stringify({ user_code: device.user_code }) }), {});
  const exchange = await app.fetch(new Request("https://api.example.test/auth/device/token", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ device_code: device.device_code }) }), {});
  const { access_token: apiToken } = await exchange.json();
  assert.ok(apiToken.startsWith("evimesh_"));

  const me = await app.fetch(new Request("https://api.example.test/auth/me", { headers: { authorization: `Bearer ${apiToken}` } }), {});
  assert.equal(me.status, 200);
  assert.deepEqual(await me.json(), { subject: "actor-1", email: null, actorId: "actor-1", actorType: "agent", signingKey: null });
});

test("auth/me exposes only the authenticated actor's active public signing key", async () => {
  const { token, records } = await issueToken();
  const repository = {
    ...repositoryOver(records),
    findActiveSigningKey: async (actorId) => ({ keyId: "key-1", actorId, algorithm: "Ed25519", publicKey: "public-key" }),
  };
  const app = createApp({ repository });
  const response = await app.fetch(new Request("https://api.example.test/auth/me", { headers: { authorization: `Bearer ${token}` } }), {});
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).signingKey, { keyId: "key-1", algorithm: "Ed25519", publicKey: "public-key" });
});
