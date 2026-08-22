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

test("events filter by payload ids and actors, ordered ascending", async () => {
  const rows = [
    { event_id: "e2", event_type: "claim.created", payload: { object_type: "claim", claim_id: "claim-9", actor_id: "a1" }, created_at: "2026-08-02T00:00:00Z" },
    { event_id: "e1", event_type: "question.created", payload: { entity_type: "question", question_id: "q1", actor_id: "a2" }, created_at: "2026-08-01T00:00:00Z" },
  ];
  const seen = [];
  const repository = createSupabaseReadRepository({
    url: "https://example.supabase.co",
    publishableKey: "anon",
    fetchImpl: async (endpoint) => {
      seen.push(String(endpoint));
      return new Response(JSON.stringify(rows), { headers: { "content-type": "application/json" } });
    },
  });
  const filtered = await repository.listResearchEvents({ objectType: "claim", objectId: "claim-9", actorId: "a1" });
  assert.deepEqual(filtered.map((row) => row.eventId), ["e2"]);
  const questionScoped = await repository.listResearchEvents({ objectType: "question", objectId: "q1" });
  assert.deepEqual(questionScoped.map((row) => row.eventId), ["e1"]);
  assert.ok(seen[0].includes("order=created_at.asc"), "events must be read ascending for cursor pagination");
  assert.equal(new URL(seen[0]).searchParams.get("payload->>actor_id"), "eq.a1");
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
  assert.equal(requests[0].endpoint.searchParams.get("payload->>actor_id"), "eq.a1");
  assert.equal(requests[0].endpoint.searchParams.get("order"), "created_at.asc,event_id.asc");
  assert.equal(requests[0].endpoint.searchParams.get("limit"), "3");
  assert.equal(requests[0].endpoint.searchParams.get("or"), null);
  assert.equal(requests[0].options.headers.Range, "0-2");

  const second = await listResearchEvents({ repository, actorId: "a1", limit: 2, cursor: first.nextCursor });
  assert.deepEqual(second.items.map((event) => event.eventId), ["e3"]);
  assert.equal(
    requests[1].endpoint.searchParams.get("or"),
    "(created_at.gt.2026-08-02T00:00:00.000Z,and(created_at.eq.2026-08-02T00:00:00.000Z,event_id.gt.e2))",
  );
  assert.equal(requests[1].endpoint.searchParams.get("limit"), "3");
  assert.equal(requests[1].options.headers.Range, "0-2");

  const descending = await listResearchEvents({ repository, actorId: "a1", order: "desc", limit: 2, cursor: first.nextCursor });
  assert.deepEqual(descending.items.map((event) => event.eventId), ["e1"]);
  assert.equal(requests[2].endpoint.searchParams.get("order"), "created_at.desc,event_id.desc");
  assert.equal(
    requests[2].endpoint.searchParams.get("or"),
    "(created_at.lt.2026-08-02T00:00:00.000Z,and(created_at.eq.2026-08-02T00:00:00.000Z,event_id.lt.e2))",
  );
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
  assert.equal(seen.searchParams.get("payload->>actor_id"), "eq.a1");
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
