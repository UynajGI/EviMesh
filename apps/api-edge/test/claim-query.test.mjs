import test from "node:test";
import assert from "node:assert/strict";
import { getClaim, getClaimDownstreamGraph, getClaimRevision, getClaimUpstreamGraph, listClaims } from "../src/claim-query.mjs";

const claims = [
  { claimId: "claim-2", projectId: "project-1", status: "candidate", createdAt: "2026-08-02T00:00:00.000Z" },
  { claimId: "claim-1", projectId: "project-1", status: "hypothesis", createdAt: "2026-08-01T00:00:00.000Z" },
];

test("lists Claims with project/status/tag filters and stable pagination", async () => {
  let received;
  const first = await listClaims({
    repository: { listClaims: async (filters) => { received = filters; return claims; } },
    projectId: " project-1 ", status: "candidate", tag: " cpu-only ", limit: 1,
  });
  assert.deepEqual(received, { projectId: "project-1", status: "candidate", tag: "cpu-only" });
  assert.deepEqual(first.items.map(({ claimId }) => claimId), ["claim-1"]);
  assert.ok(first.nextCursor);
  const second = await listClaims({
    repository: { listClaims: async () => claims }, limit: 1, cursor: first.nextCursor,
  });
  assert.deepEqual(second.items.map(({ claimId }) => claimId), ["claim-2"]);
  assert.equal(second.nextCursor, null);
});

test("rejects an empty Claim filter before querying", async () => {
  let called = false;
  await assert.rejects(
    listClaims({ repository: { listClaims: async () => { called = true; return claims; } }, tag: " " }),
    /claim tag must be a non-empty string or null/,
  );
  assert.equal(called, false);
});

test("returns the current Claim revision and protocol status policy", async () => {
  const result = await getClaim({
    repository: {
      getClaim: async (claimId) => ({ claimId, state: "candidate" }),
      getCurrentClaimRevision: async (claimId) => ({ claimId, revision: 2, statement: "Current" }),
      listContributionEdgesForObject: async () => [{ statementId: "statement-1", edgeType: "produced", objectRevision: 1 }],
      listContributionStatementsByIds: async () => [{ statementId: "statement-1", actorId: "agent-1", role: "originator", description: "Drafted", eventId: "event-1" }],
      listResearchEventsByIds: async () => [{ eventId: "event-1", eventType: "claim.created", payload: { claim_id: "claim-1", drafted_by_actor_id: "agent-1", signer_actor_id: "human-1" } }],
    },
    claimId: " claim-1 ",
  });
  assert.equal(result.claim.claimId, "claim-1");
  assert.equal(result.currentRevision.revision, 2);
  assert.deepEqual(result.originatorContributions, [{
    actorId: "agent-1",
    role: "originator",
    description: "Drafted",
    objectRevision: 1,
    eventId: "event-1",
    draftedByActorId: "agent-1",
    signedBy: "human-1",
  }]);
  assert.deepEqual(result.statusPolicy, { state: "candidate", allowedTransitions: ["under_verification", "contested", "refuted", "superseded", "retracted", "dependency_tainted"] });
});

test("returns typed errors for missing or invalid Claims", async () => {
  await assert.rejects(
    getClaim({ repository: { getClaim: async () => null, getCurrentClaimRevision: async () => null }, claimId: "missing" }),
    (error) => error.code === "CLAIM_NOT_FOUND" && error.status === 404,
  );
  await assert.rejects(
    getClaim({ repository: { getClaim: async () => ({ claimId: "claim-1", state: "invalid" }), getCurrentClaimRevision: async () => ({ revision: 1 }) }, claimId: "claim-1" }),
    (error) => error.code === "CLAIM_STATE_INVALID" && error.status === 500,
  );
});

test("returns the requested immutable Claim revision", async () => {
  const result = await getClaimRevision({
    repository: { getClaimRevision: async (claimId, revision) => ({ claimId, revision, statement: "Historical" }) },
    claimId: " claim-1 ", revision: 1,
  });
  assert.deepEqual(result, { claimId: "claim-1", revision: 1, statement: "Historical" });
});

test("rejects invalid or missing Claim revisions", async () => {
  await assert.rejects(
    getClaimRevision({ repository: { getClaimRevision: async () => null }, claimId: "claim-1", revision: 0 }),
    /claim revision must be a positive integer/,
  );
  await assert.rejects(
    getClaimRevision({ repository: { getClaimRevision: async () => null }, claimId: "claim-1", revision: 4 }),
    (error) => error.code === "CLAIM_REVISION_NOT_FOUND" && error.status === 404,
  );
});

test("returns a bounded upstream Claim graph", async () => {
  let received;
  const result = await getClaimUpstreamGraph({
    repository: { getClaimUpstreamGraph: async (query) => { received = query; return [{ claimId: "claim-0", depth: 1, path: ["claim-1", "claim-0"] }]; } },
    claimId: " claim-1 ", maxDepth: 4,
  });
  assert.deepEqual(received, { claimId: "claim-1", maxDepth: 4 });
  assert.equal(result.rootClaimId, "claim-1");
  assert.equal(result.nodes[0].depth, 1);
  assert.equal(result.truncated, false);
});

test("rejects unbounded upstream graph depths", async () => {
  await assert.rejects(
    getClaimUpstreamGraph({ repository: { getClaimUpstreamGraph: async () => [] }, claimId: "claim-1", maxDepth: 33 }),
    /graph depth must be an integer between 1 and 32/,
  );
});

test("returns downstream nodes with dependency taint markers", async () => {
  const result = await getClaimDownstreamGraph({
    repository: { getClaimDownstreamGraph: async () => ({
      nodes: [
        { claimId: "claim-2", depth: 1, state: "dependency_tainted" },
        { claimId: "claim-3", depth: 2, state: "candidate", dependencyTainted: true },
      ],
      edges: [],
      truncated: true,
    }) },
    claimId: "claim-1", maxDepth: 2,
  });
  assert.equal(result.nodes[0].dependencyTainted, true);
  assert.equal(result.nodes[1].dependencyTainted, true);
  assert.equal(result.truncated, true);
});
