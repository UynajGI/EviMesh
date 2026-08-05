import { generateKeyPair, sign } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.mjs";

const issuer = "https://auth.example.test/auth/v1";

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
  const response = await worker.fetch(new Request("https://api.example.test/auth/me", {
    headers: { authorization: `Bearer ${fixture.token}` },
  }), fixture.env);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { subject: "actor_test_01", email: "test@example.test" });
});

test("rejects missing, tampered, and expired JWTs", async () => {
  const fixture = await createFixture();
  const tampered = `${fixture.token.slice(0, -1)}${fixture.token.endsWith("a") ? "b" : "a"}`;
  const expired = await createFixture({ exp: Math.floor(Date.now() / 1000) - 1 });

  for (const token of [undefined, tampered, expired.token]) {
    const headers = token ? { authorization: `Bearer ${token}` } : {};
    const response = await worker.fetch(new Request("https://api.example.test/auth/me", { headers }), fixture.env);
    assert.equal(response.status, 401);
    const payload = await response.json();
    assert.equal(payload.code, "unauthorized");
    assert.equal(payload.message, "authentication required");
    assert.match(response.headers.get("x-request-id"), /^[0-9a-f-]{36}$/);
  }
});
