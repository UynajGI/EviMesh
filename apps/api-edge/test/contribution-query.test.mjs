import test from "node:test";
import assert from "node:assert/strict";
import { getContribution, listActors, ContributionQueryError } from "../src/contribution-query.mjs";

test("returns an Actor's roles and produced/used contribution edges", async () => {
  const calls = [];
  const repository = {
    async listContributionStatements(actorId) {
      calls.push(["statements", actorId]);
      return [
        { statementId: "statement-2", actorId, role: "reviewer", description: "Reviewed" },
        { statementId: "statement-1", actorId, role: "verifier", description: "Verified" },
      ];
    },
    async listContributionEdges(statementIds) {
      calls.push(["edges", statementIds]);
      return [
        { statementId: "statement-1", edgeType: "produced", objectType: "verification", objectId: "verification-1", objectRevision: 1 },
        { statementId: "statement-2", edgeType: "used", objectType: "claim", objectId: "claim-1", objectRevision: 2 },
      ];
    },
  };

  const result = await getContribution({ repository, actorId: " actor-1 " });

  assert.deepEqual(calls, [["statements", "actor-1"], ["edges", ["statement-2", "statement-1"]]]);
  assert.deepEqual(result.roles.map(({ role }) => role), ["reviewer", "verifier"]);
  assert.equal(result.roles[0].semantics, "reviewed scope, method, evidence, or presentation");
  assert.equal(result.produced[0].objectId, "verification-1");
  assert.equal(result.used[0].objectId, "claim-1");
});

test("hydrates produced Claim edges from immutable events even when the current Actor projection is unavailable", async () => {
  const calls = [];
  const repository = {
    async listContributionStatements() {
      return [
        { statementId: "statement-signed", eventId: "event-signed", role: "originator" },
        { statementId: "statement-missing", eventId: "event-missing", role: "originator" },
      ];
    },
    async listContributionEdges(statementIds) {
      calls.push(["edges", statementIds]);
      return [
        { statementId: "statement-signed", edgeType: "produced", objectType: "claim", objectId: "claim-signed", objectRevision: 1 },
        { statementId: "statement-missing", edgeType: "produced", objectType: "claim", objectId: "claim-missing", objectRevision: 1 },
      ];
    },
    async listResearchEventsByIds(eventIds) {
      calls.push(["events", eventIds]);
      return [{ eventId: "event-signed", eventType: "claim.created", payload: { claim_id: "claim-signed", revision: 1, signer_actor_id: "human-1" } }];
    },
    async getActor() { return null; },
  };
  const result = await getContribution({ repository, actorId: "agent-1" });
  assert.deepEqual(calls, [
    ["edges", ["statement-signed", "statement-missing"]],
    ["events", ["event-signed", "event-missing"]],
  ]);
  assert.equal(result.produced[0].signedBy, "human-1");
  assert.equal(result.produced[1].signedBy, null);
});

test("requires exact Claim creation evidence and a canonical event signer", async () => {
  const cases = [
    { suffix: "wrong-event", eventType: "claim.revised", claimId: "claim-wrong-event", revision: 1, signer: "human-1" },
    { suffix: "wrong-object", eventType: "claim.created", claimId: "another-claim", revision: 1, signer: "human-1" },
    { suffix: "wrong-revision", eventType: "claim.created", claimId: "claim-wrong-revision", revision: 2, signer: "human-1" },
    { suffix: "not-produced", edgeType: "used", eventType: "claim.created", claimId: "claim-not-produced", revision: 1, signer: "human-1" },
    { suffix: "empty-signer", eventType: "claim.created", claimId: "claim-empty-signer", revision: 1, signer: "" },
    { suffix: "noncanonical-signer", eventType: "claim.created", claimId: "claim-noncanonical-signer", revision: 1, signer: " human-1 " },
  ];
  const repository = {
    async listContributionStatements() {
      return cases.map(({ suffix }) => ({ statementId: `statement-${suffix}`, eventId: `event-${suffix}`, role: "originator" }));
    },
    async listContributionEdges() {
      return cases.map(({ suffix, edgeType = "produced" }) => ({
        statementId: `statement-${suffix}`, edgeType, objectType: "claim",
        objectId: `claim-${suffix}`, objectRevision: 1,
      }));
    },
    async listResearchEventsByIds() {
      return cases.map(({ suffix, eventType, claimId, revision, signer }) => ({
        eventId: `event-${suffix}`, eventType,
        payload: { claim_id: claimId, revision, signer_actor_id: signer },
      }));
    },
  };

  const result = await getContribution({ repository, actorId: "agent-1" });
  assert.deepEqual([...result.produced, ...result.used].map((edge) => edge.signedBy), cases.map(() => null));
});

