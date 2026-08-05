import test from "node:test";
import assert from "node:assert/strict";
import { createClaimRelation, endClaimRelation, replaceClaimRelation } from "../src/claim-relation-command.mjs";

test("creates a ClaimRelation and event atomically", async () => {
  const calls = [];
  const repository = {
    withTransaction: (callback) => callback(repository),
    listClaimRelations: async () => [],
    insertClaimRelation: async (value) => { calls.push(["relation", value]); return value; },
    appendResearchEvent: async (value) => { calls.push(["event", value]); return value; },
  };
  const result = await createClaimRelation({
    repository, actorId: "actor-1", actorRole: "maintainer", sourceClaimId: "claim-1", targetClaimId: "claim-2", relationType: "supports",
    eventFactory: ({ eventType, payload }) => ({ eventId: "event-18", eventType, payload }),
  });
  assert.deepEqual(calls.map(([kind]) => kind), ["relation", "event"]);
  assert.equal(result.relation.relationType, "supports");
  assert.equal(result.event.eventType, "claim.relation_created");
});

test("rejects duplicate and cyclic depends_on relations before writing", async () => {
  let writes = 0;
  const repository = {
    withTransaction: (callback) => callback(repository),
    listClaimRelations: async () => [
      { sourceClaimId: "claim-1", targetClaimId: "claim-2", relationType: "depends_on" },
      { sourceClaimId: "claim-2", targetClaimId: "claim-3", relationType: "depends_on" },
    ],
    insertClaimRelation: async () => { writes += 1; },
    appendResearchEvent: async () => { writes += 1; },
  };
  await assert.rejects(
    createClaimRelation({ repository, actorId: "actor-1", actorRole: "maintainer", sourceClaimId: "claim-1", targetClaimId: "claim-2", relationType: "depends_on", eventFactory: () => ({}) }),
    (error) => error.code === "RELATION_EXISTS" && error.status === 409,
  );
  await assert.rejects(
    createClaimRelation({ repository, actorId: "actor-1", actorRole: "maintainer", sourceClaimId: "claim-3", targetClaimId: "claim-1", relationType: "depends_on", eventFactory: () => ({}) }),
    (error) => error.code === "DEPENDENCY_CYCLE" && error.status === 409,
  );
  assert.equal(writes, 0);
});

test("ends a relation by timestamping the historical row and writing an event", async () => {
  const calls = [];
  const repository = {
    withTransaction: (callback) => callback(repository),
    listClaimRelations: async () => [{ sourceClaimId: "claim-1", targetClaimId: "claim-2", relationType: "supports" }],
    updateClaimRelation: async (...args) => { calls.push(["update", ...args]); return { ...args[3] }; },
    appendResearchEvent: async (value) => { calls.push(["event", value]); return value; },
  };
  const result = await endClaimRelation({
    repository, actorId: "actor-1", actorRole: "maintainer", sourceClaimId: "claim-1", targetClaimId: "claim-2", relationType: "supports",
    now: "2026-08-06T12:00:00.000Z", eventFactory: ({ eventType, payload }) => ({ eventId: "event-19", eventType, payload }),
  });
  assert.equal(calls[0][0], "update");
  assert.equal(calls[0][4].deletedAt, "2026-08-06T12:00:00.000Z");
  assert.equal(result.event.eventType, "claim.relation_ended");
});

test("replaces a relation without deleting its historical row", async () => {
  const calls = [];
  const repository = {
    withTransaction: (callback) => callback(repository),
    listClaimRelations: async () => [{ sourceClaimId: "claim-1", targetClaimId: "claim-2", relationType: "supports" }],
    updateClaimRelation: async (...args) => { calls.push(["update", ...args]); return args[3]; },
    insertClaimRelation: async (value) => { calls.push(["insert", value]); return value; },
    appendResearchEvent: async (value) => { calls.push(["event", value]); return value; },
  };
  const result = await replaceClaimRelation({
    repository, actorId: "actor-1", actorRole: "maintainer", sourceClaimId: "claim-1", targetClaimId: "claim-2", relationType: "supports",
    replacement: { sourceClaimId: "claim-1", targetClaimId: "claim-2", relationType: "qualifies" }, eventFactory: ({ eventType, payload }) => ({ eventId: "event-20", eventType, payload }),
  });
  assert.deepEqual(calls.map(([kind]) => kind), ["update", "insert", "event"]);
  assert.equal(result.replacement.relationType, "qualifies");
  assert.equal(result.event.eventType, "claim.relation_replaced");
});
