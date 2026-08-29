import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createSupabaseReadRepository } from "../src/supabase-read-repository.mjs";
import { listResearchEvents } from "../src/research-event-query.mjs";

const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");

/* Method names the query modules require from a repository, collected
 * mechanically from their guards, typeof checks, and repository.* calls.
 * This is the contract the hosted (production) read model must satisfy —
 * the gap that left every detail/events endpoint erroring on production
 * with "repository X is required". */
async function requiredRepositoryMethods() {
  const files = (await readdir(srcDir)).filter((file) => /-query\.mjs$|^research-event-(query|export|proof)\.mjs$|^contribution-query\.mjs$/.test(file));
  const names = new Set();
  for (const file of files) {
    const source = await readFile(path.join(srcDir, file), "utf8");
    for (const match of source.matchAll(/repository (\w+) is required/g)) names.add(match[1]);
    for (const match of source.matchAll(/typeof repository\.(\w+) !== ["']function["']/g)) names.add(match[1]);
    for (const match of source.matchAll(/repository\.(\w+)\(/g)) names.add(match[1]);
  }
  names.delete("withTransaction"); // write path: guarded by factory configuration, 503 by design
  return names;
}

function hostedRepository() {
  return createSupabaseReadRepository({ url: "https://example.supabase.co", publishableKey: "anon", fetchImpl: async () => new Response("[]") });
}

test("the hosted read repository implements every method the query modules require", async () => {
  const required = await requiredRepositoryMethods();
  assert.ok(required.size > 40, `expected a broad surface, found ${required.size}`);
  const repository = hostedRepository();
  const missing = [...required].filter((name) => typeof repository[name] !== "function");
  assert.deepEqual(missing, [], `hosted repository is missing read methods (production would 500): ${missing.join(", ")}`);
});

test("repository.* extraction stays in sync with the query modules", async () => {
  // Guards evolve; the extractor must keep finding methods after refactors.
  const required = await requiredRepositoryMethods();
  for (const must of ["listResearchEvents", "getQuestion", "getVerificationReceipt", "listFrontierMembers", "getObjectRevision"]) {
    assert.ok(required.has(must), `extractor no longer sees ${must} — update the pattern if guards changed`);
  }
});

test("api token reads never select the secret hash", async () => {
  const repository = hostedRepository();
  assert.deepEqual(await repository.listApiTokensByActor("actor-1"), []);
});

test("active signing-key lookup is available on the hosted repository", async () => {
  let seen;
  const repository = createSupabaseReadRepository({
    url: "https://example.supabase.co",
    publishableKey: "anon",
    fetchImpl: async (endpoint) => {
      seen = new URL(endpoint);
      return Response.json([{ key_id: "key-1", actor_id: "agent-1", algorithm: "Ed25519", public_key: "public-key", revoked_at: null, deleted_at: null }]);
    },
  });
  assert.deepEqual(await repository.findActiveSigningKey("agent-1"), {
    keyId: "key-1", actorId: "agent-1", algorithm: "Ed25519", publicKey: "public-key", revokedAt: null, deletedAt: null,
  });
  assert.equal(seen.pathname, "/rest/v1/signing_keys");
  assert.equal(seen.searchParams.get("actor_id"), "eq.agent-1");
  assert.equal(seen.searchParams.get("revoked_at"), "is.null");
  assert.equal(seen.searchParams.get("deleted_at"), "is.null");
  assert.equal(seen.searchParams.get("limit"), "1");
});

test("immutable signer event hydration uses bounded batch filters", async () => {
  const seen = [];
  const repository = createSupabaseReadRepository({
    url: "https://example.supabase.co",
    publishableKey: "anon",
    fetchImpl: async (endpoint) => {
      const url = new URL(endpoint);
      seen.push(url);
      return Response.json([{ event_id: "event-1", event_type: "claim.created", payload: { signer_actor_id: "human-1" } }]);
    },
  });
  const eventIds = Array.from({ length: 51 }, (_, index) => `event-${index + 1}`);
  const events = await repository.listResearchEventsByIds(eventIds);
  assert.equal(events[0].eventId, "event-1");
  assert.equal(seen[0].searchParams.get("event_id").split(",").length, 50);
  assert.equal(seen[1].searchParams.get("event_id"), 'in.("event-51")');
  assert.equal(seen.length, 2);
});

test("events filter by payload ids and actors, ordered ascending", async () => {
  const rows = [
    { event_id: "e2", event_type: "claim.created", payload: { object_type: "claim", claim_id: "claim-9", actor_id: "a1" }, created_at: "2026-08-02T00:00:00Z" },
    { event_id: "e1", event_type: "question.created", payload: { entity_type: "question", question_id: "q1", actor_id: "a2" }, created_at: "2026-08-01T00:00:00Z" },
    { event_id: "e3", event_type: "run.created", payload: { entity_type: "run", run_id: "run-1", publisher_actor_id: "human-1", producer_actor_id: "agent,(one)\"x" }, created_at: "2026-08-03T00:00:00Z" },
    { event_id: "e4", event_type: "claim.created", payload: { entity_type: "claim", claim_id: "claim-agent", actor_id: "human-1", drafted_by_actor_id: "agent-drafter" }, created_at: "2026-08-04T00:00:00Z" },
    { event_id: "e5", event_type: "evidence.claim_linked", payload: { entity_type: "evidence", evidence_id: "ev-1", claim_id: "claim-9", actor_id: "a1" }, created_at: "2026-08-02T12:00:00Z" },
    { event_id: "e6", event_type: "verification.submitted", payload: { entity_type: "verification_receipt", receipt_id: "receipt-1", claim_id: "claim-9", actor_id: "a2" }, created_at: "2026-08-05T00:00:00Z" },
    { event_id: "e7", event_type: "claim.state_changed", payload: { entity_type: "claim", claim_id: "claim-child", actor_id: "a2", projection: { state: { claim: { claimId: "claim-child", questionId: "q1", state: "refuted" } } } }, created_at: "2026-08-06T00:00:00Z" },
  ];
  const seen = [];
  const repository = createSupabaseReadRepository({
    url: "https://example.supabase.co",
    publishableKey: "anon",
    fetchImpl: async (endpoint) => {
      seen.push(String(endpoint));
      if (new URL(endpoint).pathname.endsWith("/claims")) {
        return Response.json([{ claim_id: "claim-9" }, { claim_id: "claim-child" }]);
      }
      return new Response(JSON.stringify(rows), { headers: { "content-type": "application/json" } });
    },
  });
  const filtered = await repository.listResearchEvents({ objectType: "claim", objectId: "claim-9", actorId: "a1" });
  assert.deepEqual(filtered.map((row) => row.eventId), ["e2", "e5"]);
  const questionScoped = await repository.listResearchEvents({ objectType: "question", objectId: "q1" });
  assert.deepEqual(questionScoped.map((row) => row.eventId), ["e2", "e1", "e5", "e6", "e7"]);
  const producerScoped = await repository.listResearchEvents({ actorId: "agent,(one)\"x" });
  assert.deepEqual(producerScoped.map((row) => row.eventId), ["e3"]);
  const drafterScoped = await repository.listResearchEvents({ actorId: "agent-drafter" });
  assert.deepEqual(drafterScoped.map((row) => row.eventId), ["e4"]);
  const verificationScoped = await repository.listResearchEvents({ objectType: "verification", objectId: "receipt-1" });
  assert.deepEqual(verificationScoped.map((row) => row.eventId), ["e6"]);
  const eventRequests = seen.filter((endpoint) => new URL(endpoint).pathname.endsWith("/research_events"));
  assert.ok(eventRequests[0].includes("order=created_at.asc"), "events must be read ascending for cursor pagination");
  assert.match(new URL(eventRequests[0]).searchParams.get("and"), /payload->>actor_id\.eq\."a1"/);
  assert.match(new URL(eventRequests[0]).searchParams.get("and"), /payload->>claim_id\.eq\."claim-9"/);
  assert.match(new URL(eventRequests[0]).searchParams.get("and"), /payload->>entity_type\.eq\."claim"/);
  assert.match(new URL(eventRequests[0]).searchParams.get("and"), /payload->>producer_actor_id\.eq\."a1"/);
  assert.match(new URL(eventRequests[1]).searchParams.get("or"), /payload->projection->state->claim->>questionId\.eq\."q1"/);
  assert.match(new URL(eventRequests[1]).searchParams.get("or"), /payload->>claim_id\.in\.\("claim-9","claim-child"\)/);
  assert.match(new URL(eventRequests[2]).searchParams.get("or"), /payload->>producer_actor_id\.eq\."agent,\(one\)\\"x"/);
  assert.match(eventRequests[2], /%2C/);
});

test("fails closed when a Question event scope exceeds the hosted Claim membership limit", async () => {
  const repository = createSupabaseReadRepository({
    url: "https://example.supabase.co",
    publishableKey: "anon",
    fetchImpl: async (endpoint) => {
      const url = new URL(endpoint);
      if (url.pathname.endsWith("/claims")) {
        return Response.json(Array.from({ length: 51 }, (_, index) => ({ claim_id: `claim-${index}` })));
      }
      return assert.fail("ResearchEvents must not be queried for an over-broad Question scope");
    },
  });
  await assert.rejects(
    repository.listResearchEvents({ objectType: "question", objectId: "q1" }),
    (error) => error.code === "SUPABASE_READ_SCOPE_TOO_BROAD" && error.status === 413,
  );
});

test("actor-only event pagination pushes the page size and cursor boundary into PostgREST", async () => {
  const requests = [];
  const responses = [
    [
      { event_id: "e1", payload: { actor_id: "a1" }, created_at: "2026-08-01T00:00:00.000Z" },
      { event_id: "e2", payload: { actor_id: "a1" }, created_at: "2026-08-02T00:00:00.000Z" },
      { event_id: "e3", payload: { actor_id: "a1" }, created_at: "2026-08-03T00:00:00.000Z" },
    ],
    [{ event_id: "e3", payload: { actor_id: "a1" }, created_at: "2026-08-03T00:00:00.000Z" }],
    [{ event_id: "e1", payload: { actor_id: "a1" }, created_at: "2026-08-01T00:00:00.000Z" }],
  ];
  const repository = createSupabaseReadRepository({
    url: "https://example.supabase.co",
    publishableKey: "anon",
    fetchImpl: async (endpoint, options) => {
      requests.push({ endpoint: new URL(endpoint), options });
      return Response.json(responses[requests.length - 1]);
    },
  });

  const first = await listResearchEvents({ repository, actorId: "a1", limit: 2 });
  assert.deepEqual(first.items.map((event) => event.eventId), ["e1", "e2"]);
  assert.ok(first.nextCursor);
  assert.match(requests[0].endpoint.searchParams.get("or"), /payload->>drafted_by_actor_id\.eq\."a1"/);
  assert.match(requests[0].endpoint.searchParams.get("or"), /payload->>producer_actor_id\.eq\."a1"/);
  assert.equal(requests[0].endpoint.searchParams.get("order"), "created_at.asc,event_id.asc");
  assert.equal(requests[0].endpoint.searchParams.get("limit"), "3");
  assert.equal(requests[0].endpoint.searchParams.get("and"), null);
  assert.equal(requests[0].options.headers.Range, "0-2");

  const second = await listResearchEvents({ repository, actorId: "a1", limit: 2, cursor: first.nextCursor });
  assert.deepEqual(second.items.map((event) => event.eventId), ["e3"]);
  assert.equal(
    requests[1].endpoint.searchParams.get("and"),
    '(or(payload->>actor_id.eq."a1",payload->>signer_actor_id.eq."a1",payload->>publisher_actor_id.eq."a1",payload->>drafted_by_actor_id.eq."a1",payload->>producer_actor_id.eq."a1",payload->>run_actor_id.eq."a1"),or(created_at.gt.2026-08-02T00:00:00.000Z,and(created_at.eq.2026-08-02T00:00:00.000Z,event_id.gt.e2)))',
  );
  assert.equal(requests[1].endpoint.searchParams.get("limit"), "3");
  assert.equal(requests[1].options.headers.Range, "0-2");

  const descending = await listResearchEvents({ repository, actorId: "a1", order: "desc", limit: 2, cursor: first.nextCursor });
  assert.deepEqual(descending.items.map((event) => event.eventId), ["e1"]);
  assert.equal(requests[2].endpoint.searchParams.get("order"), "created_at.desc,event_id.desc");
  assert.equal(
    requests[2].endpoint.searchParams.get("and"),
    '(or(payload->>actor_id.eq."a1",payload->>signer_actor_id.eq."a1",payload->>publisher_actor_id.eq."a1",payload->>drafted_by_actor_id.eq."a1",payload->>producer_actor_id.eq."a1",payload->>run_actor_id.eq."a1"),or(created_at.lt.2026-08-02T00:00:00.000Z,and(created_at.eq.2026-08-02T00:00:00.000Z,event_id.lt.e2)))',
  );
});

test("object-scoped event pagination pushes relation-aware ids and time bounds into PostgREST", async () => {
  let request;
  const repository = createSupabaseReadRepository({
    url: "https://example.supabase.co",
    publishableKey: "anon",
    fetchImpl: async (endpoint, options) => {
      request = { endpoint: new URL(endpoint), options };
      return Response.json([
        { event_id: "e3", payload: { entity_type: "evidence", claim_id: "claim-9" }, created_at: "2026-08-03T00:00:00.000Z" },
        { event_id: "e2", payload: { entity_type: "claim", claim_id: "claim-9" }, created_at: "2026-08-02T00:00:00.000Z" },
        { event_id: "e1", payload: { object_type: "claim", object_id: "claim-9" }, created_at: "2026-08-01T00:00:00.000Z" },
      ]);
    },
  });

  const result = await listResearchEvents({
    repository,
    objectType: "claim",
    objectId: "claim-9",
    createdAfter: "2026-08-01T00:00:00Z",
    createdBefore: "2026-08-03T00:00:00Z",
    order: "desc",
    limit: 2,
  });

  assert.deepEqual(result.items.map((event) => event.eventId), ["e3", "e2"]);
  assert.ok(result.nextCursor);
  assert.equal(request.endpoint.searchParams.get("created_at"), "gte.2026-08-01T00:00:00.000Z");
  assert.match(request.endpoint.searchParams.get("and"), /payload->>claim_id\.eq\."claim-9"/);
  assert.match(request.endpoint.searchParams.get("and"), /payload->>source_claim_id\.eq\."claim-9"/);
  assert.match(request.endpoint.searchParams.get("and"), /created_at\.lte\.2026-08-03T00:00:00\.000Z/);
  assert.equal(request.endpoint.searchParams.get("order"), "created_at.desc,event_id.desc");
  assert.equal(request.endpoint.searchParams.get("limit"), "3");
  assert.equal(request.options.headers.Range, "0-2");
});

test("object-scoped event filtering keeps rows whose payload ids are JSON numbers, matching payload->> text semantics", async () => {
  // PostgREST matched these rows via payload->> text comparison; the JS
  // mirror must not drop them for strict-equality type mismatch, or a
  // fetched page silently shortens and cursor pagination ends early.
  const repository = createSupabaseReadRepository({
    url: "https://example.supabase.co",
    publishableKey: "anon",
    fetchImpl: async () => Response.json([
      { event_id: "e2", payload: { entity_type: "claim", claim_id: 123456789 }, created_at: "2026-08-02T00:00:00.000Z" },
      { event_id: "e1", payload: { object_type: "claim", object_id: 123456789 }, created_at: "2026-08-01T00:00:00.000Z" },
    ]),
  });

  const result = await listResearchEvents({ repository, objectType: "claim", objectId: "123456789", order: "desc", limit: 10 });

  assert.deepEqual(result.items.map((event) => event.eventId), ["e2", "e1"]);
});

test("object contribution edges are fetched with a bounded limit", async () => {
  let endpoint;
  const repository = createSupabaseReadRepository({
    url: "https://example.supabase.co",
    publishableKey: "anon",
    fetchImpl: async (url) => {
      endpoint = new URL(url);
      return Response.json([]);
    },
  });

  const edges = await repository.listContributionEdgesForObject({ objectType: "claim", objectId: "claim-9" });

  assert.deepEqual(edges, []);
  assert.equal(endpoint.searchParams.get("object_type"), "eq.claim");
  assert.equal(endpoint.searchParams.get("object_id"), "eq.claim-9");
  assert.equal(endpoint.searchParams.get("limit"), "64");
});

test("latest actor activity uses a server-side JSON filter and one-row descending query", async () => {
  let seen;
  const repository = createSupabaseReadRepository({
    url: "https://example.supabase.co",
    publishableKey: "anon",
    fetchImpl: async (endpoint) => {
      seen = new URL(endpoint);
      return Response.json([{ event_id: "e2", payload: { actor_id: "a1" }, created_at: "2026-08-02T00:00:00Z" }]);
    },
  });
  const event = await repository.getLatestResearchEventForActor("a1");
  assert.equal(event.eventId, "e2");
  assert.match(seen.searchParams.get("or"), /payload->>drafted_by_actor_id\.eq\."a1"/);
  assert.match(seen.searchParams.get("or"), /payload->>producer_actor_id\.eq\."a1"/);
  assert.equal(seen.searchParams.get("order"), "created_at.desc,event_id.desc");
  assert.equal(seen.searchParams.get("limit"), "1");
});

test("evidence listing by claim joins through the link table", async () => {
  const responses = [
    [{ evidence_id: "ev1", claim_id: "c1", relation_type: "supports", created_at: "2026-08-01T00:00:00Z" }],
    [{ evidence_id: "ev1", evidence_type: "experimental", created_at: "2026-08-01T00:00:00Z" }],
  ];
  let call = 0;
  const repository = createSupabaseReadRepository({
    url: "https://example.supabase.co",
    publishableKey: "anon",
    fetchImpl: async () => new Response(JSON.stringify(responses[call++]), { headers: { "content-type": "application/json" } }),
  });
  const rows = await repository.listEvidence({ claimId: "c1" });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].evidenceId, "ev1");
});

test("frontier membership resolves to its snapshots for provenance", async () => {
  const responses = [
    [{ snapshot_id: "s1", claim_id: "c1", claim_revision: 4 }],
    [{ snapshot_id: "s1", project_id: "p1", sequence: 12 }],
  ];
  let call = 0;
  const repository = createSupabaseReadRepository({
    url: "https://example.supabase.co",
    publishableKey: "anon",
    fetchImpl: async () => new Response(JSON.stringify(responses[call++]), { headers: { "content-type": "application/json" } }),
  });
  const snapshots = await repository.listFrontiersForObjectRevision({ objectType: "claim", objectId: "c1", objectRevision: 4 });
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].sequence, 12);
});

test("task tag and type filters resolve through current task revisions", async () => {
  const responses = [
    /* taskRevisions (revision.desc): newest first per task. */
    [
      { task_id: "t1", revision: 2, task_type: "reproduction", tags: ["cpu-only"] },
      { task_id: "t1", revision: 1, task_type: "reproduction", tags: [] },
      { task_id: "t2", revision: 1, task_type: "general", tags: ["under-60-min"] },
    ],
    /* tasks rows. */
    [
      { task_id: "t1", state: "open", question_id: "q1" },
      { task_id: "t2", state: "open", question_id: "q1" },
    ],
  ];
  let call = 0;
  const repository = createSupabaseReadRepository({
    url: "https://example.supabase.co",
    publishableKey: "anon",
    fetchImpl: async () => new Response(JSON.stringify(responses[call++ % responses.length]), { headers: { "content-type": "application/json" } }),
  });
  const tagged = await repository.listTasks({ status: "open", tag: "cpu-only" });
  assert.deepEqual(tagged.map((row) => row.taskId), ["t1"]);
  const typed = await repository.listTasks({ status: "open", type: "general" });
  assert.deepEqual(typed.map((row) => row.taskId), ["t2"]);
});

test("typed repository errors surface with their status, never as opaque 500s", async () => {
  const repository = createSupabaseReadRepository({
    url: "https://example.supabase.co",
    publishableKey: "anon",
    fetchImpl: async () => new Response(JSON.stringify({ message: "boom" }), { status: 502, headers: { "content-type": "application/json" } }),
  });
  await assert.rejects(
    () => repository.listQuestions(),
    (error) => error.status === 503 && error.code === "SUPABASE_READ_UNAVAILABLE",
  );
});
