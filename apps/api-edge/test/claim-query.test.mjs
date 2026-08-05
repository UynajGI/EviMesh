import test from "node:test";
import assert from "node:assert/strict";
import { listClaims } from "../src/claim-query.mjs";

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
