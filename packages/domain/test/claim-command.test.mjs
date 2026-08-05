import test from "node:test";
import assert from "node:assert/strict";
import { createClaim } from "../src/claim-command.mjs";

test("creates a hypothesis Claim, first revision, and event atomically", async () => {
  const calls = [];
  const repository = {
    withTransaction: (callback) => callback(repository),
    insertClaim: async (value) => { calls.push(["claim", value]); return value; },
    insertClaimRevision: async (value) => { calls.push(["revision", value]); return value; },
    appendResearchEvent: async (value) => { calls.push(["event", value]); return value; },
  };
  const result = await createClaim({
    repository, actorId: "actor-1", actorRole: "maintainer", claimId: "claim-1", questionId: "question-1",
    statement: "The intervention improves recovery.", scope: { population: "adults" }, assumptions: ["randomized"],
    falsification: { threshold: 0 },
    eventFactory: async ({ eventType, payload }) => ({ eventId: "event-16", eventType, payload }),
  });
  assert.deepEqual(calls.map(([kind]) => kind), ["claim", "revision", "event"]);
  assert.equal(result.claim.state, "hypothesis");
  assert.equal(result.revision.revision, 1);
  assert.equal(result.revision.statement, "The intervention improves recovery.");
  assert.equal(result.event.eventType, "claim.created");
});

test("rejects malformed Claim content before writing", async () => {
  let called = false;
  const repository = {
    withTransaction: () => { called = true; },
    insertClaim: async () => ({}), insertClaimRevision: async () => ({}), appendResearchEvent: async () => ({}),
  };
  await assert.rejects(
    createClaim({ repository, actorId: "actor-1", actorRole: "maintainer", claimId: "claim-1", statement: " ", scope: {}, falsification: {}, eventFactory: () => ({}) }),
    /claim statement must be a non-empty string/,
  );
  assert.equal(called, false);
});
