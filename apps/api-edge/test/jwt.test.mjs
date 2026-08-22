import { generateKeyPair, sign } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/index.mjs";

const issuer = "https://auth.example.test/auth/v1";
const app = createApp({ repository: {
  findIdentity: async (_provider, subject) => ({ actorId: subject }),
  getActor: async (actorId) => ({ actorId, actorType: "agent" }),
} });

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}

async function createFixture(overrides = {}) {
  const { privateKey, publicKey } = await new Promise((resolve, reject) => {
    generateKeyPair("ec", { namedCurve: "prime256v1" }, (error, generatedPublicKey, generatedPrivateKey) => {
      if (error) reject(error);
      else resolve({ publicKey: generatedPublicKey, privateKey: generatedPrivateKey });
    });
  });
  const publicJwk = publicKey.export({ format: "jwk" });
  const header = { alg: "ES256", typ: "JWT", kid: "m4-test-key" };
  const payload = {
    sub: "actor_test_01",
    email: "test@example.test",
    aud: "authenticated",
    iss: issuer,
    exp: Math.floor(Date.now() / 1000) + 300,
    ...overrides,
  };
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = sign("sha256", Buffer.from(signingInput), { key: privateKey, dsaEncoding: "ieee-p1363" });
  return {
    token: `${signingInput}.${base64Url(signature)}`,
    env: {
      EVIMESH_ENV: "test",
      SUPABASE_JWT_ISSUER: issuer,
      SUPABASE_JWKS: JSON.stringify({ keys: [{ ...publicJwk, kid: "m4-test-key", alg: "ES256", use: "sig" }] }),
    },
  };
}

test("accepts a valid Supabase JWT at the authenticated route", async () => {
  const fixture = await createFixture();
  const response = await app.fetch(new Request("https://api.example.test/auth/me", {
    headers: { authorization: `Bearer ${fixture.token}` },
  }), fixture.env);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { subject: "actor_test_01", email: "test@example.test", actorId: "actor_test_01", actorType: "agent", signingKey: null });
});

test("returns the typed identity error for a valid but unprovisioned Supabase identity", async () => {
  const fixture = await createFixture();
  const unprovisioned = createApp({ repository: { findIdentity: async () => null } });
  const response = await unprovisioned.fetch(new Request("https://api.example.test/auth/me", {
    headers: { authorization: `Bearer ${fixture.token}`, "x-request-id": "auth-me-unprovisioned" },
  }), fixture.env);

  assert.equal(response.status, 403);
  assert.equal(response.headers.get("x-request-id"), "auth-me-unprovisioned");
  assert.deepEqual(await response.json(), {
    code: "ACTOR_IDENTITY_NOT_FOUND",
    message: "authenticated actor identity is not provisioned",
    request_id: "auth-me-unprovisioned",
  });
});

test("passes through typed actor and active signing-key lookup failures", async () => {
  const typedError = (message, code, status) => Object.assign(new Error(message), { code, status });
  const request = (requestId) => new Request("https://api.example.test/auth/me", {
    headers: { authorization: "Bearer test-token", "x-request-id": requestId },
  });
  const cases = [
    {
      requestId: "auth-me-actor-failure",
      code: "ACTOR_LOOKUP_UNAVAILABLE",
      message: "actor lookup is unavailable",
      status: 503,
      repository: {
        findIdentity: async () => ({ actorId: "actor-1" }),
        getActor: async () => { throw typedError("actor lookup is unavailable", "ACTOR_LOOKUP_UNAVAILABLE", 503); },
      },
    },
    {
      requestId: "auth-me-key-failure",
      code: "SIGNING_KEY_LOOKUP_DENIED",
      message: "active signing-key lookup is denied",
      status: 403,
      repository: {
        findIdentity: async () => ({ actorId: "actor-1" }),
        getActor: async () => ({ actorId: "actor-1", actorType: "human" }),
        findActiveSigningKey: async () => { throw typedError("active signing-key lookup is denied", "SIGNING_KEY_LOOKUP_DENIED", 403); },
      },
    },
  ];

  for (const scenario of cases) {
    const route = createApp({ repository: scenario.repository, authenticate: async () => ({ sub: "subject-1" }) });
    const response = await route.fetch(request(scenario.requestId), {});
    assert.equal(response.status, scenario.status);
    assert.equal(response.headers.get("x-request-id"), scenario.requestId);
    assert.deepEqual(await response.json(), {
      code: scenario.code,
      message: scenario.message,
      request_id: scenario.requestId,
    });
  }
});

test("does not convert unknown auth/me lookup errors into known failures", async () => {
  const route = createApp({
    repository: {
      findIdentity: async () => ({ actorId: "actor-1" }),
      getActor: async () => { throw new Error("unexpected actor lookup failure"); },
    },
    authenticate: async () => ({ sub: "subject-1" }),
  });
  const response = await route.fetch(new Request("https://api.example.test/auth/me", {
    headers: { authorization: "Bearer test-token", "x-request-id": "auth-me-unknown" },
  }), {});

  assert.equal(response.status, 500);
  assert.equal(response.headers.get("x-request-id"), "auth-me-unknown");
  assert.deepEqual(await response.json(), {
    code: "internal_error",
    message: "internal server error",
    request_id: "auth-me-unknown",
  });
});

test("rejects missing, tampered, and expired JWTs", async () => {
  const fixture = await createFixture();
  const [header, payload, signaturePart] = fixture.token.split(".");
  const signature = Buffer.from(signaturePart, "base64url");
  signature[0] ^= 1;
  const tampered = `${header}.${payload}.${signature.toString("base64url")}`;
  const expired = await createFixture({ exp: Math.floor(Date.now() / 1000) - 1 });

  for (const token of [undefined, tampered, expired.token]) {
    const headers = token ? { authorization: `Bearer ${token}` } : {};
    const response = await app.fetch(new Request("https://api.example.test/auth/me", { headers }), fixture.env);
    assert.equal(response.status, 401);
    const payload = await response.json();
    assert.equal(payload.code, "unauthorized");
    assert.equal(payload.message, "authentication required");
    assert.match(response.headers.get("x-request-id"), /^[0-9a-f-]{36}$/);
  }
});
