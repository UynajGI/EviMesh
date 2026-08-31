import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/index.mjs";
import { createSupabaseReadRepository } from "../src/supabase-read-repository.mjs";
import {
  INTERACTION_KINDS,
  normalizeKind,
  normalizeObjectRef,
  recordInteraction,
  getMyRecommendations,
} from "../src/interaction-query.mjs";

const ACTOR_PUBLIC_SELECT = "actor_id,actor_type,identity_strength,model_name,runtime,scope,public_key_fingerprint,owner_actor_id,created_at,updated_at";
const CLAIMS = { sub: "auth-user-1", aud: "authenticated" };

function appOver(repository, { claims = CLAIMS } = {}) {
  return createApp({
    repository,
    authenticate: async () => claims,
  });
}

function trackingRepository(overrides = {}) {
  const calls = [];
  const base = {
    findIdentity: async (provider, subject) => {
      calls.push({ method: "findIdentity", provider, subject });
      return { actorId: "actor-1", provider, subject };
    },
    getInteractionTarget: async (objectType, objectId) => {
      calls.push({ method: "getInteractionTarget", objectType, objectId });
      return { questionId: objectId };
    },
    recordInteraction: async (input) => { calls.push({ method: "recordInteraction", input }); return { recorded: true }; },
    removeInteraction: async (input) => { calls.push({ method: "removeInteraction", input }); return { removed: true }; },
    listInteractionsForActor: async (input) => { calls.push({ method: "listInteractionsForActor", input }); return []; },
    listRecommendationsForActor: async (input) => { calls.push({ method: "listRecommendationsForActor", input }); return []; },
    provisionSelfActor: async (input) => { calls.push({ method: "provisionSelfActor", input }); return { actor: { actorId: "actor-1", authSubject: "must-not-leak" }, created: true }; },
    ...overrides,
  };
  return { repository: base, calls };
}

test("kind normalization accepts known kinds and rejects everything else", () => {
  for (const kind of INTERACTION_KINDS) assert.equal(normalizeKind(kind), kind);
  assert.throws(() => normalizeKind("like"), /kind must be one of/);
  assert.throws(() => normalizeKind(null), /kind must be one of/);
});

test("object references are whitelisted and trimmed", () => {
  assert.deepEqual(normalizeObjectRef("question", " q1 "), { objectType: "question", objectId: "q1" });
  assert.throws(() => normalizeObjectRef("actor", "a1"), /object type must be one of/);
  assert.throws(() => normalizeObjectRef("question", ""), /object id/);
  assert.throws(() => normalizeObjectRef("question", "x".repeat(257)), /object id/);
});

test("PUT /interactions records a signal for the authenticated actor", async () => {
  const { repository, calls } = trackingRepository();
  const response = await appOver(repository).fetch(new Request("https://api.example.test/interactions/question/q-1", {
    method: "PUT",
    headers: { authorization: "Bearer session-token", "content-type": "application/json" },
    body: JSON.stringify({ kind: "helpful" }),
  }), {});
  assert.equal(response.status, 200, await response.clone().text());
  assert.deepEqual(await response.json(), { objectType: "question", objectId: "q-1", kind: "helpful", recorded: true });
  const write = calls.find((entry) => entry.method === "recordInteraction");
  assert.equal(write.input.actorId, "actor-1");
  assert.equal(write.input.accessToken, "session-token");
  assert.equal(write.input.kind, "helpful");
});

test("PUT /interactions validates kind, object type, and target existence", async () => {
  const missing = trackingRepository();
  const badKind = await appOver(missing.repository).fetch(new Request("https://api.example.test/interactions/question/q-1", {
    method: "PUT", headers: { authorization: "Bearer t", "content-type": "application/json" }, body: JSON.stringify({ kind: "like" }),
  }), {});
  assert.equal(badKind.status, 400);
  assert.equal((await badKind.json()).code, "INTERACTION_KIND_INVALID");

  const badType = await appOver(missing.repository).fetch(new Request("https://api.example.test/interactions/actor/a-1", {
    method: "PUT", headers: { authorization: "Bearer t", "content-type": "application/json" }, body: JSON.stringify({ kind: "helpful" }),
  }), {});
  assert.equal(badType.status, 400);
  assert.equal((await badType.json()).code, "INTERACTION_OBJECT_TYPE_INVALID");

  const { repository, calls } = trackingRepository({ getInteractionTarget: async () => null });
  const gone = await appOver(repository).fetch(new Request("https://api.example.test/interactions/claim/c-404", {
    method: "PUT", headers: { authorization: "Bearer t", "content-type": "application/json" }, body: JSON.stringify({ kind: "favorite" }),
  }), {});
  assert.equal(gone.status, 404);
  assert.equal((await gone.json()).code, "INTERACTION_TARGET_NOT_FOUND");
});

