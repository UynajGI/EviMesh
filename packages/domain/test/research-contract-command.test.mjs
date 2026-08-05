import test from "node:test";
import assert from "node:assert/strict";
import { reviseResearchContract } from "../src/research-contract-command.mjs";

const current = {
  contractId: "contract-1",
  revision: 1,
  problem: "Old problem",
  definitions: { term: "old" },
  background: "Old background",
  scope: ["old-scope"],
  exclusions: [],
  progressCriteria: ["criterion"],
  acceptableEvidence: ["evidence"],
  falsification: ["falsifier"],
  license: "CC-BY-4.0",
  riskLevel: "open",
  maintainerIds: ["actor-1"],
};

test("appends a contract revision and preserves prior content", async () => {
  const calls = [];
  const repository = {
    withTransaction: (callback) => callback(repository),
    getCurrentResearchContractRevision: async () => current,
    insertResearchContractRevision: async (value) => { calls.push(["revision", value]); return value; },
    appendResearchEvent: async (value) => { calls.push(["event", value]); return value; },
  };
  const result = await reviseResearchContract({
    repository,
    actorId: "actor-1",
    actorRole: "maintainer",
    contractId: "contract-1",
    ifMatch: 'W/"contract-1:1:abc"',
    currentEtag: 'W/"contract-1:1:abc"',
    patch: { problem: "New problem" },
    eventFactory: async ({ eventType, payload }) => ({ eventId: "event-5", eventType, payload }),
  });
  assert.deepEqual(calls.map(([kind]) => kind), ["revision", "event"]);
  assert.equal(result.revision.revision, 2);
  assert.equal(result.revision.supersedes, 1);
  assert.equal(result.revision.problem, "New problem");
  assert.deepEqual(result.revision.definitions, current.definitions);
  assert.equal(current.revision, 1);
});

test("rejects a stale contract If-Match before writing", async () => {
  const repository = {
    withTransaction: (callback) => callback(repository),
    getCurrentResearchContractRevision: async () => current,
    insertResearchContractRevision: async () => { throw new Error("must not write"); },
    appendResearchEvent: async () => { throw new Error("must not write"); },
  };
  await assert.rejects(
    reviseResearchContract({
      repository,
      actorId: "actor-1",
      actorRole: "maintainer",
      contractId: "contract-1",
      ifMatch: 'W/"contract-1:0:old"',
      currentEtag: 'W/"contract-1:1:abc"',
      eventFactory: () => ({}),
    }),
    (error) => error.code === "PRECONDITION_FAILED" && error.status === 412,
  );
});
