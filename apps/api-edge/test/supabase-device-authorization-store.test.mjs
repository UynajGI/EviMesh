import test from "node:test";
import assert from "node:assert/strict";
import { createSupabaseDeviceAuthorizationStore } from "../src/supabase-device-authorization-store.mjs";
import { DeviceAuthError } from "../src/device-auth.mjs";

const GRANT = Object.freeze({
  deviceAuthorizationId: "device-auth-1",
  status: "pending",
  clientId: "evimesh-cli",
  requestedScopes: ["profile:read", "project:read"],
  createdAt: "2026-08-31T00:00:00.000Z",
  expiresAt: "2026-08-31T00:15:00.000Z",
  agentActorId: null,
  approvedByActorId: null,
});

test("Supabase device store uses service-only RPCs, accepts every 2xx, and never sends raw codes", async () => {
  const requests = [];
  const store = createSupabaseDeviceAuthorizationStore({
    url: "https://project.supabase.co",
    serviceRoleKey: "sb_secret_test",
    fetchImpl: async (url, options = {}) => {
      requests.push({ url: String(url), options });
      return Response.json(GRANT, { status: 201 });
    },
  });
  assert.equal(store.persistent, true);
  const result = await store.create({
    deviceCodeDigest: "device-digest",
    userCodeDigest: "user-digest",
    clientId: "evimesh-cli",
    requestedScopes: ["profile:read", "project:read"],
    createdAt: GRANT.createdAt,
    expiresAt: GRANT.expiresAt,
  });
  assert.equal(result.clientId, "evimesh-cli");
  const request = requests[0];
  assert.equal(request.url, "https://project.supabase.co/rest/v1/rpc/device_authorization_start");
  assert.equal(request.options.headers.apikey, "sb_secret_test");
  assert.equal(Object.hasOwn(request.options.headers, "authorization"), false);
  const body = JSON.parse(request.options.body);
  assert.deepEqual(body, {
    p_device_code_digest: "device-digest",
    p_user_code_digest: "user-digest",
    p_client_id: "evimesh-cli",
    p_requested_scopes: ["profile:read", "project:read"],
    p_created_at: GRANT.createdAt,
    p_expires_at: GRANT.expiresAt,
  });
  assert.equal(JSON.stringify(body).includes("AAAA-AAAA"), false);
  assert.equal(JSON.stringify(body).includes("evimesh_secret"), false);
});

test("consume sends only token hash metadata and leaves scopes to the locked grant", async () => {
  let captured;
  const store = createSupabaseDeviceAuthorizationStore({
    url: "https://project.supabase.co",
    serviceRoleKey: "legacy-service-jwt",
    fetchImpl: async (_url, options) => {
      captured = options;
      return Response.json({ ...GRANT, status: "consumed", agentActorId: "actor-agent", approvedByActorId: "actor-human", issuedTokenId: "token-1" });
    },
  });
  const result = await store.consume({
    deviceCodeDigest: "device-digest",
    consumedAt: "2026-08-31T00:01:00.000Z",
    token: {
      tokenId: "token-1",
      tokenHash: "token-hash",
      tokenPrefix: "evimesh_display",
      label: "CLI device connection",
      expiresAt: "2026-09-30T00:01:00.000Z",
    },
  });
  assert.equal(result.agentActorId, "actor-agent");
  assert.equal(captured.headers.authorization, "Bearer legacy-service-jwt");
  const body = JSON.parse(captured.body);
  assert.equal(Object.hasOwn(body, "p_token_scopes"), false);
  assert.equal(Object.hasOwn(body, "access_token"), false);
  assert.equal(body.p_token_hash, "token-hash");
});

test("maps database guard failures to stable device authorization errors", async () => {
  const store = createSupabaseDeviceAuthorizationStore({
    url: "https://project.supabase.co",
    serviceRoleKey: "sb_secret_test",
    fetchImpl: async () => Response.json({ message: "[DEVICE_AUTH_AGENT_NOT_MANAGED] selected Agent is not managed" }, { status: 400 }),
  });
  await assert.rejects(
    store.approve({ userCodeDigest: "digest", approvedByActorId: "human", agentActorId: "agent", approvedAt: new Date().toISOString() }),
    (error) => error instanceof DeviceAuthError && error.code === "DEVICE_AUTH_AGENT_NOT_MANAGED" && error.status === 403,
  );
});

test("managed Agent lookup is owner-scoped and returns public identity fields only", async () => {
  let endpoint;
  const store = createSupabaseDeviceAuthorizationStore({
    url: "https://project.supabase.co",
    serviceRoleKey: "sb_secret_test",
    fetchImpl: async (url) => {
      endpoint = new URL(url);
      return Response.json([{
        actor_id: "actor-agent",
        actor_type: "agent",
        model_name: "self_declared:model",
        runtime: null,
        scope: "draft",
        public_key_fingerprint: null,
        owner_actor_id: "must-not-leak",
      }]);
    },
  });
  assert.deepEqual(await store.listManagedAgents("actor-human"), [{
    actorId: "actor-agent",
    actorType: "agent",
    modelName: "self_declared:model",
    runtime: null,
    scope: "draft",
    publicKeyFingerprint: null,
  }]);
  assert.equal(endpoint.searchParams.get("owner_actor_id"), "eq.actor-human");
  assert.equal(endpoint.searchParams.get("actor_type"), "eq.agent");
});