test("DELETE /interactions removes one signal kind", async () => {
  const { repository, calls } = trackingRepository();
  const response = await appOver(repository).fetch(new Request("https://api.example.test/interactions/question/q-1?kind=favorite", {
    method: "DELETE", headers: { authorization: "Bearer session-token" },
  }), {});
  assert.equal(response.status, 200);
  const write = calls.find((entry) => entry.method === "removeInteraction");
  assert.equal(write.input.kind, "favorite");
});

test("GET /interactions/mine narrows by comma-separated kinds", async () => {
  const { repository, calls } = trackingRepository();
  const response = await appOver(repository).fetch(new Request("https://api.example.test/interactions/mine?kind=helpful,favorite", {
    headers: { authorization: "Bearer session-token" },
  }), {});
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).interactions, []);
  const read = calls.find((entry) => entry.method === "listInteractionsForActor");
  assert.deepEqual(read.input.kinds, ["helpful", "favorite"]);
});

test("GET /recommendations returns navigation refs without scores", async () => {
  const { repository } = trackingRepository({
    listRecommendationsForActor: async () => [
      { objectType: "question", objectId: "q-9", rank: 1, reason: "because you marked useful: …", generatedAt: "2026-08-21T00:00:00Z", model: "implicit-itemitem" },
      { objectType: "claim", objectId: "c-7", rank: 2, reason: null, generatedAt: "2026-08-21T00:00:00Z", model: "implicit-itemitem" },
    ],
  });
  const response = await appOver(repository).fetch(new Request("https://api.example.test/recommendations", {
    headers: { authorization: "Bearer session-token" },
  }), {});
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.reason, "from_your_activity");
  assert.equal(body.items.length, 2);
  const serialized = JSON.stringify(body);
  assert.ok(!serialized.includes("score"), "recommendation responses must not carry scores");
  for (const item of body.items) {
    assert.deepEqual(Object.keys(item).sort(), ["generatedAt", "objectId", "objectType", "reason"]);
  }
});

test("GET /recommendations degrades to an empty labeled state without signal", async () => {
  const result = await getMyRecommendations({
    repository: { listRecommendationsForActor: async () => [] },
    accessToken: "t",
    actorId: "actor-1",
  });
  assert.deepEqual(result.items, []);
  assert.equal(result.reason, "no_recommendations_yet");
});

test("POST /actors/self provisions the identity binding idempotently", async () => {
  const { repository, calls } = trackingRepository();
  const first = await appOver(repository).fetch(new Request("https://api.example.test/actors/self", {
    method: "POST", headers: { authorization: "Bearer session-token" },
  }), {});
  assert.equal(first.status, 201);
  const firstBody = await first.json();
  assert.equal(firstBody.actor.actorId, "actor-1");
  assert.equal(Object.hasOwn(firstBody.actor, "authSubject"), false);
  const provision = calls.find((entry) => entry.method === "provisionSelfActor");
  assert.equal(provision.input.subject, "auth-user-1");
  assert.equal(provision.input.accessToken, "session-token");

  const existing = trackingRepository({ provisionSelfActor: async () => ({ actor: { actorId: "actor-1" }, created: false }) });
  const second = await appOver(existing.repository).fetch(new Request("https://api.example.test/actors/self", {
    method: "POST", headers: { authorization: "Bearer session-token" },
  }), {});
  assert.equal(second.status, 201);
  assert.equal((await second.json()).created, false);
});

test("interaction routes require Bearer credentials", async () => {
  const { repository } = trackingRepository();
  const response = await appOver(repository).fetch(new Request("https://api.example.test/interactions/question/q-1", {
    method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "helpful" }),
  }), {});
  assert.equal(response.status, 401);
});

/* ---- hosted repository write channel (token-forwarding PostgREST) ---- */

function hostedRepository(responses) {
  const requests = [];
  const repository = createSupabaseReadRepository({
    url: "https://project.supabase.co",
    publishableKey: "publishable-key",
    fetchImpl: async (url, options = {}) => {
      requests.push({ url: new URL(url), options });
      const path = new URL(url).pathname;
      const method = options.method ?? "GET";
      const key = `${method} ${path}`;
      const responder = responses[key] ?? responses["*"];
      if (!responder) return Response.json([]);
      if (responder instanceof Response) return responder;
      return typeof responder === "function" ? responder({ url: new URL(url), options, requests }) : Response.json(responder);
    },
  });
  return { repository, requests };
}

test("hosted recordInteraction forwards the caller token with a duplicate-safe insert", async () => {
  const { repository, requests } = hostedRepository({ "POST /rest/v1/engagement_interactions": [] });
  await repository.recordInteraction({ accessToken: "session-token", actorId: "actor-1", objectType: "question", objectId: "q-1", kind: "helpful" });
  const call = requests.at(-1);
  assert.equal(call.url.pathname, "/rest/v1/engagement_interactions");
  assert.equal(call.options.headers.authorization, "Bearer session-token");
  assert.equal(call.options.headers.apikey, "publishable-key");
  assert.equal(call.options.headers.prefer, "resolution=ignore-duplicates");
  const body = JSON.parse(call.options.body);
  assert.equal(body[0].actor_id, "actor-1");
  assert.equal(body[0].kind, "helpful");
  assert.match(body[0].interaction_id, /^itx_/);
});

