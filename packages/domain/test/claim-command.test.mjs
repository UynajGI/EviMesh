import test from "node:test";
import assert from "node:assert/strict";
import { createClaim, reviseClaim, transitionClaim } from "../src/claim-command.mjs";

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

test("keeps human ownership while atomically attributing an agent-authored draft", async () => {
  const calls = [];
  const repository = {
    withTransaction: (callback) => callback(repository),
    insertClaim: async (value) => { calls.push(["claim", value]); return value; },
    insertClaimRevision: async (value) => { calls.push(["revision", value]); return value; },
    appendResearchEvent: async (value) => { calls.push(["event", value]); return value; },
    insertContributionStatement: async (value) => { calls.push(["contribution", value]); return value; },
    insertContributionEdge: async (value) => { calls.push(["edge", value]); return value; },
  };
  const result = await createClaim({
    repository, actorId: "human-1", draftedByActorId: "agent-1", actorRole: "maintainer", claimId: "claim-1",
    statement: "The intervention improves recovery.", scope: { population: "adults" }, falsification: { threshold: 0 },
    eventFactory: async ({ eventType, payload }) => ({ eventId: "event-16", eventType, payload }),
  });
  assert.deepEqual(calls.map(([kind]) => kind), ["claim", "revision", "event", "contribution", "edge"]);
  assert.equal(result.claim.createdBy, "human-1");
  assert.equal(result.revision.createdBy, "human-1");
  assert.equal(result.event.payload.signer_actor_id, "human-1");
  assert.equal(result.event.payload.drafted_by_actor_id, "agent-1");
  assert.match(result.contribution.statementId, /^statement_[a-f0-9]{64}$/);
  assert.deepEqual({ ...result.contribution, statementId: "stable" }, {
    statementId: "stable", eventId: "event-16", actorId: "agent-1", role: "originator", description: "Drafted Claim claim-1@1",
  });
  assert.deepEqual(result.contributionEdge, {
    statementId: result.contribution.statementId, edgeType: "produced", objectType: "claim", objectId: "claim-1", objectRevision: 1,
  });
});

test("does not duplicate contribution attribution when drafter and signer match", async () => {
  const repository = {
    withTransaction: (callback) => callback(repository),
    insertClaim: async (value) => value,
    insertClaimRevision: async (value) => value,
    appendResearchEvent: async (value) => value,
  };
  const result = await createClaim({
    repository, actorId: "human-1", draftedByActorId: "human-1", actorRole: "maintainer", claimId: "claim-1",
    statement: "Statement", scope: [], falsification: [], eventFactory: async ({ eventType, payload }) => ({ eventId: "event-1", eventType, payload }),
  });
  assert.equal(result.contribution, undefined);
  assert.equal(result.claim.createdBy, "human-1");
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

test("appends a Claim revision and updates only the current projection", async () => {
  const calls = [];
  const current = {
    claimId: "claim-1", revision: 1, state: "hypothesis", questionId: "question-1",
    statement: "Old statement.", scope: { population: "adults" }, assumptions: ["randomized"], falsification: { threshold: 0 },
  };
  const repository = {
    withTransaction: (callback) => callback(repository),
    getCurrentClaimRevision: async () => current,
    insertClaimRevision: async (value) => { calls.push(["revision", value]); return value; },
    updateClaim: async (claimId, value) => { calls.push(["claim", claimId, value]); return { claimId, ...value }; },
    appendResearchEvent: async (value) => { calls.push(["event", value]); return value; },
  };
  const result = await reviseClaim({
    repository, actorId: "actor-2", actorRole: "maintainer", claimId: "claim-1", ifMatch: '"claim-rev-1"', currentEtag: '"claim-rev-1"',
    statement: "New statement.", eventFactory: async ({ eventType, payload }) => ({ eventId: "event-17", eventType, payload }),
  });
  assert.deepEqual(calls.map(([kind]) => kind), ["revision", "claim", "event"]);
  assert.equal(result.revision.revision, 2);
  assert.equal(result.revision.supersedes, 1);
  assert.equal(result.revision.scope.population, "adults");
  assert.equal(result.claim.state, "hypothesis");
  assert.equal(result.event.eventType, "claim.revised");
});

test("rejects a stale Claim revision before writing", async () => {
  let writes = 0;
  const repository = {
    withTransaction: (callback) => callback(repository),
    getCurrentClaimRevision: async () => ({ claimId: "claim-1", revision: 3, state: "candidate", statement: "Current", scope: {}, assumptions: [], falsification: {} }),
    insertClaimRevision: async () => { writes += 1; },
    updateClaim: async () => { writes += 1; },
    appendResearchEvent: async () => { writes += 1; },
  };
  await assert.rejects(
    reviseClaim({ repository, actorId: "actor-2", actorRole: "maintainer", claimId: "claim-1", ifMatch: '"claim-rev-2"', currentEtag: '"claim-rev-3"', eventFactory: () => ({}) }),
    (error) => error.code === "PRECONDITION_FAILED" && error.status === 412,
  );
  assert.equal(writes, 0);
});

test("transitions a Claim and records the from/to states", async () => {
  const calls = [];
  const current = { claimId: "claim-1", revision: 1, state: "hypothesis", questionId: null, statement: "Statement", scope: {}, assumptions: [], falsification: {} };
  const repository = {
    withTransaction: (callback) => callback(repository),
    getCurrentClaimRevision: async () => current,
    insertClaimRevision: async (value) => { calls.push(["revision", value]); return value; },
    updateClaim: async (claimId, value) => { calls.push(["claim", claimId, value]); return value; },
    appendResearchEvent: async (value) => { calls.push(["event", value]); return value; },
  };
  const result = await transitionClaim({
    repository, actorId: "actor-1", actorRole: "maintainer", claimId: "claim-1", toState: "candidate", ifMatch: 'W/"claim-1:1"', currentEtag: 'W/"claim-1:1"',
    eventFactory: ({ eventType, payload }) => ({ eventId: "event-21", eventType, payload }),
  });
  assert.deepEqual(calls.map(([kind]) => kind), ["revision", "claim", "event"]);
  assert.equal(result.revision.state, "candidate");
  assert.equal(result.revision.supersedes, 1);
  assert.equal(result.event.payload.from_state, "hypothesis");
});

test("rejects invalid Claim transitions before writing", async () => {
  let writes = 0;
  const repository = {
    withTransaction: (callback) => callback(repository),
    getCurrentClaimRevision: async () => ({ claimId: "claim-1", revision: 2, state: "accepted", statement: "Current", scope: {}, assumptions: [], falsification: {} }),
    insertClaimRevision: async () => { writes += 1; }, updateClaim: async () => { writes += 1; }, appendResearchEvent: async () => { writes += 1; },
  };
  await assert.rejects(
    transitionClaim({ repository, actorId: "actor-1", actorRole: "maintainer", claimId: "claim-1", toState: "candidate", ifMatch: 'W/"claim-1:2"', currentEtag: 'W/"claim-1:2"', eventFactory: () => ({}) }),
    (error) => error.code === "STATE_TRANSITION_INVALID" && error.status === 409,
  );
  assert.equal(writes, 0);
});
