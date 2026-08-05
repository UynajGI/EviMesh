import test from "node:test";
import assert from "node:assert/strict";
import { createChallenge } from "../src/challenge-command.mjs";

test("creates a Challenge locked to an existing Claim revision", async () => {
  const calls = [];
  const repository = {
    withTransaction: (callback) => callback(repository),
    getClaimRevision: async (claimId, revision) => ({ claimId, revision, statement: "Target" }),
    insertChallenge: async (value) => { calls.push(["challenge", value]); return value; },
    insertChallengeRevision: async (value) => { calls.push(["revision", value]); return value; },
    appendResearchEvent: async (value) => { calls.push(["event", value]); return value; },
  };
  const result = await createChallenge({
    repository, actorId: "actor-1", actorRole: "contributor", challengeId: "challenge-1", targetClaimId: "claim-1", targetClaimRevision: 2,
    reason: "The result may not reproduce.", impact: { type: "reproducibility", severity: "major", summary: "Independent replication differs." },
    proposedResolution: "Run an independent replication.", eventFactory: ({ eventType, payload }) => ({ eventId: "event-22", eventType, payload }),
  });
  assert.deepEqual(calls.map(([kind]) => kind), ["challenge", "revision", "event"]);
  assert.equal(result.revision.state, "open");
  assert.equal(result.revision.targetClaimRevision, 2);
  assert.equal(result.targetRevision.statement, "Target");
  assert.equal(result.event.eventType, "challenge.created");
});

test("rejects a Challenge whose target revision does not exist before writing", async () => {
  let writes = 0;
  const repository = {
    withTransaction: (callback) => callback(repository),
    getClaimRevision: async () => null,
    insertChallenge: async () => { writes += 1; }, insertChallengeRevision: async () => { writes += 1; }, appendResearchEvent: async () => { writes += 1; },
  };
  await assert.rejects(
    createChallenge({ repository, actorId: "actor-1", actorRole: "contributor", challengeId: "challenge-1", targetClaimId: "claim-1", targetClaimRevision: 3, reason: "Reason", impact: {}, eventFactory: () => ({}) }),
    (error) => error.code === "TARGET_CLAIM_REVISION_NOT_FOUND" && error.status === 404,
  );
  assert.equal(writes, 0);
});