test("returns a typed not-found error for an Actor without contribution statements", async () => {
  const repository = {
    async listContributionStatements() { return []; },
    async listContributionEdges() { throw new Error("must not load edges"); },
  };

  await assert.rejects(
    () => getContribution({ repository, actorId: "actor-missing" }),
    (error) => error instanceof ContributionQueryError && error.code === "CONTRIBUTION_NOT_FOUND" && error.status === 404,
  );
});

test("includes the identity card and profile when the repository exposes actor rows", async () => {
  const latestEventCalls = [];
  const repository = {
    async listContributionStatements() { return [{ statementId: "statement-1", role: "verifier", description: "verified", createdAt: "2026-08-01T00:00:00Z" }]; },
    async listContributionEdges() { return []; },
    async getActor(actorId) {
      return { actorId, actorType: "agent", identityStrength: "self_declared", modelName: "self_declared:glm-4.7", runtime: "oci:repro-env:2026.07", scope: "read · draft", publicKeyFingerprint: "ed25519:9f3a…21c8", ownerActorId: "human-1", createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-03T00:00:00Z" };
    },
    async getActorProfile() { return { displayName: "atlas-07", bio: null, avatarUrl: null }; },
    async getLatestResearchEventForActor(actorId) {
      latestEventCalls.push(actorId);
      return { eventId: "event-2", createdAt: "2026-08-04T00:00:00Z" };
    },
  };

  const result = await getContribution({ repository, actorId: "agent-1" });

  assert.equal(result.actor.actorType, "agent");
  assert.equal(result.actor.identityStrength, "self_declared");
  assert.equal(result.actor.modelName, "self_declared:glm-4.7");
  assert.equal(result.actor.runtime, "oci:repro-env:2026.07");
  assert.equal(result.actor.publicKeyFingerprint, "ed25519:9f3a…21c8");
  assert.equal(result.actor.ownerActorId, "human-1");
  assert.equal(result.actor.displayName, "atlas-07");
  assert.equal(result.actor.updatedAt, "2026-08-03T00:00:00Z");
  assert.equal(result.lastEventAt, "2026-08-04T00:00:00Z");
  assert.equal(result.lastEventId, "event-2");
  assert.deepEqual(latestEventCalls, ["agent-1"]);
});

test("an actor row without statements is readable; missing both stays 404", async () => {
  const withRowOnly = {
    async listContributionStatements() { return []; },
    async listContributionEdges() { return []; },
    async getActor(actorId) { return { actorId, actorType: "human", identityStrength: "observed" }; },
    getActorProfile: undefined,
  };
  const result = await getContribution({ repository: withRowOnly, actorId: "human-1" });
  assert.equal(result.actor.actorId, "human-1");
  assert.deepEqual(result.roles, []);

  const withoutEither = {
    async listContributionStatements() { return []; },
    async listContributionEdges() { return []; },
    async getActor() { return null; },
  };
  await assert.rejects(
    () => getContribution({ repository: withoutEither, actorId: "ghost" }),
    (error) => error.code === "CONTRIBUTION_NOT_FOUND" && error.status === 404,
  );
});

test("listActors returns a bounded, identity-card-shaped directory", async () => {
  const repository = {
    async listActors() {
      return [
        { actorId: "agent-1", actorType: "agent", identityStrength: "self_declared", modelName: "self_declared:glm-4.7", createdAt: "2026-08-02T00:00:00Z" },
        { actorId: "human-1", actorType: "human", identityStrength: "verified", createdAt: "2026-08-01T00:00:00Z" },
      ];
    },
  };

  const result = await listActors({ repository, limit: 1 });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].actorId, "agent-1");
  assert.equal(result.items[0].modelName, "self_declared:glm-4.7");
  assert.equal(result.items[0].actorType, "agent");

  await assert.rejects(
    () => listActors({ repository: {} }),
    (error) => error.code === "CONTRIBUTION_QUERY_INVALID",
  );
});