test("hosted listRecommendationsForActor reads the cache ranked and bounded", async () => {
  const { repository, requests } = hostedRepository({
    "GET /rest/v1/recommendation_cache": [{ actor_id: "actor-1", object_type: "question", object_id: "q-2", rank: 1, reason: null }],
  });
  const rows = await repository.listRecommendationsForActor({ accessToken: "t", actorId: "actor-1", limit: 99 });
  assert.equal(rows[0].objectId, "q-2");
  const params = requests.at(-1).url.searchParams;
  assert.equal(params.get("actor_id"), "eq.actor-1");
  assert.equal(params.get("order"), "rank.asc");
  assert.equal(params.get("limit"), "24");
});

test("hosted actor reads use the public directory view with an explicit safe projection", async () => {
  const { repository, requests } = hostedRepository({
    "GET /rest/v1/actor_directory": [{ actor_id: "actor-1", actor_type: "human", identity_strength: "self_declared" }],
  });
  await repository.listActors();
  await repository.getActor("actor-1");
  assert.equal(requests.length, 2);
  for (const request of requests) {
    assert.equal(request.url.pathname, "/rest/v1/actor_directory");
    assert.equal(request.url.searchParams.get("select"), ACTOR_PUBLIC_SELECT);
    assert.notEqual(request.url.searchParams.get("select"), "*");
    assert.equal(request.url.searchParams.get("select").includes("auth_subject"), false);
  }
  assert.equal(requests[1].url.searchParams.get("actor_id"), "eq.actor-1");
});

test("hosted provisionSelfActor creates actor + identity and survives races", async () => {
  let identitiesQueried = 0;
  const { repository, requests } = hostedRepository({
    "GET /rest/v1/identities": ({ url }) => {
      identitiesQueried += 1;
      return identitiesQueried === 1
        ? Response.json([])
        : Response.json([{ actor_id: "actor-existing", provider: "supabase", subject: url.searchParams.get("subject").slice(3) }]);
    },
    "GET /rest/v1/actor_directory": ({ url }) => Response.json([{
      actor_id: url.searchParams.get("actor_id").slice(3),
      actor_type: "human",
      identity_strength: "self_declared",
      created_at: "2026-08-21T00:00:00Z",
    }]),
    "POST /rest/v1/actors": new Response(null, { status: 201 }),
    "POST /rest/v1/identities": ({ requests: inner }) => {
      const body = JSON.parse(inner.at(-1).options.body);
      return Response.json(body, { status: 201 });
    },
  });
  const created = await repository.provisionSelfActor({ accessToken: "t", subject: "auth-user-1", email: "u@example.test" });
  assert.equal(created.created, true);
  assert.match(created.actor.actorId, /^actor_/);
  assert.equal(Object.hasOwn(created.actor, "authSubject"), false);
  const actorInsert = requests.find((request) => request.url.pathname === "/rest/v1/actors" && request.options.method === "POST");
  assert.equal(actorInsert.options.headers.prefer, "return=minimal");
  assert.equal(JSON.parse(actorInsert.options.body)[0].auth_subject, "auth-user-1");
  const createdActorRead = requests.find((request) => request.url.pathname === "/rest/v1/actor_directory");
  assert.equal(createdActorRead.url.searchParams.get("select"), ACTOR_PUBLIC_SELECT);

  // Race path: the identity insert conflicts, the existing binding wins.
  let actorsInserted = 0;
  const raced = hostedRepository({
    "GET /rest/v1/identities": ({ url, requests: inner }) => {
      const afterInsert = inner.some((call) => call.url.pathname === "/rest/v1/actors" && (call.options.method ?? "GET") === "POST");
      return afterInsert
        ? Response.json([{ actor_id: "actor-existing", provider: "supabase", subject: "auth-user-1" }], { status: 200 })
        : Response.json([], { status: 200 });
    },
    "GET /rest/v1/actor_directory": [{ actor_id: "actor-existing", actor_type: "human" }],
    "POST /rest/v1/actors": ({ requests: inner }) => {
      actorsInserted += 1;
      return new Response(null, { status: 201 });
    },
    "POST /rest/v1/identities": Response.json({ code: "23505" }, { status: 409 }),
  });
  const resolved = await raced.repository.provisionSelfActor({ accessToken: "t", subject: "auth-user-1" });
  assert.equal(resolved.created, false);
  assert.equal(resolved.actor.actorId, "actor-existing");
  assert.equal(actorsInserted, 1);
});

test("hosted findIdentity uses the caller's token scope", async () => {
  const { repository, requests } = hostedRepository({
    "GET /rest/v1/identities": [{ actor_id: "actor-1", provider: "supabase", subject: "auth-user-1" }],
  });
  const identity = await repository.findIdentity("supabase", "auth-user-1", { accessToken: "session-token" });
  assert.equal(identity.actorId, "actor-1");
  assert.equal(requests.at(-1).options.headers.authorization, "Bearer session-token");
});
