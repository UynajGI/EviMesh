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
  const repository = {
    async listContributionStatements() { return [{ statementId: "statement-1", role: "verifier", description: "verified", createdAt: "2026-08-01T00:00:00Z" }]; },
    async listContributionEdges() { return []; },
    async getActor(actorId) {
      return { actorId, actorType: "agent", identityStrength: "self_declared", modelName: "self_declared:glm-4.7", runtime: "oci:repro-env:2026.07", scope: "read · draft", publicKeyFingerprint: "ed25519:9f3a…21c8", ownerActorId: "human-1", createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-03T00:00:00Z" };
    },
    async getActorProfile() { return { displayName: "atlas-07", bio: null, avatarUrl: null }; },
    async listResearchEvents() {
      return [
        { eventId: "event-1", createdAt: "2026-08-02T00:00:00Z" },
        { eventId: "event-2", createdAt: "2026-08-04T00:00:00Z" },
      ];
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
