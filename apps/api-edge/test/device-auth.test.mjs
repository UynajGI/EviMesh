import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/index.mjs";
import { JwtVerificationError } from "../src/jwt.mjs";
import {
  approveDeviceAuthorization,
  createMemoryDeviceCodeStore,
  denyDeviceAuthorization,
  DeviceAuthError,
  exchangeDeviceToken,
  getDeviceAuthorizationForApproval,
  startDeviceAuthorization,
} from "../src/device-auth.mjs";

const HUMAN_ID = "actor-human";
const AGENT_ID = "actor-agent";
const MANAGED_AGENT = Object.freeze({
  actorId: AGENT_ID,
  actorType: "agent",
  modelName: "self_declared:test-agent",
  runtime: "node:test",
  scope: "draft",
  publicKeyFingerprint: null,
});

const AUTH = {
  authenticate: async (request) => {
    const header = request?.headers?.get?.("authorization") ?? "";
    if (!header.startsWith("Bearer ")) throw new JwtVerificationError("missing bearer token");
    return { sub: "supabase-subject" };
  },
};

function identityRepository({ actorType = "human" } = {}) {
  return {
    findIdentity: async () => ({ actorId: HUMAN_ID }),
    getActor: async (actorId) => actorId === HUMAN_ID ? { actorId, actorType } : actorId === AGENT_ID ? MANAGED_AGENT : null,
  };
}

function managedStore(options = {}) {
  return createMemoryDeviceCodeStore({
    ...options,
    managedAgents: new Map([[HUMAN_ID, [MANAGED_AGENT]]]),
  });
}

function jsonRequest(url, { method = "POST", body = null, authenticated = false } = {}) {
  return new Request(url, {
    method,
    headers: {
      ...(authenticated ? { authorization: "Bearer test-token" } : {}),
      ...(body === null ? {} : { "content-type": "application/json" }),
    },
    body: body === null ? undefined : JSON.stringify(body),
  });
}

