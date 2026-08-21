import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { createWorker } from "../src/index.mjs";

/*
 * End-to-end interaction tests: the real Worker wiring (Hono routes → real
 * ES256 JWT verification → hosted repository → PostgREST fetch) with only
 * the network replaced by a two-way PostgREST simulator. Unlike
 * interactions.test.mjs (which unit-tests routes with a stub repository and
 * the repository in isolation), nothing between the HTTP edge and the
 * PostgREST request is faked here.
 */

const SUPABASE_URL = "https://project.supabase.co";
const SUBJECT = "auth-user-e2e";
const ACTOR_ID = "actor-e2e-1";

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function startWorker({ identities = {}, interactions = [], recommendations = [], missingQuestions = new Set() } = {}) {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = publicKey.export({ format: "jwk" });
  const env = {
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: "publishable-key",
    SUPABASE_JWKS: JSON.stringify({ keys: [{ ...jwk, alg: "ES256", kid: "test-key-1", use: "sig" }] }),
  };

  const issuedAt = Math.floor(Date.now() / 1000);
  function token(subject = SUBJECT) {
    const header = base64Url(JSON.stringify({ alg: "ES256", typ: "JWT", kid: "test-key-1" }));
    const payload = base64Url(JSON.stringify({
      sub: subject, aud: "authenticated", iss: `${SUPABASE_URL}/auth/v1`, iat: issuedAt, exp: issuedAt + 3600,
    }));
    const signature = base64Url(cryptoSign("SHA256", Buffer.from(`${header}.${payload}`), { key: privateKey, dsaEncoding: "ieee-p1363" }));
    return `${header}.${payload}.${signature}`;
  }

  const calls = [];
  const postgrest = async (url, options = {}) => {
    const target = new URL(url);
    calls.push({ method: options.method ?? "GET", path: target.pathname, params: target.searchParams, options, body: options.body ? JSON.parse(options.body) : null });
    const method = options.method ?? "GET";
    const path = target.pathname;
    /* PostgREST filter params arrive as `eq.value`; strip the operator. */
    const filter = (name) => {
      const value = target.searchParams.get(name);
      return value && value.startsWith("eq.") ? value.slice(3) : value;
    };

    if (method === "GET" && path === "/rest/v1/identities") {
      const subject = filter("subject");
      const bound = identities[subject];
      return Response.json(bound ? [{ identity_id: "id-1", actor_id: bound, provider: "supabase", subject }] : []);
    }
    if (method === "GET" && (path === "/rest/v1/questions" || path === "/rest/v1/claims")) {
      const idColumn = path.endsWith("/questions") ? "question_id" : "claim_id";
      const id = filter(idColumn);
      if (!id || missingQuestions.has(id)) return Response.json([]);
      return Response.json([{ [idColumn]: id, state: "open", deleted_at: null, created_at: "2026-08-21T00:00:00Z" }]);
    }
    if (method === "GET" && path === "/rest/v1/engagement_interactions") return Response.json(interactions);
    if (method === "GET" && path === "/rest/v1/recommendation_cache") return Response.json(recommendations);
    if (method === "POST" && path === "/rest/v1/engagement_interactions") return Response.json([], { status: 201 });
    if (method === "DELETE") return Response.json([]);
    if (method === "POST" && (path === "/rest/v1/actors" || path === "/rest/v1/identities")) {
      const body = JSON.parse(options.body);
      return Response.json(body, { status: 201 });
    }
    return Response.json({ message: `unexpected PostgREST call ${method} ${path}` }, { status: 500 });
  };

  const worker = createWorker({ fetchImpl: postgrest });
  const fetchApi = (path, { headers = {}, method = "GET", body } = {}) => worker.fetch(
    new Request(`https://api.example.test${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }),
    env,
  );
  return { fetchApi, calls, token };
}

test("PUT /interactions flows from a signed JWT to a PostgREST insert", async () => {
  const harness = startWorker({ identities: { [SUBJECT]: ACTOR_ID } });
  const session = harness.token();
  const response = await harness.fetchApi("/interactions/question/q-1", {
    method: "PUT",
    headers: { authorization: `Bearer ${session}`, "content-type": "application/json" },
    body: { kind: "helpful" },
  });
  assert.equal(response.status, 200, await response.clone().text());
  assert.deepEqual(await response.json(), { objectType: "question", objectId: "q-1", kind: "helpful", recorded: true });

  const insert = harness.calls.find((call) => call.method === "POST" && call.path === "/rest/v1/engagement_interactions");
  assert.ok(insert, "the write reached PostgREST");
  assert.equal(insert.options.headers.authorization, `Bearer ${session}`, "the caller's own JWT is forwarded");
  assert.equal(insert.options.headers.apikey, "publishable-key");
  assert.equal(insert.options.headers.prefer, "resolution=ignore-duplicates");
  assert.equal(insert.body[0].actor_id, ACTOR_ID);
  assert.equal(insert.body[0].kind, "helpful");
  assert.match(insert.body[0].interaction_id, /^itx_/);
});

test("PUT /interactions rejects unknown targets with 404 before writing", async () => {
  const harness = startWorker({ identities: { [SUBJECT]: ACTOR_ID }, missingQuestions: new Set(["q-gone"]) });
  const response = await harness.fetchApi("/interactions/question/q-gone", {
    method: "PUT",
    headers: { authorization: `Bearer ${harness.token()}`, "content-type": "application/json" },
    body: { kind: "favorite" },
  });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).code, "INTERACTION_TARGET_NOT_FOUND");
  assert.ok(!harness.calls.some((call) => call.path === "/rest/v1/engagement_interactions" && call.method === "POST"));
});

test("interaction routes reject unsigned and unprovisioned callers", async () => {
  const anonymous = startWorker({ identities: { [SUBJECT]: ACTOR_ID } });
  const noToken = await anonymous.fetchApi("/interactions/question/q-1", {
    method: "PUT", headers: { "content-type": "application/json" }, body: { kind: "helpful" },
  });
  assert.equal(noToken.status, 401);

  const unprovisioned = startWorker({ identities: {} });
  const response = await unprovisioned.fetchApi("/interactions/question/q-1", {
    method: "PUT",
    headers: { authorization: `Bearer ${unprovisioned.token()}`, "content-type": "application/json" },
    body: { kind: "helpful" },
  });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "ACTOR_IDENTITY_NOT_FOUND");
});

test("POST /actors/self provisions the actor and the pinned identity end to end", async () => {
  const harness = startWorker({ identities: {} });
  const response = await harness.fetchApi("/actors/self", {
    method: "POST",
    headers: { authorization: `Bearer ${harness.token()}` },
  });
  assert.equal(response.status, 201, await response.clone().text());
  const body = await response.json();
  assert.equal(body.created, true);
  assert.match(body.actor.actorId, /^actor_/);
  assert.equal(body.actor.authSubject, SUBJECT);

  const actorInsert = harness.calls.find((call) => call.method === "POST" && call.path === "/rest/v1/actors");
  assert.equal(actorInsert.body[0].auth_subject, SUBJECT);
  assert.equal(actorInsert.body[0].identity_strength, "self_declared");
  const identityInsert = harness.calls.find((call) => call.method === "POST" && call.path === "/rest/v1/identities");
  assert.equal(identityInsert.body[0].provider, "supabase");
  assert.equal(identityInsert.body[0].subject, SUBJECT);
  assert.equal(identityInsert.body[0].actor_id, body.actor.actorId);
});

test("GET /recommendations maps cache rows without leaking scores", async () => {
  const harness = startWorker({
    identities: { [SUBJECT]: ACTOR_ID },
    recommendations: [
      { actor_id: ACTOR_ID, object_type: "claim", object_id: "c-7", rank: 1, reason: "near your item: X", generated_at: "2026-08-21T04:23:00Z", model: "implicit-itemitem" },
    ],
  });
  const session = harness.token();
  const response = await harness.fetchApi("/recommendations", { headers: { authorization: `Bearer ${session}` } });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.reason, "from_your_activity");
  assert.equal(body.items[0].objectId, "c-7");
  assert.equal(body.items[0].reason, "near your item: X");
  assert.ok(!JSON.stringify(body).includes("score"), "no score may cross the API boundary");
  const read = harness.calls.find((call) => call.path === "/rest/v1/recommendation_cache");
  assert.equal(read.options.headers.authorization, `Bearer ${session}`);
  assert.equal(read.params.get("actor_id"), `eq.${ACTOR_ID}`);
  assert.equal(read.params.get("order"), "rank.asc");
});

test("GET /interactions/mine and DELETE /interactions reach PostgREST with their filters", async () => {
  const harness = startWorker({ identities: { [SUBJECT]: ACTOR_ID } });
  const mine = await harness.fetchApi("/interactions/mine?kind=helpful,favorite", { headers: { authorization: `Bearer ${harness.token()}` } });
  assert.equal(mine.status, 200);
  assert.deepEqual((await mine.json()).interactions, []);
  const listRead = harness.calls.find((call) => call.method === "GET" && call.path === "/rest/v1/engagement_interactions");
  assert.equal(listRead.params.get("kind"), "in.(helpful,favorite)");
  assert.equal(listRead.params.get("actor_id"), `eq.${ACTOR_ID}`);

  const removed = await harness.fetchApi("/interactions/question/q-1?kind=watch", {
    method: "DELETE",
    headers: { authorization: `Bearer ${harness.token()}` },
  });
  assert.equal(removed.status, 200);
  assert.deepEqual(await removed.json(), { objectType: "question", objectId: "q-1", kind: "watch", recorded: false });
  const deleteCall = harness.calls.find((call) => call.method === "DELETE");
  assert.equal(deleteCall.path, "/rest/v1/engagement_interactions");
  assert.equal(deleteCall.params.get("kind"), "eq.watch");
  assert.equal(deleteCall.params.get("object_id"), "eq.q-1");
});

test("invalid kinds and object types fail validation before any upstream write", async () => {
  const harness = startWorker({ identities: { [SUBJECT]: ACTOR_ID } });
  for (const [url, body] of [
    ["/interactions/question/q-1", { kind: "like" }],
    ["/interactions/actor/a-1", { kind: "helpful" }],
  ]) {
    const response = await harness.fetchApi(url, {
      method: "PUT",
      headers: { authorization: `Bearer ${harness.token()}`, "content-type": "application/json" },
      body,
    });
    assert.equal(response.status, 400);
  }
  assert.ok(!harness.calls.some((call) => call.method === "POST" && call.path === "/rest/v1/engagement_interactions"));
});
