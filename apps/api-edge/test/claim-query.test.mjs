import test from "node:test";
import assert from "node:assert/strict";
import { getClaim, listClaims } from "../src/claim-query.mjs";

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
    },
    claimId: " claim-1 ",
  });
  assert.equal(result.claim.claimId, "claim-1");
  assert.equal(result.currentRevision.revision, 2);
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
