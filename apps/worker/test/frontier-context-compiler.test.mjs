import assert from "node:assert/strict";
import test from "node:test";
import { FrontierContextCompileError, compileFrontierContext, compileFrontierContextJob } from "../src/frontier-context-compiler.mjs";

const taskRevision = {
  taskId: "task-1", revision: 2, title: "Bounded task", description: "Use the fixed frontier.",
  inputs: [{ artifact: "input-1" }], outputs: { result: "answer" }, acceptance: { tests: ["unit"] },
};
const snapshot = { snapshotId: "frontier-7", projectId: "project-1", sequence: 7, projectRevision: 3, checkpoint: { root: "abc" }, createdAt: "ignored" };
function member(claimId, claimRevision, extra = {}) {
  return {
    snapshotId: "frontier-7", claimId, claimRevision, membershipType: "supporting",
    claimRevisionData: { claimId, revision: claimRevision, state: "accepted", statement: `${claimId} statement`, scope: { project: "project-1" }, assumptions: [], falsification: { method: "test" }, traceEvents: ["must-not-leak"] },
    ...extra,
  };
}

test("Frontier compiler emits only fixed members and pinned dependencies", () => {
  const bundle = compileFrontierContext({
    taskRevision,
    frontierSnapshot: snapshot,
    frontierMembers: [member("claim-b", 1), member("claim-a", 2)],
    dependencies: [{ type: "depends_on", sourceClaimId: "claim-b", sourceRevision: 1, targetClaimId: "claim-a", targetRevision: 2 }],
  });
  assert.equal(bundle.mode, "frontier");
  assert.deepEqual(bundle.frontier.members.map(({ claimId, revision }) => ({ claimId, revision })), [{ claimId: "claim-a", revision: 2 }, { claimId: "claim-b", revision: 1 }]);
  assert.deepEqual(bundle.dependencies, [{ type: "depends_on", source: { claimId: "claim-b", revision: 1 }, target: { claimId: "claim-a", revision: 2 } }]);
  assert.equal(JSON.stringify(bundle).includes("traceEvents"), false);
  assert.equal(JSON.stringify(bundle).includes("createdAt"), false);
});

test("Frontier compiler rejects dependencies that introduce an unpinned Claim revision", () => {
  assert.throws(() => compileFrontierContext({
    taskRevision, frontierSnapshot: snapshot, frontierMembers: [member("claim-a", 2)],
    dependencies: [{ type: "depends_on", sourceClaimId: "claim-a", sourceRevision: 2, targetClaimId: "claim-x", targetRevision: 1 }],
  }), (error) => error instanceof FrontierContextCompileError && error.code === "FRONTIER_DEPENDENCY_NOT_PINNED");
});

test("Worker job fetches the exact revisions named by the Frontier snapshot", async () => {
  const calls = [];
  const repository = {
    getTaskRevision: async (...args) => { calls.push(["task", ...args]); return taskRevision; },
    getFrontierSnapshot: async (...args) => { calls.push(["snapshot", ...args]); return snapshot; },
    listFrontierMembers: async (...args) => { calls.push(["members", ...args]); return [member("claim-a", 2)]; },
    getClaimRevision: async (...args) => { calls.push(["claim", ...args]); return member("claim-a", 2).claimRevisionData; },
    listFrontierDependencies: async (args) => { calls.push(["dependencies", args]); return []; },
  };
  const bundle = await compileFrontierContextJob({ repository, taskId: "task-1", taskRevision: 2, frontierSnapshotId: "frontier-7" });
  assert.equal(bundle.frontier.members[0].revision, 2);
  assert.deepEqual(calls.slice(0, 4), [["task", "task-1", 2], ["snapshot", "frontier-7"], ["members", "frontier-7"], ["claim", "claim-a", 2]]);
});