test("device authorization binds a human-approved Agent and atomically issues one hash-only token", async () => {
  const store = managedStore();
  const app = createApp({ repository: identityRepository(), deviceCodeStore: store, ...AUTH });

  const start = await app.fetch(jsonRequest("https://api.example.test/auth/device", {
    body: { client_id: "evimesh-cli", scope: "profile:read project:read research:prepare research:submit artifact:upload" },
  }), { EVIMESH_WEB_URL: "https://evimesh.com" });
  assert.equal(start.status, 200);
  const device = await start.json();
  assert.match(device.user_code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal(device.verification_uri, "https://evimesh.com/device");
  assert.equal(device.verification_uri_complete, `https://evimesh.com/device?user_code=${device.user_code}`);

  const pending = await app.fetch(jsonRequest("https://api.example.test/auth/device/token", { body: { device_code: device.device_code } }), {});
  assert.equal(pending.status, 400);
  assert.equal((await pending.json()).error, "authorization_pending");

  const preview = await app.fetch(jsonRequest(`https://api.example.test/auth/device/grants/${device.user_code}`, { method: "GET", authenticated: true }), {});
  assert.equal(preview.status, 200);
  const previewBody = await preview.json();
  assert.equal(previewBody.client_id, "evimesh-cli");
  assert.equal(previewBody.status, "pending");
  assert.equal(Object.hasOwn(previewBody, "device_code"), false);

  const managed = await app.fetch(jsonRequest("https://api.example.test/actors/managed?actor_type=agent", { method: "GET", authenticated: true }), {});
  assert.equal(managed.status, 200);
  assert.deepEqual((await managed.json()).items, [MANAGED_AGENT]);

  const approve = await app.fetch(jsonRequest("https://api.example.test/auth/device/approve", {
    authenticated: true,
    body: { user_code: device.user_code, agent_actor_id: AGENT_ID },
  }), {});
  assert.equal(approve.status, 200);
  assert.deepEqual(Object.keys(await approve.clone().json()).sort(), ["agent_actor_id", "expires_at", "status"]);
  assert.equal((await approve.json()).agent_actor_id, AGENT_ID);

  const exchange = await app.fetch(jsonRequest("https://api.example.test/auth/device/token", { body: { device_code: device.device_code } }), {});
  assert.equal(exchange.status, 200);
  const token = await exchange.json();
  assert.ok(token.access_token.startsWith("evimesh_"));
  assert.equal(token.token_type, "Bearer");
  assert.equal(token.agent_actor_id, AGENT_ID);
  assert.equal(token.approved_by_actor_id, HUMAN_ID);
  assert.deepEqual(token.scopes, ["profile:read", "project:read", "research:prepare", "research:submit", "artifact:upload"]);
  assert.equal(store.issuedTokens.length, 1);
  assert.equal(store.issuedTokens[0].actorId, AGENT_ID);
  assert.equal(store.issuedTokens[0].approvedByActorId, HUMAN_ID);
  assert.match(store.issuedTokens[0].tokenHash, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(Object.values(store.issuedTokens[0]).includes(token.access_token), false);

  const replay = await app.fetch(jsonRequest("https://api.example.test/auth/device/token", { body: { device_code: device.device_code } }), {});
  assert.equal(replay.status, 400);
  assert.equal((await replay.json()).error, "access_denied");
  assert.equal(store.issuedTokens.length, 1);
});

test("denial is terminal and cannot issue a token", async () => {
  const store = managedStore();
  const app = createApp({ repository: identityRepository(), deviceCodeStore: store, ...AUTH });
  const started = await startDeviceAuthorization({ store, clientId: "evimesh-cli" });

  const denied = await app.fetch(jsonRequest("https://api.example.test/auth/device/deny", {
    authenticated: true,
    body: { user_code: started.user_code },
  }), {});
  assert.equal(denied.status, 200);
  assert.deepEqual(await denied.json(), { status: "denied" });

  const exchange = await app.fetch(jsonRequest("https://api.example.test/auth/device/token", { body: { device_code: started.device_code } }), {});
  assert.equal(exchange.status, 400);
  assert.equal((await exchange.json()).error, "access_denied");
});

test("rejects non-human approval and unknown or signing scopes", async () => {
  const store = managedStore();
  const agentApp = createApp({ repository: identityRepository({ actorType: "agent" }), deviceCodeStore: store, ...AUTH });
  const started = await startDeviceAuthorization({ store, clientId: "evimesh-cli" });
  const nonHuman = await agentApp.fetch(jsonRequest("https://api.example.test/auth/device/approve", {
    authenticated: true,
    body: { user_code: started.user_code, agent_actor_id: AGENT_ID },
  }), {});
  assert.equal(nonHuman.status, 403);
  assert.equal((await nonHuman.json()).error, "device_auth_human_required");

  const app = createApp({ repository: identityRepository(), deviceCodeStore: store, ...AUTH });
  for (const scope of ["research:sign", "admin:write"]) {
    const response = await app.fetch(jsonRequest("https://api.example.test/auth/device", { body: { client_id: "evimesh-cli", scope } }), {});
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, "invalid_scope");
  }
});

test("expires grants and preserves RFC-style terminal errors", async () => {
  let clock = 0;
  const store = managedStore({ ttlMs: 1000, now: () => clock });
  const started = await startDeviceAuthorization({ store, clientId: "evimesh-cli", now: () => clock });
  clock = 2000;
  await assert.rejects(
    exchangeDeviceToken({ store, deviceCode: started.device_code, now: () => clock }),
    (error) => error instanceof DeviceAuthError && error.code === "EXPIRED_TOKEN",
  );
  await assert.rejects(
    getDeviceAuthorizationForApproval({ store, userCode: started.user_code, now: () => clock }),
    (error) => error instanceof DeviceAuthError && error.code === "EXPIRED_TOKEN",
  );
});

test("concurrent exchanges have exactly one winner", async () => {
  const store = managedStore();
  const started = await startDeviceAuthorization({ store, clientId: "evimesh-cli" });
  await approveDeviceAuthorization({
    store,
    approvedByActorId: HUMAN_ID,
    agentActorId: AGENT_ID,
    userCode: started.user_code,
  });
  const results = await Promise.allSettled([
    exchangeDeviceToken({ store, deviceCode: started.device_code }),
    exchangeDeviceToken({ store, deviceCode: started.device_code }),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = results.find((result) => result.status === "rejected");
  assert.equal(rejected.reason.code, "ACCESS_DENIED");
  assert.equal(store.issuedTokens.length, 1);
});

test("database already-used conflicts become RFC-style access_denied on replay", async () => {
  const store = {
    consume: async () => { throw new DeviceAuthError("already consumed", "DEVICE_AUTH_ALREADY_USED", 409); },
  };
  await assert.rejects(
    exchangeDeviceToken({ store, deviceCode: "a".repeat(43) }),
    (error) => error instanceof DeviceAuthError && error.code === "ACCESS_DENIED" && error.status === 400,
  );
});

test("approval must select an Agent managed by the authenticated human", async () => {
  const store = managedStore();
  const started = await startDeviceAuthorization({ store, clientId: "evimesh-cli" });
  await assert.rejects(
    approveDeviceAuthorization({ store, approvedByActorId: HUMAN_ID, agentActorId: "actor-other", userCode: started.user_code }),
    (error) => error instanceof DeviceAuthError && error.code === "DEVICE_AUTH_AGENT_NOT_MANAGED",
  );
  await denyDeviceAuthorization({ store, deniedByActorId: HUMAN_ID, userCode: started.user_code });
});

test("createApp has no implicit in-memory device authorization fallback", async () => {
  const app = createApp({ repository: identityRepository(), ...AUTH });
  const response = await app.fetch(jsonRequest("https://api.example.test/auth/device", { body: { client_id: "evimesh-cli" } }), {});
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "device_auth_unavailable");
});
