import test from "node:test";
import assert from "node:assert/strict";
import {
  ApiTokenError,
  assertApiTokenScopes,
  createActorApiToken,
  markApiTokenUsed,
  rotateActorApiToken,
  revokeActorApiToken,
} from "../src/api-token.mjs";

function createRepository() {
  const records = [];
  return {
    records,
    async withTransaction(callback) { return callback(this); },
    async insertApiToken(record) {
      records.push({ tokenId: "token_1", ...record });
      return records.at(-1);
    },
    async revokeOwnedAgentToken(actorId, tokenId) {
      const record = records.find((candidate) => candidate.tokenId === tokenId && candidate.actorId === actorId);
      if (!record || record.revokedAt) return null;
      record.revokedAt = "now";
      return record;
    },
    async rotateOwnedAgentToken(actorId, oldTokenId, newTokenId) {
      return { actorId, oldTokenId, newTokenId, rotatedAt: "now" };
    },
    async markApiTokenUsed(tokenId, usedAt) {
      const record = records.find((candidate) => candidate.tokenId === tokenId);
      if (!record) return null;
      record.lastUsedAt = usedAt;
      return record;
    },
  };
}

test("returns plaintext once while persisting only the digest", async () => {
  const repository = createRepository();
  const result = await createActorApiToken({
    repository,
    actorId: "actor_1",
    issuanceContext: "device_authorization",
    scopes: ["project:read", "project:read", "profile:read"],
    tokenFactory: () => `evimesh_${"A".repeat(43)}`,
    digestFactory: () => "B".repeat(43),
  });

  assert.equal(result.token, `evimesh_${"A".repeat(43)}`);
  assert.deepEqual(repository.records, [{
    tokenId: "token_1",
    actorId: "actor_1",
    tokenHash: "B".repeat(43),
    tokenPrefix: "evimesh_AAAAAAAA",
    scopes: ["profile:read", "project:read"],
    expiresAt: null,
  }]);
  assert.equal(JSON.stringify(repository.records).includes(result.token), false);
});

test("validates ownership input, scopes, and token factory output", async () => {
  const repository = createRepository();
  await assert.rejects(
    createActorApiToken({ repository, actorId: "actor_1", scopes: ["project:read"] }),
    (error) => error instanceof ApiTokenError && error.code === "API_TOKEN_DEVICE_AUTH_REQUIRED",
  );
  await assert.rejects(
    createActorApiToken({ repository, actorId: "actor_1", issuanceContext: "device_authorization", scopes: ["research:sign"] }),
    (error) => error instanceof ApiTokenError && error.code === "API_TOKEN_SCOPE_INVALID",
  );
  await assert.rejects(
    createActorApiToken({ repository, actorId: "actor_1", issuanceContext: "device_authorization", tokenFactory: () => "short" }),
    (error) => error instanceof ApiTokenError,
  );
});

test("requires every requested scope", () => {
  assert.equal(assertApiTokenScopes({ grantedScopes: ["project:read", "profile:read"], requiredScopes: ["project:read"] }), true);
  assert.throws(
    () => assertApiTokenScopes({ grantedScopes: ["project:read"], requiredScopes: ["profile:read"] }),
    (error) => error instanceof ApiTokenError && error.code === "API_TOKEN_SCOPE_FORBIDDEN",
  );
});

test("revokes only an owned token and records successful use", async () => {
  const repository = createRepository();
  await createActorApiToken({
    repository,
    actorId: "actor_1",
    issuanceContext: "device_authorization",
    tokenFactory: () => `evimesh_${"A".repeat(43)}`,
    digestFactory: () => "B".repeat(43),
  });
  const usedAt = new Date("2026-08-06T00:00:00.000Z");
  const used = await markApiTokenUsed({ repository, tokenId: "token_1", usedAt });
  assert.equal(used.lastUsedAt, usedAt);
  const revoked = await revokeActorApiToken({ repository, actorId: "actor_1", tokenId: "token_1", reason: "owner revoked" });
  assert.equal(revoked.revokedAt, "now");
  await assert.rejects(
    revokeActorApiToken({ repository, actorId: "actor_2", tokenId: "token_1", reason: "owner revoked" }),
    (error) => error instanceof ApiTokenError && error.code === "API_TOKEN_NOT_FOUND",
  );
});

test("rotates only between distinct Device-Authorization-issued token records", async () => {
  const repository = createRepository();
  const rotated = await rotateActorApiToken({
    repository,
    actorId: "actor_1",
    oldTokenId: "token_old",
    newTokenId: "token_new",
    reason: "scheduled rotation",
  });
  assert.equal(rotated.rotatedAt, "now");
  await assert.rejects(
    rotateActorApiToken({ repository, actorId: "actor_1", oldTokenId: "same", newTokenId: "same", reason: "x" }),
    /distinct/,
  );
});
