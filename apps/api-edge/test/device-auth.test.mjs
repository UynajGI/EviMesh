import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/index.mjs";
import { JwtVerificationError } from "../src/jwt.mjs";
import { approveDeviceAuthorization, createMemoryDeviceCodeStore, DeviceAuthError, exchangeDeviceToken, startDeviceAuthorization } from "../src/device-auth.mjs";

const AUTH = {
  authenticate: async (request) => {
    const header = request?.headers?.get?.("authorization") ?? "";
    if (!header.startsWith("Bearer ")) throw new JwtVerificationError("missing bearer token");
    return { sub: "supabase-subject" };
  },
};

function identityRepository() {
  const tokens = [];
  const insertApiToken = async (record) => {
    const persisted = { tokenId: `token-${tokens.length + 1}`, ...record };
    tokens.push(persisted);
    return persisted;
  };
  return {
    tokens,
    findIdentity: async () => ({ actorId: "actor-1" }),
    insertApiToken,
    withTransaction: async (callback) => callback({ insertApiToken }),
  };
}

test("device authorization grants a limited token through the full flow", async () => {
  const repository = identityRepository();
  const app = createApp({ repository, ...AUTH });

  const start = await app.fetch(new Request("https://api.example.test/auth/device", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_id: "evimesh-cli" }),
  }), {});
  assert.equal(start.status, 200);
  const device = await start.json();
  assert.match(device.user_code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal(device.interval, 5);
  assert.ok(device.expires_in >= 60);

  const pending = await app.fetch(new Request("https://api.example.test/auth/device/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ device_code: device.device_code }),
  }), {});
  assert.equal(pending.status, 400);
  assert.equal((await pending.json()).error, "authorization_pending");

  const approve = await app.fetch(new Request("https://api.example.test/auth/device/approve", {
    method: "POST",
    headers: { authorization: "Bearer test-token", "content-type": "application/json" },
    body: JSON.stringify({ user_code: device.user_code }),
  }), {});
  assert.equal(approve.status, 200);
  assert.equal((await approve.json()).status, "approved");

  const exchange = await app.fetch(new Request("https://api.example.test/auth/device/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ device_code: device.device_code }),
  }), {});
  assert.equal(exchange.status, 200);
  const token = await exchange.json();
  assert.ok(token.access_token.startsWith("evimesh_"));
  assert.deepEqual(token.scopes, ["profile:read", "project:read"]);
  assert.equal(token.token_id, "token-1");
  assert.deepEqual(repository.tokens[0].scopes, ["profile:read", "project:read"]);

  const replay = await app.fetch(new Request("https://api.example.test/auth/device/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ device_code: device.device_code }),
  }), {});
  assert.equal(replay.status, 400);
  assert.equal((await replay.json()).error, "invalid_device_code");
});

test("rejects device approval without authentication and unknown user codes", async () => {
  const app = createApp({ repository: identityRepository(), ...AUTH });
  const unauthenticated = await app.fetch(new Request("https://api.example.test/auth/device/approve", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ user_code: "AAAA-0000" }),
  }), {});
  assert.equal(unauthenticated.status, 401);

  const missing = await app.fetch(new Request("https://api.example.test/auth/device/approve", {
    method: "POST",
    headers: { authorization: "Bearer test-token", "content-type": "application/json" },
    body: JSON.stringify({ user_code: "AAAA-0000" }),
  }), {});
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error, "user_code_not_found");
});

test("rejects invalid device start inputs and unknown device codes", async () => {
  const app = createApp({ repository: identityRepository(), ...AUTH });
  const noClient = await app.fetch(new Request("https://api.example.test/auth/device", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  }), {});
  assert.equal(noClient.status, 400);
  assert.equal((await noClient.json()).error, "invalid_request");

  const unknown = await app.fetch(new Request("https://api.example.test/auth/device/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ device_code: "nope" }),
  }), {});
  assert.equal(unknown.status, 400);
  assert.equal((await unknown.json()).error, "invalid_device_code");
});

test("returns 503 when token issuance has no repository", async () => {
  const store = createMemoryDeviceCodeStore();
  const app = createApp({ repository: null, deviceCodeStore: store, ...AUTH });
  const started = await startDeviceAuthorization({ store, clientId: "evimesh-cli" });
  await approveDeviceAuthorization({ store, actorId: "actor-1", userCode: started.user_code });
  const exchange = await app.fetch(new Request("https://api.example.test/auth/device/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ device_code: started.device_code }),
  }), {});
  assert.equal(exchange.status, 503);
  assert.equal((await exchange.json()).error, "device_auth_token_unavailable");
});

test("expires device codes after the store TTL", async () => {
  let clock = 0;
  const store = createMemoryDeviceCodeStore({ ttlMs: 1000, now: () => clock });
  const started = await startDeviceAuthorization({ store, clientId: "evimesh-cli", now: () => clock });
  clock = 2000;
  await assert.rejects(
    exchangeDeviceToken({ store, deviceCode: started.device_code, issueToken: async () => ({ access_token: "t", scopes: [] }), now: () => clock }),
    (error) => error instanceof DeviceAuthError && error.code === "EXPIRED_TOKEN",
  );
  assert.equal(await store.getByDeviceCode(started.device_code), null);
});

test("rejects approving one user code twice", async () => {
  const store = createMemoryDeviceCodeStore();
  const started = await startDeviceAuthorization({ store, clientId: "evimesh-cli" });
  await approveDeviceAuthorization({ store, actorId: "actor-1", userCode: started.user_code });
  await assert.rejects(
    approveDeviceAuthorization({ store, actorId: "actor-2", userCode: started.user_code }),
    (error) => error instanceof DeviceAuthError && error.code === "USER_CODE_USED",
  );
});
